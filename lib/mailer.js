/* Envío del informe de vencimientos por mail.

   Prioridad:
     1. Brevo (API HTTPS, gratis 300 mails/día) → BREVO_API_KEY
     2. SMTP genérico (nodemailer) → SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS

   Remitente: INFORMES_EMAIL_FROM (o SMTP_USER como fallback). Si no hay
   ninguno usa grupo@falpat.com.ar, que tiene que estar verificado como
   remitente en Brevo (Senders & IP).
   Destinatarios: los que recibe por parámetro (config de la web) o, si no
   vienen, INFORMES_EMAIL_TO (varios separados por coma).

   Si no hay nada configurado devuelve { enviado: false, motivo } sin lanzar,
   así el endpoint puede responder 200 con el PDF generado igual. */
'use strict';

const FROM_DEFAULT = 'grupo@falpat.com.ar';

function destinatariosDeEnv() {
  return (process.env.INFORMES_EMAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function remitente() {
  return process.env.INFORMES_EMAIL_FROM || process.env.SMTP_USER || FROM_DEFAULT;
}

async function enviarInforme({ pdf, filename, asunto, texto, destinatarios }) {
  const to = Array.isArray(destinatarios) && destinatarios.length
    ? destinatarios.map((s) => String(s).trim()).filter(Boolean)
    : destinatariosDeEnv();
  if (!to.length) return { enviado: false, motivo: 'sin destinatarios configurados' };

  const from = remitente();
  const tieneAdjunto = pdf !== undefined && pdf !== null && filename;

  if (process.env.BREVO_API_KEY) {
    const payload = {
      sender: { name: 'Falpat Informes', email: from },
      to: to.map((email) => ({ email })),
      subject: asunto,
      textContent: texto
    };
    if (tieneAdjunto) {
      payload.attachment = [{ name: filename, content: Buffer.from(pdf).toString('base64') }];
    }

    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const detalle = await r.text();
      let msg = `Brevo ${r.status}: ${detalle.slice(0, 300)}`;
      if (/sender|from/i.test(detalle) && /(invalid|not valid|does not exist|missing)/i.test(detalle)) {
        msg += ` — Verificá el remitente ${from} en Brevo → Senders & IP → Add a sender.`;
      }
      throw new Error(msg);
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
    const mensaje = {
      from: `"Falpat Informes" <${from}>`,
      to: to.join(','),
      subject: asunto,
      text: texto
    };
    if (tieneAdjunto) mensaje.attachments = [{ filename, content: Buffer.from(pdf) }];
    await transporte.sendMail(mensaje);
    return { enviado: true, via: 'smtp', destinatarios: to };
  }

  return { enviado: false, motivo: 'sin BREVO_API_KEY ni SMTP configurado' };
}

module.exports = { enviarInforme };
