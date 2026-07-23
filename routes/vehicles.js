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
    const vtv = req.body.vtv || {};
    const trompoEnabled = req.body.trompo === true;
    const data = {
      patente: req.body.patente?.toUpperCase().trim(),
      interno: req.body.interno?.trim(),
      tipo: req.body.tipo,
      subtipo: req.body.subtipo?.trim() || '',
      marca: req.body.marca?.trim(),
      modelo: req.body.modelo?.trim(),
      año: req.body.año ? parseInt(req.body.año) : null,
      chasis: req.body.chasis?.trim() || '',
      numeroMotor: req.body.numeroMotor?.trim() || '',
      capacidadCarga: parseFloat(req.body.capacidadCarga) || null,
      trompo: trompoEnabled,
      marcaTrompo: trompoEnabled ? (req.body.marcaTrompo?.trim() || null) : null,
      serieTrompo: trompoEnabled ? (req.body.serieTrompo?.trim() || null) : null,
      modeloTrompo: trompoEnabled ? (req.body.modeloTrompo?.trim() || null) : null,
      cargaM3Trompo: trompoEnabled ? (req.body.cargaM3Trompo?.trim() || null) : null,
      kilometraje: parseInt(req.body.kilometraje) || 0,
      horometro: parseInt(req.body.horometro) || 0,
      estadoGeneral: req.body.estadoGeneral || 'Bueno',
      fechaUltimaRevision: req.body.fechaUltimaRevision ? new Date(req.body.fechaUltimaRevision) : null,
      vtv: {
        fechaRealizacion: vtv.fechaRealizacion ? new Date(vtv.fechaRealizacion) : null,
        fechaVencimiento: vtv.fechaVencimiento ? new Date(vtv.fechaVencimiento) : null,
        costo: parseFloat(vtv.costo) || null,
        centroMedicion: vtv.centroMedicion?.trim() || '',
        resultado: vtv.resultado || 'Pendiente'
      },
      seguro: {
        compania: seguro.compania || seguro.compañía || '',
        poliza: seguro.poliza || '',
        tipo: seguro.tipo || '',
        fechaVencimiento: seguro.fechaVencimiento ? new Date(seguro.fechaVencimiento) : null,
        costo: parseFloat(seguro.costo) || null
      },
      proximoServiceKm: parseInt(req.body.proximoServiceKm) || null,
      proximoServiceFecha: req.body.proximoServiceFecha ? new Date(req.body.proximoServiceFecha) : null,
      centroTrabajo: req.body.centroTrabajo || '',
      chofer: req.body.chofer?.trim() || '',
      dni: req.body.dni?.trim() || '',
      vencimientoDNI: req.body.vencimientoDNI ? new Date(req.body.vencimientoDNI) : null,
      registro: req.body.registro?.trim() || '',
      vencimientoRegistro: req.body.vencimientoRegistro ? new Date(req.body.vencimientoRegistro) : null,
      observaciones: req.body.observaciones?.trim() || '',
      fotoURL: req.body.fotoURL?.trim() || '',
      multas: req.body.multas || [],
      documentos: req.body.documentos || [],
      fechaAlta: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!data.patente) {
      return res.status(400).json({ error: 'La patente es obligatoria' });
    }

    const existing = await db.collection('vehicles').where('patente', '==', data.patente).get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'Ya existe un vehiculo con esa patente' });
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
    const vtv = req.body.vtv || {};
    const trompoEnabled = req.body.trompo === true;
    const data = {
      patente: req.body.patente?.toUpperCase().trim(),
      interno: req.body.interno?.trim(),
      tipo: req.body.tipo,
      subtipo: req.body.subtipo?.trim() || '',
      marca: req.body.marca?.trim(),
      modelo: req.body.modelo?.trim(),
      año: req.body.año ? parseInt(req.body.año) : null,
      chasis: req.body.chasis?.trim() || '',
      numeroMotor: req.body.numeroMotor?.trim() || '',
      capacidadCarga: parseFloat(req.body.capacidadCarga) || null,
      trompo: trompoEnabled,
      marcaTrompo: trompoEnabled ? (req.body.marcaTrompo?.trim() || null) : null,
      serieTrompo: trompoEnabled ? (req.body.serieTrompo?.trim() || null) : null,
      modeloTrompo: trompoEnabled ? (req.body.modeloTrompo?.trim() || null) : null,
      cargaM3Trompo: trompoEnabled ? (req.body.cargaM3Trompo?.trim() || null) : null,
      kilometraje: parseInt(req.body.kilometraje) || 0,
      horometro: parseInt(req.body.horometro) || 0,
      estadoGeneral: req.body.estadoGeneral || 'Bueno',
      fechaUltimaRevision: req.body.fechaUltimaRevision ? new Date(req.body.fechaUltimaRevision) : null,
      vtv: {
        fechaRealizacion: vtv.fechaRealizacion ? new Date(vtv.fechaRealizacion) : null,
        fechaVencimiento: vtv.fechaVencimiento ? new Date(vtv.fechaVencimiento) : null,
        costo: parseFloat(vtv.costo) || null,
        centroMedicion: vtv.centroMedicion?.trim() || '',
        resultado: vtv.resultado || 'Pendiente'
      },
      seguro: {
        compania: seguro.compania || seguro.compañía || '',
        poliza: seguro.poliza || '',
        tipo: seguro.tipo || '',
        fechaVencimiento: seguro.fechaVencimiento ? new Date(seguro.fechaVencimiento) : null,
        costo: parseFloat(seguro.costo) || null
      },
      proximoServiceKm: parseInt(req.body.proximoServiceKm) || null,
      proximoServiceFecha: req.body.proximoServiceFecha ? new Date(req.body.proximoServiceFecha) : null,
      centroTrabajo: req.body.centroTrabajo || '',
      chofer: req.body.chofer?.trim() || '',
      dni: req.body.dni?.trim() || '',
      vencimientoDNI: req.body.vencimientoDNI ? new Date(req.body.vencimientoDNI) : null,
      registro: req.body.registro?.trim() || '',
      vencimientoRegistro: req.body.vencimientoRegistro ? new Date(req.body.vencimientoRegistro) : null,
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

router.get('/:id/combustible', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('vehicles').doc(req.params.id).collection('combustible')
      .orderBy('fecha', 'desc').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/combustible', verifyToken, requireAdmin, async (req, res) => {
  try {
    const data = {
      fecha: req.body.fecha ? new Date(req.body.fecha) : new Date(),
      litros: parseFloat(req.body.litros),
      importe: parseFloat(req.body.importe),
      tipo: req.body.tipo || 'Gasoil',
      km: parseInt(req.body.km) || null,
      proveedor: req.body.proveedor?.trim() || '',
      observaciones: req.body.observaciones?.trim() || '',
      createdAt: new Date()
    };
    const ref = await db.collection('vehicles').doc(req.params.id).collection('combustible').add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/combustible/:entryId', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection('vehicles').doc(req.params.id).collection('combustible').doc(req.params.entryId).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/repuestos', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('vehicles').doc(req.params.id).collection('repuestos')
      .orderBy('fecha', 'desc').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/repuestos', verifyToken, requireAdmin, async (req, res) => {
  try {
    const data = {
      fecha: req.body.fecha ? new Date(req.body.fecha) : new Date(),
      pieza: req.body.pieza?.trim(),
      costo: parseFloat(req.body.costo),
      proveedor: req.body.proveedor?.trim() || '',
      tipo: req.body.tipo || 'Mantenimiento',
      km: parseInt(req.body.km) || null,
      observaciones: req.body.observaciones?.trim() || '',
      createdAt: new Date()
    };
    const ref = await db.collection('vehicles').doc(req.params.id).collection('repuestos').add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/repuestos/:entryId', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection('vehicles').doc(req.params.id).collection('repuestos').doc(req.params.entryId).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/template/excel', verifyToken, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Vehículos');

    const headers = [
      'patente','interno','marca','modelo','año','chasis','numeroMotor',
      'tipo','subtipo','capacidadCarga','trompo','marcaTrompo','serieTrompo',
      'modeloTrompo','cargaM3Trompo','kilometraje','vtvFechaRealizacion',
      'vtvVencimiento','vtvCosto','vtvCentro','vtvResultado','seguroCompania',
      'seguroPoliza','seguroTipo','seguroVencimiento','seguroCosto',
      'proximoServiceKm','proximoServiceFecha','chofer','dni','vencimientoDNI','registro','vencimientoRegistro','empresa',
      'centroTrabajo','observaciones'
    ];

    ws.addRow(headers);

    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C3CE1' } };
      cell.alignment = { horizontal: 'center' };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_vehiculos.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
