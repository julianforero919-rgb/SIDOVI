-- SIDOVI: datos completos del aspirante y estados controlados de selección/vinculación.
-- Ejecutar una sola vez en la base PostgreSQL de Render ANTES de desplegar el backend actualizado.
BEGIN;

ALTER TABLE aspirante ADD COLUMN IF NOT EXISTS ciudad varchar(100) NOT NULL DEFAULT '';
ALTER TABLE aspirante ADD COLUMN IF NOT EXISTS fecha_nacimiento date;
ALTER TABLE aspirante ADD COLUMN IF NOT EXISTS experiencia varchar(20) NOT NULL DEFAULT '';
ALTER TABLE aspirante ADD COLUMN IF NOT EXISTS descripcion_experiencia text NOT NULL DEFAULT '';
ALTER TABLE aspirante ADD COLUMN IF NOT EXISTS autorizacion_datos boolean NOT NULL DEFAULT false;
ALTER TABLE aspirante ADD COLUMN IF NOT EXISTS autorizacion_datos_fecha timestamp;

ALTER TABLE contrato ADD COLUMN IF NOT EXISTS fecha_firma_real timestamp;
ALTER TABLE contrato ADD COLUMN IF NOT EXISTS firmado_por integer REFERENCES usuario(id_usuario) ON DELETE SET NULL;

-- Retirar temporalmente la restricción anterior para incorporar el nuevo estado.
ALTER TABLE postulacion DROP CONSTRAINT IF EXISTS postulacion_estado_check;

-- Normalizar alias históricos de estados sin cambiar el sentido de cada etapa.
UPDATE postulacion SET estado='APROBADO_RRHH'
WHERE estado IN ('HOJA_VIDA_APROBADA','ENTREVISTA_PENDIENTE');
UPDATE postulacion SET estado='ENTREVISTA'
WHERE estado='ENTREVISTA_AGENDADA';
UPDATE postulacion SET estado='EXAMENES_AGENDADOS'
WHERE estado='EXAMENES_PROGRAMADOS';

-- Reconocer como contratados los contratos que ya constan firmados/activos.
UPDATE postulacion p
SET estado = 'CONTRATADO',
    fecha_contratacion = COALESCE(p.fecha_contratacion, CURRENT_DATE)
FROM contrato c
WHERE c.id_postulacion = p.id_postulacion
  AND p.estado IN ('PENDIENTE_CONTRATO','FIRMA_CONTRATO_AGENDADA','CONTRATO_GENERADO','CONTRATADO')
  AND LOWER(TRIM(COALESCE(c.estado, ''))) IN
      ('firmado', 'firmado manualmente', 'firmado digitalmente', 'activo', 'contratado');

-- Un contrato existente que aún no está firmado queda pendiente de confirmación.
UPDATE postulacion p
SET estado = 'CONTRATO_GENERADO'
FROM contrato c
WHERE c.id_postulacion = p.id_postulacion
  AND p.estado IN ('PENDIENTE_CONTRATO','FIRMA_CONTRATO_AGENDADA','CONTRATO_GENERADO','CONTRATADO')
  AND LOWER(TRIM(COALESCE(c.estado, ''))) NOT IN
      ('firmado', 'firmado manualmente', 'firmado digitalmente', 'activo', 'contratado');

ALTER TABLE postulacion
  ADD CONSTRAINT postulacion_estado_check
  CHECK (estado IN (
    'EN_REVISION',
    'APROBADO_RRHH',
    'RECHAZADO_RRHH',
    'ENTREVISTA',
    'APROBADO',
    'RECHAZADO',
    'CONTRATADO',
    'EXAMENES_PENDIENTES',
    'EXAMENES_AGENDADOS',
    'EXAMENES_EN_REVISION',
    'PENDIENTE_CONTRATO',
    'FIRMA_CONTRATO_AGENDADA',
    'CONTRATO_GENERADO',
    -- Compatibilidad con valores históricos de versiones anteriores.
    'HOJA_VIDA_APROBADA',
    'ENTREVISTA_PENDIENTE',
    'ENTREVISTA_AGENDADA',
    'EXAMENES_PROGRAMADOS'
  ));

CREATE INDEX IF NOT EXISTS idx_postulacion_estado_flujo
  ON postulacion(estado);

COMMIT;
