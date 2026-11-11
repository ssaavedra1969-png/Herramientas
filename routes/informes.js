/* API de Admin → Correos: configuración del informe de vencimientos y envío
   manual. Todo requiere sesión Admin (verifyToken + requireAdmin).

   - GET  /api/informes/config   → configuración efectiva (Firestore + defaults)
   - PUT  /api/informes/config   → guardar destinatarios / asunto / cuerpo / días / activo
   - POST /api/informes/enviar   → genera el PDF y lo envía ahora (ignora el toggle)
   - GET  /api/informes/vista-previa → texto del asunto y cuerpo ya renderizados
     (con datos reales) para revisar antes de enviar. */
'use strict';

const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const {
  getInformeConfig,
  guardarInformeConfig,
  resolverEnvio,
  renderPlantilla,
  varsInforme
} = require('../lib/informe-config');
const { armarFilas, generarPDF } = require('../lib/informe-vencimientos');
const { enviarInforme } = require('../lib/mailer');

const router = express.Router();

router.get('/config', verifyToken, requireAdmin, async (req, res) => {
  try {
    const cfg = await getInformeConfig();
    res.json({
      ok: true,
      config: cfg,
      servicioMail: {
        brevo: !!process.env.BREVO_API_KEY,
        smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
        remitente: process.env.INFORMES_EMAIL_FROM || process.env.SMTP_USER || 'grupo@falpat.com.ar'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/config', verifyToken, requireAdmin, async (req, res) => {
  try {
    const cfg = await guardarInformeConfig(req.body || {}, req.userData?.displayName || req.user?.email || '');
    res.json({ ok: true, config: cfg });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/vista-previa', verifyToken, requireAdmin, async (req, res) => {
  try {
    const cfg = await getInformeConfig();
    const dias = Math.max(1, parseInt(req.query.dias, 10) || cfg.dias);
    const { stats } = await armarFilas({ dias });
    res.json({
      ok: true,
      stats,
      dias,
      vars: varsInforme({ stats, dias })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/enviar', verifyToken, requireAdmin, async (req, res) => {
  try {
    const cfg = await getInformeConfig();

    let envio;
    try {
      envio = resolverEnvio(req.body, cfg);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const { filas, stats } = await armarFilas({ dias: envio.dias });
    const pdf = generarPDF(filas, { dias: envio.dias, stats });
    const hoy = new Date().toISOString().slice(0, 10);
    const filename = `VENCIMIENTOS_SEMANAL_${hoy}.pdf`;

    const vars = varsInforme({ stats, dias: envio.dias, fecha: hoy });
    const asunto = renderPlantilla(envio.asunto, vars);
    const texto = renderPlantilla(envio.cuerpo, vars);

    const mail = await enviarInforme({
      pdf,
      filename,
      asunto,
      texto,
      destinatarios: envio.destinatarios
    });
    if (!mail.enviado) {
      return res.status(400).json({ error: mail.motivo || 'No se pudo enviar el mail', stats, mail });
    }

    res.json({ ok: true, fecha: hoy, dias: envio.dias, stats, mail, asunto });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
