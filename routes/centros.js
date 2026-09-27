const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const TTL_CENTROS = 60 * 1000;
const cacheTTL = new Map();

function getCache(key, ttl) {
  const hit = cacheTTL.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.value;
  if (hit) cacheTTL.delete(key);
  return null;
}
function setCache(key, value) {
  cacheTTL.set(key, { t: Date.now(), value });
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const cacheado = getCache('centros-list', TTL_CENTROS);
    if (cacheado) return res.json(cacheado);
    const snapshot = await db.collection('centros').orderBy('nombre', 'asc').get();
    const centros = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setCache('centros-list', centros);
    res.json(centros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { nombre, ubicacion, observaciones } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const docRef = await db.collection('centros').add({
      nombre: nombre.trim(),
      ubicacion: ubicacion?.trim() || '',
      observaciones: observaciones?.trim() || '',
      estado: 'activa',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    cacheTTL.delete('centros-list');
    res.status(201).json({ id: docRef.id, nombre });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const cacheKey = `centro-${req.params.id}`;
    const cacheado = getCache(cacheKey, TTL_CENTROS);
    if (cacheado) return res.json(cacheado);
    const doc = await db.collection('centros').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Centro no encontrado' });
    const centro = { id: doc.id, ...doc.data() };

    const elementosSnap = await db.collection(`centros/${req.params.id}/elementos`)
      .orderBy('fechaAsignacion', 'desc').get();
    const elementos = elementosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    centro.elementos = elementos;
    centro.totalElementos = elementos.length;
    centro.asignados = elementos.filter(e => !e.fechaDevolucion || e.fechaDevolucion === '').length;
    centro.devueltos = elementos.filter(e => e.fechaDevolucion && e.fechaDevolucion !== '').length;

    setCache(cacheKey, centro);
    res.json(centro);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { estado, observaciones, ubicacion } = req.body;
    const update = { updatedAt: new Date() };
    if (estado) update.estado = estado;
    if (observaciones !== undefined) update.observaciones = observaciones;
    if (ubicacion !== undefined) update.ubicacion = ubicacion;
    await db.collection('centros').doc(req.params.id).update(update);
    cacheTTL.delete(`centro-${req.params.id}`);
    cacheTTL.delete('centros-list');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/elementos', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { elementoId, elementoTipo, origenCentro, observaciones } = req.body;
    if (!elementoId || !elementoTipo) {
      return res.status(400).json({ error: 'elementoId y elementoTipo son obligatorios' });
    }
    const docRef = await db.collection(`centros/${req.params.id}/elementos`).add({
      elementoId,
      elementoTipo,
      origenCentro: origenCentro || null,
      fechaAsignacion: new Date(),
      fechaDevolucion: '',
      observaciones: observaciones?.trim() || '',
      createdAt: new Date()
    });
    cacheTTL.delete(`centro-${req.params.id}`);
    cacheTTL.delete('centros-list');
    res.status(201).json({ id: docRef.id, elementoId, elementoTipo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/elementos/:elemId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const elemRef = db.collection(`centros/${req.params.id}/elementos`).doc(req.params.elemId);
    const doc = await elemRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Elemento no encontrado en este centro' });
    await elemRef.update({
      fechaDevolucion: new Date(),
      updatedAt: new Date()
    });
    cacheTTL.delete(`centro-${req.params.id}`);
    cacheTTL.delete('centros-list');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
