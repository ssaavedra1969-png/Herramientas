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

  snapshot.docs.forEach((doc) => {
    const v = doc.data() || {};
    // Misma regla que el resto de los informes: un vehículo deshabilitado no
    // cuenta (ver esDeshabilitado en lib/utils.js).
    if (esDeshabilitado(v)) return;
    const alta = aFecha(v.createdAt) || aFecha(v.fechaAlta);
    const actualizacion = aFecha(v.updatedAt);
    const fechaCambio = alta && actualizacion
      ? new Date(Math.max(alta.getTime(), actualizacion.getTime()))
      : (actualizacion || alta);
    if (!fechaCambio || fechaCambio <= desde || fechaCambio > fin) return;

    vehiculos.push({
      patente: String(v.patente || 'Sin patente').toUpperCase(),
      interno: String(v.interno || ''),
      accion: alta && alta > desde ? 'Alta' : 'Datos actualizados'
    });
  });
  vehiculos.sort((a, b) => a.patente.localeCompare(b.patente, 'es'));

  const cambiosDocs = await githubDocs.cambiosDesde(desde.toISOString(), { estricto: true });
  const documentos = Object.keys(cambiosDocs)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((patente) => ({
      patente,
      tipos: Array.from(cambiosDocs[patente] || []).sort((a, b) => a.localeCompare(b, 'es'))
    }));

  return {
    desde,
    hasta: fin,
    primerEnvio: !ultimoEnvio,
    vehiculos,
    documentos
  };
}

function armarCorreo(novedades) {
  const fecha = fechaTexto(novedades.hasta);
  const asunto = `Novedades de flota - ${fecha}`;
  const lineas = [
    'NOVEDADES DE FLOTA',
    `Período: ${fechaTexto(novedades.desde)} al ${fecha}`,
    '',
    `Vehículos con datos cargados o actualizados: ${novedades.vehiculos.length}`
  ];

  if (novedades.vehiculos.length) {
    novedades.vehiculos.forEach((v) => {
      lineas.push(`- ${v.accion}: ${v.patente}${v.interno ? ` (Interno ${v.interno})` : ''}`);
    });
  }

  lineas.push('', `Vehículos con documentación actualizada: ${novedades.documentos.length}`);
  if (novedades.documentos.length) {
    novedades.documentos.forEach((d) => {
      lineas.push(`- ${d.patente}: ${d.tipos.join(', ')}`);
    });
  }

  lineas.push('', 'Este resumen se envió manualmente desde el sistema de control de flota.');
  return { asunto, texto: lineas.join('\n') };
}

async function guardarEnvio(hasta, usuario) {
  await db.collection('config').doc(CONFIG_ID).set({
    ultimoEnvio: hasta,
    actualizadoPor: String(usuario || '').slice(0, 120)
  }, { merge: true });
}

module.exports = { CONFIG_ID, DIAS_INICIALES, obtenerNovedades, armarCorreo, guardarEnvio, fechaTexto };
