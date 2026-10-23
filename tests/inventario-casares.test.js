'use strict';
/* Carga del inventario de Carlos Casares contra el Firestore falso.
   Corre: npm run test:inventario */
const { fake, makeReporter } = require('./helpers');
const { check, section, done } = makeReporter('inventario-casares');
const { leerInventario, ejecutar, DEFAULT_EXCEL } = require('../scripts/importar-casares');

(async () => {
  section('LECTURA DEL EXCEL');
  const { items, omitidos } = leerInventario(DEFAULT_EXCEL);

  check('detecta 34 elementos', items.length === 34, items.length);
  check('omite 2 filas (tornillos resumen y "limpio de cemento")', omitidos.length === 2,
    JSON.stringify(omitidos.map((o) => o.nombreOriginal)));
  check('28 equipos + 6 herramientas',
    items.filter((x) => x.tipo === 'equipo').length === 28 &&
    items.filter((x) => x.tipo === 'herramienta').length === 6,
    JSON.stringify(items.reduce((a, x) => { a[x.tipo] = (a[x.tipo] || 0) + 1; return a; }, {})));
  check('sectores: 10 planta + 6 silo + 7 c1 + 11 c2',
    items.filter((x) => x.sector === 'Planta Dosificadora').length === 10 &&
    items.filter((x) => x.sector === 'Silo Móvil').length === 6 &&
    items.filter((x) => x.sector === 'Contenedor 1').length === 7 &&
    items.filter((x) => x.sector === 'Contenedor 2').length === 11,
    JSON.stringify(items.reduce((a, x) => { a[x.sector] = (a[x.sector] || 0) + 1; return a; }, {})));
  check('stock toma la cantidad del Excel (patas 8, llaves Allen 9)',
    items.find((x) => x.nombre === 'Patas extensoras').stock === 8 &&
    items.find((x) => x.nombre === 'Llaves Allen').stock === 9);
  check('el silo conserva el estado "Limpio de cemento"',
    /Limpio de cemento/.test(items.find((x) => x.nombre === 'Silo móvil').descripcion),
    items.find((x) => x.nombre === 'Silo móvil').descripcion);

  section('CARGA CONTRA FIRESTORE FALSO');
  fake.seed('centros', 'c-casares', { nombre: 'Carlos Casares', estado: 'activa', createdAt: new Date() });
  fake.seed('counters', 'equipo', { current: 4 });
  fake.seed('counters', 'herramienta', { current: 3 });

  const res = await ejecutar(fake.db, items, { centroNombre: 'Carlos Casares' });
  check('crea 34 en catálogo', res.creadosCatalogo === 34, JSON.stringify(res));
  check('crea 34 asignaciones', res.creadosAsignados === 34, JSON.stringify(res));

  const cat = fake.dump('elementos_catalogo');
  const asig = fake.dump('centros/c-casares/elementos');
  check('quedan 34 en catálogo', cat.length === 34, cat.length);
  check('quedan 34 asignadas', asig.length === 34, asig.length);
  check('sin internos duplicados', new Set(cat.map((x) => x.interno)).size === cat.length,
    cat.map((x) => x.interno).join(','));

  const equipos = cat.filter((x) => x.tipo === 'equipo').map((x) => x.interno).sort();
  const herramientas = cat.filter((x) => x.tipo === 'herramienta').map((x) => x.interno).sort();
  check('equipos E005..E032', equipos[0] === 'E005' && equipos[equipos.length - 1] === 'E032',
    equipos.join(','));
  check('herramientas H004..H009', herramientas[0] === 'H004' && herramientas[herramientas.length - 1] === 'H009',
    herramientas.join(','));

  const porSector = asig.reduce((a, x) => { a[x.sector] = (a[x.sector] || 0) + 1; return a; }, {});
  check('asignaciones por sector correctas',
    porSector['Planta Dosificadora'] === 10 && porSector['Silo Móvil'] === 6 &&
    porSector['Contenedor 1'] === 7 && porSector['Contenedor 2'] === 11,
    JSON.stringify(porSector));

  check('cada asignación guarda su sector',
    asig.every((x) => x.sector && x.sector.length > 0));
  check('no hay diferencias con los vehículos existentes',
    asig.every((x) => x.elementoTipo === 'equipo' || x.elementoTipo === 'herramienta'));

  section('IDEMPOTENCIA');
  const res2 = await ejecutar(fake.db, items, { centroNombre: 'Carlos Casares' });
  check('2da corrida no crea catálogo', res2.creadosCatalogo === 0, JSON.stringify(res2));
  check('2da corrida no crea asignaciones', res2.creadosAsignados === 0, JSON.stringify(res2));
  check('2da corrida reutiliza los 34 elementos', res2.reutilizadosCatalogo === 34, JSON.stringify(res2));
  check('2da corrida ve las 34 ya asignadas', res2.yaAsignados === 34, JSON.stringify(res2));
  check('los totales no cambian', fake.dump('elementos_catalogo').length === 34 &&
    fake.dump('centros/c-casares/elementos').length === 34);

  done();
})().catch((e) => {
  console.error('ERROR EN EL TEST:', e);
  process.exit(1);
});
