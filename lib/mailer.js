/* Envío del informe de vencimientos por mail.

   Prioridad:
     1. Brevo (API HTTPS, gratis 300 mails/día) → BREVO_API_KEY
     2. SMTP genérico (nodemailer) → SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS

   Remitente: INFORMES_EMAIL_FROM (o SMTP_USER como fallback).
   Destinatarios: los que recibe por parámetro (config de la web) o, si no
   vienen, INFORMES_EMAIL_TO (varios separados por coma).

   Si no hay nada configurado devuelve { enviado: false, motivo } sin lanzar,
   así el endpoint puede responder 200 con el PDF generado igual. */
'use strict';

function destinatariosDeEnv() {
  return (process.env.INFORMES_EMAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function remitente() {
  return process.env.INFORMES_EMAIL_FROM || process.env.SMTP_USER || '';
}

async function enviarInforme({ pdf, filename, asunto, texto, destinatarios }) {
  const to = Array.isArray(destinatarios) && destinatarios.length
    ? destinatarios.map((s) => String(s).trim()).filter(Boolean)
    : destinatariosDeEnv();
  if (!to.length) return { enviado: false, motivo: 'sin destinatarios configurados' };

  const from = remitente();
  if (!from) return { enviado: false, motivo: 'INFORMES_EMAIL_FROM no configurado' };

  if (process.env.BREVO_API_KEY) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Falpat Informes', email: from },
        to: to.map((email) => ({ email })),
        subject: asunto,
        textContent: texto,
        attachment: [{ name: filename, content: Buffer.from(pdf).toString('base64') }]
      })
    });
    if (!r.ok) {
      const detalle = await r.text();
      throw new Error(`Brevo ${r.status}: ${detalle.slice(0, 300)}`);
    }
    return { enviado: true, via: 'brevo', destinatarios: to };
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = require('nodemailer');
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporte.sendMail({
      from: `"Falpat Informes" <${from}>`,
      to: to.join(','),
      subject: asunto,
      text: texto,
      attachments: [{ filename, content: Buffer.from(pdf) }]
    });
    return { enviado: true, via: 'smtp', destinatarios: to };
  }

  return { enviado: false, motivo: 'sin BREVO_API_KEY ni SMTP configurado' };
}

module.exports = { enviarInforme };
