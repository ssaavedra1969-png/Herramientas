const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const gh = require('../lib/github-docs');

const DOCS_DIR = path.join(process.cwd(), 'PATENTE');
const DOC_TIPOS = ['titulo', 'cedula', 'seguro', 'registro', 'vtv', 'dni'];
const DOC_EXT_PRIORIDAD = ['pdf', 'jpg', 'jpeg', 'png'];
const DOC_MAX_UPLOAD = 700 * 1024;

function parseFecha(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function recomputeServiceSummary(vehicleId) {
  const snap = await db.collection('vehicles').doc(vehicleId).collection('services').get();
  const summary = {};
  let minKm = null;
  let minFecha = null;
  let nextTipo = null;
  snap.forEach(doc => {
    const s = doc.data();
    const tipo = s.tipo || 'Otro';
    if (!summary[tipo]) summary[tipo] = null;
    const cur = summary[tipo];
    const curDate = cur && cur.fecha ? (cur.fecha.seconds ? cur.fecha.seconds * 1000 : new Date(cur.fecha).getTime()) : 0;
    const newDate = s.fecha ? (s.fecha.seconds ? s.fecha.seconds * 1000 : new Date(s.fecha).getTime()) : 0;
    if (!cur || newDate >= curDate) {
      summary[tipo] = { fecha: s.fecha || null, km: s.km || null, proximoKm: s.proximoKm || null, proximoFecha: s.proximoFecha || null };
    }
    if (s.proximoKm != null && (minKm === null || s.proximoKm < minKm)) {
      minKm = s.proximoKm;
      minFecha = s.proximoFecha || null;
      nextTipo = tipo;
    }
  });
  const update = {
    serviceSummary: summary,
    proximoServiceKm: minKm,
    proximoServiceFecha: minFecha,
    proximoServiceTipo: nextTipo,
    updatedAt: new Date()
  };
  await db.collection('vehicles').doc(vehicleId).update(update);
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('vehicles').orderBy('interno', 'asc').get();
    const vehicles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function scanDocumentosCarpeta(patente) {
  const carpeta = path.join(DOCS_DIR, patente);
  let presentes = {};
  if (fs.existsSync(carpeta)) {
    const archivos = fs.readdirSync(carpeta);
    archivos.forEach(nombre => {
      const parsed = path.parse(nombre);
      const base = parsed.name.toLowerCase();
      const ext = parsed.ext.replace('.', '').toLowerCase();
      if (!DOC_TIPOS.includes(base) || !DOC_EXT_PRIORIDAD.includes(ext)) return;
      const actual = presentes[base];
      if (!actual || DOC_EXT_PRIORIDAD.indexOf(ext) < DOC_EXT_PRIORIDAD.indexOf(path.parse(actual.nombre).ext.replace('.', '').toLowerCase())) {
        presentes[base] = { url: `/documentos/${encodeURIComponent(patente)}/${nombre}`, nombre, origen: 'carpeta' };
      }
    });
  }
  return presentes;
}

router.get('/documentos/reporte', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('vehicles').get();
    const rows = snap.docs.map(d => {
      const v = d.data();
      const patente = (v.patente || '').toUpperCase();
      const presentes = scanDocumentosCarpeta(patente);
      const subidos = v.docsAdjuntos || {};
      const docs = {};
      DOC_TIPOS.forEach(t => { docs[t] = !!presentes[t] || !!subidos[t]; });
      const faltantes = DOC_TIPOS.filter(t => !docs[t]).length;
      return {
        id: d.id,
        patente: v.patente || '—',
        marca: v.marca || '—',
        modelo: v.modelo || '—',
        marcaModelo: [v.marca, v.modelo].filter(Boolean).join(' ') || '—',
        interno: v.interno || '',
        empresa: v.empresa || '',
        centroTrabajo: v.centroTrabajo || '',
        docs,
        faltantes
      };
    });
    rows.sort((a, b) => b.faltantes - a.faltantes || a.patente.localeCompare(b.patente));
    res.json({ rows, tipos: DOC_TIPOS });
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

router.get('/:id/documentos', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('vehicles').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });
    const patente = (doc.data().patente || '').toUpperCase();
    const ghDocs = await gh.listarCarpeta(patente).catch(() => []);

    const presentes = {};
    for (const t of DOC_TIPOS) {
      const entrada = gh.mejorNombre(ghDocs, t);
      if (entrada) {
        presentes[t] = { url: `/api/vehicles/${req.params.id}/documentos/adjunto/${t}`, nombre: entrada.nombre, mime: '', origen: 'carpeta' };
      }
    }

    const adj = doc.data().docsAdjuntos || {};
    const migrados = [];
    for (const t of DOC_TIPOS) {
      if (!presentes[t] && adj[t]) {
        presentes[t] = { url: `/api/vehicles/${req.params.id}/documentos/adjunto/${t}`, nombre: adj[t].nombre || `${t} (subido)`, mime: adj[t].mime || '', origen: 'carga' };
        if (process.env.GITHUB_TOKEN) migrados.push(t);
      }
    }

    if (migrados.length && process.env.GITHUB_TOKEN) {
      migrarAdjuntoAFirestore(req.params.id, patente, migrados).catch(() => {});
    }

    res.json({ id: doc.id, patente, documentos: presentes, tipos: DOC_TIPOS, migrados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/documentos/adjunto/:tipo', verifyToken, async (req, res) => {
  try {
    const tipo = (req.params.tipo || '').toLowerCase();
    if (!DOC_TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo de documento inválido' });
    const doc = await db.collection('vehicles').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });
    const patente = (doc.data().patente || '').toUpperCase();

    if (process.env.GITHUB_TOKEN) {
      const leido = await gh.leerArchivo(patente, tipo).catch(() => null);
      if (leido && leido.content) {
        const buf = Buffer.from(leido.content, leido.encoding === 'base64' ? 'base64' : 'utf8');
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `inline; filename="${leido.nombre}"`);
        res.set('Cache-Control', 'no-store');
        return res.send(buf);
      }
    }

    const ref = db.collection('vehicles').doc(req.params.id).collection('docsadjuntos').doc(tipo);
    const u = await ref.get();
    if (!u.exists) return res.status(404).json({ error: 'Documento no encontrado' });
    const d = u.data();
    res.set('Content-Type', d.mime || 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${d.nombre || tipo}"`);
    res.set('Cache-Control', 'no-store');
    res.send(d.bytes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function migrarAdjuntoAFirestore(vehicleId, patente, tipos) {
  for (const t of tipos) {
    const ref = db.collection('vehicles').doc(vehicleId).collection('docsadjuntos').doc(t);
    const u = await ref.get();
    if (!u.exists) continue;
    const d = u.data();
    const buf = d.bytes;
    try {
      await gh.subirArchivo(patente, t, buf.toString('base64'));
      await ref.delete();
      await db.collection('vehicles').doc(vehicleId).update({ [`docsAdjuntos.${t}`]: admin.firestore.FieldValue.delete() });
    } catch (e) { /* no bloquea */ }
  }
}

router.post('/:id/documentos/:tipo/upload', verifyToken, requireAdmin, async (req, res) => {
  try {
    const tipo = (req.params.tipo || '').toLowerCase();
    if (!DOC_TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo de documento inválido' });
    const vehiculo = await db.collection('vehicles').doc(req.params.id).get();
    if (!vehiculo.exists) return res.status(404).json({ error: 'No encontrado' });
    const patente = (vehiculo.data().patente || '').toUpperCase();
    if (!patente) return res.status(400).json({ error: 'El vehículo no tiene patente' });

    if (!process.env.GITHUB_TOKEN) {
      return res.status(503).json({ error: 'El servidor de producción no tiene configurado GITHUB_TOKEN para poder escribir los documentos en GitHub.' });
    }

    const { nombre, base64, mime } = req.body || {};
    if (!base64) return res.status(400).json({ error: 'Falta el archivo' });
    const buf = Buffer.from(base64, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'Archivo vacío o inválido' });
    const nombreArchivo = (nombre || `${tipo}.pdf`).replace(/^.*[\\/]/, '') || `${tipo}.pdf`;
    const ext = path.parse(nombreArchivo).ext.toLowerCase();

    const permitidas = process.env.GITHUB_TOKEN ? ['.pdf'] : ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!permitidas.includes(ext)) return res.status(400).json({ error: 'Solo se permiten archivos PDF' });

    const resultado = await gh.subirArchivo(patente, tipo, buf.toString('base64'));

    const subRef = db.collection('vehicles').doc(req.params.id).collection('docsadjuntos').doc(tipo);
    if ((await subRef.get()).exists) {
      await subRef.delete();
      await db.collection('vehicles').doc(req.params.id).update({ [`docsAdjuntos.${tipo}`]: admin.firestore.FieldValue.delete() });
    }

    res.json({ ok: true, tipo, limpiados: resultado.limpiados });
  } catch (error) {
    res.status(error.code === 'NO_TOKEN' ? 503 : 500).json({ error: error.message });
  }
});

router.delete('/:id/documentos/:tipo', verifyToken, requireAdmin, async (req, res) => {
  try {
    const tipo = (req.params.tipo || '').toLowerCase();
    if (!DOC_TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo de documento inválido' });
    const doc = await db.collection('vehicles').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });
    const patente = (doc.data().patente || '').toUpperCase();

    let borrados = [];
    if (process.env.GITHUB_TOKEN) {
      borrados = await gh.borrarTipo(patente, tipo);
    }

    const subRef = db.collection('vehicles').doc(req.params.id).collection('docsadjuntos').doc(tipo);
    let borradoSubido = false;
    if ((await subRef.get()).exists) {
      await subRef.delete();
      await db.collection('vehicles').doc(req.params.id).update({ [`docsAdjuntos.${tipo}`]: admin.firestore.FieldValue.delete() });
      borradoSubido = true;
    }

    if (!borrados.length && !borradoSubido) {
      if (!process.env.GITHUB_TOKEN) {
        return res.status(503).json({ error: 'El servidor de producción no tiene configurado GITHUB_TOKEN para poder eliminar los documentos de GitHub.' });
      }
      return res.status(404).json({ error: 'No hay documento de ese tipo en GitHub ni en los adjuntos' });
    }

    res.json({ ok: true, borrados, subido: borradoSubido });
  } catch (error) {
    res.status(error.code === 'NO_TOKEN' ? 503 : 500).json({ error: error.message });
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
      nroBet: req.body.nroBet?.trim() || '',
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
      nroBet: req.body.nroBet?.trim() || '',
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

router.get('/:id/services', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('vehicles').doc(req.params.id).collection('services')
      .orderBy('fecha', 'desc').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/services', verifyToken, requireAdmin, async (req, res) => {
  try {
    const km = parseInt(req.body.km) || null;
    const intervalo = parseInt(req.body.intervalo) || null;
    const proximoKm = req.body.proximoKm != null && req.body.proximoKm !== ''
      ? parseInt(req.body.proximoKm)
      : (km != null && intervalo != null ? km + intervalo : null);
    const data = {
      fecha: parseFecha(req.body.fecha) || new Date(),
      tipo: req.body.tipo?.trim() || 'Otro',
      km: km,
      intervaloKm: intervalo,
      proximoKm: proximoKm,
      proximoFecha: parseFecha(req.body.proximoFecha),
      costo: req.body.costo ? parseFloat(req.body.costo) : null,
      proveedor: req.body.proveedor?.trim() || '',
      observaciones: req.body.observaciones?.trim() || '',
      createdAt: new Date()
    };
    const ref = await db.collection('vehicles').doc(req.params.id).collection('services').add(data);
    await recomputeServiceSummary(req.params.id);
    res.status(201).json({ id: ref.id, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/services/:entryId', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection('vehicles').doc(req.params.id).collection('services').doc(req.params.entryId).delete();
    await recomputeServiceSummary(req.params.id);
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
      'patente','interno','marca','modelo','año','chasis','numeroMotor','nroBet',
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
