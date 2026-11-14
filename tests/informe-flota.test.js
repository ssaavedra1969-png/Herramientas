'use strict';
/* Novedades de flota (Admin → Correos): período del resumen, filtros y
   persistencia del último envío. Usa el Firestore falso del harness y un
   `cambiosDesde()` simulado, así no toca producción ni GitHub. */
const { fake, makeReporter } = require('./helpers');

// Se reemplaza ANTES de requerir informe-flota, que guarda esta referencia.
const gh = require('../lib/github-docs');
let llamadas = [];
let respuestaDocs = {};
gh.cambiosDesde = async (desdeISO, opciones) => {
  llamadas.push({ desdeISO, opciones });
  if (respuestaDocs instanceof Error) throw respuestaDocs;
  return respuestaDocs;
};

const arbolCompleto = () => new Map([
  ['AB111CD', ['titulo.pdf', 'cedula.pdf', 'seguro.pdf', 'registro.pdf', 'vtv.pdf', 'dni.pdf']],
  ['AC222EF', ['titulo.pdf']],
  ['AD333GH', []],
  ['AF555KL', []]
]);
let arbolDocs = arbolCompleto();
let carpetas = {};
gh.listarPatenteGlobal = async () => arbolDocs;
gh.listarCarpeta = async (patente) => carpetas[patente] || [];

const {
  CONFIG_ID,
  DIAS_INICIALES,
  obtenerNovedades,
  armarCorreo,
  hayParaEnviar,
  guardarEnvio
} = require('../lib/informe-flota');

const rep = makeReporter('novedades de flota');
const { check, section, done } = rep;

const HASTA = new Date('2026-11-14T12:00:00Z');
const MS_DIA = 86400000;
const fecha = (iso) => new Date(iso);

(async () => {
  section('primer envío: últimos 7 días');

  fake.seed('vehicles', 'v-alta', {
    patente: 'ab111cd', interno: 'V010', createdAt: fecha('2026-11-12T10:00:00Z')
  });
  fake.seed('vehicles', 'v-editado', {
    patente: 'AC222EF', interno: 'V011',
    createdAt: fecha('2026-01-01T10:00:00Z'), updatedAt: fecha('2026-11-13T10:00:00Z')
  });
  fake.seed('vehicles', 'v-viejo', {
    patente: 'AD333GH', createdAt: fecha('2026-01-01T10:00:00Z'),
    updatedAt: fecha('2026-10-01T10:00:00Z')
  });
  fake.seed('vehicles', 'v-deshab', {
    patente: 'AE444IJ', updatedAt: fecha('2026-11-13T10:00:00Z'), deshabilitado: true
  });
  fake.seed('vehicles', 'v-sin-fecha', { patente: 'AF555KL' });
  fake.seed('vehicles', 'v-subidos', {
    patente: 'AJ666MM',
    docsAdjuntos: {
      titulo: {}, cedula: {}, seguro: {}, registro: {}, vtv: {}, dni: {}
    }
  });

  respuestaDocs = {
    AG999XX: new Set(['seguro', 'vtv']),
    AH888YY: new Set(['dni'])
  };

  const primera = await obtenerNovedades({ hasta: HASTA });

  check('primerEnvio = true', primera.primerEnvio === true);
  check(
    `desde = ${DIAS_INICIALES} días antes`,
    primera.desde.getTime() === HASTA.getTime() - DIAS_INICIALES * MS_DIA,
    primera.desde.toISOString()
  );
  check('hasta respeta el corte', primera.hasta.getTime() === HASTA.getTime());
  check('solo 2 vehículos con novedades', primera.vehiculos.length === 2, JSON.stringify(primera.vehiculos));
  check('alta detectada y patente normalizada', primera.vehiculos[0].patente === 'AB111CD' && primera.vehiculos[0].accion === 'Alta', JSON.stringify(primera.vehiculos[0]));
  check('actualización detectada', primera.vehiculos[1].patente === 'AC222EF' && primera.vehiculos[1].accion === 'Datos actualizados', JSON.stringify(primera.vehiculos[1]));
  check('excluye cambios viejos', !primera.vehiculos.some((v) => v.patente === 'AD333GH'));
  check('excluye deshabilitados', !primera.vehiculos.some((v) => v.patente === 'AE444IJ'));
  check('excluye vehículos sin fechas', !primera.vehiculos.some((v) => v.patente === 'AF555KL'));
  check('ordena por patente', primera.vehiculos.map((v) => v.patente).join(',') === 'AB111CD,AC222EF', JSON.stringify(primera.vehiculos));

  check('2 vehículos con documentación', primera.documentos.length === 2, JSON.stringify(primera.documentos));
  check('ordena patentes de docs', primera.documentos[0].patente === 'AG999XX' && primera.documentos[1].patente === 'AH888YY');
  check('ordena tipos de docs', primera.documentos[0].tipos.join(',') === 'seguro,vtv', JSON.stringify(primera.documentos[0]));
  check('consulta GitHub en modo estricto', llamadas[0] && llamadas[0].opciones.estricto === true);
  check('consulta GitHub desde el mismo corte', llamadas[0].desdeISO === primera.desde.toISOString(), llamadas[0].desdeISO);

  check('pendientes solo de habilitados', primera.pendientes.length === 3 && !primera.pendientes.some((p) => p.patente === 'AE444IJ'), JSON.stringify(primera.pendientes));
  check('no lista al que tiene todos los documentos', !primera.pendientes.some((p) => p.patente === 'AB111CD'));
  check('faltantes en orden fijo', primera.pendientes.find((p) => p.patente === 'AC222EF').faltantes.join(',') === 'cedula,seguro,registro,vtv,dni');
  check('los docs subidos cuentan como presentes', !primera.pendientes.some((p) => p.patente === 'AJ666MM'));
  check('pendientes ordenados por patente', primera.pendientes.map((p) => p.patente).join(',') === 'AC222EF,AD333GH,AF555KL', JSON.stringify(primera.pendientes));

  section('correo');

  const correo = armarCorreo(primera);
  check('asunto con fecha', /^Novedades de flota - /.test(correo.asunto), correo.asunto);
  check('incluye período', correo.texto.includes('Período:'));
  check('lista datos por patente', correo.texto.includes('- AB111CD (Interno V010): Alta'));
  check('lista actualizaciones', correo.texto.includes('- AC222EF (Interno V011): Datos actualizados'));
  check('junta la documentación en su patente', correo.texto.includes('- AG999XX: Documentación: seguro, vtv'));
  check('incluye documentación pendiente', correo.texto.includes('DOCUMENTACIÓN PENDIENTE (verificada en línea)'));
  check('detalla faltantes por patente', correo.texto.includes('- AC222EF (Interno V011): cedula, seguro, registro, vtv, dni'));
  check('aclara que fue manual', correo.texto.includes('envió manualmente'));

  section('segundo envío: desde el último envío aceptado');

  await guardarEnvio(HASTA, 'Admin Test');
  const config = fake.dump('config').find((d) => d.id === CONFIG_ID);
  check('guarda ultimoEnvio', config && config.ultimoEnvio.getTime() === HASTA.getTime(), JSON.stringify(config));
  check('guarda el autor', config && config.actualizadoPor === 'Admin Test');

  const siguiente = await obtenerNovedades({ hasta: new Date(HASTA.getTime() + MS_DIA) });
  check('ya no es primer envío', siguiente.primerEnvio === false);
  check('desde = último envío', siguiente.desde.getTime() === HASTA.getTime(), siguiente.desde.toISOString());
  check('no repite lo ya enviado', siguiente.vehiculos.length === 0, JSON.stringify(siguiente.vehiculos));

  fake.seed('vehicles', 'v-nuevo', {
    patente: 'AZ777ZZ', interno: 'V012', createdAt: new Date(HASTA.getTime() + 12 * 3600000)
  });
  const conNuevo = await obtenerNovedades({ hasta: new Date(HASTA.getTime() + MS_DIA) });
  check('detecta el alta posterior al envío', conNuevo.vehiculos.length === 1 && conNuevo.vehiculos[0].patente === 'AZ777ZZ', JSON.stringify(conNuevo.vehiculos));

  section('sin árbol global: consulta por carpeta');

  arbolDocs = null;
  carpetas = { AC222EF: [{ nombre: 'titulo.pdf' }] };
  const porCarpeta = await obtenerNovedades({ hasta: new Date(HASTA.getTime() + MS_DIA) });
  check(
    'cae a listarCarpeta y calcula faltantes',
    porCarpeta.pendientes.some((p) => p.patente === 'AC222EF' && p.faltantes.length === 5),
    JSON.stringify(porCarpeta.pendientes)
  );
  arbolDocs = arbolCompleto();
  carpetas = {};

  section('envío solo con pendientes');

  const soloPendientes = {
    desde: HASTA,
    hasta: HASTA,
    vehiculos: [],
    documentos: [],
    pendientes: [{ patente: 'AC222EF', interno: 'V011', faltantes: ['dni'] }]
  };
  check('hayParaEnviar con pendientes', hayParaEnviar(soloPendientes) === true);
  check('hayParaEnviar sin nada = false', hayParaEnviar({ vehiculos: [], documentos: [], pendientes: [] }) === false);
  const correoPend = armarCorreo(soloPendientes);
  check(
    'correo sin datos pero con pendientes',
    correoPend.texto.includes('Sin datos cargados en el período') &&
      correoPend.texto.includes('- AC222EF (Interno V011): dni')
  );

  section('errores');

  respuestaDocs = new Error('GitHub caído');
  let fallo = null;
  try {
    await obtenerNovedades({ hasta: HASTA });
  } catch (e) {
    fallo = e;
  }
  check('propaga el error de GitHub (no omite docs en silencio)', !!fallo && /GitHub caído/.test(fallo.message));
  respuestaDocs = {};

  let fechaInvalida = null;
  try {
    await obtenerNovedades({ hasta: new Date('no-es-fecha') });
  } catch (e) {
    fechaInvalida = e;
  }
  check('rechaza un corte inválido', !!fechaInvalida && /corte/i.test(fechaInvalida.message));

  done();
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
