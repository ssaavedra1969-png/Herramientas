const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { sendAlertEmail } = require('../config/mail');
const { verifyToken } = require('../middleware/auth');

async function collectAlerts() {
  const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
  const now = new Date();
  const diasCritico = 7;
  const diasWarning = 30;
  const alerts = [];

  for (const d of snap.docs) {
    const v = d.data();
    const patente = v.patente || '—';
    const interno = v.interno || '';
    const marca = v.marca || '';
    const modelo = v.modelo || '';

    if (v.vtv?.fechaVencimiento) {
      const ven = v.vtv.fechaVencimiento.toDate ? v.vtv.fechaVencimiento.toDate() : new Date(v.vtv.fechaVencimiento);
      const diff = Math.ceil((ven - now) / 86400000);
      if (diff <= diasWarning) {
        alerts.push({
          tipo: 'VTV', patente, interno, marca, modelo,
          fecha: ven.toLocaleDateString('es-AR'),
          dias: diff,
          nivel: diff <= diasCritico ? 'critico' : 'warning'
        });
      }
    }

    if (v.seguro?.fechaVencimiento) {
      const ven = v.seguro.fechaVencimiento.toDate ? v.seguro.fechaVencimiento.toDate() : new Date(v.seguro.fechaVencimiento);
      const diff = Math.ceil((ven - now) / 86400000);
      if (diff <= diasWarning) {
        alerts.push({
          tipo: 'Seguro', patente, interno, marca, modelo,
          fecha: ven.toLocaleDateString('es-AR'),
          dias: diff,
          nivel: diff <= diasCritico ? 'critico' : 'warning'
        });
      }
    }

    if (v.proximoServiceFecha) {
      const ven = v.proximoServiceFecha.toDate ? v.proximoServiceFecha.toDate() : new Date(v.proximoServiceFecha);
      const diff = Math.ceil((ven - now) / 86400000);
      if (diff <= diasWarning) {
        alerts.push({
          tipo: 'Service', patente, interno, marca, modelo,
          fecha: ven.toLocaleDateString('es-AR'),
          dias: diff,
          nivel: diff <= diasCritico ? 'critico' : 'warning'
        });
      }
    }
  }

  alerts.sort((a, b) => a.dias - b.dias);
  return alerts;
}

function buildEmailHtml(alerts, fecha) {
  const criticos = alerts.filter(a => a.nivel === 'critico');
  const warnings = alerts.filter(a => a.nivel === 'warning');

  let rows = '';
  if (criticos.length) {
    rows += `<tr><td style="padding:12px 0 6px;font-size:13px;font-weight:700;color:#dc2626;">🔴 CRÍTICO (vence en ≤7 días)</td></tr>`;
    criticos.forEach(a => {
      rows += `<tr><td style="padding:4px 0 4px 12px;font-size:12px;color:#333;border-left:3px solid #dc2626;margin-bottom:4px;">
        <strong>${a.interno}</strong> — ${a.patente} — ${a.marca} ${a.modelo}<br>
        <span style="color:#666;">${a.tipo} vence ${a.fecha} (${a.dias <= 0 ? 'VENCIDO' : a.dias + ' días'})</span>
      </td></tr>`;
    });
  }
  if (warnings.length) {
    rows += `<tr><td style="padding:12px 0 6px;font-size:13px;font-weight:700;color:#d97706;">🟡 PRÓXIMO (vence en ≤30 días)</td></tr>`;
    warnings.forEach(a => {
      rows += `<tr><td style="padding:4px 0 4px 12px;font-size:12px;color:#333;border-left:3px solid #d97706;margin-bottom:4px;">
        <strong>${a.interno}</strong> — ${a.patente} — ${a.marca} ${a.modelo}<br>
        <span style="color:#666;">${a.tipo} vence ${a.fecha} (${a.dias} días)</span>
      </td></tr>`;
    });
  }

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#6C3CE1,#00D4FF);padding:20px 24px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="background:#fff;border-radius:8px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#6C3CE1;font-size:14px;font-weight:900;">GF</span>
      </div>
      <div>
        <div style="color:#fff;font-size:16px;font-weight:700;">Grupo Falpat SRL</div>
        <div style="color:rgba(255,255,255,0.8);font-size:11px;">Alerta de Vencimientos</div>
      </div>
    </div>
  </div>
  <div style="padding:20px 24px;">
    <p style="color:#666;font-size:12px;margin:0 0 16px;">Fecha: <strong>${fecha}</strong> — ${alerts.length} alerta${alerts.length !== 1 ? 's' : ''}</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
      <a href="${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/dashboard" style="display:inline-block;background:#6C3CE1;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Ver Dashboard →</a>
    </div>
  </div>
  <div style="padding:12px 24px;background:#f9f9fb;text-align:center;">
    <p style="color:#999;font-size:10px;margin:0;">Grupo Falpat SRL — Sistema de Control Vehicular</p>
  </div>
</div></body></html>`;
}

async function runAlerts(trigger) {
  const alerts = await collectAlerts();
  if (!alerts.length) return { sent: 0, alerts: 0, message: 'No hay vencimientos próximos' };

  const usersSnap = await db.collection('users').where('role', '==', 'Admin').get();
  const admins = usersSnap.docs.map(d => d.data()).filter(u => u.email);
  if (!admins.length) return { sent: 0, alerts: alerts.length, message: 'No hay admins con email configurado' };

  const now = new Date();
  const fecha = now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const criticos = alerts.filter(a => a.nivel === 'critico').length;
  const warnings = alerts.filter(a => a.nivel === 'warning').length;
  const subject = `🔴 ${criticos} crítico${criticos !== 1 ? 's' : ''} · 🟡 ${warnings} próximo${warnings !== 1 ? 's' : ''} — Alerta vencimientos Falpat`;
  const html = buildEmailHtml(alerts, fecha);

  const emails = admins.map(u => u.email);
  const results = [];
  for (const email of emails) {
    try {
      await sendAlertEmail(email, subject, html);
      results.push({ email, ok: true });
    } catch (e) {
      results.push({ email, ok: false, error: e.message });
    }
  }

  await db.collection('alertLogs').add({
    fecha: now,
    enviadoPor: trigger,
    destinatarios: emails,
    alertasEnviadas: alerts.length,
    criticos, warnings,
    vehiculos: [...new Set(alerts.map(a => a.patente))],
    resultados: results
  });

  const sent = results.filter(r => r.ok).length;
  return { sent, alerts: alerts.length, criticos, warnings, message: `${sent} email${sent !== 1 ? 's' : ''} enviado${sent !== 1 ? 's' : ''} (${alerts.length} alertas)` };
}

router.post('/send-alerts', verifyToken, async (req, res) => {
  try {
    if (res.locals.currentUserData?.role !== 'Admin') {
      return res.status(403).json({ error: 'Solo administradores pueden enviar alertas' });
    }
    const result = await runAlerts('manual');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/cron/check-alerts', async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await runAlerts('cron');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/alerts-config', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('alertConfig').get();
    res.json(doc.exists ? doc.data() : { diasCritico: 7, diasWarning: 30, incluirService: true, emailHabilitado: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/alerts-config', verifyToken, async (req, res) => {
  try {
    if (res.locals.currentUserData?.role !== 'Admin') {
      return res.status(403).json({ error: 'Solo administradores' });
    }
    await db.collection('settings').doc('alertConfig').set(req.body, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
