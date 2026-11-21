process.env.GITHUB_TOKEN = 'test-token';

const assert = require('assert');
const fetchReal = global.fetch;
const archivos = new Map();
const b64 = s => Buffer.from(s).toString('base64');
const nombre = r => r.split('/').pop();

function respuesta(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

function arbol() {
  return {
    tree: [...archivos.keys()].map(p => ({ type: 'blob', path: p })),
    truncated: false
  };
}

global.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (!u.includes('api.github.com')) return fetchReal(url, opts);
  if (u.includes('/git/trees/main')) return respuesta(200, arbol());
  const m = /\/contents\/(.+)$/.exec(u);
  if (!m) return respuesta(404, {});
  const ruta = decodeURIComponent(m[1]);
  const method = opts.method || 'GET';
  if (method === 'PUT') {
    archivos.set(ruta, JSON.parse(opts.body).content);
    return respuesta(201, { content: { path: ruta } });
  }
  if (method === 'DELETE') {
    archivos.delete(ruta);
    return respuesta(200, {});
  }
  if (method === 'GET') {
    if (archivos.has(ruta)) {
      const c = archivos.get(ruta);
      return respuesta(200, {
        name: nombre(ruta),
        path: ruta,
        sha: `sha-${ruta}`,
        size: Buffer.from(c, 'base64').length,
        content: c,
        encoding: 'base64'
      });
    }
    const prefijo = `${ruta}/`;
    const hijos = [...archivos.keys()].filter(k => k.startsWith(prefijo));
    if (hijos.length) {
      return respuesta(200, hijos.map(k => ({
        name: nombre(k),
        path: k,
        sha: `sha-${k}`,
        size: Buffer.from(archivos.get(k), 'base64').length
      })));
    }
    return respuesta(404, {});
  }
  return respuesta(405, {});
};

const { fake, req, makeReporter } = require('./helpers');
const empleadosLib = require('../lib/empleados');
const vehiculoRoutes = require('../routes/vehicles');
const adminRoutes = require('../routes/admin');
const report = makeReporter('EMPLEADOS');

function limpiarDatos() {
  for (const k of [...fake.db.store.keys()]) {
    if (k === 'vehicles' || k.startsWith('employees')) fake.db.store.get(k).clear();
  }
  archivos.clear();
  empleadosLib.invalidarCacheArbol();
  vehiculoRoutes.invalidarCachesDocumentos();
  adminRoutes.invalidarCachesDocumentos();
}

function vehiculo(patente, datos = {}) {
  return {
    patente,
    interno: `V-${patente}`,
    chofer: '',
    dni: '',
    registro: '',
    vencimientoDNI: '',
    vencimientoRegistro: '',
    documentacion: {},
    ...datos
  };
}

function perfil(nombreCompleto, dni, registro, patenteActual, id) {
  const limpio = nombreCompleto;
  return {
    nombre: limpio,
    nombreNormalizado: empleadosLib.normalizarNombre(limpio),
    clave: empleadosLib.claveDe(limpio, dni),
    dni,
    registro,
    vencimientoDNI: '01/01/2030',
    vencimientoRegistro: '02/02/2030',
    activo: true,
    patenteActual,
    documentos: {
      dni: { ruta: `PATENTE/${patenteActual}/dni.pdf`, presente: true },
      registro: { ruta: `PATENTE/${patenteActual}/registro.pdf`, presente: true }
    },
    conflictos: [],
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    creadoPor: 'Admin',
    actualizadoPor: 'Admin',
    id
  };
}

(async () => {
  report.section('AUTH Y ROLES');
  limpiarDatos();

  let r = await req('GET', '/api/empleados', { as: 'none' });
  report.check('GET sin token -> 401', r.status === 401, `status=${r.status}`);

  r = await req('GET', '/api/empleados', { as: 'user' });
  report.check('GET como Usuario -> 200', r.status === 200 && r.json?.ok === true, `status=${r.status}`);

  r = await req('POST', '/api/empleados', { as: 'user', body: { nombre: 'Juan Perez' } });
  report.check('POST como Usuario -> 403', r.status === 403, `status=${r.status}`);

  report.section('ALTA Y NORMALIZACION');
  r = await req('POST', '/api/empleados', {
    as: 'admin',
    body: {
      nombre: '  Juan   Pérez ',
      dni: '333-',
      registro: ' R-333 ',
      vencimientoDNI: '01/01/2030',
      vencimientoRegistro: '02/02/2030'
    }
  });
  report.check('POST como Admin -> 201', r.status === 201 && r.json?.ok === true, `status=${r.status} ${JSON.stringify(r.json)}`);

  const creados = fake.dump('employees');
  report.check('perfil creado con nombre normalizado', creados.length === 1 && creados[0].nombreNormalizado === 'juan perez' && creados[0].dni === '333-', JSON.stringify(creados));

  report.section('SINCRONIZACION DESDE VEHICULOS');
  limpiarDatos();
  fake.seed('employees', 'empA', perfil('Ana Perez', '111', 'R1', 'ORIA', 'empA'));
  fake.seed('employees', 'empB', perfil('Beto Gomez', '222', 'R2', 'DESTB', 'empB'));
  fake.seed('vehicles', 'vA', vehiculo('ORIA', { chofer: 'Ana Perez', dni: '111', registro: 'R1', empleadoId: 'empA', vencimientoDNI: '01/01/2030', vencimientoRegistro: '02/02/2030' }));
  fake.seed('vehicles', 'vB', vehiculo('DESTB', { chofer: 'Beto Gomez', dni: '222', registro: 'R2', empleadoId: 'empB', vencimientoDNI: '01/01/2030', vencimientoRegistro: '02/02/2030' }));
  fake.seed('vehicles', 'vD', vehiculo('CONF', { chofer: 'Ana Perez', dni: '999', registro: 'R9' }));
  fake.seed('vehicles', 'vC', vehiculo('SINCH', { documentacion: { dni: { fechaVencimiento: '01/01/2020' }, registro: { fechaVencimiento: '01/01/2020' } } }));

  r = await req('POST', '/api/empleados/sincronizar', { as: 'admin', body: {} });
  report.check('sincronizar -> 200', r.status === 200 && r.json?.ok === true, `status=${r.status} ${JSON.stringify(r.json)}`);
  report.check('sincronizar creo perfil virtual y detecto conflicto', r.json?.creados === 1 && (r.json?.conflictos || []).includes('Ana Perez'), JSON.stringify(r.json));

  const sinChofer = fake.dump('vehicles').find(v => v.patente === 'SINCH');
  report.check('vehiculo sin chofer queda marcado sinChofer', sinChofer?.documentacion?.dni?.sinChofer === true && sinChofer?.documentacion?.registro?.sinChofer === true && sinChofer?.documentacion?.dni?.fechaVencimiento === undefined, JSON.stringify(sinChofer));

  r = await req('GET', '/api/empleados', { as: 'user' });
  const lista = r.json?.empleados || [];
  const empA = lista.find(e => e.id === 'empA');
  report.check('lista agrupa patentes por empleado', !!empA && empA.patentes?.some(p => p.patente === 'ORIA') && (empA.conflictos || []).length > 0, JSON.stringify(empA));

  report.section('EDICION Y ESPEJO');
  limpiarDatos();
  fake.seed('employees', 'emp1', perfil('Juan Lopez', '333', 'R-333', 'X1', 'emp1'));
  fake.seed('vehicles', 'v1', vehiculo('X1', { chofer: 'Juan Lopez', dni: '333', registro: 'R-333', empleadoId: 'emp1' }));
  fake.seed('vehicles', 'v2', vehiculo('X2', { chofer: 'juan lopez', dni: '333-', registro: 'R-333', empleadoId: 'emp1' }));

  r = await req('PUT', '/api/empleados/emp1', {
    as: 'admin',
    body: { nombre: 'Juan Lopez', dni: '333', registro: 'R-333-NUEVO', vencimientoDNI: '03/03/2031', vencimientoRegistro: '04/04/2031', activo: false }
  });
  report.check('PUT edita perfil -> 200', r.status === 200 && r.json?.ok === true, `status=${r.status}`);
  const espejos = fake.dump('vehicles');
  report.check('PUT replica registro/vencimientos en todos los vehiculos', espejos.every(v => v.registro === 'R-333-NUEVO' && v.vencimientoDNI === '03/03/2031' && v.documentacion?.dni?.fechaVencimiento === '03/03/2031'), JSON.stringify(espejos));
  report.check('activo se guarda como booleano', fake.dump('employees')[0].activo === false, String(fake.dump('employees')[0].activo));

  report.section('HISTORIAL');
  limpiarDatos();
  fake.seed('employees', 'emp1', perfil('Ana Perez', '111', 'R1', 'ORIA', 'emp1'));
  fake.seed('employees/emp1/historial', 'h1', { desde: '2026-01-01', hasta: null, patente: 'ORIA', interno: 'V1', motivo: '' });
  r = await req('PATCH', '/api/empleados/emp1/historial/h1', { as: 'admin', body: { hasta: '21/11/2026', motivo: 'Traslado' } });
  report.check('PATCH historial -> 200', r.status === 200 && r.json?.ok === true, `status=${r.status}`);
  const hist = fake.dump('employees/emp1/historial')[0];
  report.check('historial guarda hasta y motivo', hist?.hasta === '21/11/2026' && hist?.motivo === 'Traslado', JSON.stringify(hist));

  report.section('TRASLADO CON DOCUMENTOS');
  limpiarDatos();
  archivos.set('PATENTE/ORIA/dni.pdf', b64('DNI-ANA'));
  archivos.set('PATENTE/ORIA/registro.pdf', b64('REG-ANA'));
  archivos.set('PATENTE/DESTB/dni.pdf', b64('DNI-BETO'));
  archivos.set('PATENTE/DESTB/registro.pdf', b64('REG-BETO'));
  fake.seed('employees', 'empA', perfil('Ana Perez', '111', 'R1', 'ORIA', 'empA'));
  fake.seed('employees', 'empB', perfil('Beto Gomez', '222', 'R2', 'DESTB', 'empB'));
  fake.seed('vehicles', 'vA', vehiculo('ORIA', { chofer: 'Ana Perez', dni: '111', registro: 'R1', empleadoId: 'empA' }));
  fake.seed('vehicles', 'vB', vehiculo('DESTB', { chofer: 'Beto Gomez', dni: '222', registro: 'R2', empleadoId: 'empB' }));

  r = await req('POST', '/api/empleados/mover', { as: 'admin', body: { empleadoId: 'empA', patenteOrigen: 'ORIA', patenteDestino: 'DESTB' } });
  report.check('mover destino ocupado -> 409', r.status === 409, `status=${r.status} ${JSON.stringify(r.json)}`);

  r = await req('POST', '/api/empleados/mover', { as: 'admin', body: { empleadoId: 'empA', patenteOrigen: 'ORIA', patenteDestino: 'DESTB', reemplazar: true } });
  report.check('mover con reemplazo -> 200', r.status === 200 && r.json?.ok === true, `status=${r.status} ${JSON.stringify(r.json)}`);
  report.check('DNI de A queda en destino', Buffer.from(archivos.get('PATENTE/DESTB/dni.pdf') || '', 'base64').toString() === 'DNI-ANA', [...archivos.keys()].join(','));
  report.check('B queda estacionado en EMPLEADOS', Buffer.from(archivos.get('PATENTE/EMPLEADOS/empB/dni.pdf') || '', 'base64').toString() === 'DNI-BETO', [...archivos.keys()].join(','));
  report.check('origen queda sin chofer y sin documentos', !archivos.has('PATENTE/ORIA/dni.pdf') && (fake.dump('vehicles').find(v => v.patente === 'ORIA')?.documentacion?.dni?.sinChofer === true), [...archivos.keys()].join(','));

  const trasladados = fake.dump('employees');
  const perfilADespues = trasladados.find(e => e.id === 'empA');
  const perfilBDespues = trasladados.find(e => e.id === 'empB');
  report.check('perfiles actualizados tras traslado', perfilADespues?.patenteActual === 'DESTB' && perfilBDespues?.patenteActual === null, JSON.stringify([perfilADespues, perfilBDespues]));
  const historialB = fake.dump('employees/empB/historial');
  const historialA = fake.dump('employees/empA/historial');
  report.check('historial cierra B y abre A', historialB.length === 1 && !!historialB[0].hasta && historialA.some(h => !!h.hasta) && historialA.some(h => !h.hasta), JSON.stringify([historialB, historialA]));

  r = await req('GET', '/api/empleados/empA/documentos/dni', { as: 'user' });
  report.check('lectura autenticada de documento', r.status === 200, `status=${r.status}`);

  report.section('GUARDAS sinChofer EN REPORTES');
  limpiarDatos();
  fake.seed('vehicles', 'vSC', vehiculo('SINCH', { documentacion: { dni: { sinChofer: true, noVence: true }, registro: { sinChofer: true, noVence: true } } }));
  r = await req('GET', '/api/vehicles/documentos/reporte', { as: 'user' });
  const filaSC = r.json?.rows?.find(x => x.patente === 'SINCH');
  report.check('reporte documentos marca DNI/Registro sinChofer como presentes', filaSC?.docs?.dni === true && filaSC?.docs?.registro === true && filaSC?.faltantes === 4, JSON.stringify(filaSC));

  r = await req('GET', '/api/admin/report/flota', { as: 'admin' });
  const filaAdmin = r.json?.vehicles?.find(x => x.patente === 'SINCH') || r.json?.flota?.find(x => x.patente === 'SINCH');
  report.check('reporte flota no cuenta DNI/Registro sinChofer como faltantes', !!filaAdmin && filaAdmin.dniSinChofer === true && filaAdmin.registroSinChofer === true && filaAdmin.docs?.dni === true && filaAdmin.docs?.registro === true && filaAdmin.registroFecha === null && filaAdmin.dniFecha === null, JSON.stringify(filaAdmin));

  report.done();
})().catch(e => { console.error(e); process.exit(1); });
