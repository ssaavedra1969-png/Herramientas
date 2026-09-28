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

/* ── CATÁLOGO DE ELEMENTOS ── */
const TIPOS_ELEMENTOS = ['vehiculo', 'herramienta', 'equipo', 'ropa', 'material'];

function cleanTimestamps(obj) {
  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && v.constructor && v.constructor.name === 'Timestamp') {
      cleaned[k] = v.toDate().toISOString();
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      cleaned[k] = cleanTimestamps(v);
    } else if (Array.isArray(v)) {
      cleaned[k] = v.map(item => typeof item === 'object' ? cleanTimestamps(item) : item);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

async function getVehicleList() {
  const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
  return snap.docs.map(d => {
    const v = d.data();
    return {
      id: d.id,
      interno: v.patente || v.interno || '',
      nombre: `${v.patente || v.interno || ''} — ${v.marca || ''} ${v.modelo || ''} ${v.anio || ''}`.trim()
    };
  });
}

async function getCatalogElements(tipo) {
  const col = db.collection('elementos_catalogo').where('tipo', '==', tipo);
  const snap = await col.get();
  const items = snap.docs.map(d => {
    const data = d.data();
    return { id: d.id, nombre: data.nombre, interno: data.interno || data.elementoId || '', marca: data.marca || '', modelo: data.modelo || '', descripcion: data.descripcion || '', stock: data.stock || 0 };
  });
  items.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return items;
}

async function getAvailableElements(tipo) {
  if (tipo === 'vehiculo') return await getVehicleList();
  return await getCatalogElements(tipo);
}

router.get('/elementos/disponibles/:tipo', verifyToken, async (req, res) => {
  try {
    const tipo = req.params.tipo;
    if (!TIPOS_ELEMENTOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    const elements = await getAvailableElements(tipo);
    res.json(elements.map(e => cleanTimestamps(e)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const TIPOS_PREFIJO = { vehiculo: 'V', herramienta: 'H', equipo: 'E', ropa: 'R', material: 'M' };

async function getNextCatalogNumber(tipo) {
  const prefijo = TIPOS_PREFIJO[tipo];
  const counterRef = db.collection('counters').doc(tipo);
  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    if (!doc.exists) {
      const snap = await db.collection('elementos_catalogo').where('tipo', '==', tipo).get();
      let max = 0;
      snap.docs.forEach(d => {
        const m = (d.data().interno || '').match(new RegExp(`^${prefijo}0*(\\d+)$`));
        if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
      });
      transaction.set(counterRef, { current: max });
      return { number: max + 1, formatted: `${prefijo}${String(max + 1).padStart(3, '0')}` };
    }
    const next = (doc.data().current || 0) + 1;
    transaction.update(counterRef, { current: next });
    return { number: next, formatted: `${prefijo}${String(next).padStart(3, '0')}` };
  });
  return result;
}

router.post('/elementos/disponibles', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { tipo, nombre, descripcion, marca, modelo, stock } = req.body;
    if (!tipo || !nombre) return res.status(400).json({ error: 'tipo y nombre son obligatorios' });
    if (!TIPOS_ELEMENTOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    const { formatted } = await getNextCatalogNumber(tipo);
    await db.collection('elementos_catalogo').add({
      tipo,
      interno: formatted,
      nombre,
      descripcion: descripcion || '',
      marca: marca || '',
      modelo: modelo || '',
      stock: stock || 1,
      createdAt: new Date()
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/elementos/disponibles/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, marca, modelo, stock } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
    const stockNum = parseInt(stock, 10);
    await db.collection('elementos_catalogo').doc(req.params.id).update({
      nombre,
      descripcion: descripcion || '',
      marca: marca || '',
      modelo: modelo || '',
      stock: Number.isNaN(stockNum) ? 1 : stockNum,
      updatedAt: new Date()
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/elementos/disponibles/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection('elementos_catalogo').doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/catalogo', verifyToken, async (req, res) => {
  try {
    const catalogo = {};
    for (const tipo of TIPOS_ELEMENTOS) {
      if (tipo === 'vehiculo') {
        const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
        catalogo[tipo] = snap.docs.map(d => {
          const v = d.data();
          return cleanTimestamps({
            id: d.id,
            interno: v.interno || v.patente || '',
            nombre: `${v.patente || v.interno || ''} — ${v.marca || ''} ${v.modelo || ''} ${v.anio || ''}`.trim(),
            marca: v.marca || '',
            modelo: v.modelo || '',
            stock: 1,
            tipo: 'vehiculo'
          });
        });
      } else {
        const snap = await db.collection('elementos_catalogo').where('tipo', '==', tipo).get();
        catalogo[tipo] = snap.docs.map(d => cleanTimestamps({ id: d.id, ...d.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre));
      }
    }
    res.json(catalogo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
/* ── FIN CATÁLOGO ── */

router.get('/', verifyToken, async (req, res) => {
  try {
    const cacheado = getCache('centros-list', TTL_CENTROS);
    if (cacheado) return res.json(cacheado);
    const snapshot = await db.collection('centros').orderBy('nombre', 'asc').get();
    const centros = await Promise.all(snapshot.docs.map(async (d) => {
      const centro = cleanTimestamps({ id: d.id, ...d.data() });
      const elementosSnap = await db.collection(`centros/${d.id}/elementos`).get();
      const elementos = elementosSnap.docs.map(e => e.data());
      centro.totalElementos = elementos.length;
      centro.asignados = elementos.filter(e => !e.fechaDevolucion || e.fechaDevolucion === '').length;
      centro.devueltos = elementos.filter(e => e.fechaDevolucion && e.fechaDevolucion !== '').length;
      return centro;
    }));
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

router.get('/elementos', verifyToken, async (req, res) => {
  try {
    const snap = await db.collectionGroup('elementos').get();
    const items = snap.docs.map(d => {
      const data = d.data();
      const centroId = d.ref.parent.parent.id;
      return {
        id: d.id,
        centroId,
        interno: data.interno || '',
        elementoTipo: data.elementoTipo || '',
        fechaAsignacion: data.fechaAsignacion || null,
        fechaDevolucion: data.fechaDevolucion || null,
        origenCentro: data.origenCentro || null,
        observaciones: data.observaciones || ''
      };
    });

    const vehiculosSnap = await db.collection('vehicles').get();
    const vehMap = {};
    vehiculosSnap.docs.forEach(d => {
      const v = d.data();
      vehMap[v.interno] = { nombre: `${v.patente || v.interno || ''} — ${v.marca || ''} ${v.modelo || ''} ${v.anio || ''}`.trim(), marca: v.marca || '', modelo: v.modelo || '' };
    });

    const catalogoSnap = await db.collection('elementos_catalogo').get();
    const catMap = {};
    catalogoSnap.docs.forEach(d => {
      const c = d.data();
      catMap[c.interno] = { nombre: c.nombre || '', marca: c.marca || '', modelo: c.modelo || '' };
    });

    const elementos = items.map(e => {
      const info = e.elementoTipo === 'vehiculo'
        ? vehMap[e.interno]
        : catMap[e.interno];
      return cleanTimestamps({
        ...e,
        nombre: info?.nombre || '',
        marca: info?.marca || '',
        modelo: info?.modelo || ''
      });
    });

    elementos.sort((a, b) => {
      const fa = a.fechaAsignacion ? new Date(a.fechaAsignacion).getTime() : 0;
      const fb = b.fechaAsignacion ? new Date(b.fechaAsignacion).getTime() : 0;
      return fb - fa;
    });
    res.json(elementos);
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
    const centro = cleanTimestamps({ id: doc.id, ...doc.data() });

    const elementosSnap = await db.collection(`centros/${req.params.id}/elementos`)
      .orderBy('fechaAsignacion', 'desc').get();
    const elementos = elementosSnap.docs.map(d => cleanTimestamps({ id: d.id, ...d.data() }));
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

const ESTADOS = ['activa', 'pausada', 'cerrada'];

router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { nombre, estado, observaciones, ubicacion } = req.body;
    const update = { updatedAt: new Date() };
    if (nombre !== undefined) {
      if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
      update.nombre = nombre.trim();
    }
    if (estado) {
      if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
      update.estado = estado;
    }
    if (observaciones !== undefined) update.observaciones = String(observaciones).trim();
    if (ubicacion !== undefined) update.ubicacion = String(ubicacion).trim();
    await db.collection('centros').doc(req.params.id).update(update);
    cacheTTL.delete(`centro-${req.params.id}`);
    cacheTTL.delete('centros-list');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* Borrar una obra es definitivo, así que se niega si todavía tiene elementos
   asignados (sin fechaDevolucion): primero hay que devolverlos, así no se
   pierde el registro de qué elemento estuvo en qué obra. Los ya devueltos se
   borran junto con la obra, porque su historial ya no sirve para nada. */
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const centroRef = db.collection('centros').doc(req.params.id);
    const doc = await centroRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Centro no encontrado' });

    // Se leen todos y se filtra en memoria en vez de usar
    // where('fechaDevolucion','==',''): los elementos cargados antes de que
    // existiera ese campo no tienen la clave, y con el query no aparecerían
    // (la obra se dejaría borrar con un elemento sin devolver adentro).
    const todos = await centroRef.collection('elementos').get();
    const sinDevolver = todos.docs.filter(d => !d.data().fechaDevolucion);
    if (sinDevolver.length) {
      return res.status(409).json({
        error: `La obra tiene ${sinDevolver.length} elemento(s) sin devolver. Devuelvelos antes de eliminarla.`
      });
    }

    // La subcolección no se va sola con el doc padre: hay que borrarla a mano.
    const subcol = centroRef.collection('elementos');
    let borrados = 0;
    for (;;) {
      const lote = await subcol.limit(400).get();
      if (lote.empty) break;
      const batch = db.batch();
      lote.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      borrados += lote.size;
    }
    await centroRef.delete();

    cacheTTL.delete(`centro-${req.params.id}`);
    cacheTTL.delete('centros-list');
    res.json({ ok: true, elementosBorrados: borrados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/elementos', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { interno, elementoTipo, origenCentro, observaciones } = req.body;
    if (!interno || !elementoTipo) {
      return res.status(400).json({ error: 'interno y elementoTipo son obligatorios' });
    }
    const docRef = await db.collection(`centros/${req.params.id}/elementos`).add({
      interno,
      elementoTipo,
      origenCentro: origenCentro || null,
      fechaAsignacion: new Date(),
      fechaDevolucion: '',
      observaciones: observaciones?.trim() || '',
      createdAt: new Date()
    });
    cacheTTL.delete(`centro-${req.params.id}`);
    cacheTTL.delete('centros-list');
    res.status(201).json({ id: docRef.id, interno, elementoTipo });
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
