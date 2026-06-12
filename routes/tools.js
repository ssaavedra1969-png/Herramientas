const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('tools').orderBy('codigoInterno', 'asc').get();
    const tools = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(tools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('tools').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const data = {
      nombre: req.body.nombre?.trim(),
      codigoInterno: req.body.codigoInterno?.trim().toUpperCase(),
      tipo: req.body.tipo,
      estado: req.body.estado || 'Bueno',
      ubicacion: req.body.ubicacion || 'Taller',
      fechaUltimoControl: req.body.fechaUltimoControl ? new Date(req.body.fechaUltimoControl) : null,
      proximoControl: req.body.proximoControl ? new Date(req.body.proximoControl) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!data.nombre || !data.codigoInterno || !data.tipo) {
      return res.status(400).json({ error: 'Campos obligatorios: nombre, código, tipo' });
    }

    const docRef = await db.collection('tools').add(data);
    res.status(201).json({ id: docRef.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('tools').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });

    const data = {
      nombre: req.body.nombre?.trim(),
      codigoInterno: req.body.codigoInterno?.trim().toUpperCase(),
      tipo: req.body.tipo,
      estado: req.body.estado || 'Bueno',
      ubicacion: req.body.ubicacion || 'Taller',
      fechaUltimoControl: req.body.fechaUltimoControl ? new Date(req.body.fechaUltimoControl) : null,
      proximoControl: req.body.proximoControl ? new Date(req.body.proximoControl) : null,
      updatedAt: new Date()
    };

    await db.collection('tools').doc(req.params.id).update(data);
    res.json({ id: req.params.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection('tools').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
