const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: Number(SMTP_PORT) || 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  return transporter;
}

async function sendAlertEmail(to, subject, html) {
  const t = getTransporter();
  if (!t) throw new Error('SMTP no configurado. Definí SMTP_USER y SMTP_PASS en .env');
  const from = process.env.SMTP_FROM || `Falpat SRL <${process.env.SMTP_USER}>`;
  return t.sendMail({ from, to, subject, html });
}

module.exports = { getTransporter, sendAlertEmail };
