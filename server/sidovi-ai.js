'use strict';

/**
 * SIDOVI AI - motor de respuestas (solo lectura).
 *
 * Interpreta preguntas en español, detecta el TEMA (postulaciones, entrevistas,
 * exámenes, contratos, vacantes, sedes...), el TIEMPO (hoy, mañana, semana, mes),
 * la SEDE y el ESTADO por el que se pregunta, y responde con consultas SELECT
 * parametrizadas.
 *
 * Diseño:
 *  - Cada tema puntúa por palabras clave; gana el de mayor puntaje (ya no gana
 *    "el primer if que coincida").
 *  - Nunca se concatena texto del usuario en SQL: todo va por parámetros.
 *  - `opciones.fallback` permite conectar más adelante un modelo de IA para
 *    preguntas que las reglas no entienden.
 *
 * Devuelve: { respuesta: string, enlaces: [{texto, url}], sugerencias: [string] }
 */

const TZ = 'America/Bogota';
const HOY = `(NOW() AT TIME ZONE '${TZ}')::date`;
const AHORA = `(NOW() AT TIME ZONE '${TZ}')`;
const MAX_LISTA = 6;

const ESTADOS = {
  EN_REVISION: 'En revisión',
  APROBADO_RRHH: 'Hoja de vida aprobada',
  HOJA_VIDA_APROBADA: 'Hoja de vida aprobada',
  RECHAZADO_RRHH: 'Rechazado por RRHH',
  ENTREVISTA: 'Entrevista',
  ENTREVISTA_PENDIENTE: 'Entrevista pendiente',
  ENTREVISTA_AGENDADA: 'Entrevista agendada',
  APROBADO: 'Entrevista aprobada',
  RECHAZADO: 'Rechazado',
  EXAMENES_PENDIENTES: 'Exámenes pendientes',
  EXAMENES_AGENDADOS: 'Exámenes agendados',
  EXAMENES_PROGRAMADOS: 'Exámenes agendados',
  EXAMENES_EN_REVISION: 'Exámenes en revisión',
  EXAMENES_APROBADOS: 'Exámenes aprobados',
  PENDIENTE_CONTRATO: 'Pendiente de contrato',
  FIRMA_CONTRATO_AGENDADA: 'Firma de contrato agendada',
  CONTRATADO: 'Contratado',
  CANCELADO: 'Cancelado',
};

const etiquetaEstado = (estado) =>
  ESTADOS[String(estado || '').trim().toUpperCase()] ||
  String(estado || '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

/* ------------------------------ utilidades ------------------------------ */

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function formatoFechaHora(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const fecha = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${fecha}, ${hora}`;
}

function formatoFecha(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ------------------------------ interpretación -------------------------- */

// Palabras (por prefijo) que identifican cada tema. `peso` desempata:
// los temas específicos ganan sobre los genéricos.
const TEMAS = [
  { id: 'entrevistas', peso: 2, claves: ['entrevista'] },
  { id: 'examenes', peso: 2, claves: ['examen', 'medico', 'psicotecnic'] },
  { id: 'contratos', peso: 2, claves: ['contrato', 'firma', 'firmar', 'contratad'] },
  { id: 'vacantes', peso: 2, claves: ['vacante', 'oferta', 'cargo'] },
  { id: 'sedes', peso: 2, claves: ['sede', 'sucursal', 'ciudad'] },
  { id: 'postulaciones', peso: 1, claves: ['postulacion', 'postulant', 'aspirante', 'candidato', 'solicitud', 'hoja de vida', 'hojas de vida'] },
  { id: 'pendientes', peso: 0.5, claves: ['pendiente', 'por hacer', 'tareas', 'resumen', 'que tengo', 'que debo', 'prioridad', 'urgente'] },
  { id: 'procesos', peso: 0.5, claves: ['programado', 'agendado', 'proceso'] },
];

function detectarTema(q) {
  let mejor = null;
  for (const tema of TEMAS) {
    const aciertos = tema.claves.filter((c) => new RegExp(`\\b${c}`).test(q)).length;
    if (!aciertos) continue;
    const puntaje = aciertos + tema.peso;
    if (!mejor || puntaje > mejor.puntaje) mejor = { id: tema.id, puntaje };
  }
  return mejor ? mejor.id : null;
}

function detectarTiempo(q) {
  if (/\bhoy\b/.test(q)) return 'hoy';
  if (/\bmanana\b/.test(q)) return 'manana';
  if (/\b(semana|7 dias|siete dias)\b/.test(q)) return 'semana';
  if (/\b(mes|30 dias|treinta dias)\b/.test(q)) return 'mes';
  return null;
}

/** Fragmento SQL (sin datos del usuario) para filtrar una columna FECHA hacia adelante. */
function rangoFuturo(col, tiempo) {
  switch (tiempo) {
    case 'hoy': return `${col}::date = ${HOY}`;
    case 'manana': return `${col}::date = ${HOY} + 1`;
    case 'semana': return `${col}::date >= ${HOY} AND ${col}::date < ${HOY} + 7`;
    case 'mes': return `${col}::date >= ${HOY} AND ${col}::date < ${HOY} + 30`;
    default: return null;
  }
}

/** Fragmento SQL para filtrar una columna FECHA hacia atrás ("nuevas", "de la semana"). */
function rangoPasado(col, tiempo) {
  switch (tiempo) {
    case 'hoy': return `${col} = ${HOY}`;
    case 'manana': return null;
    case 'semana': return `${col} >= ${HOY} - 7`;
    case 'mes': return `${col} >= ${HOY} - 30`;
    default: return null;
  }
}

const TEXTO_TIEMPO = { hoy: 'hoy', manana: 'mañana', semana: 'en los próximos 7 días', mes: 'en los próximos 30 días' };
const TEXTO_TIEMPO_PASADO = { hoy: 'hoy', semana: 'en los últimos 7 días', mes: 'en los últimos 30 días' };

function detectarEstadoPostulacion(q) {
  if (/(hoja de vida|hojas de vida).*(aprobad)|preseleccion|preseleccionad/.test(q)) return { estados: ['APROBADO_RRHH', 'HOJA_VIDA_APROBADA'], etiqueta: 'con hoja de vida aprobada' };
  if (/revision|revisar|por revisar|en proceso|sin revisar/.test(q)) return { estados: ['EN_REVISION'], etiqueta: 'en revisión' };
  if (/contratad/.test(q)) return { estados: ['CONTRATADO'], etiqueta: 'contratadas' };
  if (/rechazad|descartad/.test(q)) return { estados: ['RECHAZADO_RRHH', 'RECHAZADO'], etiqueta: 'rechazadas' };
  if (/aprobad/.test(q)) return { estados: ['APROBADO_RRHH', 'HOJA_VIDA_APROBADA', 'APROBADO'], etiqueta: 'aprobadas' };
  return null;
}

const quiereLista = (q) => /\b(quien|quienes|cual|cuales|lista|listame|nombres?|detalle|muestrame|dime|ver|mostrar)\b/.test(q);
const quiereMios = (q) => /\b(mis|mi agenda|mias|mios)\b/.test(q);

/* ------------------------------ enlaces por rol ------------------------- */

function enlacesPara(rol, ...claves) {
  const esGerente = rol === 'Gerente';
  const mapa = {
    postulantes: { texto: 'Ver postulantes', url: esGerente ? 'evaluar.html' : 'postulantes.html' },
    hojas: { texto: 'Revisar hojas de vida', url: 'hojasdevida.html' },
    agenda: { texto: 'Abrir agenda', url: esGerente ? 'gerente.html' : 'agenda.html' },
    evaluar: { texto: 'Evaluar candidatos', url: 'evaluar.html' },
    examenes: { texto: 'Ir a exámenes', url: 'examenes.html' },
    contratos: { texto: 'Ir a contratos', url: 'contrato.html' },
    reportes: { texto: 'Ver reportes', url: 'reporte.html' },
    cargos: { texto: 'Gestionar cargos', url: 'cargos.html' },
    perfil: { texto: 'Mi perfil', url: 'mi-perfil.html' },
    dashboard: { texto: 'Ir al inicio', url: esGerente ? 'gerente.html' : 'RRHH.html' },
  };
  // RRHH no entra a evaluar.html y Gerente no entra a RRHH.html/cargos.html (ver protectedPages).
  return claves
    .map((c) => mapa[c])
    .filter(Boolean)
    .filter((e) => !(esGerente && ['cargos.html', 'postulantes.html', 'hojasdevida.html', 'agenda.html', 'RRHH.html'].includes(e.url)))
    .filter((e) => !(!esGerente && ['evaluar.html', 'gerente.html'].includes(e.url)));
}

function sugerenciasPara(rol) {
  return rol === 'Gerente'
    ? ['¿Qué entrevistas tengo hoy?', '¿Qué tengo pendiente?', '¿Qué contratos están pendientes?', '¿Cómo funciona el proceso?']
    : ['¿Qué tengo pendiente?', '¿Cuántas postulaciones están en revisión?', '¿Qué exámenes hay por verificar?', '¿Cómo funciona el proceso?'];
}

/* ------------------------------ base de conocimiento -------------------- */

// Respuestas fijas sobre cómo funciona SIDOVI (no consultan la base de datos).
const CONOCIMIENTO = [
  {
    patron: /flujo|proceso de seleccion|etapas|como funciona|paso a paso|pasos|que hace sidovi|para que sirve/,
    respuesta:
      'Así avanza un candidato en SIDOVI:\n' +
      '1. Se postula a una vacante y queda En revisión.\n' +
      '2. RRHH revisa la hoja de vida y la aprueba o la rechaza.\n' +
      '3. Se agenda la entrevista y Gerencia la evalúa.\n' +
      '4. Si la entrevista se aprueba, se programan los exámenes.\n' +
      '5. Se cargan los resultados y RRHH los verifica.\n' +
      '6. Se agenda la firma y se genera el contrato; el candidato queda Contratado.',
    enlaces: ['dashboard'],
  },
  {
    patron: /que significa|significado|que quiere decir|estados|que es .*(estado)/,
    respuesta:
      'Estados principales de una postulación:\n' +
      '• En revisión: RRHH aún no revisa la hoja de vida.\n' +
      '• Hoja de vida aprobada: pasa a entrevista.\n' +
      '• Entrevista / Entrevista agendada: espera o tiene fecha de entrevista.\n' +
      '• Exámenes pendientes / agendados / en revisión: etapa de exámenes y verificación.\n' +
      '• Pendiente de contrato / Firma agendada: listo para contratar.\n' +
      '• Contratado: proceso terminado.\n' +
      '• Rechazado: salió del proceso en alguna etapa.',
    enlaces: [],
  },
  {
    patron: /reporte|informe|pdf|exportar|descargar|historial/,
    respuesta:
      'En Reportes puedes filtrar por fechas, ver el historial completo de cada aspirante y generar el reporte en PDF.',
    enlaces: ['reportes'],
  },
  {
    patron: /(crear|agregar|nuevo|editar|desactivar|activar|modificar).*(cargo|vacante)|como .*(cargo)/,
    respuesta:
      'Los cargos se crean, editan y desactivan desde la sección Cargos (solo RRHH); cada cargo queda asociado a una sede.',
    enlaces: ['cargos'],
  },
  {
    patron: /contrasena|clave|password|foto de perfil|mi perfil|perfil/,
    respuesta:
      'En Mi perfil puedes ver y actualizar tus datos y cambiar tu contraseña.',
    enlaces: ['perfil'],
  },
  {
    patron: /que puedes hacer|ayuda|en que me ayudas|que sabes|como te uso|comandos|opciones/,
    respuesta:
      'Puedo decirte cuántas postulaciones hay (por estado, sede o fecha), qué entrevistas, exámenes y firmas de contrato hay programados, ' +
      'qué tienes pendiente, cuántas vacantes están abiertas, buscar el estado de un candidato por su nombre ' +
      '("estado de Juan Pérez") y explicarte cómo funciona el proceso. Solo leo información; no modifico nada.',
    enlaces: [],
  },
];

/* ------------------------------ consultas ------------------------------- */

async function hPostulaciones({ db, q, sede, tiempo, rol }) {
  const params = [];
  const where = [];
  const join = 'JOIN vacante v ON v.id_vacante = p.id_vacante LEFT JOIN sede s ON s.id_sede = v.id_sede JOIN aspirante a ON a.id_aspirante = p.id_aspirante';

  if (sede) { params.push(sede.id); where.push(`v.id_sede = $${params.length}`); }

  const detectado = detectarEstadoPostulacion(q);
  const estados = detectado ? detectado.estados : null;
  if (estados) { params.push(estados); where.push(`UPPER(TRIM(p.estado)) = ANY($${params.length}::text[])`); }

  const esNuevas = /nueva|nuevo|reciente|ultima|ultimo/.test(q);
  const tiempoEfectivo = tiempo || (esNuevas ? 'semana' : null);
  const rangoSql = tiempoEfectivo ? rangoPasado('p.fecha_postulacion', tiempoEfectivo) : null;
  if (rangoSql) where.push(rangoSql);

  const filtro = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sufijoSede = sede ? ` en ${sede.nombre}` : '';
  const sufijoTiempo = rangoSql ? ` ${TEXTO_TIEMPO_PASADO[tiempoEfectivo]}` : '';

  const total = (await db.query(`SELECT COUNT(*)::int AS n FROM postulacion p ${join} ${filtro}`, params)).rows[0].n;

  let texto;
  if (estados || rangoSql) {
    const adjetivo = estados ? detectado.etiqueta : 'nuevas';
    texto = total === 0
      ? `No hay postulaciones ${adjetivo}${sufijoSede}${sufijoTiempo}.`
      : `Hay ${plural(total, 'postulación', 'postulaciones')} ${adjetivo}${sufijoSede}${sufijoTiempo}.`;
  } else {
    const filas = (await db.query(
      `SELECT p.estado, COUNT(*)::int AS n FROM postulacion p ${join} ${filtro} GROUP BY p.estado ORDER BY n DESC`,
      params
    )).rows;
    texto = total === 0
      ? `Todavía no hay postulaciones${sufijoSede}.`
      : `Hay ${plural(total, 'postulación', 'postulaciones')}${sufijoSede} en total:\n` +
        filas.map((f) => `• ${etiquetaEstado(f.estado)}: ${f.n}`).join('\n');
  }

  if (total > 0 && quiereLista(q)) {
    const lista = (await db.query(
      `SELECT a.nombre_completo, COALESCE(NULLIF(v.nombre_cargo, ''), v.titulo) AS cargo,
              s.nombre_sede, p.estado, p.fecha_postulacion
         FROM postulacion p ${join} ${filtro}
        ORDER BY p.fecha_postulacion DESC, p.id_postulacion DESC
        LIMIT ${MAX_LISTA}`,
      params
    )).rows;
    texto += `\n\nLas más recientes:\n` + lista.map((f) =>
      `• ${f.nombre_completo} — ${f.cargo}${f.nombre_sede ? ` (${f.nombre_sede})` : ''} · ${etiquetaEstado(f.estado)}`
    ).join('\n');
  }

  return {
    respuesta: texto,
    enlaces: enlacesPara(rol, 'postulantes', 'hojas'),
    sugerencias: ['¿Cuántas están en revisión?', 'Postulaciones de esta semana', '¿Cómo funciona el proceso?'],
  };
}

async function hEntrevistas({ db, q, sede, tiempo, rol, usuarioId }) {
  const params = [];
  const where = [];
  const from = `
    FROM entrevista e
    LEFT JOIN aspirantes_seleccionados sel ON sel.id_seleccionado = e.id_seleccionado
    LEFT JOIN postulacion p ON p.id_postulacion = COALESCE(e.id_postulacion, sel.id_postulacion)
    LEFT JOIN aspirante a ON a.id_aspirante = p.id_aspirante
    LEFT JOIN vacante v ON v.id_vacante = p.id_vacante
    LEFT JOIN sede s ON s.id_sede = v.id_sede`;

  const realizadas = /realizada|hechas|ya se hicieron|terminada|pasadas|anteriores/.test(q);
  const canceladas = /cancelada/.test(q);

  if (sede) { params.push(sede.id); where.push(`v.id_sede = $${params.length}`); }
  const mias = rol === 'Gerente' && quiereMios(q);
  if (mias) { params.push(usuarioId); where.push(`e.id_gerente = $${params.length}`); }

  if (realizadas) {
    where.push(`UPPER(TRIM(e.estado)) = 'REALIZADA'`);
    const r = tiempo ? rangoPasado('e.fecha_entrevista::date', tiempo) : null;
    if (r) where.push(r);
  } else if (canceladas) {
    where.push(`UPPER(TRIM(e.estado)) IN ('CANCELADA','CANCELADO')`);
  } else {
    where.push(`UPPER(TRIM(e.estado)) = 'PROGRAMADA'`);
    const r = rangoFuturo('e.fecha_entrevista', tiempo);
    // Sin tiempo: solo las que aún no han pasado. Con "hoy": todas las de hoy (incluso las de la mañana).
    where.push(r || `e.fecha_entrevista >= ${AHORA}`);
  }

  const filtro = `WHERE ${where.join(' AND ')}`;
  const total = (await db.query(`SELECT COUNT(*)::int AS n ${from} ${filtro}`, params)).rows[0].n;

  const tipo = realizadas ? 'realizadas' : canceladas ? 'canceladas' : 'programadas';
  const cuando = tiempo ? ` ${realizadas ? (TEXTO_TIEMPO_PASADO[tiempo] || '') : (TEXTO_TIEMPO[tiempo] || '')}` : '';
  const quienes = mias ? ' tuyas' : '';
  const sufijoSede = sede ? ` en ${sede.nombre}` : '';

  const singular = { programadas: 'programada', realizadas: 'realizada', canceladas: 'cancelada' }[tipo];
  let texto = total === 0
    ? `No hay entrevistas ${tipo}${quienes}${sufijoSede}${cuando}.`
    : `Hay ${plural(total, `entrevista ${singular}`, `entrevistas ${tipo}`)}${quienes}${sufijoSede}${cuando}.`;

  if (total > 0 && (tiempo || quiereLista(q) || total <= MAX_LISTA)) {
    const lista = (await db.query(
      `SELECT e.fecha_entrevista, e.modalidad, a.nombre_completo,
              COALESCE(NULLIF(v.nombre_cargo, ''), v.titulo) AS cargo, s.nombre_sede
       ${from} ${filtro}
       ORDER BY e.fecha_entrevista ${realizadas ? 'DESC' : 'ASC'}
       LIMIT ${MAX_LISTA}`,
      params
    )).rows;
    texto += '\n\n' + lista.map((f) =>
      `• ${formatoFechaHora(f.fecha_entrevista)} — ${f.nombre_completo || 'Candidato'}${f.cargo ? `, ${f.cargo}` : ''}${f.nombre_sede ? ` (${f.nombre_sede})` : ''} · ${f.modalidad}`
    ).join('\n');
    if (total > lista.length) texto += `\n… y ${total - lista.length} más.`;
  }

  return {
    respuesta: texto,
    enlaces: enlacesPara(rol, 'agenda', 'evaluar'),
    sugerencias: ['¿Qué entrevistas hay mañana?', '¿Qué entrevistas hay esta semana?', '¿Qué tengo pendiente?'],
  };
}

async function hExamenes({ db, q, sede, tiempo, rol }) {
  const params = [];
  const where = [];
  const from = `
    FROM examen_programado ex
    JOIN postulacion p ON p.id_postulacion = ex.id_postulacion
    JOIN aspirante a ON a.id_aspirante = p.id_aspirante
    JOIN vacante v ON v.id_vacante = p.id_vacante
    LEFT JOIN sede s ON s.id_sede = v.id_sede`;
  if (sede) { params.push(sede.id); where.push(`v.id_sede = $${params.length}`); }
  const y = where.length ? `${where.join(' AND ')} AND` : '';

  const cuenta = async (cond) => (await db.query(`SELECT COUNT(*)::int AS n ${from} WHERE ${y} ${cond}`, params)).rows[0].n;

  const r = rangoFuturo('ex.fecha', tiempo);
  const porVerificar = await cuenta(`UPPER(TRIM(ex.estado)) = 'EN_REVISION'`);
  const proximos = await cuenta(`UPPER(TRIM(ex.estado)) = 'PROGRAMADO' AND ${r || `ex.fecha >= ${HOY}`}`);
  const sinDocs = await cuenta(`UPPER(TRIM(ex.estado)) = 'PROGRAMADO' AND ex.fecha < ${HOY}`);
  const sufijoSede = sede ? ` en ${sede.nombre}` : '';
  const cuando = tiempo ? ` ${TEXTO_TIEMPO[tiempo]}` : '';

  let texto;
  let listaSql = null;
  if (/verificar|verificacion|revision|revisar|resultado|por revisar/.test(q)) {
    texto = porVerificar === 0
      ? `No hay exámenes por verificar${sufijoSede}.`
      : `Hay ${plural(porVerificar, 'examen por verificar', 'exámenes por verificar')}${sufijoSede}: ${porVerificar === 1 ? 'ya tiene' : 'ya tienen'} documentos cargados y ${porVerificar === 1 ? 'espera' : 'esperan'} la verificación de RRHH.`;
    listaSql = `UPPER(TRIM(ex.estado)) = 'EN_REVISION'`;
  } else if (/aprobad|rechazad/.test(q)) {
    const res = /rechazad/.test(q) ? 'RECHAZADO' : 'APROBADO';
    const n = await cuenta(`ex.resultado = '${res}'`);
    texto = `Hay ${plural(n, `examen ${res === 'APROBADO' ? 'aprobado' : 'rechazado'}`, `exámenes ${res === 'APROBADO' ? 'aprobados' : 'rechazados'}`)}${sufijoSede}.`;
  } else if (/sin documento|faltan|no han (cargado|entregado)|atrasad|vencid/.test(q)) {
    texto = sinDocs === 0
      ? `No hay exámenes atrasados${sufijoSede}.`
      : `${sinDocs === 1 ? '1 examen ya pasó su fecha' : `${sinDocs} exámenes ya pasaron su fecha`}${sufijoSede} y todavía no ${sinDocs === 1 ? 'tiene' : 'tienen'} documentos cargados.`;
    listaSql = `UPPER(TRIM(ex.estado)) = 'PROGRAMADO' AND ex.fecha < ${HOY}`;
  } else if (tiempo || /programad|agendad|proximo|cuando/.test(q)) {
    texto = proximos === 0
      ? `No hay exámenes programados${sufijoSede}${cuando}.`
      : `Hay ${plural(proximos, 'examen programado', 'exámenes programados')}${sufijoSede}${cuando}.`;
    listaSql = `UPPER(TRIM(ex.estado)) = 'PROGRAMADO' AND ${r || `ex.fecha >= ${HOY}`}`;
  } else {
    texto = `Exámenes${sufijoSede}:\n• Programados próximos: ${proximos}\n• Por verificar (documentos cargados): ${porVerificar}\n• Con fecha vencida sin documentos: ${sinDocs}`;
  }

  if (listaSql) {
    const lista = (await db.query(
      `SELECT ex.fecha, ex.hora, ex.lugar, a.nombre_completo
       ${from} WHERE ${y} ${listaSql} ORDER BY ex.fecha ASC, ex.hora ASC LIMIT ${MAX_LISTA}`,
      params
    )).rows;
    if (lista.length) {
      texto += '\n\n' + lista.map((f) =>
        `• ${formatoFecha(f.fecha)} ${String(f.hora || '').slice(0, 5)} — ${f.nombre_completo}${f.lugar ? ` · ${f.lugar}` : ''}`
      ).join('\n');
    }
  }

  return {
    respuesta: texto,
    enlaces: enlacesPara(rol, 'examenes'),
    sugerencias: ['¿Qué exámenes hay por verificar?', '¿Qué exámenes están programados esta semana?', '¿Qué tengo pendiente?'],
  };
}

async function hContratos({ db, q, sede, tiempo, rol }) {
  const params = [];
  let filtroSede = '';
  if (sede) { params.push(sede.id); filtroSede = `AND v.id_sede = $${params.length}`; }
  const sufijoSede = sede ? ` en ${sede.nombre}` : '';

  const fila = (await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM postulacion p JOIN vacante v ON v.id_vacante = p.id_vacante
         WHERE UPPER(TRIM(p.estado)) IN ('PENDIENTE_CONTRATO','FIRMA_CONTRATO_AGENDADA')
           AND NOT EXISTS (SELECT 1 FROM contrato c WHERE c.id_postulacion = p.id_postulacion) ${filtroSede}) AS pendientes,
       (SELECT COUNT(*)::int FROM contrato c JOIN postulacion p ON p.id_postulacion = c.id_postulacion
         JOIN vacante v ON v.id_vacante = p.id_vacante WHERE 1 = 1 ${filtroSede}) AS registrados,
       (SELECT COUNT(*)::int FROM contrato c JOIN postulacion p ON p.id_postulacion = c.id_postulacion
         JOIN vacante v ON v.id_vacante = p.id_vacante
         WHERE c.fecha_firma_programada >= ${HOY} ${filtroSede}) AS firmas`,
    params
  )).rows[0];

  let texto;
  if (/firma|firmar|agendad|programad/.test(q) || tiempo) {
    const r = rangoFuturo('c.fecha_firma_programada', tiempo);
    const n = r
      ? (await db.query(
          `SELECT COUNT(*)::int AS n FROM contrato c JOIN postulacion p ON p.id_postulacion = c.id_postulacion
             JOIN vacante v ON v.id_vacante = p.id_vacante WHERE ${r} ${filtroSede}`, params)).rows[0].n
      : fila.firmas;
    const cuando = tiempo ? ` ${TEXTO_TIEMPO[tiempo]}` : ' próximas';
    texto = n === 0
      ? `No hay firmas de contrato programadas${sufijoSede}${tiempo ? cuando : ''}.`
      : `Hay ${plural(n, 'firma de contrato programada', 'firmas de contrato programadas')}${sufijoSede}${cuando}.`;
  } else if (/pendiente|falta|por generar|por hacer/.test(q)) {
    texto = fila.pendientes === 0
      ? `No hay contratos pendientes por generar${sufijoSede}.`
      : `Hay ${plural(fila.pendientes, 'candidato listo para contrato', 'candidatos listos para contrato')}${sufijoSede} que aún no tiene contrato generado.`;
  } else {
    texto = `Contratos${sufijoSede}:\n• Pendientes por generar: ${fila.pendientes}\n• Contratos registrados: ${fila.registrados}\n• Firmas programadas próximas: ${fila.firmas}`;
  }

  return {
    respuesta: texto,
    enlaces: enlacesPara(rol, 'contratos'),
    sugerencias: ['¿Qué firmas hay esta semana?', '¿Qué contratos están pendientes?', '¿Qué tengo pendiente?'],
  };
}

async function hVacantes({ db, sede, rol }) {
  const filas = (await db.query(
    `SELECT COALESCE(s.nombre_sede, 'Sin sede') AS sede, COUNT(*)::int AS n
       FROM vacante v LEFT JOIN sede s ON s.id_sede = v.id_sede
      WHERE UPPER(TRIM(v.estado)) = 'ABIERTA' ${sede ? 'AND v.id_sede = $1' : ''}
      GROUP BY 1 ORDER BY n DESC, 1`,
    sede ? [sede.id] : []
  )).rows;
  const total = filas.reduce((s, f) => s + f.n, 0);
  const texto = total === 0
    ? `No hay vacantes abiertas${sede ? ` en ${sede.nombre}` : ''}.`
    : `Hay ${plural(total, 'vacante abierta', 'vacantes abiertas')}${sede ? ` en ${sede.nombre}` : ''}:\n` +
      filas.map((f) => `• ${f.sede}: ${f.n}`).join('\n');
  return { respuesta: texto, enlaces: enlacesPara(rol, 'cargos'), sugerencias: ['¿Cuántas postulaciones hay?', '¿Qué sedes hay?'] };
}

async function hSedes({ db, rol }) {
  const filas = (await db.query(
    `SELECT s.nombre_sede, COUNT(v.id_vacante) FILTER (WHERE UPPER(TRIM(v.estado)) = 'ABIERTA')::int AS abiertas
       FROM sede s LEFT JOIN vacante v ON v.id_sede = s.id_sede
      WHERE s.activa GROUP BY s.nombre_sede ORDER BY s.nombre_sede`
  )).rows;
  const texto = filas.length
    ? `Sedes activas:\n` + filas.map((f) => `• ${f.nombre_sede}: ${plural(f.abiertas, 'vacante abierta', 'vacantes abiertas')}`).join('\n') +
      '\n\nPuedes preguntarme por una sede, por ejemplo: «postulaciones en Tunja».'
    : 'No hay sedes activas registradas.';
  return { respuesta: texto, enlaces: enlacesPara(rol, 'cargos'), sugerencias: ['¿Cuántas vacantes hay abiertas?'] };
}

async function hPendientes({ db, rol, usuarioId }) {
  const fila = (await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM postulacion WHERE UPPER(TRIM(estado)) = 'EN_REVISION') AS revision,
       (SELECT COUNT(*)::int FROM entrevista WHERE UPPER(TRIM(estado)) = 'PROGRAMADA'
          AND fecha_entrevista::date = ${HOY}) AS entrevistas_hoy,
       (SELECT COUNT(*)::int FROM entrevista WHERE UPPER(TRIM(estado)) = 'PROGRAMADA'
          AND fecha_entrevista >= ${AHORA}) AS entrevistas_proximas,
       (SELECT COUNT(*)::int FROM examen_programado WHERE UPPER(TRIM(estado)) = 'EN_REVISION') AS examenes_verificar,
       (SELECT COUNT(*)::int FROM examen_programado WHERE UPPER(TRIM(estado)) = 'PROGRAMADO' AND fecha >= ${HOY}) AS examenes_proximos,
       (SELECT COUNT(*)::int FROM postulacion p WHERE UPPER(TRIM(p.estado)) IN ('PENDIENTE_CONTRATO','FIRMA_CONTRATO_AGENDADA')
          AND NOT EXISTS (SELECT 1 FROM contrato c WHERE c.id_postulacion = p.id_postulacion)) AS contratos_pendientes,
       (SELECT COUNT(*)::int FROM entrevista WHERE UPPER(TRIM(estado)) = 'PROGRAMADA'
          AND fecha_entrevista >= ${AHORA} AND id_gerente = $1) AS mis_entrevistas`,
    [usuarioId || null]
  )).rows[0];

  const lineas = [];
  if (rol === 'Gerente') {
    lineas.push(`• Entrevistas hoy: ${fila.entrevistas_hoy}`);
    lineas.push(`• Entrevistas programadas por delante: ${fila.entrevistas_proximas} (${fila.mis_entrevistas} asignadas a ti)`);
    lineas.push(`• Candidatos listos para contrato: ${fila.contratos_pendientes}`);
  } else {
    lineas.push(`• Hojas de vida en revisión: ${fila.revision}`);
    lineas.push(`• Exámenes por verificar: ${fila.examenes_verificar}`);
    lineas.push(`• Exámenes programados próximos: ${fila.examenes_proximos}`);
    lineas.push(`• Entrevistas hoy: ${fila.entrevistas_hoy}`);
    lineas.push(`• Candidatos listos para contrato: ${fila.contratos_pendientes}`);
  }
  const hayAlgo = Object.values(fila).some((v) => v > 0);
  return {
    respuesta: hayAlgo ? `Esto es lo que tienes en este momento:\n${lineas.join('\n')}` : 'No tienes tareas pendientes en este momento. 🎉',
    enlaces: rol === 'Gerente' ? enlacesPara(rol, 'evaluar', 'contratos') : enlacesPara(rol, 'hojas', 'examenes', 'contratos'),
    sugerencias: rol === 'Gerente'
      ? ['¿Qué entrevistas tengo hoy?', '¿Qué contratos están pendientes?']
      : ['¿Cuántas postulaciones están en revisión?', '¿Qué exámenes hay por verificar?'],
  };
}

const PALABRAS_NO_NOMBRE = new Set([
  'postulacion', 'postulaciones', 'postulante', 'postulantes', 'aspirante', 'aspirantes', 'candidato', 'candidatos',
  'entrevista', 'entrevistas', 'examen', 'examenes', 'contrato', 'contratos', 'vacante', 'vacantes', 'sede', 'sedes',
  'cargo', 'cargos', 'proceso', 'procesos', 'sistema', 'todo', 'todos', 'hoy', 'manana', 'semana', 'mes', 'pendiente',
  'pendientes', 'revision', 'sidovi', 'tengo', 'hay', 'cuantas', 'cuantos',
]);
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'al', 'a', 'un', 'una', 'que', 'como', 'va', 'esta', 'mi']);

function extraerNombre(q) {
  const m = q.match(/(?:estado de|como va|como esta|buscar|busca|buscame|informacion de|datos de|donde esta|en que va)\s+(.{3,60})$/);
  if (!m) return null;
  const tokens = m[1].split(' ').filter((t) => t.length >= 2 && !STOP.has(t));
  if (!tokens.length || tokens.some((t) => PALABRAS_NO_NOMBRE.has(t))) return null;
  return tokens.slice(0, 4);
}

async function hCandidato({ db, tokens, rol }) {
  const params = [];
  const cond = tokens.map((t) => {
    params.push(`%${t}%`);
    return `translate(lower(a.nombre_completo), 'áéíóúüñ', 'aeiouun') LIKE $${params.length}`;
  });
  const filas = (await db.query(
    `SELECT a.nombre_completo, COALESCE(NULLIF(v.nombre_cargo, ''), v.titulo) AS cargo, s.nombre_sede,
            p.estado, p.fecha_postulacion
       FROM postulacion p
       JOIN aspirante a ON a.id_aspirante = p.id_aspirante
       JOIN vacante v ON v.id_vacante = p.id_vacante
       LEFT JOIN sede s ON s.id_sede = v.id_sede
      WHERE ${cond.join(' AND ')}
      ORDER BY p.fecha_postulacion DESC, p.id_postulacion DESC
      LIMIT ${MAX_LISTA}`,
    params
  )).rows;
  const buscado = tokens.join(' ');
  if (!filas.length) {
    return { respuesta: `No encontré postulaciones de «${buscado}». Prueba con el nombre y el apellido, tal como está registrado.`, enlaces: enlacesPara(rol, 'postulantes'), sugerencias: sugerenciasPara(rol) };
  }
  return {
    respuesta: `Encontré ${plural(filas.length, 'postulación', 'postulaciones')} para «${buscado}»:\n` +
      filas.map((f) => `• ${f.nombre_completo} — ${f.cargo || 'Sin cargo'}${f.nombre_sede ? ` (${f.nombre_sede})` : ''} · ${etiquetaEstado(f.estado)} · postulado el ${formatoFecha(f.fecha_postulacion)}`).join('\n'),
    enlaces: enlacesPara(rol, 'postulantes'),
    sugerencias: sugerenciasPara(rol),
  };
}

/* ------------------------------ punto de entrada ------------------------ */

const SALUDO = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que mas|saludos)\b/;

async function responder(db, { pregunta, rol, usuarioId, nombre }, opciones = {}) {
  const q = normalizar(pregunta);
  const base = (respuesta, extra = {}) => ({ respuesta, enlaces: [], sugerencias: sugerenciasPara(rol), ...extra });

  if (!q) return base('Escribe tu pregunta y te ayudo.');
  if (SALUDO.test(q) && q.split(' ').length <= 3) {
    const primerNombre = String(nombre || '').trim().split(/\s+/)[0];
    return base(`¡Hola${primerNombre ? `, ${primerNombre}` : ''}! Soy el asistente de SIDOVI. Puedo contarte cómo van las postulaciones, entrevistas, exámenes y contratos. ¿Qué necesitas?`);
  }

  // Sede mencionada (se lee de la base para no depender de una lista fija).
  const sedes = (await db.query('SELECT id_sede, nombre_sede FROM sede WHERE activa')).rows;
  const sedeMencionada = sedes
    .map((s) => ({ id: s.id_sede, nombre: s.nombre_sede, n: normalizar(s.nombre_sede) }))
    .find((s) => new RegExp(`\\b${s.n}\\b`).test(q)) || null;

  const ctx = { db, q, sede: sedeMencionada, tiempo: detectarTiempo(q), rol, usuarioId };

  // 1) Buscar a una persona por nombre.
  const tokens = extraerNombre(q);
  if (tokens && !sedeMencionada) return hCandidato({ ...ctx, tokens });

  // 2) Preguntas "cómo funciona / qué significa".
  const tema = detectarTema(q);
  const esConceptual = /(como funciona|que significa|significado|que quiere decir|para que sirve|paso a paso|flujo|etapas|que puedes hacer|ayuda|como te uso|como (creo|cambio|descargo|genero|programo|agendo)|(crear|agregar|nuevo|editar|desactivar|activar|modificar).*(cargo|vacante))/.test(q);
  if (esConceptual || !tema) {
    const kb = CONOCIMIENTO.find((k) => k.patron.test(q));
    if (kb) return { respuesta: kb.respuesta, enlaces: enlacesPara(rol, ...kb.enlaces), sugerencias: sugerenciasPara(rol) };
  }

  // 3) Consultas a la base de datos.
  switch (tema) {
    case 'postulaciones': return hPostulaciones(ctx);
    case 'entrevistas': return hEntrevistas(ctx);
    case 'examenes': return hExamenes(ctx);
    case 'contratos': return hContratos(ctx);
    case 'vacantes': return hVacantes(ctx);
    case 'sedes': return hSedes(ctx);
    case 'pendientes':
    case 'procesos': return hPendientes(ctx);
    default: break;
  }

  // 4) Sin coincidencia: gancho para un modelo de IA (paso siguiente) o mensaje de ayuda.
  if (typeof opciones.fallback === 'function') {
    const r = await opciones.fallback({ pregunta, rol });
    if (r) return typeof r === 'string' ? base(r) : { ...base(''), ...r };
  }
  return base('No estoy seguro de haber entendido. Puedo ayudarte con postulaciones, entrevistas, exámenes, contratos, vacantes y sedes. Prueba con alguna de estas preguntas:');
}

module.exports = { responder, normalizar, detectarTema, detectarTiempo, detectarEstadoPostulacion, extraerNombre, etiquetaEstado };
