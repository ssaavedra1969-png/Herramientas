/* Informe semanal de vencimientos (seguro, VTV, registro, service).

   Genera el PDF con los vencidos + próximos 30 días y lo guarda en
   informes/VENCIMIENTOS_SEMANAL_<fecha>.pdf. Si hay SMTP configurado en .env
   lo envía por mail con el PDF adjunto; si no, abre la carpeta en el
   Explorador para que lo mandes a mano por WhatsApp o mail.

   Configuración de mail en .env (opcional):
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=tucorreo@gmail.com
     SMTP_PASS=contraseña-de-aplicacion   ← no es la contraseña normal de Gmail
     INFORMES_EMAIL_TO=destino1@...,destino2@...

   Automatización (viernes 08:00): correr UNA VEZ scripts\instalar-tarea-vencimientos.bat
   (crea la tarea "Falpat Informe Vencimientos" en el Programador de tareas).

   Uso:
     npm run informe:vencimientos
     node scripts/informe-vencimientos-semanal.js --dias=60
     node scripts/informe-vencimientos-semanal.js --salida=C:\temp\prueba.pdf
     node scripts/informe-vencimientos-semanal.js --sin-abrir
*/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { armarFilas, generarPDF } = require('../lib/informe-vencimientos');

const args = process.argv.slice(2);
const arg = n => (args.find(a => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || '';
const ventana = Math.max(1, parseInt(arg('dias'), 10) || 90);
const sinAbrir = args.includes('--sin-abrir');

function p2(n) { return String(n).padStart(2, '0'); }
function sello() {
  const h = new Date();
  return `${h.getFullYear()}-${p2(h.getMonth() + 1)}-${p2(h.getDate())}`;
}

async function enviarMail(archivo, stats) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.INFORMES_EMAIL_TO) {
    return false;
  }
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: (parseInt(process.env.SMTP_PORT, 10) || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await t.sendMail({
    from: `"Falpat Informes" <${process.env.SMTP_USER}>`,
    to: process.env.INFORMES_EMAIL_TO,
    subject: `Vencimientos próximos ${sello()} - ${stats.total} en los próximos ${ventana} días${stats.hoy ? ` (${stats.hoy} HOY)` : ''}`,
    text:
      `Informe de vencimientos próximos (seguro, VTV, registro, service).\n\n` +
      `Vencimientos en los próximos ${ventana} días: ${stats.total}\n` +
      (stats.hoy ? `Vence HOY: ${stats.hoy}\n` : '') +
      `\nPDF adjunto.\n`,
    attachments: [{ filename: path.basename(archivo), path: archivo }]
  });
  return true;
}

(async () => {
  const { filas, stats } = await armarFilas({ dias: ventana });
  const pdf = generarPDF(filas, { dias: ventana, stats });

  const salida = arg('salida') || path.join(__dirname, '..', 'informes', `VENCIMIENTOS_SEMANAL_${sello()}.pdf`);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, pdf);

  console.log(`\nPDF: ${salida}`);
  console.log(`  flota            : ${stats.flota}`);
  console.log(`  a vencer <=${ventana} d : ${stats.total}${stats.hoy ? ` (${stats.hoy} vence HOY)` : ''}`);

  let mailEnviado = false;
  try {
    mailEnviado = await enviarMail(salida, stats);
  } catch (e) {
    console.error(`  mail ERROR       : ${e.message}`);
  }
  console.log(`  mail             : ${mailEnviado ? 'enviado a ' + process.env.INFORMES_EMAIL_TO : 'no configurado (se genera el PDF nomás)'}`);

  if (!mailEnviado && !sinAbrir && process.platform === 'win32') {
    // Abre el Explorador con el PDF seleccionado: listo para adjuntar a mano.
    const { execSync } = require('child_process');
    try { execSync(`explorer /select,"${salida}"`); } catch (_) { /* explorer devuelve 1 al abrir */ }
  }
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
