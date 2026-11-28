const {
  normalizarEstadoRevision,
  estadoPostulacionTrasEntrevista,
  estadoPostulacionTrasExamen,
  puedeProgramarEntrevista,
  puedeProgramarExamen,
  puedeProgramarFirma,
  puedeConfirmarContratacion
} = require('../../server/flujo-postulacion');

describe('Flujo de postulación SIDOVI', () => {
  test('normaliza únicamente estados que RR. HH. puede definir en la revisión inicial', () => {
    expect(normalizarEstadoRevision('EN_REVISION')).toBe('EN_REVISION');
    expect(normalizarEstadoRevision('HOJA_VIDA_APROBADA')).toBe('APROBADO_RRHH');
    expect(normalizarEstadoRevision('RECHAZADO')).toBe('RECHAZADO_RRHH');
    expect(normalizarEstadoRevision('CONTRATADO')).toBeNull();
    expect(normalizarEstadoRevision('EXAMENES_PENDIENTES')).toBeNull();
  });

  test('la entrevista aprobada habilita exámenes; rechazada termina el proceso; pendiente no avanza', () => {
    expect(estadoPostulacionTrasEntrevista('APROBADO')).toBe('EXAMENES_PENDIENTES');
    expect(estadoPostulacionTrasEntrevista('RECHAZADO')).toBe('RECHAZADO');
    expect(estadoPostulacionTrasEntrevista('PENDIENTE')).toBe('ENTREVISTA');
    expect(() => estadoPostulacionTrasEntrevista('OTRO')).toThrow(TypeError);
  });

  test('los exámenes aprobados habilitan firma; no aprobados no avanzan', () => {
    expect(estadoPostulacionTrasExamen('APROBADO')).toBe('PENDIENTE_CONTRATO');
    expect(estadoPostulacionTrasExamen('RECHAZADO')).toBe('RECHAZADO');
    expect(estadoPostulacionTrasExamen('PENDIENTE')).toBe('EXAMENES_EN_REVISION');
    expect(() => estadoPostulacionTrasExamen('OTRO')).toThrow(TypeError);
  });

  test('cada etapa solo se habilita desde el estado anterior correspondiente', () => {
    expect(puedeProgramarEntrevista('APROBADO_RRHH')).toBe(true);
    expect(puedeProgramarEntrevista('EN_REVISION')).toBe(false);
    expect(puedeProgramarExamen('EXAMENES_PENDIENTES')).toBe(true);
    expect(puedeProgramarExamen('APROBADO')).toBe(false);
    expect(puedeProgramarExamen('ENTREVISTA')).toBe(false);
    expect(puedeProgramarFirma('PENDIENTE_CONTRATO')).toBe(true);
    expect(puedeProgramarFirma('CONTRATO_GENERADO')).toBe(true);
    expect(puedeProgramarFirma('EN_REVISION')).toBe(false);
    expect(puedeConfirmarContratacion('CONTRATO_GENERADO')).toBe(true);
    expect(puedeConfirmarContratacion('FIRMA_CONTRATO_AGENDADA')).toBe(false);
  });
});
