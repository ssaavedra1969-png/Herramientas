'use strict';
/* Lógica de negocio con riesgo. Corre: npm run test:negocio */
const { fake, req, makeReporter } = require('./helpers');
const { check, section, done } = makeReporter('negocio');

(async () => {
  section('CONTADOR DEL CATALOGO (regresion del fix d98d8d8)');
  // el counter no existe todavia -> tiene que derivar del maximo de los internos
  fake.seed('elementos_catalogo', 'x1', { tipo: 'herramienta', nombre: 'Previa', interno: 'H007' });

  const alta = async (tipo, nombre) => {
    const r = await req('POST', '/api/centros/elementos/disponibles', { body: { tipo, nombre } });
    if (r.status !== 201) throw new Error('alta fallo: ' + JSON.stringify(r.json));
    return fake.dump('elementos_catalogo').find((e) => e.nombre === nombre).interno;
  };

  check('1ra alta deriva del max existente -> H008', (await alta('herramienta', 'Uno')) === 'H008');
  check('crea el counter', fake.dump('counters').some((c) => c.id === 'herramienta'));
  // antes del fix estas dos devolvian H008 y H009 (duplicando la primera)
  check('2da alta -> H009 (no repite H008)', (await alta('herramienta', 'Dos')) === 'H009');
  check('3ra alta -> H010', (await alta('herramienta', 'Tres')) === 'H010');

  const intsH = fake.dump('elementos_catalogo').filter((e) => e.tipo === 'herramienta').map((e) => e.interno);
  check('sin internos duplicados en herramienta', new Set(intsH).size === intsH.length, intsH.join(','));

  check('otro tipo -> R001', (await alta('ropa', 'Camara')) === 'R001');
  const intsR = fake.dump('elementos_catalogo').filter((e) => e.tipo === 'ropa').map((e) => e.interno);
  check('sin internos duplicados en ropa', new Set(intsR).size === intsR.length, intsR.join(','));

  const counters = fake.dump('counters');
  check('el counter guarda el ultimo asignado', counters.find((c) => c.id === 'herramienta').current === 10,
    JSON.stringify(counters));
  check('los counters por tipo no se pisan', counters.length === 2, JSON.stringify(counters));

  check('alta sin nombre -> 400', (await req('POST', '/api/centros/elementos/disponibles', { body: { tipo: 'herramienta' } })).status === 400);
  check('tipo invalido -> 400', (await req('POST', '/api/centros/elementos/disponibles', { body: { tipo: 'inventado', nombre: 'X' } })).status === 400);

  section('RESUMEN DE SERVICE (recomputeServiceSummary)');
  const v = await req('POST', '/api/vehicles', { body: { patente: 'AA111BB', interno: 'V-00001', tipo: 'Camion', marca: 'Iveco' } });
  const vid = v.json.id;
  check('vehiculo creado', v.status === 201, JSON.stringify(v.json).slice(0, 120));

  // s1: km 30000 + intervalo 30000 = 60000 | s2: km 10000 + intervalo 10000 = 20000
  await req('POST', `/api/vehicles/${vid}/services`, { body: { tipo: 'Service 30.000km', km: 30000, intervalo: 30000, costo: 100 } });
  await req('POST', `/api/vehicles/${vid}/services`, { body: { tipo: 'Service 10.000km', km: 10000, intervalo: 10000, costo: 50 } });

  let veh = fake.dump('vehicles').find((x) => x.id === vid);
  check('proximoServiceKm = el mas bajo (20000)', veh.proximoServiceKm === 20000, veh.proximoServiceKm);
  check('proximoServiceTipo correcto', veh.proximoServiceTipo === 'Service 10.000km', veh.proximoServiceTipo);
  check('serviceSummary agrupa por tipo', Object.keys(veh.serviceSummary || {}).length === 2,
    JSON.stringify(Object.keys(veh.serviceSummary || {})));

  const cercano = fake.dump(`vehicles/${vid}/services`).find((s) => s.tipo === 'Service 10.000km');
  check('borrar service -> 200', (await req('DELETE', `/api/vehicles/${vid}/services/${cercano.id}`)).status === 200);
  veh = fake.dump('vehicles').find((x) => x.id === vid);
  check('recalcula tras borrar (60000)', veh.proximoServiceKm === 60000, veh.proximoServiceKm);
  check('recalcula el tipo', veh.proximoServiceTipo === 'Service 30.000km', veh.proximoServiceTipo);

  section('FieldValue.delete() en docsAdjuntos');
  const w = await req('POST', '/api/vehicles', { body: { patente: 'CC222DD', interno: 'V-00002', tipo: 'Auto' } });
  const wid = w.json.id;
  fake.seed(`vehicles/${wid}/docsadjuntos`, 'seguro', { bytes: 'x', tipo: 'pdf' });
  fake.db._map('vehicles').get(wid).docsAdjuntos = {
    seguro: { nombre: 'seguro.pdf', bytes: 1 },
    vtv: { nombre: 'vtv.pdf', bytes: 2 }
  };

  check('tipo de doc invalido -> 400', (await req('DELETE', `/api/vehicles/${wid}/documentos/licencia`)).status === 400);

  const delDoc = await req('DELETE', `/api/vehicles/${wid}/documentos/seguro`);
  check('borrar adjunto -> 200', delDoc.status === 200, JSON.stringify(delDoc.json));
  check('marca subido:true', delDoc.json && delDoc.json.subido === true, JSON.stringify(delDoc.json));

  veh = fake.dump('vehicles').find((x) => x.id === wid);
  check('FieldValue.delete() saco docsAdjuntos.seguro', veh.docsAdjuntos && veh.docsAdjuntos.seguro === undefined,
    JSON.stringify(veh.docsAdjuntos));
  check('NO toco el resto de docsAdjuntos', veh.docsAdjuntos && veh.docsAdjuntos.vtv &&
    veh.docsAdjuntos.vtv.nombre === 'vtv.pdf', JSON.stringify(veh.docsAdjuntos));
  check('borro el subdocumento', !fake.dump(`vehicles/${wid}/docsadjuntos`).some((d) => d.id === 'seguro'));
  check('borrar doc inexistente -> 503 sin GITHUB_TOKEN',
    (await req('DELETE', `/api/vehicles/${wid}/documentos/cedula`)).status === 503);

  section('PARAMETROS DE SERVICE (config/serviceParametros)');
  let cfg = await req('GET', '/api/vehicles/services/parametros');
  check('GET parametros -> 200', cfg.status === 200, JSON.stringify(cfg.json).slice(0, 120));
  check('seed con 16 items', cfg.json.items && cfg.json.items.length === 16, cfg.json.items && cfg.json.items.length);
  check('seed con 5 items fijos', cfg.json.items && cfg.json.items.filter((i) => i.fijo).length === 5);
  const aceiteSeed = cfg.json.items && cfg.json.items.find((i) => i.nombre === 'Cambio de aceite');
  check('aceite fijo con 10000 km', aceiteSeed && aceiteSeed.fijo === true && aceiteSeed.km === 10000,
    JSON.stringify(aceiteSeed));
  const alineacionSeed = cfg.json.items && cfg.json.items.find((i) => i.nombre === 'Alineación');
  check('item no fijo sin km ni meses', alineacionSeed && alineacionSeed.fijo === false && alineacionSeed.km === null && alineacionSeed.meses === null,
    JSON.stringify(alineacionSeed));

  const guardar = await req('PUT', '/api/vehicles/services/parametros', {
    body: {
      items: [
        { nombre: '  Cambio de aceite ', km: '12000', meses: '8', fijo: 'true' },
        { nombre: 'Cambio de aceite', km: 1, fijo: true },
        { nombre: '   ', km: 5 },
        { nombre: 'Otro', km: 9999999, meses: 999, fijo: false }
      ]
    }
  });
  check('PUT parametros -> 200', guardar.status === 200, JSON.stringify(guardar.json).slice(0, 160));
  check('dedupe y descarta nombre vacio', guardar.json.items && guardar.json.items.length === 2,
    JSON.stringify(guardar.json.items));
  check('normaliza nombre, km y fijo', guardar.json.items && guardar.json.items[0].nombre === 'Cambio de aceite' &&
    guardar.json.items[0].km === 12000 && guardar.json.items[0].fijo === true, JSON.stringify(guardar.json.items && guardar.json.items[0]));
  check('clamp de km y meses', guardar.json.items && guardar.json.items[1].km === 1000000 &&
    guardar.json.items[1].meses === 120, JSON.stringify(guardar.json.items && guardar.json.items[1]));

  cfg = await req('GET', '/api/vehicles/services/parametros');
  check('GET devuelve lo guardado', cfg.json.items && cfg.json.items.length === 2 && cfg.json.items[0].meses === 8,
    JSON.stringify(cfg.json.items));
  check('registra el autor', typeof cfg.json.actualizadoPor === 'string' && cfg.json.actualizadoPor.length > 0,
    JSON.stringify(cfg.json.actualizadoPor));
  check('PUT sin items -> 400', (await req('PUT', '/api/vehicles/services/parametros', { body: {} })).status === 400);
  check('PUT como Usuario -> 403',
    (await req('PUT', '/api/vehicles/services/parametros', { body: { items: [] }, as: 'user' })).status === 403);

  done();
})();
