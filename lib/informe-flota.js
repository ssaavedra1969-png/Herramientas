'use strict';

const { db } = require('../config/firebase');
const githubDocs = require('./github-docs');
const { esDeshabilitado } = require('./utils');

const CONFIG_ID = 'informesNovedadesFlota';
const DIAS_INICIALES = 7;
const MS_DIA = 24 * 60 * 60 * 1000;

function aFecha(valor) {
  if (!valor) return null;
  const fecha = typeof valor.toDate === 'function'
    ? valor.toDate()
    : (valor instanceof Date ? valor : new Date(valor));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function fechaTexto(valor) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(valor);
}

const TIPOS_DOC = githubDocs.TIPOS;

function nombreArchivo(archivo) {
  return typeof archivo === 'string' ? archivo : (archivo && archivo.nombre) || '';
}

/* La documentación se controla contra lo que está online: PATENTE/ en GitHub
   (fuente que lee producción) más los PDF subidos desde la ficha (docsAdjuntos).
   No se mira el disco local: en Vercel no está y puede tener archivos sin publicar. */
async function documentacionPendiente(habilitados) {
  const arbol = await githubDocs.listarPatenteGlobal();
  const pendientes = [];

  for (const item of habilitados) {
    const archivos = arbol
      ? (item.patente ? arbol.get(item.patente) || [] : [])
      : (item.patente ? await githubDocs.listarCarpeta(item.patente) : []);
    const subidos = item.v.docsAdjuntos || {};
    const faltantes = TIPOS_DOC.filter((tipo) => {
      if (subidos[tipo]) return false;
      return !archivos.some((archivo) => githubDocs.esDeTipo(nombreArchivo(archivo), tipo));
    });
    if (faltantes.length) {
      pendientes.push({
        patente: item.etiqueta,
        interno: String(item.v.interno || ''),
        faltantes
      });
    }
  }

  return pendientes;
}

async function obtenerNovedades({ hasta = new Date() } = {}) {
  const fin = aFecha(hasta);
  if (!fin) throw new Error('La fecha de corte del informe no es válida.');

  const configRef = db.collection('config').doc(CONFIG_ID);
  const configSnap = await configRef.get();
  const guardado = configSnap.exists ? configSnap.data() || {} : {};
  const ultimoEnvio = guardado.ultimoEnvio ? aFecha(guardado.ultimoEnvio) : null;
  if (guardado.ultimoEnvio && !ultimoEnvio) {
    throw new Error('La fecha del último envío de novedades no es válida.');
  }
  const desde = ultimoEnvio || new Date(fin.getTime() - DIAS_INICIALES * MS_DIA);
  const snapshot = await db.collection('vehicles').get();
  const vehiculos = [];
  const habilitados = [];

  snapshot.docs.forEach((doc) => {
    const v = doc.data() || {};
    // Misma regla que el resto de los informes: un vehículo deshabilitado no
    // cuenta (ver esDeshabilitado en lib/utils.js).
    if (esDeshabilitado(v)) return;
    const patente = String(v.patente || '').toUpperCase();
    habilitados.push({ patente, etiqueta: patente || 'Sin patente', v });

    const alta = aFecha(v.createdAt) || aFecha(v.fechaAlta);
    const actualizacion = aFecha(v.updatedAt);
    const fechaCambio = alta && actualizacion
      ? new Date(Math.max(alta.getTime(), actualizacion.getTime()))
      : (actualizacion || alta);
    if (!fechaCambio || fechaCambio <= desde || fechaCambio > fin) return;

    vehiculos.push({
      patente: patente || 'Sin patente',
      interno: String(v.interno || ''),
      accion: alta && alta > desde ? 'Alta' : 'Datos actualizados'
    });
  });
  vehiculos.sort((a, b) => a.patente.localeCompare(b.patente, 'es'));
  habilitados.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));

  const cambiosDocs = await githubDocs.cambiosDesde(desde.toISOString(), { estricto: true });
  const documentos = Object.keys(cambiosDocs)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((patente) => ({
      patente,
      tipos: Array.from(cambiosDocs[patente] || []).sort((a, b) => a.localeCompare(b, 'es'))
    }));

  const pendientes = await documentacionPendiente(habilitados);

  return {
    desde,
    hasta: fin,
    primerEnvio: !ultimoEnvio,
    vehiculos,
    documentos,
    pendientes
  };
}

function armarCorreo(novedades) {
  const fecha = fechaTexto(novedades.hasta);
  const asunto = `Novedades de flota - ${fecha}`;
  const lineas = [
    'NOVEDADES DE FLOTA',
    `Período: ${fechaTexto(novedades.desde)} al ${fecha}`
  ];

  const porPatente = new Map();
  const entrada = (patente, interno) => {
    if (!porPatente.has(patente)) {
      porPatente.set(patente, { patente, interno: String(interno || ''), accion: '', tipos: [] });
    }
    const e = porPatente.get(patente);
    if (!e.interno && interno) e.interno = String(interno);
    return e;
  };

  (novedades.vehiculos || []).forEach((v) => {
    entrada(v.patente, v.interno).accion = v.accion;
  });
  (novedades.documentos || []).forEach((d) => {
    entrada(d.patente, '').tipos = d.tipos;
  });
  const patentes = Array.from(porPatente.keys()).sort((a, b) => a.localeCompare(b, 'es'));

  lineas.push('', `DATOS CARGADOS: ${patentes.length} vehículo(s)`);
  if (!patentes.length) {
    lineas.push('- Sin datos cargados en el período.');
  }
  patentes.forEach((patente) => {
    const e = porPatente.get(patente);
    const partes = [];
    if (e.accion) partes.push(e.accion);
    if (e.tipos.length) partes.push(`Documentación: ${e.tipos.join(', ')}`);
    lineas.push(`- ${e.patente}${e.interno ? ` (Interno ${e.interno})` : ''}: ${partes.join(' · ')}`);
  });

  const pendientes = novedades.pendientes || [];
  lineas.push('', 'DOCUMENTACIÓN PENDIENTE (verificada en línea)');
  if (!pendientes.length) {
    lineas.push('Sin documentación pendiente en la flota habilitada.');
  } else {
    lineas.push(`${pendientes.length} vehículo(s) habilitado(s) con documentación faltante:`);
    pendientes.forEach((p) => {
      lineas.push(`- ${p.patente}${p.interno ? ` (Interno ${p.interno})` : ''}: ${p.faltantes.join(', ')}`);
    });
  }

  lineas.push('', 'Este resumen se envió manualmente desde el sistema de control de flota.');
  return { asunto, texto: lineas.join('\n') };
}

function hayParaEnviar(novedades) {
  return Boolean(
    (novedades.vehiculos || []).length ||
    (novedades.documentos || []).length ||
    (novedades.pendientes || []).length
  );
}

async function guardarEnvio(hasta, usuario) {
  await db.collection('config').doc(CONFIG_ID).set({
    ultimoEnvio: hasta,
    actualizadoPor: String(usuario || '').slice(0, 120)
  }, { merge: true });
}

module.exports = { CONFIG_ID, DIAS_INICIALES, obtenerNovedades, armarCorreo, hayParaEnviar, guardarEnvio, fechaTexto };
