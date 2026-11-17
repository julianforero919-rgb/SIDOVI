-- Campos adicionales del perfil de RRHH y Gerencia. Idempotente.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS fecha_nacimiento date;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS sexo varchar(20);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ciudad varchar(80) NOT NULL DEFAULT '';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS area varchar(120) NOT NULL DEFAULT '';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS fecha_ingreso date;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS contacto_emergencia varchar(120) NOT NULL DEFAULT '';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS telefono_emergencia varchar(30) NOT NULL DEFAULT '';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS descripcion varchar(500) NOT NULL DEFAULT '';

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_sexo;
ALTER TABLE usuario ADD CONSTRAINT chk_usuario_sexo
    CHECK (sexo IS NULL OR sexo IN ('Hombre','Mujer'));
