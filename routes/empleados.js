'use strict';

const express = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { db } = require('../config/firebase');
const empleados = require('../lib/empleados');

const router = express.Router();

function actor(req) {
  return req.userData?.displayName || req.user?.email || req.body?.actualizadoPor || 'sistema';
}

function responderError(res, error) {
  if (error.code === 'NO_ENCONTRADO') return res.status(404).json({ error: error.message });
  if (error.code === 'CONFLICTO') return res.status(409).json({ error: error.message, conflictos: error.conflictos || [error.message] });
  if (error.code === 'VALIDACION') return res.status(400).json({ error: error.message });
  return res.status(500).json({ error: error.message });
}

function invalidarCachesRelacionados() {
  try { require('./vehicles').invalidarCachesDocumentos?.(); } catch (e) { void e; }
  try { require('./admin').invalidarCachesDocumentos?.(); } catch (e) { void e; }
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const lista = await empleados.obtenerEmpleados(db);
    res.json({ ok: true, empleados: lista });
  } catch (error) {
    responderError(res, error);
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const empleado = await empleados.obtenerEmpleado(db, req.params.id);
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json({ ok: true, empleado });
  } catch (error) {
    responderError(res, error);
  }
});

router.get('/:id/documentos/:tipo', verifyToken, async (req, res) => {
  try {
    const doc = await empleados.obtenerDocumentoEmpleado(db, req.params.id, String(req.params.tipo || '').toLowerCase());
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.set('Content-Type', doc.mime || 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${doc.nombre}"`);
    res.set('Cache-Control', 'no-store');
    return res.send(doc.buffer);
  } catch (error) {
    responderError(res, error);
  }
});

router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!String(body.nombre || '').trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const empleado = await empleados.crearEmpleado(db, body, actor(req));
    invalidarCachesRelacionados();
    res.status(201).json({ ok: true, empleado });
  } catch (error) {
    responderError(res, error);
  }
});

router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const empleado = await empleados.actualizarEmpleado(db, req.params.id, req.body || {}, actor(req));
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
    invalidarCachesRelacionados();
    res.json({ ok: true, empleado });
  } catch (error) {
    responderError(res, error);
  }
});

router.patch('/:id/historial/:histId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const hist = await empleados.actualizarHistorial(db, req.params.id, req.params.histId, req.body || {}, actor(req));
    if (!hist) return res.status(404).json({ error: 'Historial no encontrado' });
    res.json({ ok: true, historial: hist });
  } catch (error) {
    responderError(res, error);
  }
});

router.post('/mover', verifyToken, requireAdmin, async (req, res) => {
  try {
    const resultado = await empleados.moverChofer(db, req.body || {}, actor(req));
    invalidarCachesRelacionados();
    res.json({ ok: true, ...resultado });
  } catch (error) {
    responderError(res, error);
  }
});

router.post('/sincronizar', verifyToken, requireAdmin, async (req, res) => {
  try {
    const resultado = await empleados.sincronizarDesdeVehiculos(db, actor(req));
    invalidarCachesRelacionados();
    res.json({ ok: true, ...resultado });
  } catch (error) {
    responderError(res, error);
  }
});

module.exports = router;
