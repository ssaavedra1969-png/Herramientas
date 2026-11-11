/* Configuración del informe de vencimientos por mail.

   Vive en Firestore (`config/informesMail`) para poder editarla desde la web
   (Admin → Correos): destinatarios, asunto, cuerpo, ventana y si el envío
   automático de los lunes está activo.

   Si el doc no existe se usan los defaults; los destinatarios salen de
   INFORMES_EMAIL_TO (env) para que el cron funcione apenas se despliega.

   Placeholders disponibles en asunto y cuerpo:
     {{fecha}}  {{dias}}  {{total}}  {{hoy}}  {{flota}}  {{hoy_linea}} */
'use strict';

const { db } = require('../config/firebase');

const DOC_ID = 'informesMail';
const MAX_DESTINATARIOS = 20;
const MAX_ASUNTO = 200;
const MAX_CUERPO = 5000;
const DIAS_DEFAULT = 90;

const ASUNTO_DEFAULT = 'Vencimientos próximos {{fecha}} - {{total}} en los próximos {{dias}} días';
const CUERPO_DEFAULT =
  'Informe de vencimientos próximos (VTV, seguro, registro, DNI, cédula, matafuego y service).\n\n' +
  'Vencimientos en los próximos {{dias}} días: {{total}}\n' +
  '{{hoy_linea}}\n' +
  'PDF adjunto.\n';

function esEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function normalizarDestinatarios(lista) {
  let arr = lista;
  if (typeof arr === 'string') arr = arr.split(/[,;\n]/);
  if (!Array.isArray(arr)) return [];
  const vistos = new Set();
  const out = [];
  arr.forEach((raw) => {
    const email = String(raw || '').trim();
    if (!esEmail(email)) return;
    const clave = email.toLowerCase();
    if (vistos.has(clave)) return;
    vistos.add(clave);
    out.push(email);
  });
  return out.slice(0, MAX_DESTINATARIOS);
}

function normalizarDias(n) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return DIAS_DEFAULT;
  return Math.min(365, Math.max(1, v));
}

function envDestinatarios() {
  return normalizarDestinatarios(process.env.INFORMES_EMAIL_TO || '');
}

function defaults() {
  return {
    destinatarios: envDestinatarios(),
    asunto: ASUNTO_DEFAULT,
    cuerpo: CUERPO_DEFAULT,
    dias: normalizarDias(process.env.INFORME_VENCIMIENTOS_DIAS),
    activo: true,
    actualizadoEl: null,
    actualizadoPor: null
  };
}

async function getInformeConfig() {
  const base = defaults();
  let snap = null;
  try {
    snap = await db.collection('config').doc(DOC_ID).get();
  } catch (_) {
    return base;
  }
  if (!snap || !snap.exists) return base;

  const d = snap.data() || {};
  return {
    destinatarios: Array.isArray(d.destinatarios) ? normalizarDestinatarios(d.destinatarios) : base.destinatarios,
    asunto: typeof d.asunto === 'string' && d.asunto.trim() ? d.asunto.trim().slice(0, MAX_ASUNTO) : base.asunto,
    cuerpo: typeof d.cuerpo === 'string' && d.cuerpo.trim() ? d.cuerpo.trim().slice(0, MAX_CUERPO) : base.cuerpo,
    dias: normalizarDias(d.dias),
    activo: d.activo !== false,
    actualizadoEl: d.actualizadoEl || null,
    actualizadoPor: d.actualizadoPor || null
  };
}

async function guardarInformeConfig(data, usuario) {
  const destinatarios = normalizarDestinatarios(data && data.destinatarios);
  if (!destinatarios.length) {
    throw new Error('Agregá al menos un destinatario válido');
  }
  const limpio = {
    destinatarios,
    asunto: String((data && data.asunto) || '').trim().slice(0, MAX_ASUNTO) || ASUNTO_DEFAULT,
    cuerpo: String((data && data.cuerpo) || '').trim().slice(0, MAX_CUERPO) || CUERPO_DEFAULT,
    dias: normalizarDias(data && data.dias),
    activo: !(data && data.activo === false),
    actualizadoEl: new Date(),
    actualizadoPor: String(usuario || '').slice(0, 120)
  };
  await db.collection('config').doc(DOC_ID).set(limpio, { merge: true });
  return limpio;
}

function renderPlantilla(texto, vars) {
  const valores = vars || {};
  return String(texto || '').replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, clave) => {
    const v = valores[clave];
    return v === undefined || v === null ? '' : String(v);
  });
}

function varsInforme({ stats, dias, fecha } = {}) {
  const s = stats || {};
  return {
    fecha: fecha || new Date().toISOString().slice(0, 10),
    dias: dias === undefined ? DIAS_DEFAULT : dias,
    total: s.total === undefined ? 0 : s.total,
    hoy: s.hoy === undefined ? 0 : s.hoy,
    flota: s.flota === undefined ? 0 : s.flota,
    hoy_linea: s.hoy ? `Vence HOY: ${s.hoy}` : ''
  };
}

module.exports = {
  DOC_ID,
  ASUNTO_DEFAULT,
  CUERPO_DEFAULT,
  DIAS_DEFAULT,
  normalizarDestinatarios,
  normalizarDias,
  getInformeConfig,
  guardarInformeConfig,
  renderPlantilla,
  varsInforme
};
