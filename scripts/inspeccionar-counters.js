/**
 * INSPECCION DE CONTADORES (SOLO LECTURA — no escribe NADA en Firestore).
 *
 * Responde las dos preguntas abiertas de la sesion del 2026-09-29:
 *   1. Como se llaman REALMENTE los docs de la coleccion `counters`?
 *      El codigo busca doc(tipo) => counters/herramienta, counters/ropa, ...
 *      pero la doc historica decia `cat-{prefijo}`. Si el nombre real difiere,
 *      doc.exists siempre da false, el counter nunca se crea y el fix del
 *      off-by-one (commit d98d8d8) nunca llega a ejecutarse.
 *   2. El bug YA disparo? Hay internal duplicados en elementos_catalogo
 *      (H008 repetido) o en vehiculos (V-XXX repetido)?
 *
 *   node scripts/inspeccionar-counters.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { db } = require('../config/firebase');

const PREFIJO = { vehiculo: 'V', herramienta: 'H', equipo: 'E', ropa: 'R', material: 'M' };
const TIPOS = Object.keys(PREFIJO);

(async () => {
  console.log('\n=== 1. DOCS REALES DE LA COLECCION counters ===');
  const snap = await db.collection('counters').get();
  console.log('total de docs:', snap.size);
  snap.docs.forEach((d) => {
    const data = d.data();
    console.log('  ' + d.id.padEnd(18) + ' -> ' + JSON.stringify(data));
  });

  console.log('\n  --- lo que el codigo BUSCA (db.collection("counters").doc(tipo)) ---');
  for (const t of [...TIPOS, 'vehicles']) {
    const doc = await db.collection('counters').doc(t).get();
    console.log('  counters/' + t.padEnd(12) + ' -> ' + (doc.exists ? 'EXISTE  ' + JSON.stringify(doc.data()) : 'NO EXISTE  <<< el codigo cae en la rama de derivar del max'));
  }

  console.log('\n  --- lo que la DOC DICE que existe (cat-{prefijo} / vehicles-{tipo}) ---');
  const posibles = [];
  for (const t of TIPOS) posibles.push('cat-' + PREFIJO[t]);
  posibles.push('vehicles', 'vehiculos', 'vehiculo');
  for (const n of posibles) {
    const doc = await db.collection('counters').doc(n).get();
    if (doc.exists) console.log('  counters/' + n.padEnd(12) + ' -> EXISTE  ' + JSON.stringify(doc.data()));
  }
  console.log('  (solo se listan los que existen de los candidatos)');

  console.log('\n=== 2. HAY INTERNOS DUPLICADOS? (el bug ya disparo?) ===');

  const catalogo = await db.collection('elementos_catalogo').get();
  const porTipo = {};
  catalogo.docs.forEach((d) => {
    const v = d.data();
    const t = v.tipo || '(sin tipo)';
    (porTipo[t] = porTipo[t] || []).push({ interno: v.interno || '(vacio)', nombre: v.nombre, id: d.id });
  });
  console.log('\nelementos_catalogo: ' + catalogo.size + ' docs');
  for (const [t, items] of Object.entries(porTipo)) {
    const ints = items.map((i) => i.interno);
    const dupes = ints.filter((v, i) => ints.indexOf(v) !== i);
    const unicos = [...new Set(dupes)];
    console.log('  ' + t.padEnd(12) + ' items=' + String(items.length).padEnd(4) +
      (unicos.length ? ' DUPLICADOS: ' + unicos.join(', ') : ' sin duplicados'));
    unicos.forEach((dup) => {
      items.filter((i) => i.interno === dup).forEach((i) =>
        console.log('      ' + dup + '  ->  ' + i.nombre + '   (docId ' + i.id + ')'));
    });
    const conPrefijo = ints.filter((i) => i && i !== '(vacio)').sort();
    if (conPrefijo.length) console.log('      internos: ' + conPrefijo.join(', '));
  }

  const vehiculos = await db.collection('vehicles').get();
  const vints = vehiculos.docs.map((d) => ({ interno: d.data().interno || '', id: d.id, patente: d.data().patente }));
  const vLista = vints.map((v) => v.interno);
  const vDupes = [...new Set(vLista.filter((v, i) => vLista.indexOf(v) !== i))];
  console.log('\nvehicles: ' + vehiculos.size + ' docs');
  console.log('  ' + (vDupes.length ? 'DUPLICADOS: ' + vDupes.join(', ') : 'sin internos duplicados'));
  vDupes.forEach((dup) => {
    vints.filter((v) => v.interno === dup).forEach((v) =>
      console.log('      ' + dup + '  ->  patente ' + v.patente + '   (docId ' + v.id + ')'));
  });
  const conNum = vints.filter((v) => /^V\d+$/.test(v.interno)).map((v) => Number(v.interno.slice(1)));
  if (conNum.length) console.log('  max V = V' + String(Math.max(...conNum)).padStart(3, '0'));

  // Internos que el calculo del max NO ve: getNextVehicleNumber() solo mira los
  // que matchean /^V0*(\d+)$/. Uno con formato raro no cuelga del contador, asi
  // que no impide que el proximo numero se repita contra el.
  const CANONICO = /^V\d{3}$/;
  const irregulares = vints.filter((v) => v.interno && !CANONICO.test(v.interno));
  console.log('\n  internos con formato NO canonico (V###): ' + (irregulares.length || 'ninguno'));
  irregulares.forEach((v) => console.log('      "' + v.interno + '"  patente ' + v.patente + '   (docId ' + v.id + ')'));
  if (irregulares.length) {
    console.log('      ^ OJO: estos NO los ve el calculo del max, pero la app si los muestra.');
    console.log('        Si alguno representa un numero YA usado, la proxima alta lo repetiria.');
  }

  console.log('\n=== 3. SIMULACION: que pasaria con la proxima alta ===');
  const counterVeh = await db.collection('counters').doc('vehicles').get();
  let simulado;
  if (counterVeh.exists) {
    const n = (counterVeh.data().current || 0) + 1;
    simulado = 'V' + String(n).padStart(3, '0') + '  (rama incremento, counter=' + counterVeh.data().current + ')';
  } else {
    const max = conNum.length ? Math.max(...conNum) : 0;
    simulado = 'V' + String(max + 1).padStart(3, '0') + '  (deriva del max, counter NO existe)';
  }
  console.log('  proximo interno: ' + simulado);
  console.log('  ya lo usa alguien? ' + (vLista.includes(simulado.split(' ')[0]) ? 'SI -> COLISION' : 'no'));

  console.log('\n=== 4. RESUMEN ===');
  const busca = snap.docs.map((d) => d.id);
  const esperados = [...TIPOS, 'vehicles'];
  const ok = esperados.filter((t) => busca.includes(t));
  const otros = busca.filter((b) => !esperados.includes(b));
  console.log('  docs que el codigo SI encuentra: ' + (ok.length ? ok.join(', ') : 'NINGUNO'));
  console.log('  docs con otro nombre: ' + (otros.length ? otros.join(', ') : 'ninguno'));
  console.log('');
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
