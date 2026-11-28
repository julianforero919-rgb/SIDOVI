'use strict';

const ALIASES_REVISION = Object.freeze({
  EN_REVISION: 'EN_REVISION',
  APROBADO_RRHH: 'APROBADO_RRHH',
  HOJA_VIDA_APROBADA: 'APROBADO_RRHH',
  ENTREVISTA_PENDIENTE: 'APROBADO_RRHH',
  RECHAZADO_RRHH: 'RECHAZADO_RRHH',
  RECHAZADO: 'RECHAZADO_RRHH'
});

function normalizarEstadoRevision(value) {
  const normalized = String(value || '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
  return ALIASES_REVISION[normalized] || null;
}

function estadoPostulacionTrasEntrevista(resultado) {
  if (resultado === 'APROBADO') return 'EXAMENES_PENDIENTES';
  if (resultado === 'RECHAZADO') return 'RECHAZADO';
  if (resultado === 'PENDIENTE') return 'ENTREVISTA';
  throw new TypeError('Resultado de entrevista no válido.');
}

function estadoPostulacionTrasExamen(resultado) {
  if (resultado === 'APROBADO') return 'PENDIENTE_CONTRATO';
  if (resultado === 'RECHAZADO') return 'RECHAZADO';
  if (resultado === 'PENDIENTE') return 'EXAMENES_EN_REVISION';
  throw new TypeError('Resultado de examen no válido.');
}

function puedeProgramarEntrevista(estado) {
  return estado === 'APROBADO_RRHH';
}

function puedeProgramarExamen(estado) {
  return estado === 'EXAMENES_PENDIENTES' || estado === 'APROBADO';
}

function puedeProgramarFirma(estado) {
  return estado === 'PENDIENTE_CONTRATO' || estado === 'FIRMA_CONTRATO_AGENDADA' || estado === 'CONTRATO_GENERADO';
}

function puedeConfirmarContratacion(estado) {
  return estado === 'CONTRATO_GENERADO';
}

module.exports = {
  normalizarEstadoRevision,
  estadoPostulacionTrasEntrevista,
  estadoPostulacionTrasExamen,
  puedeProgramarEntrevista,
  puedeProgramarExamen,
  puedeProgramarFirma,
  puedeConfirmarContratacion
};
