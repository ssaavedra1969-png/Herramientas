const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('vehicles').orderBy('interno', 'asc').get();
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
    const seguro = req.body.seguro || {};
    const data = {
      patente: req.body.patente?.toUpperCase().trim(),
      interno: req.body.interno?.trim(),
      tipo: req.body.tipo,
      marca: req.body.marca?.trim(),
      modelo: req.body.modelo?.trim(),
      año: req.body.año ? parseInt(req.body.año) : null,
      chasis: req.body.chasis?.trim() || '',
      kilometraje: parseInt(req.body.kilometraje) || 0,
      horometro: parseInt(req.body.horometro) || 0,
      estadoGeneral: req.body.estadoGeneral || 'Bueno',
      fechaUltimaRevision: req.body.fechaUltimaRevision ? new Date(req.body.fechaUltimaRevision) : null,
      vencimientoVTV: req.body.vencimientoVTV ? new Date(req.body.vencimientoVTV) : null,
      seguro: {
        compañía: seguro.compañía || '',
        poliza: seguro.poliza || '',
        fechaVencimiento: seguro.fechaVencimiento ? new Date(seguro.fechaVencimiento) : null
      },
      proximoServiceKm: parseInt(req.body.proximoServiceKm) || null,
      proximoServiceFecha: req.body.proximoServiceFecha ? new Date(req.body.proximoServiceFecha) : null,
      centroTrabajo: req.body.centroTrabajo || '',
      conductorHabitual: req.body.conductorHabitual?.trim() || '',
      observaciones: req.body.observaciones?.trim() || '',
      fotoURL: req.body.fotoURL?.trim() || '',
      multas: req.body.multas || [],
      documentos: req.body.documentos || [],
      fechaAlta: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!data.patente || !data.interno || !data.marca || !data.tipo) {
      return res.status(400).json({ error: 'Campos obligatorios: patente, interno, marca, tipo' });
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

    const seguro = req.body.seguro || {};
    const data = {
      patente: req.body.patente?.toUpperCase().trim(),
      interno: req.body.interno?.trim(),
      tipo: req.body.tipo,
      marca: req.body.marca?.trim(),
      modelo: req.body.modelo?.trim(),
      año: req.body.año ? parseInt(req.body.año) : null,
      chasis: req.body.chasis?.trim() || '',
      kilometraje: parseInt(req.body.kilometraje) || 0,
      horometro: parseInt(req.body.horometro) || 0,
      estadoGeneral: req.body.estadoGeneral || 'Bueno',
      fechaUltimaRevision: req.body.fechaUltimaRevision ? new Date(req.body.fechaUltimaRevision) : null,
      vencimientoVTV: req.body.vencimientoVTV ? new Date(req.body.vencimientoVTV) : null,
      seguro: {
        compañía: seguro.compañía || '',
        poliza: seguro.poliza || '',
        fechaVencimiento: seguro.fechaVencimiento ? new Date(seguro.fechaVencimiento) : null
      },
      proximoServiceKm: parseInt(req.body.proximoServiceKm) || null,
      proximoServiceFecha: req.body.proximoServiceFecha ? new Date(req.body.proximoServiceFecha) : null,
      centroTrabajo: req.body.centroTrabajo || '',
      conductorHabitual: req.body.conductorHabitual?.trim() || '',
      observaciones: req.body.observaciones?.trim() || '',
      fotoURL: req.body.fotoURL?.trim() || '',
      multas: req.body.multas || [],
      documentos: req.body.documentos || [],
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
