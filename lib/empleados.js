const { admin } = require('../config/firebase');
const gh = require('./github-docs');

const FieldValue = admin.firestore.FieldValue;
const TIPOS_DOC = ['dni', 'registro'];

let arbolCache = null;
let arbolCacheEn = 0;

function normalizarNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarDni(dni) {
  return String(dni || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function claveDe(nombre, dni) {
  return `${normalizarNombre(nombre)}|${normalizarDni(dni)}`;
}

function limpiar(valor, max = 160) {
  return String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim().slice(0, max);
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function selloBackup() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
}

function nuevoId() {
  return `h${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

function rutaVehiculo(patente, tipo) {
  return `PATENTE/${String(patente || '').toUpperCase()}/${tipo}.pdf`;
}

function invalidarCacheArbol() {
  arbolCache = null;
  arbolCacheEn = 0;
}

async function arbolesDocumentos() {
  const ahora = Date.now();
  if (arbolCache && ahora - arbolCacheEn < 10 * 60 * 1000) return arbolCache;
  const [patentes, empleados] = await Promise.all([
    gh.listarPatenteGlobal().catch(() => null),
    gh.listarEmpleadosGlobal().catch(() => null)
  ]);
  arbolCache = { patentes, empleados };
  arbolCacheEn = ahora;
  return arbolCache;
}

function rutaPresente(ruta, tipo, arboles, meta) {
  if (!ruta) return false;
  const partes = String(ruta).split('/');
  if ((partes[2] || '').toUpperCase() === 'EMPLEADOS') {
    const id = partes[3];
    const nombres = (arboles.empleados && arboles.empleados.get(id)) || [];
    return nombres.some(n => gh.esDeTipo(n, tipo)) || !!(meta && meta.presente);
  }
  const patente = (partes[1] || '').toUpperCase();
  const nombres = (arboles.patentes && arboles.patentes.get(patente)) || [];
  return nombres.some(n => gh.esDeTipo(n, tipo)) || !!(meta && meta.presente) || !!(meta && meta.adjunto);
}

function construirPerfil(datos, usuario, id) {
  const nombre = limpiar(datos.nombre, 120);
  return {
    nombre,
    nombreNormalizado: normalizarNombre(nombre),
    clave: claveDe(nombre, datos.dni),
    dni: limpiar(datos.dni, 40),
    registro: limpiar(datos.registro, 40),
    vencimientoDNI: limpiar(datos.vencimientoDNI, 30),
    vencimientoRegistro: limpiar(datos.vencimientoRegistro, 30),
    activo: datos.activo !== false,
    patenteActual: datos.patenteActual || null,
    documentos: {
      dni: { ruta: (datos.documentos && datos.documentos.dni && datos.documentos.dni.ruta) || null, presente: false },
      registro: { ruta: (datos.documentos && datos.documentos.registro && datos.documentos.registro.ruta) || null, presente: false }
    },
    conflictos: [],
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    creadoPor: usuario || 'sistema',
    actualizadoPor: usuario || 'sistema',
    ...(id ? { id } : {})
  };
}

function camposEspejo(empleado, opciones = {}) {
  const sinChofer = opciones.sinChofer === true;
  const patch = {
    chofer: sinChofer ? '' : (empleado.nombre || ''),
    dni: sinChofer ? '' : (empleado.dni || ''),
    registro: sinChofer ? '' : (empleado.registro || ''),
    vencimientoDNI: sinChofer ? '' : (empleado.vencimientoDNI || ''),
    vencimientoRegistro: sinChofer ? '' : (empleado.vencimientoRegistro || ''),
    empleadoId: sinChofer ? FieldValue.delete() : (empleado.id || null),
    'documentacion.dni.sinChofer': sinChofer ? true : FieldValue.delete(),
    'documentacion.registro.sinChofer': sinChofer ? true : FieldValue.delete(),
    'documentacion.dni.noVence': sinChofer ? true : FieldValue.delete(),
    'documentacion.registro.noVence': sinChofer ? true : FieldValue.delete(),
    'documentacion.dni.fechaVencimiento': sinChofer || !empleado.vencimientoDNI ? FieldValue.delete() : empleado.vencimientoDNI,
    'documentacion.registro.fechaVencimiento': sinChofer || !empleado.vencimientoRegistro ? FieldValue.delete() : empleado.vencimientoRegistro
  };
  return patch;
}

async function cargarDatos(db) {
  const [vehiculos, perfiles] = await Promise.all([
    db.collection('vehicles').get(),
    db.collection('employees').get()
  ]);
  return {
    vehiculos: vehiculos.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() })),
    perfiles: perfiles.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
  };
}

async function obtenerEmpleados(db) {
  const { vehiculos, perfiles } = await cargarDatos(db);
  const arboles = await arbolesDocumentos();
  const porClave = new Map();
  const porNombre = new Map();

  perfiles.forEach(p => {
    const normalizado = p.nombreNormalizado || normalizarNombre(p.nombre);
    const clave = p.clave || claveDe(p.nombre, p.dni);
    p.nombreNormalizado = normalizado;
    p.clave = clave;
    p._patentes = [];
    p._virtual = false;
    porClave.set(clave, p);
    if (!porNombre.has(normalizado)) porNombre.set(normalizado, []);
    porNombre.get(normalizado).push(p);
  });

  const avisoDuplicado = 'Posible duplicado por DNI distinto';
  porNombre.forEach(grupo => {
    const dnis = new Set(grupo.map(e => normalizarDni(e.dni)).filter(Boolean));
    if (dnis.size < 2) return;
    grupo.forEach(e => {
      e.conflictos = [...new Set([...(e.conflictos || []), avisoDuplicado])];
    });
  });

  vehiculos.forEach(v => {
    const nombre = v.chofer || v.conductorHabitual || '';
    if (!normalizarNombre(nombre)) return;
    const clave = claveDe(nombre, v.dni);
    let emp = porClave.get(clave);
    if (!emp) {
      const normalizado = normalizarNombre(nombre);
      const otros = porNombre.get(normalizado) || [];
      const aviso = 'Posible duplicado por DNI distinto';
      otros.forEach(o => {
        o.conflictos = [...new Set([...(o.conflictos || []), aviso])];
      });
      emp = construirPerfil({
        nombre,
        dni: v.dni,
        registro: v.registro,
        vencimientoDNI: v.vencimientoDNI,
        vencimientoRegistro: v.vencimientoRegistro
      }, null);
      emp.conflictos = otros.length ? [aviso] : [];
      emp._patentes = [];
      emp._virtual = true;
      porClave.set(clave, emp);
      if (!porNombre.has(normalizado)) porNombre.set(normalizado, []);
      porNombre.get(normalizado).push(emp);
    }
    const patente = String(v.patente || '').toUpperCase();
    emp._patentes.push({
      patente,
      interno: v.interno || '',
      vehiculoId: v.id,
      empresa: v.empresa || '',
      centroTrabajo: v.centroTrabajo || '',
      deshabilitado: !!v.deshabilitado
    });
    if (!emp.patenteActual) emp.patenteActual = patente;
  });

  const lista = [...porClave.values()].map(e => {
    const patentes = e._patentes.length
      ? e._patentes
      : (e.patenteActual ? [{ patente: e.patenteActual, interno: '', vehiculoId: '', empresa: '', centroTrabajo: '', deshabilitado: false }] : []);
    const asignado = patentes.some(p => p.patente === e.patenteActual);
    const documentos = {};
    TIPOS_DOC.forEach(tipo => {
      const meta = (e.documentos && e.documentos[tipo]) || {};
      const ruta = meta.ruta || (asignado ? rutaVehiculo(e.patenteActual, tipo) : null);
      documentos[tipo] = {
        ruta,
        presente: rutaPresente(ruta, tipo, arboles, meta),
        adjunto: !!meta.adjunto
      };
    });
    return {
      id: e.id || null,
      nombre: e.nombre || '',
      nombreNormalizado: e.nombreNormalizado || '',
      dni: e.dni || '',
      registro: e.registro || '',
      vencimientoDNI: e.vencimientoDNI || '',
      vencimientoRegistro: e.vencimientoRegistro || '',
      activo: e.activo !== false,
      patenteActual: asignado ? e.patenteActual : null,
      sinAsignar: !asignado,
      virtual: !!e._virtual,
      patentes,
      documentos,
      conflictos: e.conflictos || [],
      actualizadoEn: e.actualizadoEn || null
    };
  });

  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base' }) || String(a.patenteActual || '').localeCompare(String(b.patenteActual || '')));
  return lista;
}

async function obtenerHistorial(db, id) {
  const snap = await db.collection(`employees/${id}/historial`).get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.desde || '').localeCompare(String(a.desde || '')));
}

async function obtenerEmpleado(db, id) {
  const doc = await db.collection('employees').doc(id).get();
  if (!doc.exists) return null;
  const datos = doc.data();
  const lista = await obtenerEmpleados(db);
  const basico = lista.find(e => e.id === id) || null;
  return {
    ...datos,
    ...(basico || {}),
    id,
    historial: await obtenerHistorial(db, id)
  };
}

async function crearEmpleado(db, datos, usuario) {
  const perfil = construirPerfil(datos, usuario);
  const ref = await db.collection('employees').add(perfil);
  return { id: ref.id, ...perfil };
}

async function sincronizarEspejos(db, id, datos) {
  const refs = new Map();
  const porId = await db.collection('vehicles').where('empleadoId', '==', id).get();
  porId.forEach(d => refs.set(d.id, d.ref));
  const todas = await db.collection('vehicles').get();
  todas.forEach(d => {
    const v = d.data();
    const mismoNombre = normalizarNombre(v.chofer || v.conductorHabitual) === normalizarNombre(datos.nombre);
    const mismoDni = !normalizarDni(datos.dni) || normalizarDni(v.dni) === normalizarDni(datos.dni);
    if (mismoNombre && mismoDni) refs.set(d.id, d.ref);
  });
  if (!refs.size) return 0;
  const patch = camposEspejo({ ...datos, id }, { sinChofer: false });
  const batch = db.batch();
  refs.forEach(ref => batch.update(ref, patch));
  await batch.commit();
  return refs.size;
}

async function actualizarEmpleado(db, id, datos, usuario) {
  const doc = await db.collection('employees').doc(id).get();
  if (!doc.exists) return null;
  const actual = doc.data();
  const patch = { actualizadoEn: new Date().toISOString(), actualizadoPor: usuario || 'sistema' };
  ['nombre', 'dni', 'registro', 'vencimientoDNI', 'vencimientoRegistro'].forEach(k => {
    if (Object.prototype.hasOwnProperty.call(datos, k)) patch[k] = limpiar(datos[k], k === 'nombre' ? 120 : 40);
  });
  if (Object.prototype.hasOwnProperty.call(datos, 'activo')) patch.activo = datos.activo !== false;
  if (Object.prototype.hasOwnProperty.call(patch, 'nombre')) {
    patch.nombreNormalizado = normalizarNombre(patch.nombre);
    patch.clave = claveDe(patch.nombre, Object.prototype.hasOwnProperty.call(patch, 'dni') ? patch.dni : actual.dni);
  }
  await db.collection('employees').doc(id).update(patch);
  const final = { ...actual, ...patch, id };
  await sincronizarEspejos(db, id, final);
  return final;
}

async function actualizarHistorial(db, id, histId, datos, usuario) {
  const ref = db.collection(`employees/${id}/historial`).doc(histId);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const patch = { actualizadoPor: usuario || 'sistema' };
  ['desde', 'hasta', 'patente', 'interno', 'motivo'].forEach(k => {
    if (Object.prototype.hasOwnProperty.call(datos, k)) patch[k] = datos[k] === null ? null : limpiar(datos[k], 60);
  });
  await ref.update(patch);
  return { id: histId, ...doc.data(), ...patch };
}

async function buscarVehiculoPorPatente(db, patente) {
  const snap = await db.collection('vehicles').where('patente', '==', String(patente || '').toUpperCase()).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ref: d.ref, ...d.data() };
}

async function resolverOcupante(db, destino, perfilA, usuario) {
  const idGuardado = destino.empleadoId;
  if (idGuardado && idGuardado !== perfilA.id) {
    const doc = await db.collection('employees').doc(idGuardado).get();
    if (doc.exists) return { id: idGuardado, datos: doc.data(), esNuevo: false };
  }
  const nombre = destino.chofer || destino.conductorHabitual || '';
  if (!normalizarNombre(nombre)) return null;
  const clave = claveDe(nombre, destino.dni);
  const snap = await db.collection('employees').get();
  let encontrado = null;
  snap.forEach(d => {
    const e = d.data();
    if ((e.clave || claveDe(e.nombre, e.dni)) === clave) encontrado = { id: d.id, datos: e, esNuevo: false };
  });
  if (encontrado) return encontrado;
  const perfil = construirPerfil({
    nombre,
    dni: destino.dni,
    registro: destino.registro,
    vencimientoDNI: destino.vencimientoDNI,
    vencimientoRegistro: destino.vencimientoRegistro,
    patenteActual: String(destino.patente || '').toUpperCase()
  }, usuario);
  perfil.documentos.dni.ruta = rutaVehiculo(destino.patente, 'dni');
  perfil.documentos.registro.ruta = rutaVehiculo(destino.patente, 'registro');
  const ref = await db.collection('employees').add(perfil);
  return { id: ref.id, datos: { ...perfil, id: ref.id }, esNuevo: true };
}

async function bytesBase64(leido) {
  if (leido.content && leido.content.length) return String(leido.content).replace(/\s/g, '');
  if (leido.download_url) {
    const resp = await fetch(leido.download_url);
    if (!resp.ok) throw new Error(`No se pudo descargar el documento (${resp.status})`);
    return Buffer.from(await resp.arrayBuffer()).toString('base64');
  }
  throw new Error('El documento no tiene contenido');
}

async function asegurarDestinoLibre(destinoRuta, tipo, reemplazar) {
  const actual = await gh.leerRuta(destinoRuta, { tipo: null });
  if (!actual) return false;
  if (!reemplazar) {
    const err = new Error(`El destino ya tiene ${tipo}`);
    err.code = 'CONFLICTO';
    throw err;
  }
  const respaldo = destinoRuta.replace(/\.pdf$/i, `_al ${selloBackup()}.pdf`);
  await gh.escribirRuta(respaldo, await bytesBase64(actual), `Docs: respaldo ${tipo} ${selloBackup()}`);
  await gh.borrarRuta(destinoRuta, actual.sha, `Docs: limpiar destino ${tipo}`);
  return true;
}

async function moverDocumento(origenRuta, destinoRuta, tipo, opciones = {}) {
  const existe = await gh.leerRuta(origenRuta, { tipo });
  if (!existe) return false;
  await gh.moverRuta(origenRuta, destinoRuta, {
    tipoOrigen: tipo,
    tipoDestino: opciones.tipoDestino === undefined ? tipo : opciones.tipoDestino,
    mensaje: `Docs: mover ${tipo}`,
    mensajeBorrado: `Docs: quitar ${tipo} del origen`
  });
  return true;
}

async function moverDesdeAdjunto(vehiculo, tipo, destinoRuta) {
  if (!vehiculo || !vehiculo.ref) return false;
  const ref = vehiculo.ref.collection('docsadjuntos').doc(tipo);
  const doc = await ref.get();
  if (!doc.exists || !doc.data().bytes) return false;
  const bytes = doc.data().bytes;
  const base64 = Buffer.isBuffer(bytes) ? bytes.toString('base64') : Buffer.from(bytes).toString('base64');
  await gh.escribirRuta(destinoRuta, base64, `Docs: migrar ${tipo}`);
  const verificado = await gh.leerRuta(destinoRuta, { tipo: null });
  if (!verificado) throw new Error('No se pudo verificar el documento migrado; el origen NO fue borrado');
  await ref.delete();
  return true;
}

function cambiosHistorialCierre(db, batch, id, patente, usuario) {
  const refColeccion = db.collection(`employees/${id}/historial`);
  return refColeccion.where('hasta', '==', null).get().then(snap => {
    if (!snap.empty) {
      snap.forEach(d => batch.update(d.ref, { hasta: hoy(), actualizadoPor: usuario || 'sistema' }));
      return;
    }
    if (!patente) return;
    batch.set(refColeccion.doc(nuevoId()), {
      patente,
      interno: '',
      desde: hoy(),
      hasta: hoy(),
      motivo: 'Cierre automático',
      creadoPor: usuario || 'sistema'
    });
  });
}

function cambioHistorialApertura(db, batch, id, patente, interno, usuario, motivo) {
  batch.set(db.collection(`employees/${id}/historial`).doc(nuevoId()), {
    patente,
    interno: interno || '',
    desde: hoy(),
    hasta: null,
    motivo: motivo || 'Asignación',
    creadoPor: usuario || 'sistema'
  });
}

async function moverChofer(db, params, usuario) {
  const id = String(params.empleadoId || '');
  const destino = String(params.patenteDestino || '').toUpperCase();
  if (!id || !destino) throw Object.assign(new Error('Faltan datos del traslado'), { code: 'VALIDACION' });
  const docA = await db.collection('employees').doc(id).get();
  if (!docA.exists) throw Object.assign(new Error('Empleado no encontrado'), { code: 'NO_ENCONTRADO' });
  const perfilA = { ...docA.data(), id };
  const destinoDoc = await buscarVehiculoPorPatente(db, destino);
  if (!destinoDoc) throw Object.assign(new Error('Patente destino no encontrada'), { code: 'NO_ENCONTRADO' });

  const mismo = destinoDoc.empleadoId === id || normalizarNombre(destinoDoc.chofer || destinoDoc.conductorHabitual) === normalizarNombre(perfilA.nombre);
  if (mismo && perfilA.patenteActual === destino) throw Object.assign(new Error('El chofer ya está en esa patente'), { code: 'VALIDACION' });

  const origen = String(params.patenteOrigen || perfilA.patenteActual || '').toUpperCase();
  const origenDoc = origen ? await buscarVehiculoPorPatente(db, origen) : null;
  const ocupante = await resolverOcupante(db, destinoDoc, perfilA, usuario);
  if (ocupante && ocupante.id === id) throw Object.assign(new Error('El chofer destino es el mismo'), { code: 'VALIDACION' });

  const tipos = Array.isArray(params.tipos) && params.tipos.length ? params.tipos.filter(t => TIPOS_DOC.includes(t)) : TIPOS_DOC;
  const reemplazar = params.reemplazar === true;
  if (ocupante && !reemplazar) {
    const error = new Error(`La patente ${destino} ya tiene asignado a ${ocupante.datos?.nombre || 'otro chofer'}`);
    error.code = 'CONFLICTO';
    error.conflictos = [ocupante.datos?.nombre || 'Chofer destino'];
    throw error;
  }
  const batch = db.batch();
  const patchA = { actualizadoEn: new Date().toISOString(), actualizadoPor: usuario || 'sistema', patenteActual: destino };
  const patchB = { actualizadoEn: new Date().toISOString(), actualizadoPor: usuario || 'sistema', patenteActual: null };
  const patchOrigen = {};
  const patchDestino = {};

  for (const tipo of tipos) {
    if (ocupante) {
      const rutaOrigenB = rutaVehiculo(destino, tipo);
      const rutaParkingB = gh.rutaDocumentoEmpleado(ocupante.id, tipo);
      await asegurarDestinoLibre(rutaParkingB, tipo, true);
      let movio = await moverDocumento(rutaOrigenB, rutaParkingB, tipo, { tipoDestino: null });
      if (!movio) movio = await moverDesdeAdjunto(destinoDoc, tipo, rutaParkingB);
      if (movio) {
        ocupante.datos.documentos = ocupante.datos.documentos || {};
        ocupante.datos.documentos[tipo] = { ruta: rutaParkingB, presente: true };
        patchB[`documentos.${tipo}`] = ocupante.datos.documentos[tipo];
      }
      patchDestino[`docsAdjuntos.${tipo}`] = FieldValue.delete();
    }

    const rutaOrigenA = origen ? rutaVehiculo(origen, tipo) : gh.rutaDocumentoEmpleado(id, tipo);
    const rutaDestinoA = rutaVehiculo(destino, tipo);
    await asegurarDestinoLibre(rutaDestinoA, tipo, reemplazar);
    let movio = await moverDocumento(rutaOrigenA, rutaDestinoA, tipo, {});
    if (!movio && origenDoc) movio = await moverDesdeAdjunto(origenDoc, tipo, rutaDestinoA);
    if (movio) {
      perfilA.documentos = perfilA.documentos || {};
      perfilA.documentos[tipo] = { ruta: rutaDestinoA, presente: true };
      patchA[`documentos.${tipo}`] = perfilA.documentos[tipo];
    }
    if (origenDoc) patchOrigen[`docsAdjuntos.${tipo}`] = FieldValue.delete();
  }

  if (origenDoc) batch.update(origenDoc.ref, { ...camposEspejo({}, { sinChofer: true }), ...patchOrigen });
  const perfilAFinal = { ...perfilA, patenteActual: destino };
  batch.update(destinoDoc.ref, { ...camposEspejo(perfilAFinal), ...patchDestino });
  batch.update(db.collection('employees').doc(id), patchA);

  if (ocupante) {
    batch.update(db.collection('employees').doc(ocupante.id), patchB);
    await cambiosHistorialCierre(db, batch, ocupante.id, destino, usuario);
  }
  await cambiosHistorialCierre(db, batch, id, origen, usuario);
  cambioHistorialApertura(db, batch, id, destino, destinoDoc.interno, usuario, 'Traslado');
  await batch.commit();

  invalidarCacheArbol();
  return {
    ok: true,
    empleado: { id, nombre: perfilA.nombre, desde: origen || null, hasta: destino },
    desplazado: ocupante ? { id: ocupante.id, nombre: ocupante.datos.nombre, quedaSinPatente: true } : null,
    tipos: tipos.filter(tipo => !!(perfilA.documentos && perfilA.documentos[tipo] && perfilA.documentos[tipo].ruta === rutaVehiculo(destino, tipo)))
  };
}

async function sincronizarDesdeVehiculos(db, usuario) {
  const { vehiculos, perfiles } = await cargarDatos(db);
  const porClave = new Map();
  perfiles.forEach(p => porClave.set(p.clave || claveDe(p.nombre, p.dni), p));
  const grupos = new Map();
  vehiculos.forEach(v => {
    const nombre = v.chofer || v.conductorHabitual || '';
    if (!normalizarNombre(nombre)) return;
    const clave = claveDe(nombre, v.dni);
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        nombre,
        dni: v.dni || '',
        registro: v.registro || '',
        vencimientoDNI: v.vencimientoDNI || '',
        vencimientoRegistro: v.vencimientoRegistro || '',
        patente: String(v.patente || '').toUpperCase(),
        refs: []
      });
    }
    grupos.get(clave).refs.push(v.ref);
  });

  const batch = db.batch();
  let huboWrites = false;
  let creados = 0;
  let actualizados = 0;
  const conflictos = [];
  const vistos = new Map();
  const todas = await db.collection('employees').get();
  todas.forEach(d => {
    const e = d.data();
    const nn = e.nombreNormalizado || normalizarNombre(e.nombre);
    if (!vistos.has(nn)) vistos.set(nn, []);
    vistos.get(nn).push({ id: d.id, dni: normalizarDni(e.dni) });
  });

  for (const [clave, g] of grupos) {
    let perfil = porClave.get(clave);
    if (!perfil) {
      const datos = construirPerfil(g, usuario);
      datos.patenteActual = g.patente;
      datos.documentos.dni.ruta = rutaVehiculo(g.patente, 'dni');
      datos.documentos.registro.ruta = rutaVehiculo(g.patente, 'registro');
      const ref = await db.collection('employees').add(datos);
      perfil = { id: ref.id, ...datos };
      creados++;
    } else if (!perfil.patenteActual) {
      batch.update(db.collection('employees').doc(perfil.id), {
        patenteActual: g.patente,
        actualizadoEn: new Date().toISOString(),
        actualizadoPor: usuario || 'sistema'
      });
      huboWrites = true;
      actualizados++;
    } else {
      actualizados++;
    }
    const mismos = vistos.get(normalizarNombre(g.nombre)) || [];
    if (mismos.some(x => x.dni && normalizarDni(g.dni) && x.dni !== normalizarDni(g.dni))) {
      conflictos.push(g.nombre);
    }
    g.refs.forEach(ref => {
      batch.update(ref, camposEspejo({ ...perfil, id: perfil.id }));
      huboWrites = true;
    });
  }
  vehiculos.forEach(v => {
    if (normalizarNombre(v.chofer || v.conductorHabitual)) return;
    batch.update(v.ref, camposEspejo({}, { sinChofer: true }));
    huboWrites = true;
  });
  if (huboWrites) await batch.commit();
  invalidarCacheArbol();
  return { creados, actualizados, conflictos: [...new Set(conflictos)] };
}

async function obtenerDocumentoEmpleado(db, id, tipo) {
  if (!TIPOS_DOC.includes(tipo) || !id) return null;
  const doc = await db.collection('employees').doc(id).get();
  if (!doc.exists) return null;
  const meta = ((doc.data().documentos || {})[tipo] || {}).ruta;
  if (!meta) return null;
  const leido = await gh.leerRuta(meta, { tipo: null });
  if (!leido) return null;
  const base64 = await bytesBase64(leido);
  return {
    buffer: Buffer.from(base64, 'base64'),
    nombre: leido.nombre || `${tipo}.pdf`,
    mime: 'application/pdf'
  };
}

function esFechaInvalida(valor) {
  if (valor == null || valor === '') return false;
  return typeof valor === 'string' && /\[object Object\]|\b(?:invalid date|nan|null|undefined)\b/i.test(valor);
}

function fechaCrudaVehiculo(vehiculo, tipo) {
  const doc = (vehiculo.documentacion && vehiculo.documentacion[tipo]) || null;
  if (doc && doc.sinChofer === true) return null;
  const candidatos = [tipo === 'dni' ? vehiculo.vencimientoDNI : vehiculo.vencimientoRegistro];
  if (doc) candidatos.push(doc.fechaVencimiento);
  for (const valor of candidatos) {
    if (valor == null || valor === '') continue;
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
    if (typeof valor.toDate === 'function') {
      const d = valor.toDate();
      if (d && !isNaN(d.getTime())) {
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
      }
    }
  }
  return null;
}

function fechaDesdeVehiculo(vehiculo, tipo) {
  const valor = fechaCrudaVehiculo(vehiculo, tipo);
  return esFechaInvalida(valor) ? null : valor;
}

async function completarVencimientosDesdeVehiculos(db, opciones = {}) {
  const aplicar = opciones.aplicar === true;
  const usuario = String(opciones.usuario || 'sistema');
  const [snapVehiculos, snapPerfiles] = await Promise.all([
    db.collection('vehicles').get(),
    db.collection('employees').get()
  ]);
  const vehiculos = snapVehiculos.docs.map(d => ({ id: d.id, ...d.data() }));
  const perfiles = snapPerfiles.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const planes = [];
  const conflictos = [];
  const sinVehiculo = [];
  const yaAlDia = [];
  const sinFecha = [];
  const invalidos = [];

  perfiles.forEach(p => {
    const clave = p.clave || claveDe(p.nombre, p.dni);
    const porId = p.id ? vehiculos.filter(v => v.empleadoId === p.id) : [];
    const vinculados = porId.length ? porId : vehiculos.filter(v => {
      const nombre = v.chofer || v.conductorHabitual || '';
      return !!normalizarNombre(nombre) && claveDe(nombre, v.dni) === clave;
    });
    if (!vinculados.length) {
      sinVehiculo.push({ id: p.id, nombre: p.nombre, dni: p.dni });
      return;
    }
    const detallesInvalidos = [];
    TIPOS_DOC.forEach(tipo => {
      const campo = tipo === 'dni' ? 'vencimientoDNI' : 'vencimientoRegistro';
      if (esFechaInvalida(p[campo])) detallesInvalidos.push(`${tipo} en empleado: ${p[campo]}`);
      const sucios = vinculados.map(v => fechaCrudaVehiculo(v, tipo)).filter(esFechaInvalida);
      if (sucios.length) detallesInvalidos.push(`${tipo} en vehicle: ${[...new Set(sucios)].join(', ')}`);
    });
    if (detallesInvalidos.length) {
      invalidos.push({ id: p.id, nombre: p.nombre, detalles: detallesInvalidos });
      return;
    }
    const cambios = {};
    const detalles = [];
    TIPOS_DOC.forEach(tipo => {
      const campo = tipo === 'dni' ? 'vencimientoDNI' : 'vencimientoRegistro';
      const fechas = [...new Set(vinculados.map(v => fechaDesdeVehiculo(v, tipo)).filter(Boolean))];
      if (fechas.length > 1) {
        conflictos.push({ id: p.id, nombre: p.nombre, tipo, fechas });
        return;
      }
      if (!fechas.length) return;
      const valor = fechas[0];
      if (p[campo] === valor) return;
      cambios[campo] = valor;
      detalles.push(`${tipo}: ${p[campo] || '(vacío)'} -> ${valor}`);
    });
    if (!Object.keys(cambios).length) {
      const conFecha = TIPOS_DOC.some(tipo => vinculados.some(v => !!fechaDesdeVehiculo(v, tipo)));
      (conFecha ? yaAlDia : sinFecha).push({ id: p.id, nombre: p.nombre });
      return;
    }
    planes.push({
      id: p.id,
      nombre: p.nombre,
      patentes: vinculados.map(v => v.patente).filter(Boolean),
      cambios,
      detalles
    });
  });

  let escritos = 0;
  if (aplicar && planes.length) {
    for (let i = 0; i < planes.length; i += 20) {
      const lote = planes.slice(i, i + 20);
      const batch = db.batch();
      lote.forEach(plan => {
        batch.update(db.collection('employees').doc(plan.id), {
          ...plan.cambios,
          actualizadoEn: new Date().toISOString(),
          actualizadoPor: usuario
        });
      });
      await batch.commit();
      escritos += lote.length;
    }
  }

  return {
    aplicar,
    perfiles: perfiles.length,
    planes,
    conflictos,
    sinVehiculo,
    yaAlDia,
    sinFecha,
    invalidos,
    escritos
  };
}

module.exports = {
  normalizarNombre,
  normalizarDni,
  claveDe,
  camposEspejo,
  invalidarCacheArbol,
  obtenerEmpleados,
  obtenerEmpleado,
  obtenerHistorial,
  crearEmpleado,
  actualizarEmpleado,
  actualizarHistorial,
  moverChofer,
  sincronizarDesdeVehiculos,
  obtenerDocumentoEmpleado,
  sincronizarEspejos,
  completarVencimientosDesdeVehiculos
};
