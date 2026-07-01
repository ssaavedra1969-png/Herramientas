const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    let query = db.collection('maintenance').orderBy('fechaRealizacion', 'desc');

    if (req.query.tipo) query = query.where('tipo', '==', req.query.tipo);
    if (req.query.estado) query = query.where('estado', '==', req.query.estado);
    if (req.query.vehiculoId) query = query.where('vehiculoId', '==', req.query.vehiculoId);

    const snapshot = await query.get();
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('maintenance').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.userData?.role !== 'Admin') {
      return res.status(403).json({ error: 'Solo administradores pueden crear mantenimientos' });
    }

    const data = {
      tipo: req.body.tipo,
      vehiculoId: req.body.vehiculoId || null,
      vehiculoPatente: req.body.vehiculoPatente || null,
      vehiculoInterno: req.body.vehiculoInterno || null,
      fechaRealizacion: req.body.fechaRealizacion ? new Date(req.body.fechaRealizacion) : null,
      proximaFechaVencimiento: req.body.proximaFechaVencimiento ? new Date(req.body.proximaFechaVencimiento) : null,
      kilometrajeHoras: parseInt(req.body.kilometrajeHoras) || null,
      descripcion: req.body.descripcion?.trim(),
      costo: parseFloat(req.body.costo) || null,
      responsable: req.body.responsable?.trim(),
      estado: req.body.estado || 'Pendiente',
      comprobanteURL: req.body.comprobanteURL?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!data.tipo || !data.descripcion || !data.responsable || !data.fechaRealizacion) {
      return res.status(400).json({ error: 'Campos obligatorios: tipo, descripción, responsable, fecha' });
    }

    const docRef = await db.collection('maintenance').add(data);
    res.status(201).json({ id: docRef.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('maintenance').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });

    const data = {
      tipo: req.body.tipo,
      vehiculoId: req.body.vehiculoId || null,
      vehiculoPatente: req.body.vehiculoPatente || null,
      vehiculoInterno: req.body.vehiculoInterno || null,
      fechaRealizacion: req.body.fechaRealizacion ? new Date(req.body.fechaRealizacion) : null,
      proximaFechaVencimiento: req.body.proximaFechaVencimiento ? new Date(req.body.proximaFechaVencimiento) : null,
      kilometrajeHoras: parseInt(req.body.kilometrajeHoras) || null,
      descripcion: req.body.descripcion?.trim(),
      costo: parseFloat(req.body.costo) || null,
      responsable: req.body.responsable?.trim(),
      estado: req.body.estado || 'Pendiente',
      comprobanteURL: req.body.comprobanteURL?.trim() || '',
      updatedAt: new Date()
    };

    await db.collection('maintenance').doc(req.params.id).update(data);
    res.json({ id: req.params.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection('maintenance').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
