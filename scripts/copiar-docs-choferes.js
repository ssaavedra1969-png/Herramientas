/* Copia el DNI y el Registro de cada vehículo a la carpeta de red de Choferes.

   Para qué: en la oficina hay una carpeta física donde se archivan los DNI y
   los Registros de los choferes. Esta script deja una copia con el nombre del
   chofer adelante, para poder buscarlo sin saber la patente.

   IMPORTANTE: copia, nunca mueve. Los originales de PATENTE/ y los adjuntos
   de Firestore quedan intactos.

   Destino:  \\Admin1\compartida\Archivos1\Grupo Falpat\SEGURO\Seguros en APP\Choferes
   Nombre:   Nombre Del Chofer_TIPO_PATENTE.pdf     (ej. Juan Perrez_DNI_LOO879.pdf)

   Dry-run por defecto (solo lista). Para copiar de verdad:
     node scripts/copiar-docs-choferes.js --apply
   Para rehacer uno solo:
     node scripts/copiar-docs-choferes.js --apply --patente=LOO879
   Para pisar un archivo que ya existe (no lo hace salvo que se lo pida):
     node scripts/copiar-docs-choferes.js --apply --forzar
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebase');

const DESTINO = '\\\\Admin1\\compartida\\Archivos1\\Grupo Falpat\\SEGURO\\Seguros en APP\\Choferes';
const PATENTE_DIR = path.join(__dirname, '..', 'PATENTE');
// Prioridad de extensión, igual que en routes/vehicles.js y lib/github-docs.js
const EXT_PRIORIDAD = ['pdf', 'jpg', 'jpeg', 'png'];
const TIPOS = [
  { tipo: 'dni', etiqueta: 'DNI' },
  { tipo: 'registro', etiqueta: 'REGISTRO' }
];

const args = process.argv.slice(2);
const aplicar = args.includes('--apply');
const forzar = args.includes('--forzar');
const soloPatente = ((args.find(a => a.startsWith('--patente=')) || '').split('=')[1] || '').toUpperCase() || null;

/* Los nombres de archivo de Windows no admiten estos caracteres. Los choferes
   se cargan a mano y hay acentos, comas y barras de por medio. */
function limpiarNombre(s) {
  return String(s)
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function archivoEnCarpeta(patente, tipo) {
  const dir = path.join(PATENTE_DIR, patente);
  if (!fs.existsSync(dir)) return null;
  for (const ext of EXT_PRIORIDAD) {
    const p = path.join(dir, `${tipo}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Origen de un documento: primero la carpeta PATENTE/, después el adjunto
// subido desde la web (subcolección docsadjuntos), que son bytes en Firestore.
async function buscarDocumento(vehicleDoc, tipo) {
  const v = vehicleDoc.data();
  const patente = String(v.patente || '').toUpperCase();
  const enCarpeta = archivoEnCarpeta(patente, tipo);
  if (enCarpeta) return { buffer: fs.readFileSync(enCarpeta), ext: path.extname(enCarpeta).slice(1).toLowerCase(), origen: 'PATENTE/' };
  try {
    const d = await vehicleDoc.ref.collection('docsadjuntos').doc(tipo).get();
    if (d.exists && d.data().bytes) {
      const buf = Buffer.isBuffer(d.data().bytes) ? d.data().bytes : Buffer.from(d.data().bytes);
      return { buffer: buf, ext: (d.data().nombre || '').split('.').pop().toLowerCase() || 'pdf', origen: 'adjunto web' };
    }
  } catch (e) { /* sin permiso o sin adjunto: se informa abajo */ }
  return null;
}

(async () => {
  console.log(`\n${aplicar ? 'COPIANDO' : 'DRY-RUN (no se copia nada)'} - DNI y Registro de choferes`);
  console.log(`Destino: ${DESTINO}\n`);

  if (!fs.existsSync(DESTINO)) {
    if (!aplicar) console.log('! El destino no existe todavia (en --apply se crea).');
    else {
      fs.mkdirSync(DESTINO, { recursive: true });
      console.log(`+ Carpeta creada: ${DESTINO}`);
    }
  }

  const snap = await db.collection('vehicles').get();
  const planes = [];
  const sinChofer = [];
  const sinDocumento = [];

  for (const d of snap.docs) {
    const v = d.data();
    const patente = String(v.patente || '').toUpperCase();
    if (soloPatente && patente !== soloPatente) continue;
    const chofer = limpiarNombre(v.chofer || '');
    const conDocs = [];

    for (const { tipo, etiqueta } of TIPOS) {
      const doc = await buscarDocumento(d, tipo);
      if (!doc) continue;
      if (!chofer) continue; // se reporta abajo, una vez por vehiculo
      conDocs.push({ etiqueta, ...doc, destino: `${chofer}_${etiqueta}_${patente}.${doc.ext}` });
    }

    if (!chofer) { sinChofer.push({ patente, tieneDocs: TIPOS.some(t => archivoEnCarpeta(patente, t.tipo)) }); continue; }
    if (!conDocs.length) sinDocumento.push({ patente, chofer });
    planes.push(...conDocs);
  }

  let copiados = 0, salteados = 0;
  console.log('Plan:');
  for (const p of planes) {
    const dest = path.join(DESTINO, p.destino);
    if (fs.existsSync(dest)) {
      console.log(`  = YA ESTA  ${p.destino}   (${p.origen}, no se toca; usar --forzar para pisar)`);
      salteados++;
      continue;
    }
    console.log(`  + ${p.destino}   (${p.origen}, ${(p.buffer.length / 1024).toFixed(0)} KB)`);
    if (aplicar) {
      fs.writeFileSync(dest, p.buffer);
      copiados++;
    }
  }

  console.log(`\nTotal a copiar: ${planes.length}  |  copiados: ${copiados}  |  ya existian: ${salteados}`);
  if (sinChofer.length) {
    console.log(`\nSin nombre de chofer (no se pueden archivar, quedan como estan):`);
    sinChofer.forEach(x => console.log(`  - ${x.patente}${x.tieneDocs ? '  (tiene el documento en PATENTE/)' : ''}`));
  }
  if (sinDocumento.length) {
    console.log(`\nCon chofer pero sin DNI/Registro en PATENTE/ ni adjuntos:`);
    sinDocumento.forEach(x => console.log(`  - ${x.patente} ${x.chofer}`));
  }
  if (!aplicar) console.log(`\n( dry-run: nada se escribio. Reejecutar con --apply )`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });