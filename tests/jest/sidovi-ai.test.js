const {
  responder,
  normalizar,
  detectarTema,
  detectarTiempo,
  detectarEstadoPostulacion,
  extraerNombre
} = require('../../server/sidovi-ai');

/** Base de datos falsa: registra las consultas y devuelve datos fijos. */
function crearDbFalsa() {
  const consultas = [];
  return {
    consultas,
    query: async (sql, params = []) => {
      consultas.push({ sql, params });
      if (/FROM sede WHERE activa/.test(sql)) {
        return { rows: [{ id_sede: 1, nombre_sede: 'Tunja' }, { id_sede: 2, nombre_sede: 'Bogotá' }] };
      }
      if (/entrevistas_hoy/.test(sql)) {
        return { rows: [{ revision: 9, entrevistas_hoy: 1, entrevistas_proximas: 3, examenes_verificar: 1, examenes_proximos: 1, contratos_pendientes: 0, mis_entrevistas: 2 }] };
      }
      if (/GROUP BY p\.estado/.test(sql)) {
        return { rows: [{ estado: 'EN_REVISION', n: 9 }, { estado: 'CONTRATADO', n: 2 }] };
      }
      if (/COUNT\(\*\)::int AS n/.test(sql)) return { rows: [{ n: 9 }] };
      return { rows: [] };
    }
  };
}

describe('SIDOVI AI - interpretación de preguntas', () => {
  test('normaliza tildes, signos y mayúsculas', () => {
    expect(normalizar('¿Cuántas POSTULACIONES hay?')).toBe('cuantas postulaciones hay');
  });

  test('el tema específico gana sobre el genérico (antes ganaba el primer if)', () => {
    expect(detectarTema(normalizar('¿Cuántas postulaciones están en revisión?'))).toBe('postulaciones');
    expect(detectarTema(normalizar('exámenes pendientes de postulaciones'))).toBe('examenes');
    expect(detectarTema(normalizar('¿Qué entrevistas tengo hoy?'))).toBe('entrevistas');
    expect(detectarTema(normalizar('¿Qué tengo pendiente?'))).toBe('pendientes');
  });

  test('"postulantes" y "candidatos" se reconocen como postulaciones', () => {
    expect(detectarTema(normalizar('cuántos postulantes hay'))).toBe('postulaciones');
    expect(detectarTema(normalizar('lista de candidatos'))).toBe('postulaciones');
  });

  test('no confunde palabras que solo contienen la clave ("confirmar" no es "firma")', () => {
    expect(detectarTema(normalizar('necesito confirmar algo'))).toBeNull();
  });

  test('detecta el tiempo', () => {
    expect(detectarTiempo('entrevistas hoy')).toBe('hoy');
    expect(detectarTiempo('entrevistas manana')).toBe('manana');
    expect(detectarTiempo('entrevistas esta semana')).toBe('semana');
    expect(detectarTiempo('entrevistas')).toBeNull();
  });

  test('detecta el estado de la postulación', () => {
    expect(detectarEstadoPostulacion('postulaciones en revision').estados).toEqual(['EN_REVISION']);
    expect(detectarEstadoPostulacion('postulaciones rechazadas').estados).toEqual(['RECHAZADO_RRHH', 'RECHAZADO']);
    expect(detectarEstadoPostulacion('cuantas postulaciones hay')).toBeNull();
  });

  test('extrae el nombre de un candidato y descarta temas', () => {
    expect(extraerNombre('estado de juan perez')).toEqual(['juan', 'perez']);
    expect(extraerNombre('como va rosa florez')).toEqual(['rosa', 'florez']);
    expect(extraerNombre('estado de las postulaciones')).toBeNull();
    expect(extraerNombre('como va el proceso')).toBeNull();
  });
});

describe('SIDOVI AI - respuestas', () => {
  test('"en revisión" filtra por EN_REVISION (no devuelve las de los últimos 7 días)', async () => {
    const db = crearDbFalsa();
    const r = await responder(db, { pregunta: '¿Cuántas postulaciones están en revisión?', rol: 'RRHH' });
    const consulta = db.consultas.find((c) => /FROM postulacion p/.test(c.sql));
    expect(consulta.params).toContainEqual(['EN_REVISION']);
    expect(consulta.sql).not.toMatch(/fecha_postulacion >=/);
    expect(r.respuesta).toMatch(/9 postulaciones en revisión/);
  });

  test('filtra por la sede mencionada usando parámetros', async () => {
    const db = crearDbFalsa();
    await responder(db, { pregunta: 'postulaciones en Tunja', rol: 'RRHH' });
    const consulta = db.consultas.find((c) => /FROM postulacion p/.test(c.sql));
    expect(consulta.sql).toMatch(/v\.id_sede = \$1/);
    expect(consulta.params[0]).toBe(1);
  });

  test('nunca mete texto del usuario dentro del SQL (inyección)', async () => {
    const db = crearDbFalsa();
    await responder(db, { pregunta: "estado de x'; DROP TABLE postulacion;--", rol: 'RRHH' });
    await responder(db, { pregunta: "estado de maria'; DROP TABLE aspirante;--", rol: 'Gerente' });
    db.consultas.forEach((c) => expect(c.sql).not.toMatch(/DROP/i));
  });

  test('el enlace sugerido depende del rol', async () => {
    const rrhh = await responder(crearDbFalsa(), { pregunta: 'entrevistas hoy', rol: 'RRHH' });
    const gerente = await responder(crearDbFalsa(), { pregunta: 'entrevistas hoy', rol: 'Gerente' });
    expect(rrhh.enlaces.map((e) => e.url)).toContain('agenda.html');
    expect(rrhh.enlaces.map((e) => e.url)).not.toContain('evaluar.html');
    expect(gerente.enlaces.map((e) => e.url)).toContain('evaluar.html');
    expect(gerente.enlaces.map((e) => e.url)).not.toContain('agenda.html');
  });

  test('saluda con el primer nombre y no consulta la base', async () => {
    const db = crearDbFalsa();
    const r = await responder(db, { pregunta: 'hola', rol: 'RRHH', nombre: 'Laura Gómez' });
    expect(r.respuesta).toMatch(/Hola, Laura/);
    expect(db.consultas).toHaveLength(0);
  });

  test('"hola, ¿qué tengo pendiente?" es una pregunta, no solo un saludo', async () => {
    const r = await responder(crearDbFalsa(), { pregunta: 'hola, ¿qué tengo pendiente?', rol: 'Gerente', usuarioId: 1 });
    expect(r.respuesta).not.toMatch(/Soy el asistente/);
  });

  test('responde preguntas sobre el funcionamiento sin consultar datos', async () => {
    const db = crearDbFalsa();
    const r = await responder(db, { pregunta: '¿Cómo funciona el proceso?', rol: 'RRHH' });
    expect(r.respuesta).toMatch(/Se postula a una vacante/);
    expect(db.consultas.filter((c) => /FROM postulacion/.test(c.sql))).toHaveLength(0);
  });

  test('pregunta desconocida: da ayuda y sugerencias; usa el respaldo (IA) si existe', async () => {
    const sin = await responder(crearDbFalsa(), { pregunta: 'cuéntame un chiste', rol: 'RRHH' });
    expect(sin.respuesta).toMatch(/No estoy seguro/);
    expect(sin.sugerencias.length).toBeGreaterThan(0);

    const fallback = jest.fn().mockResolvedValue('respuesta del modelo');
    const con = await responder(crearDbFalsa(), { pregunta: 'cuéntame un chiste', rol: 'RRHH' }, { fallback });
    expect(fallback).toHaveBeenCalled();
    expect(con.respuesta).toBe('respuesta del modelo');
  });

  test('devuelve siempre respuesta, enlaces y sugerencias', async () => {
    const r = await responder(crearDbFalsa(), { pregunta: '¿Cuántas postulaciones hay?', rol: 'RRHH' });
    expect(typeof r.respuesta).toBe('string');
    expect(Array.isArray(r.enlaces)).toBe(true);
    expect(Array.isArray(r.sugerencias)).toBe(true);
  });
});
