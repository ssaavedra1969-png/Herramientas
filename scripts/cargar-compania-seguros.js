/* Completa `seguro.compania` en los vehículos que la tienen vacía.

   Por qué: el PDF de control de seguros agrupa por compañía, y con 52 de 57
   vehículos sin el campo el listado quedaba en un solo bloque inútil. La carga
   original nunca se completó (el campo existe en el schema desde siempre pero
   casi todos los docs lo tienen en "").

   Regla: SOLO rellena lo que no dice nada. No toca los valores que ya están
   cargados, ni aunque sean distintos (hoy hay SANCOR y Zurich): si hay que
   corregir uno, se corrige a mano.

   "Vacío" incluye los valores que se cargaron sin querer y no nombran a
   ninguna aseguradora: "" y ".". En la flota hubo 1 (HOA036 tiene "."), y
   dejarlo hizo que el PDF lo mostrara como si fuera una compañía aparte.
   Hoy está corregido: la flota quedó 56 SANCOR + 1 Zurich (DML84).

   Dry-run por defecto. Para escribir de verdad:
     node scripts/cargar-compania-seguros.js --apply
   Para forzar un valor distinto:
     node scripts/cargar-compania-seguros.js --apply --compania=Zurich
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { db } = require('../config/firebase');

const args = process.argv.slice(2);
const aplicar = args.includes('--apply');
const COMPAÑIA = ((args.find(a => a.startsWith('--compania=')) || '').split('=').slice(1).join('=') || 'SANCOR').trim();

const VACIOS = ['', '.'];
const esVacio = s => VACIOS.includes(String(s || '').trim().toLowerCase());

(async () => {
  const snap = await db.collection('vehicles').get();
  const faltan = [];
  const yaTienen = [];

  snap.docs.forEach(d => {
    const v = d.data();
    const actual = String((v.seguro && (v.seguro.compania || v.seguro['compañía'])) || '').trim();
    if (!esVacio(actual)) yaTienen.push({ patente: v.patente, actual });
    else faltan.push(d);
  });

  console.log(`\n${aplicar ? 'ESCRIBIENDO' : 'DRY-RUN (no se escribe nada)'} - seguro.compania = "${COMPAÑIA}"`);
  console.log(`\nCon compania cargada (no se tocan): ${yaTienen.length}`);
  yaTienen.forEach(x => console.log(`  = ${x.patente}  "${x.actual}"`));
  console.log(`\nSin compania (${faltan.length}):`);
  faltan.forEach(d => console.log(`  + ${String(d.data().patente || '').toUpperCase()} -> "${COMPAÑIA}"`));

  if (!aplicar) {
    console.log('\n( dry-run: nada se escribio. Reejecutar con --apply )');
    process.exit(0);
  }

  const db_ = db;
  let escritos = 0;
  for (let i = 0; i < faltan.length; i += 400) {
    const lote = faltan.slice(i, i + 400);
    const batch = db_.batch();
    lote.forEach(d => batch.update(d.ref, { 'seguro.compania': COMPAÑIA, updatedAt: new Date() }));
    await batch.commit();
    escritos += lote.length;
  }
  console.log(`\nEscritos: ${escritos} de ${faltan.length}.`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });