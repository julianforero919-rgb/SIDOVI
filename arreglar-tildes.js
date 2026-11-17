// Repara texto dañado (ej. "PÃ¡gina" -> "Página") en server.js
// Uso:  node arreglar-tildes.js            (repara server.js)
//       node arreglar-tildes.js otro.js    (repara otro archivo)
const fs = require('fs');
const archivo = process.argv[2] || 'server.js';

// Tabla de la codificación windows-1252 para los bytes 0x80-0x9F
const cp1252 = {
    '€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8A,
    '‹':0x8B,'Œ':0x8C,'Ž':0x8E,'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,
    '˜':0x98,'™':0x99,'š':0x9A,'›':0x9B,'œ':0x9C,'ž':0x9E,'Ÿ':0x9F
};
const aByte = (ch) => {
    const c = ch.codePointAt(0);
    if (c <= 0xFF) return c;
    return cp1252[ch];
};

let texto = fs.readFileSync(archivo, 'utf8');
const original = texto;

// Secuencias dañadas: inician con Ã/Â (2 bytes) o â (3 bytes)
const claseCont = '[\\u0080-\\u00BF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]';
const re = new RegExp(`Ã${claseCont}|Â${claseCont}|â${claseCont}${claseCont}`, 'g');

let cambios = 0;
texto = texto.replace(re, (m) => {
    const bytes = [...m].map(aByte);
    if (bytes.some((b) => b === undefined)) return m;
    try {
        const dec = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
        cambios++;
        return dec;
    } catch { return m; }
});

if (texto === original) { console.log('No encontré texto dañado en', archivo); process.exit(0); }
fs.writeFileSync(archivo + '.copia-antes-de-tildes', original);
fs.writeFileSync(archivo, texto);
console.log(`Listo: ${cambios} partes reparadas en ${archivo}.`);
console.log(`Copia de seguridad: ${archivo}.copia-antes-de-tildes`);
