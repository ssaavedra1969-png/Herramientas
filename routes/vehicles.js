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
        compañía: seguro.compañía || '',
        poliza: seguro.poliza || '',
        tipo: seguro.tipo || '',
        fechaVencimiento: seguro.fechaVencimiento ? new Date(seguro.fechaVencimiento) : null,
        costo: parseFloat(seguro.costo) || null
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

    if (!data.patente || !data.marca || !data.modelo || !data.año || !data.chasis || !data.numeroMotor || !data.tipo || !data.subtipo) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
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
    const vtv = req.body.vtv || {};
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
        compañía: seguro.compañía || '',
        poliza: seguro.poliza || '',
        tipo: seguro.tipo || '',
        fechaVencimiento: seguro.fechaVencimiento ? new Date(seguro.fechaVencimiento) : null,
        costo: parseFloat(seguro.costo) || null
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
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ingreso Vehiculos', { views: [{ state: 'frozen', ySplit: 2 }] });

    const cols = [
      { h: 'patente', w: 14 }, { h: 'marca', w: 18 }, { h: 'modelo', w: 20 },
      { h: 'ano', w: 8 }, { h: 'chasis', w: 24 }, { h: 'numeroMotor', w: 22 },
      { h: 'tipo', w: 22 }, { h: 'subtipo', w: 16 }, { h: 'capacidadCarga', w: 16 },
      { h: 'kilometraje', w: 14 }, { h: 'vtvFechaRealizacion', w: 18 },
      { h: 'vtvVencimiento', w: 18 }, { h: 'vtvCosto', w: 14 }, { h: 'vtvCentro', w: 18 },
      { h: 'vtvResultado', w: 16 }, { h: 'seguroCompania', w: 22 }, { h: 'seguroPoliza', w: 20 },
      { h: 'seguroTipo', w: 22 }, { h: 'seguroVencimiento', w: 18 }, { h: 'seguroCosto', w: 14 },
      { h: 'proximoServiceKm', w: 16 }, { h: 'proximoServiceFecha', w: 18 },
      { h: 'conductorHabitual', w: 22 }, { h: 'centroTrabajo', w: 16 }, { h: 'observaciones', w: 42 }
    ];
    ws.columns = cols.map(c => ({ header: c.h, key: c.h, width: c.w }));

    const hRow = ws.getRow(1);
    hRow.height = 36;
    ws.columns.forEach((col, i) => {
      const c = hRow.getCell(i + 1);
      c.value = col.header;
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B35' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = { top: { style: 'thin', color: { argb: 'FFFFFF' } }, bottom: { style: 'thin', color: { argb: 'FFFFFF' } }, left: { style: 'thin', color: { argb: 'FFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFF' } } };
    });

    const sample = ['ABC123', 'Mercedes Benz', 'Atego 1718', 2022, '9BM1234567890ABC', 'Motor XYZ-12345', 'mixer', 'Indumix', 25000, 158000, '2026-03-15', '2026-08-31', 25000, 'Campana', 'Aprobado', 'Rivadavia Seguros', 'POL-2024-12345', 'Todo Riesgo', '2026-09-30', 120000, 160000, '2026-07-15', 'Juan Perez', 'Lujan', 'Ultimo cambio de cubiertas'];
    const sRow = ws.getRow(2);
    sRow.height = 24;
    sample.forEach((v, i) => {
      const c = sRow.getCell(i + 1);
      c.value = v;
      c.font = { name: 'Calibri', size: 10, color: { argb: '212121' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
      c.alignment = { vertical: 'middle' };
      if (typeof v === 'number') c.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const addDV = (range, opts) => ws.dataValidations.add(range, { type: 'list', formulae: ['"' + opts + '"'], allowBlank: true, showErrorMessage: true, errorTitle: 'Valor invalido', error: 'Seleccione un valor de la lista.' });
    addDV('B3:B502', 'Mercedes Benz,Scania,Volvo,Iveco,Volkswagen,Ford,Chevrolet,Toyota,Fiat,Renault,Nissan,JCB,Caterpillar,Komatsu,Hyundai,New Holland,John Deere,Case,Terex,Agrale');
    addDV('G3:G502', 'Camión volcador,mixer,hormigonera,cisterna,jaula,playo,regador,chasis,Auto,Camioneta,Grua,Utilitario,Carga,Cargadora frontal,Retroexcavadora,Motoniveladora,Excavadora,Minicargadora,Rodillo,Acoplado,Semirremolque,Montacarga');
    addDV('H3:H502', 'Indumix,Tzr,Betonmac,tecnus,Barival,everdingm,arrastre,Montacarga');
    addDV('N3:N502', 'Pendiente,Aprobado,Rechazado');
    addDV('R3:R502', 'Responsabilidad Civil,Todo Riesgo,Terceros Completo,Seguro Técnico');
    addDV('Y3:Y502', 'Lujan,Campana,Ituzaingo,Moreno,Zarate');
    ws.dataValidations.add('D3:D502', { type: 'whole', formulae: [1980, 2030], allowBlank: true, showErrorMessage: true, errorTitle: 'Ano invalido', error: 'Ingrese 1980-2030.' });
    ws.dataValidations.add('J3:J502', { type: 'whole', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'Kilometraje invalido', error: 'Debe ser positivo.' });
    ws.dataValidations.add('I3:I502', { type: 'whole', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'Capacidad invalida', error: 'Debe ser positivo.' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_vehiculos.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
