/* Tests del campo `deshabilitado` y del orden de Vencimientos por fecha.

   El orden es la parte que más se rompió: `datosVenc()` en reports.js elegía
   qué columna ordenar, y con la agrupación por empresa activa la clave por
   defecto pasó a ser `patente`. El efecto en pantalla era que la columna
   "Vencimiento" tenía la flecha pero no ordenaba nada, y el grupo más urgente
   no quedaba arriba.

   Ambos helpers viven en archivos que se cargan por `<script>` (no ESM), así
   que se extraen del texto y se evalúan con `new Function` contra una base
   falsa. Es la misma técnica de tests/vehiculos-numeracion.test.js.
*/
const fs = require('fs');
const path = require('path');

let checks = 0, fails = 0;
function ok(cond, msg) {
  checks++;
  if (cond) return true;
  fails++;
  console.error(`  FALLA: ${msg}`);
  return false;
}
function eq(a, b, msg) { return ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)})`); }

// ---------- lib/utils.js: esDeshabilitado / sinDeshabilitados ----------
const utilsSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'utils.js'), 'utf8');
const extraer = (src, nombre) => {
  const i = src.indexOf(`function ${nombre}(`);
  if (i < 0) throw new Error(`no encontré ${nombre}()`);
  let depth = 0, j = src.indexOf('{', i);
  const start = j;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(i, j + 1);
};
// sinDeshabilitados() llama a esDeshabilitado(), así que las dos van en el
// mismo ámbito: se evaluan juntas y se devuelve la segunda.
const _utils = new Function(`${extraer(utilsSrc, 'esDeshabilitado')}\n${extraer(utilsSrc, 'sinDeshabilitados')}\nreturn { esDeshabilitado, sinDeshabilitados };`)();
const esDeshabilitado = _utils.esDeshabilitado;
const sinDeshabilitados = _utils.sinDeshabilitados;

console.log('\nesDeshabilitado()');
ok(esDeshabilitado({ deshabilitado: true }) === true, 'true es deshabilitado');
ok(esDeshabilitado({ deshabilitado: false }) === false, 'false NO es deshabilitado');
ok(esDeshabilitado({}) === false, 'sin campo NO es deshabilitado (los 57 previos)');
ok(esDeshabilitado({ estadoGeneral: 'Baja' }) === false, 'estadoGeneral Baja NO es deshabilitado (son cosas distintas)');
ok(esDeshabilitado({ deshabilitado: 'true' }) === true, 'acepta el string "true" (doc escrito a mano)');
ok(esDeshabilitado({ deshabilitado: null }) === false, 'null NO es deshabilitado');
ok(esDeshabilitado(undefined) === false, 'undefined NO revienta');
ok(esDeshabilitado({ data: () => ({ deshabilitado: true }) }) === true, 'acepta un DocumentSnapshot');
ok(esDeshabilitado({ deshabilitado: 'false' }) === false, 'el string "false" NO cuenta como deshabilitado');

console.log('sinDeshabilitados()');
const flota = [
  { patente: 'A', deshabilitado: true },
  { patente: 'B' },
  { patente: 'C', deshabilitado: false },
  { patente: 'D', deshabilitado: 'true' }
];
eq(sinDeshabilitados(flota).map(v => v.patente), ['B', 'C'], 'saca solo los deshabilitados, conserva el orden');
eq(sinDeshabilitados([]), [], 'array vacío');

// ---------- public/js/reports.js: el orden de datosVenc ----------
const reportsSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'reports.js'), 'utf8');

/* datosVenc() es la función que se rompió, así que se evalúa REAL (se extrae del
   archivo), no una reimplementación. Sus dependencias se inyectan:

     - vencFiltrada(): devuelve las filas que el test arma. La real lee el
       array global `fleet` y los checklists de la pantalla, y además calcula
       los días con `vencimientosDe()`; todo eso acá se reemplaza por filas ya
       construidas, que es lo que hay que probar de todos modos (el ORDEN).
     - valorVenc() / campoObjeto(): la real resuelve la columna activa. Se
       replica su regla de 'fecha' (usa r.dias) y el resto se resuelve contra
       el vehículo, como hace orderVal().
     - normTxt(): la real normaliza minúsculas + trim para agrupar por empresa
       (la flota tiene "mixer" y "Mixer"). */
function datosVenc(filas, agrupar = true) {
  const cuerpo = `
    let vencSortKey = 'fecha';
    let vencSortDir = 'asc';
    const vencFilters = { agrupar: ${agrupar} };
    function normTxt(s) { return String(s || '').trim().toLowerCase(); }
    function campoObjeto() { return null; }
    function valorVenc(r, key) { return key === 'fecha' ? r.dias : r.v[key]; }
    function vencFiltrada() { return ${JSON.stringify(filas)}; }
    ${extraer(reportsSrc, 'datosVenc')}
    return datosVenc();`;
  return new Function(cuerpo)();
}

const diasDe = (ymd) => {
  const vto = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
  const h = new Date();
  return Math.round((vto - Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate())) / 86400000);
};
const hoy = new Date();
const ymd = d => new Date(hoy.getTime() + d * 86400000).toISOString().slice(0, 10);
// Una fila de vencFiltrada(): `v` es el vehículo y `dias` los días que le
// quedan al documento que se muestra (null si no tiene fecha).
const fila = (patente, empresa, dias) => ({ v: { patente, empresa, tipo: 'mixer', chofer: '', marca: '' }, dias, doc: null, totalDocs: 1 });

console.log('\ndatosVenc() - el default ordena por Vencimiento');
// Las patentes están en orden INVERSO a las fechas a propósito: si el código
// volviera a ordenar por patente, estos asserts fallan. Ese era el bug.
const base = [fila('ZZZ999', 'OBRA A', 90), fila('AAA111', 'OBRA B', 5), fila('MMM555', 'OBRA A', 45), fila('BBB222', 'OBRA B', 1)];

const sinAgrupar = datosVenc(base, false);
ok(sinAgrupar.grupos === null, 'sin el toggle de agrupar, no arma grupos');
eq(sinAgrupar.filas.map(f => f.v.patente), ['BBB222', 'AAA111', 'MMM555', 'ZZZ999'],
  'de más próximo a más lejano');

const agrupado = datosVenc(base);
eq(agrupado.grupos.map(g => g.nombre), ['OBRA B', 'OBRA A'],
  'las empresas ordenan por su vencimiento más próximo: la más urgente arriba');
eq(agrupado.grupos.map(g => g.minDias), [1, 45], 'minDias es el mínimo de cada grupo');
eq(agrupado.grupos.map(g => g.vehiculos), [2, 2], 'cuenta vehículos distintos por grupo');
// Ojo con esta: acá la aplanada coincide con el sort global solo por casualidad
// (OBRA B tiene los 2 más próximos). La prueba real de que `filas` sale en el
// orden de los grupos está en "estados del grupo", donde las empresas están
// intercaladas en el sort global.
eq(agrupado.filas.map(f => f.v.patente), ['BBB222', 'AAA111', 'MMM555', 'ZZZ999'],
  'filas sale aplanada: OBRA B primero, y adentro por fecha');
eq(agrupado.grupos[0].vencidos, 0, 'grupo OBRA B no tiene vencidos');

console.log('\ndatosVenc() - estados del grupo');
// Empresas intercaladas en el sort global: el sort por fecha solo las mezclaría
// como A(10), A(-30), B(5) -> -30, 5, 10. Como `filas` sale aplanada por grupo,
// tiene que ser A(-30), A(10), B(5): el -30 antes del 5, aunque el 5 sea menor.
const conVencidos = datosVenc([fila('AAA111', 'A', 10), fila('BBB222', 'A', -30), fila('CCC333', 'B', 5)]);
eq(conVencidos.grupos.map(g => g.nombre), ['A', 'B'], 'el grupo con un vencido (-30 d) va primero');
eq(conVencidos.grupos[0].vencidos, 1, 'cuenta los vencidos del grupo');
eq(conVencidos.filas.map(f => f.v.patente), ['BBB222', 'AAA111', 'CCC333'],
  'filas respeta el orden de los grupos, no el sort global por fecha');

console.log('\ndatosVenc() - adentro del grupo manda la fecha');
const dosEnElMismo = datosVenc([fila('AAA111', 'A', 10), fila('BBB222', 'A', 1)]);
eq(dosEnElMismo.grupos.length, 1, 'las dos filas son del mismo grupo');
eq(dosEnElMismo.grupos[0].filas.map(f => f.v.patente), ['BBB222', 'AAA111'],
  'adentro del grupo va la más próxima primero, aunque la patente sea al revés');

console.log('\ndatosVenc() - mayúsculas en el nombre de empresa');
const mayusculas = datosVenc([fila('AAA111', 'Mixer', 10), fila('BBB222', 'mixer', 1)]);
eq(mayusculas.grupos.length, 1, '"Mixer" y "mixer" son la misma empresa, no dos grupos');

// El bug original: `keyFila` valía 'patente', así que la columna de la flecha
// decía Vencimiento pero el comparador usaba `orderVal(v, "patente")`. Estas 3
// patentes están en orden inverso a los días, así que un orden por patente
// daría otro resultado y el assert lo detecta.
console.log('\ndatosVenc() - el default ordena por Vencimiento y no por patente');
const mezcladas = datosVenc([fila('AAA111', 'X', 3), fila('ZZZ999', 'X', 300), fila('MMM555', 'X', 30)]);
eq(mezcladas.filas.map(f => f.dias), [3, 30, 300], 'días crecientes');
eq(mezcladas.filas.map(f => f.v.patente), ['AAA111', 'MMM555', 'ZZZ999'],
  'las patentes salen ordenadas al revés de como entraron: no es orden por patente');

console.log(`\n${checks} checks, ${fails} fallas`);
process.exit(fails ? 1 : 0);