const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
    const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['Admin', 'Usuario'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const userDoc = await db.collection('users').doc(req.params.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.collection('users').doc(req.params.id).update({
      role,
      updatedAt: new Date()
    });

    res.json({ success: true, role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const [vehiclesSnap, toolsSnap, maintenanceSnap] = await Promise.all([
      db.collection('vehicles').get(),
      db.collection('tools').get(),
      db.collection('maintenance').get()
    ]);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const vehiculosActivos = vehiclesSnap.docs.filter(d => d.data().estado === 'Activo').length;
    const herramientasMalEstado = toolsSnap.docs.filter(d => ['Roto', 'En reparación'].includes(d.data().estado)).length;

    let vencidosHoy = 0;
    let proximos7 = 0;
    const monthlyData = {};

    maintenanceSnap.docs.forEach(d => {
      const m = d.data();
      const venc = m.proximaFechaVencimiento?.toDate ? m.proximaFechaVencimiento.toDate() : new Date(m.proximaFechaVencimiento);
      const diff = Math.ceil((venc - now) / (1000 * 60 * 60 * 24));

      if (diff <= 0 && m.estado !== 'Realizado') vencidosHoy++;
      else if (diff <= 7 && m.estado !== 'Realizado') proximos7++;

      if (m.fechaRealizacion) {
        const d2 = m.fechaRealizacion.toDate ? m.fechaRealizacion.toDate() : new Date(m.fechaRealizacion);
        const key = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + 1;
      }
    });

    res.json({
      vehiculosActivos,
      herramientasMalEstado,
      vencidosHoy,
      proximos7,
      monthlyData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/backup', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');

    const child = spawn('node', [path.join(__dirname, '..', 'scripts', 'export-firebase.js')], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout.on('data', d => output += d.toString());
    child.stderr.on('data', d => output += d.toString());

    child.on('close', code => {
      if (code === 0) {
        res.json({ success: true, message: 'Backup completado', log: output });
      } else {
        res.status(500).json({ error: 'Error en backup', log: output });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/alerts', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('maintenance').where('estado', '!=', 'Realizado').get();
    const now = new Date();
    const alerts = [];

    snapshot.docs.forEach(d => {
      const m = d.data();
      const venc = m.proximaFechaVencimiento?.toDate ? m.proximaFechaVencimiento.toDate() : new Date(m.proximaFechaVencimiento);
      const diff = Math.ceil((venc - now) / (1000 * 60 * 60 * 24));

      let level = 'none';
      let label = '';
      if (diff <= 0) { level = 'critical'; label = 'Vencido'; }
      else if (diff <= 1) { level = 'critical'; label = 'Vence hoy'; }
      else if (diff <= 7) { level = 'warning'; label = 'Próximo a vencer'; }
      else if (diff <= 15) { level = 'info'; label = 'Por vencer'; }

      if (level !== 'none') {
        alerts.push({
          id: d.id,
          level,
          label,
          days: diff,
          descripcion: m.descripcion,
          proximaFechaVencimiento: venc,
          vehiculoPatente: m.vehiculoPatente,
          herramientaCodigo: m.herramientaCodigo,
          tipo: m.tipo
        });
      }
    });

    alerts.sort((a, b) => a.days - b.days);
    res.json(alerts.slice(0, 50));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
