ALTER TABLE aspirante ADD COLUMN IF NOT EXISTS sexo varchar(20);

UPDATE aspirante SET sexo = 'Hombre'
WHERE UPPER(TRIM(COALESCE(sexo,''))) IN ('M','MASCULINO','HOMBRE');

UPDATE aspirante SET sexo = 'Mujer'
WHERE UPPER(TRIM(COALESCE(sexo,''))) IN ('F','FEMENINO','MUJER');

UPDATE aspirante SET sexo = NULL
WHERE sexo IS NOT NULL AND sexo NOT IN ('Hombre','Mujer');

ALTER TABLE aspirante DROP CONSTRAINT IF EXISTS chk_aspirante_sexo;
ALTER TABLE aspirante ADD CONSTRAINT chk_aspirante_sexo
    CHECK (sexo IS NULL OR sexo IN ('Hombre','Mujer'));