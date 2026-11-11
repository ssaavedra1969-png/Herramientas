/* Endpoint para Vercel Cron: informe semanal de vencimientos (lunes).

   Vercel manda `Authorization: Bearer <CRON_SECRET>` automáticamente si esa
   variable existe en el proyecto. También acepta `?token=<CRON_SECRET>` para
   probar desde curl/navegador. Sin secreto configurado responde 401.

   Usa la configuración de Admin → Correos (`config/informesMail`):
   destinatarios, asunto, cuerpo, ventana y el toggle de envío automático.
   `?forzar=1` ignora el toggle; `?mail=0` genera el PDF sin enviar.

   No escribe en Firestore. */
'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { armarFilas, generarPDF } = require('../lib/informe-vencimientos');
const { getInformeConfig, renderPlantilla, varsInforme } = require('../lib/informe-config');
const { enviarInforme } = require('../lib/mailer');

const router = express.Router();

function igual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function autorizado(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '') || String(req.query.token || '');
  return igual(token, secret);
}

router.get('/vencimientos', async (req, res) => {
  if (!autorizado(req)) return res.status(401).json({ error: 'No autorizado' });

  try {
    const cfg = await getInformeConfig();

    if (cfg.activo === false && req.query.forzar !== '1') {
      return res.json({
        ok: true,
        omitido: 'envío automático desactivado en Admin → Correos',
        activo: false
      });
    }

    const dias = Math.max(1, parseInt(req.query.dias, 10) || cfg.dias);
    const { filas, stats } = await armarFilas({ dias });
    const pdf = generarPDF(filas, { dias, stats });
    const hoy = new Date().toISOString().slice(0, 10);
    const filename = `VENCIMIENTOS_SEMANAL_${hoy}.pdf`;

    const vars = varsInforme({ stats, dias, fecha: hoy });
    const asunto = renderPlantilla(cfg.asunto, vars);
    const texto = renderPlantilla(cfg.cuerpo, vars);

    let mail = { enviado: false, motivo: 'omitido (?mail=0)' };
    if (req.query.mail !== '0') {
      mail = await enviarInforme({
        pdf,
        filename,
        asunto,
        texto,
        destinatarios: cfg.destinatarios
      });
    }

    // En local guarda una copia en informes/ (gitignored). En Vercel no se escribe.
    let archivo = null;
    if (!process.env.VERCEL) {
      const destino = path.join(__dirname, '..', 'informes', filename);
      try {
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, pdf);
        archivo = destino;
      } catch (_) {
        archivo = null;
      }
    }

    res.json({ ok: true, fecha: hoy, dias, stats, mail, archivo, activo: cfg.activo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
