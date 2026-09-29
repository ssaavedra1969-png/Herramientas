'use strict';
/* Escrituras: auth, obras, elementos, vehículos. Corre: npm run test:escrituras */
const { fake, req, makeReporter } = require('./helpers');
const { check, section, done } = makeReporter('escrituras');

(async () => {
  section('AUTH');
  check('sin token -> 401', (await req('GET', '/api/centros', { as: 'none' })).status === 401);
  check('token invalido -> 401', (await req('GET', '/api/centros', { as: 'invalid' })).status === 401);
  check('POST como Usuario -> 403', (await req('POST', '/api/centros', { body: { nombre: 'X' }, as: 'user' })).status === 403);
  check('DELETE inexistente -> 404', (await req('DELETE', '/api/centros/zzz')).status === 404);

  section('CENTROS: crear');
  check('nombre vacio -> 400', (await req('POST', '/api/centros', { body: { nombre: '   ' } })).status === 400);

  const rCrear = await req('POST', '/api/centros', {
    body: { nombre: '  Obra Norte  ', ubicacion: ' Ruta 8 ', observaciones: ' x ' }
  });
  check('crear -> 201', rCrear.status === 201, JSON.stringify(rCrear.json));
  const obraId = rCrear.json && rCrear.json.id;
  check('devuelve id', !!obraId);

  const guardada = fake.dump('centros').find((c) => c.id === obraId);
  check('recorta el nombre', guardada.nombre === 'Obra Norte', guardada.nombre);
  check('recorta ubicacion', guardada.ubicacion === 'Ruta 8', guardada.ubicacion);
  check('recorta observaciones', guardada.observaciones === 'x', guardada.observaciones);
  check('estado inicial = activa', guardada.estado === 'activa', guardada.estado);

  section('CENTROS: editar');
  check('nombre vacio -> 400', (await req('PUT', `/api/centros/${obraId}`, { body: { nombre: '  ' } })).status === 400);
  check('estado invalido -> 400', (await req('PUT', `/api/centros/${obraId}`, { body: { estado: 'inventada' } })).status === 400);

  const rPut = await req('PUT', `/api/centros/${obraId}`, {
    body: { nombre: '  Obra Sur  ', estado: 'pausada', ubicacion: '  Av 1  ', observaciones: '  nota  ' }
  });
  check('editar -> 200', rPut.status === 200, JSON.stringify(rPut.json));
  const editado = fake.dump('centros').find((c) => c.id === obraId);
  check('PUT recorta nombre', editado.nombre === 'Obra Sur', editado.nombre);
  check('PUT recorta ubicacion', editado.ubicacion === 'Av 1', editado.ubicacion);
  check('PUT recorta observaciones', editado.observaciones === 'nota', editado.observaciones);
  check('PUT aplica estado', editado.estado === 'pausada', editado.estado);

  section('CENTROS: elementos');
  check('asignar sin interno -> 400',
    (await req('POST', `/api/centros/${obraId}/elementos`, { body: { elementoTipo: 'herramienta' } })).status === 400);

  const rElem = await req('POST', `/api/centros/${obraId}/elementos`, {
    body: { interno: 'HERR-001', elementoTipo: 'herramienta' }
  });
  check('asignar elemento -> 201', rElem.status === 201, JSON.stringify(rElem.json));
  check('fechaDevolucion vacia al asignar',
    (fake.dump(`centros/${obraId}/elementos`)[0] || {}).fechaDevolucion === '');

  section('CENTROS: borrado con 409');
  const r409 = await req('DELETE', `/api/centros/${obraId}`);
  check('borrar con elemento sin devolver -> 409', r409.status === 409, 'status=' + r409.status);
  check('el 409 menciona el elemento', /sin devolver/.test(r409.json?.error || ''), r409.json?.error);
  check('la obra NO se borro', fake.dump('centros').some((c) => c.id === obraId));

  // elemento legacy: sin el campo fechaDevolucion (no debe dejarse pasar)
  const rElem2 = await req('POST', `/api/centros/${obraId}/elementos`, {
    body: { interno: 'HERR-VIEJO', elementoTipo: 'equipo' }
  });
  const viejoId = rElem2.json.id;
  delete fake.db._map(`centros/${obraId}/elementos`).get(viejoId).fechaDevolucion;
  check('borrado con elemento viejo (sin campo) -> 409',
    (await req('DELETE', `/api/centros/${obraId}`)).status === 409);

  section('CENTROS: devolver y borrar');
  check('devolver inexistente -> 404', (await req('DELETE', `/api/centros/${obraId}/elementos/zzz`)).status === 404);
  check('devolver -> 200', (await req('DELETE', `/api/centros/${obraId}/elementos/${rElem.json.id}`)).status === 200);
  check('devolver el viejo -> 200', (await req('DELETE', `/api/centros/${obraId}/elementos/${viejoId}`)).status === 200);

  const rDel = await req('DELETE', `/api/centros/${obraId}`);
  check('borrar obra sin pendientes -> 200', rDel.status === 200, JSON.stringify(rDel.json));
  check('la obra se borro', !fake.dump('centros').some((c) => c.id === obraId));
  check('la subcoleccion quedo vacia', fake.dump(`centros/${obraId}/elementos`).length === 0);
  check('borro los 2 elementos', rDel.json && rDel.json.elementosBorrados === 2, JSON.stringify(rDel.json));
  check('borrar de nuevo -> 404', (await req('DELETE', `/api/centros/${obraId}`)).status === 404);

  section('VEHICLES: crear');
  const rVeh = await req('POST', '/api/vehicles', {
    body: { patente: 'AB123CD', marca: 'Iveco', tipo: 'Camion' }
  });
  check('crear vehiculo -> 201', rVeh.status === 201, JSON.stringify(rVeh.json).slice(0, 200));
  const vehId = rVeh.json && rVeh.json.id;

  section('VEHICLES: combustible / repuestos / services');
  const rComb = await req('POST', `/api/vehicles/${vehId}/combustible`, { body: { litros: 100, importe: 250000, km: 1000 } });
  check('agregar combustible -> 201', rComb.status === 201, JSON.stringify(rComb.json).slice(0, 150));
  check('leer combustible -> 200', (await req('GET', `/api/vehicles/${vehId}/combustible`)).status === 200);

  const rRep = await req('POST', `/api/vehicles/${vehId}/repuestos`, { body: { pieza: 'Filtro', costo: 50000 } });
  check('agregar repuesto -> 201', rRep.status === 201, JSON.stringify(rRep.json).slice(0, 150));

  const rSvc = await req('POST', `/api/vehicles/${vehId}/services`, {
    body: { tipo: 'Mecánico', descripcion: 'Service 10.000', costo: 120000 }
  });
  check('agregar service -> 201', rSvc.status === 201, JSON.stringify(rSvc.json).slice(0, 150));
  check('leer services -> 200', (await req('GET', `/api/vehicles/${vehId}/services`)).status === 200);

  section('VEHICLES: editar / borrar');
  const rVehPut = await req('PUT', `/api/vehicles/${vehId}`, { body: { marca: 'Scania', kilometraje: 55555 } });
  check('editar vehiculo -> 200', rVehPut.status === 200, JSON.stringify(rVehPut.json).slice(0, 150));
  const veh = fake.dump('vehicles').find((v) => v.id === vehId);
  check('aplica la marca', veh.marca === 'Scania', veh.marca);
  check('aplica el kilometraje', veh.kilometraje === 55555, veh.kilometraje);

  const rVehDel = await req('DELETE', `/api/vehicles/${vehId}`);
  check('borrar vehiculo -> 200', rVehDel.status === 200, JSON.stringify(rVehDel.json).slice(0, 150));
  check('el vehiculo se borro', !fake.dump('vehicles').some((v) => v.id === vehId));

  section('ROLES: no-admin no escribe');
  check('Usuario no crea obra', (await req('POST', '/api/centros', { body: { nombre: 'hack' }, as: 'user' })).status === 403);
  check('Usuario no borra obra', (await req('DELETE', `/api/centros/${obraId}`, { as: 'user' })).status === 403);
  check('Usuario no crea elemento', (await req('POST', `/api/centros/${obraId}/elementos`, {
    body: { interno: 'a', elementoTipo: 'herramienta' }, as: 'user'
  })).status === 403);

  done();
})();
