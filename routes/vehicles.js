const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('vehicles').orderBy('numeroInterno', 'asc').get();
    const vehicles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('vehicles').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const data = {
      patente: req.body.patente?.toUpperCase().trim(),
      numeroInterno: req.body.numeroInterno?.trim(),
      marca: req.body.marca?.trim(),
      modelo: req.body.modelo?.trim(),
      anio: req.body.anio ? parseInt(req.body.anio) : null,
      tipo: req.body.tipo,
      kilometraje: parseInt(req.body.kilometraje) || 0,
      estado: req.body.estado || 'Activo',
      proximoServiceKm: parseInt(req.body.proximoServiceKm) || null,
      proximoServiceFecha: req.body.proximoServiceFecha ? new Date(req.body.proximoServiceFecha) : null,
      fotoURL: req.body.fotoURL?.trim() || '',
      fechaAlta: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!data.patente || !data.numeroInterno || !data.marca || !data.modelo || !data.tipo) {
      return res.status(400).json({ error: 'Campos obligatorios: patente, interno, marca, modelo, tipo' });
    }

    const existing = await db.collection('vehicles').where('patente', '==', data.patente).get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'Ya existe un vehículo con esa patente' });
    }

    const docRef = await db.collection('vehicles').add(data);
    res.status(201).json({ id: docRef.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('vehicles').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });

    const data = {
      patente: req.body.patente?.toUpperCase().trim(),
      numeroInterno: req.body.numeroInterno?.trim(),
      marca: req.body.marca?.trim(),
      modelo: req.body.modelo?.trim(),
      anio: req.body.anio ? parseInt(req.body.anio) : null,
      tipo: req.body.tipo,
      kilometraje: parseInt(req.body.kilometraje) || 0,
      estado: req.body.estado || 'Activo',
      proximoServiceKm: parseInt(req.body.proximoServiceKm) || null,
      proximoServiceFecha: req.body.proximoServiceFecha ? new Date(req.body.proximoServiceFecha) : null,
      fotoURL: req.body.fotoURL?.trim() || '',
      updatedAt: new Date()
    };

    await db.collection('vehicles').doc(req.params.id).update(data);
    res.json({ id: req.params.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection('vehicles').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
