const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { db, admin } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
    const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['Admin', 'Usuario'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const userDoc = await db.collection('users').doc(req.params.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.collection('users').doc(req.params.id).update({
      role,
      updatedAt: new Date()
    });

    res.json({ success: true, role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const [vehiclesSnap, toolsSnap, maintenanceSnap] = await Promise.all([
      db.collection('vehicles').get(),
      db.collection('tools').get(),
      db.collection('maintenance').get()
    ]);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const vehiculosActivos = vehiclesSnap.docs.filter(d => d.data().estado === 'Activo').length;
    const herramientasMalEstado = toolsSnap.docs.filter(d => ['Roto', 'En reparación'].includes(d.data().estado)).length;

    let vencidosHoy = 0;
    let proximos7 = 0;
    const monthlyData = {};

    maintenanceSnap.docs.forEach(d => {
      const m = d.data();
      const venc = m.proximaFechaVencimiento?.toDate ? m.proximaFechaVencimiento.toDate() : new Date(m.proximaFechaVencimiento);
      const diff = Math.ceil((venc - now) / (1000 * 60 * 60 * 24));

      if (diff <= 0 && m.estado !== 'Realizado') vencidosHoy++;
      else if (diff <= 7 && m.estado !== 'Realizado') proximos7++;

      if (m.fechaRealizacion) {
        const d2 = m.fechaRealizacion.toDate ? m.fechaRealizacion.toDate() : new Date(m.fechaRealizacion);
        const key = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = (monthlyData[key] || 0) + 1;
      }
    });

    res.json({
      vehiculosActivos,
      herramientasMalEstado,
      vencidosHoy,
      proximos7,
      monthlyData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/financial', verifyToken, async (req, res) => {
  try {
    const vehiclesSnap = await db.collection('vehicles').get();
    const combustibleData = {};
    const gastoPorVehiculo = {};
    const ultimosMovimientos = [];
    let totalRepuestos = 0;
    let totalMantenimiento = 0;
    let totalVTV = 0;
    let totalSeguro = 0;

    for (const vDoc of vehiclesSnap.docs) {
      const v = vDoc.data();
      const patente = v.patente || '—';
      const batchSize = 100;

      const combSnap = await vDoc.ref.collection('combustible')
        .orderBy('fecha', 'desc').limit(batchSize).get();

      combSnap.docs.forEach(d => {
        const c = d.data();
        const date = c.fecha?.toDate ? c.fecha.toDate() : new Date(c.fecha);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!combustibleData[monthKey]) combustibleData[monthKey] = { litros: 0, importe: 0 };
        combustibleData[monthKey].litros += Number(c.litros) || 0;
        combustibleData[monthKey].importe += Number(c.importe) || 0;

        if (!gastoPorVehiculo[patente]) gastoPorVehiculo[patente] = 0;
        gastoPorVehiculo[patente] += Number(c.importe) || 0;

        ultimosMovimientos.push({
          tipo: 'Combustible', patente, desc: `${(c.litros || 0).toFixed(1)}L ${c.tipo || ''}`,
          importe: Number(c.importe) || 0, fecha: c.fecha
        });
      });
    }

    for (const vDoc of vehiclesSnap.docs) {
      const v = vDoc.data();
      const patente = v.patente || '—';

      if (v.vtv?.fechaVencimiento || v.vtv?.fechaRealizacion || v.vtv?.costo) {
        totalVTV += Number(v.vtv.costo) || 0;
        ultimosMovimientos.push({
          tipo: 'VTV', patente, desc: `VTV · ${v.vtv.centroMedicion || '—'} · ${v.vtv.resultado || 'Pendiente'}`,
          importe: Number(v.vtv.costo) || 0, fecha: v.vtv.fechaVencimiento || v.vtv.fechaRealizacion
        });
      }

      if (v.seguro?.fechaVencimiento || v.seguro?.costo) {
        totalSeguro += Number(v.seguro.costo) || 0;
        ultimosMovimientos.push({
          tipo: 'Seguro', patente, desc: `Seguro · ${v.seguro.compañía || '—'}`,
          importe: Number(v.seguro.costo) || 0, fecha: v.seguro.fechaVencimiento
        });
      }

      const repSnap = await vDoc.ref.collection('repuestos').get();
      repSnap.docs.forEach(d => {
        const r = d.data();
        totalRepuestos += Number(r.costo) || 0;
        ultimosMovimientos.push({
          tipo: 'Repuesto', patente, desc: r.pieza || '',
          importe: Number(r.costo) || 0, fecha: r.fecha
        });
      });
    }

    const maintenanceSnap = await db.collection('maintenance')
      .orderBy('fechaRealizacion', 'desc').limit(50).get();

    maintenanceSnap.docs.forEach(d => {
      const m = d.data();
      if (m.costo) {
        totalMantenimiento += Number(m.costo) || 0;
        ultimosMovimientos.push({
          tipo: 'Mantenimiento', patente: m.vehiculoPatente || m.herramientaCodigo || '—',
          desc: m.descripcion || '', importe: Number(m.costo) || 0, fecha: m.fechaRealizacion
        });
      }
    });

    const totalCombustible = Object.values(combustibleData).reduce((s, v) => s + v.importe, 0);

    const sortedKeys = Object.keys(combustibleData).sort();
    const combustibleChart = sortedKeys.map(k => ({
      mes: k, litros: combustibleData[k].litros, importe: combustibleData[k].importe
    }));

    const gastoVehiculosEntries = Object.entries(gastoPorVehiculo)
      .sort((a, b) => b[1] - a[1]);

    ultimosMovimientos.sort((a, b) => {
      const da = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
      const db2 = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
      return db2 - da;
    });

    res.json({
      combustibleChart,
      donut: { combustible: totalCombustible, repuestos: totalRepuestos, mantenimiento: totalMantenimiento, vtv: totalVTV, seguro: totalSeguro },
      gastoVehiculos: gastoVehiculosEntries.map(([vehiculo, monto]) => ({ vehiculo, monto })),
      ultimosMovimientos: ultimosMovimientos.slice(0, 15)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/backup-delete', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { collection, docId } = req.body;
    if (!collection || !docId) {
      return res.status(400).json({ error: 'collection y docId requeridos' });
    }

    const docRef = db.collection(collection).doc(docId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'No encontrado' });

    // Función auxiliar recursiva para convertir timestamps de firestore a JSON serializable
    const convertData = (data) => {
      if (!data || typeof data !== 'object') return data;
      if (Array.isArray(data)) return data.map(convertData);

      const converted = {};
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object') {
          if (value.toDate && typeof value.toDate === 'function') {
            converted[key] = { __type: 'timestamp', value: value.toDate().toISOString() };
          } else if (value.constructor?.name === 'Timestamp' || (value._seconds !== undefined && value._nanoseconds !== undefined)) {
            const seconds = value.seconds !== undefined ? value.seconds : value._seconds;
            const nanoseconds = value.nanoseconds !== undefined ? value.nanoseconds : value._nanoseconds;
            const date = new admin.firestore.Timestamp(seconds, nanoseconds).toDate();
            converted[key] = { __type: 'timestamp', value: date.toISOString() };
          } else {
            converted[key] = convertData(value);
          }
        } else {
          converted[key] = value;
        }
      }
      return converted;
    };

    const raw = doc.data();
    const converted = convertData(raw);

    const backup = {
      _meta: {
        exportado: new Date().toISOString(),
        coleccion: collection,
        documento: docId,
        estado: 'baja'
      },
      datos: { id: doc.id, ...converted }
    };

    // Si es vehículo, recolectar subcolecciones (combustible y repuestos)
    if (collection === 'vehicles') {
      backup.subcolecciones = {};
      const subcols = ['combustible', 'repuestos'];
      for (const sub of subcols) {
        const snap = await docRef.collection(sub).get();
        backup.subcolecciones[sub] = snap.docs.map(d => ({ id: d.id, ...convertData(d.data()) }));
      }
    }

    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);
    fs.mkdirSync(backupPath, { recursive: true });

    const manifest = {
      timestamp: new Date().toISOString(),
      tipo: 'baja',
      coleccion: collection,
      documento: docId,
      collections: {}
    };

    const filePath = path.join(backupPath, `${collection}.json`);
    fs.writeFileSync(filePath, JSON.stringify([backup], null, 2), 'utf8');
    manifest.collections[collection] = { count: 1, file: `${collection}.json`, tipo: 'baja' };

    const manifestPath = path.join(backupPath, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const latestLink = path.join(backupDir, 'latest');
    if (fs.existsSync(latestLink)) {
      const stat = fs.lstatSync(latestLink);
      if (stat.isSymbolicLink() || stat.isDirectory()) {
        fs.rmSync(latestLink, { recursive: true, force: true });
      }
    }
    fs.mkdirSync(latestLink, { recursive: true });
    for (const file of fs.readdirSync(backupPath)) {
      fs.copyFileSync(path.join(backupPath, file), path.join(latestLink, file));
    }

    // ELIMINAR DE FIREBASE COMPLETAMENTE
    if (collection === 'vehicles') {
      const subcols = ['combustible', 'repuestos'];
      for (const sub of subcols) {
        const snap = await docRef.collection(sub).get();
        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
    }

    // Eliminar el documento principal
    await docRef.delete();

    console.log(`Backup de baja guardado y eliminado de Firebase: ${backupPath}`);
    res.json({ success: true, path: backupPath });
  } catch (error) {
    console.error('Error al borrar con backup:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/backup', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');

    const child = spawn('node', [path.join(__dirname, '..', 'scripts', 'export-firebase.js')], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout.on('data', d => output += d.toString());
    child.stderr.on('data', d => output += d.toString());

    child.on('close', code => {
      if (code === 0) {
        res.json({ success: true, message: 'Backup completado', log: output });
      } else {
        res.status(500).json({ error: 'Error en backup', log: output });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/report', verifyToken, async (req, res) => {
  try {
    const { desde, hasta, categoria, vehiculo } = req.query;
    const filterDesde = desde ? new Date(desde) : new Date(0);
    const filterHasta = hasta ? new Date(hasta + 'T23:59:59') : new Date('2100-01-01');

    const [vehiclesSnap, maintenanceSnap] = await Promise.all([
      db.collection('vehicles').get(),
      db.collection('maintenance').get()
    ]);

    const vehiclePatMap = {};
    vehiclesSnap.docs.forEach(d => {
      const v = d.data();
      vehiclePatMap[d.id] = v.patente || '—';
    });

    const items = [];
    let totalComb = 0, totalRep = 0, totalMto = 0, totalVTV = 0, totalSeguro = 0;

    for (const vDoc of vehiclesSnap.docs) {
      const v = vDoc.data();
      const patente = vehiclePatMap[vDoc.id];

      if (v.vtv?.fechaVencimiento || v.vtv?.fechaRealizacion) {
        const fecha = v.vtv.fechaVencimiento?.toDate
          ? v.vtv.fechaVencimiento.toDate()
          : v.vtv.fechaRealizacion?.toDate
            ? v.vtv.fechaRealizacion.toDate()
            : new Date();
        if (fecha >= filterDesde && fecha <= filterHasta) {
          if (!categoria || categoria === 'todas' || categoria === 'VTV') {
            if (!vehiculo || vehiculo === 'todos' || patente.toLowerCase().includes(vehiculo.toLowerCase())) {
              const costo = Number(v.vtv.costo) || 0;
              items.push({
                fecha, categoria: 'VTV', vehiculo: patente,
                detalle: `VTV · ${v.vtv.centroMedicion || '—'} · ${v.vtv.resultado || 'Pendiente'}`,
                monto: costo
              });
              totalVTV += costo;
            }
          }
        }
      }

      if (v.seguro?.fechaVencimiento || v.seguro?.costo) {
        const fecha = v.seguro.fechaVencimiento?.toDate
          ? v.seguro.fechaVencimiento.toDate()
          : v.seguro.fechaRealizacion?.toDate
            ? v.seguro.fechaRealizacion.toDate()
            : new Date();
        if (fecha >= filterDesde && fecha <= filterHasta) {
          if (!categoria || categoria === 'todas' || categoria === 'Seguro') {
            if (!vehiculo || vehiculo === 'todos' || patente.toLowerCase().includes(vehiculo.toLowerCase())) {
              const costoS = Number(v.seguro.costo) || 0;
              items.push({
                fecha, categoria: 'Seguro', vehiculo: patente,
                detalle: `Seguro · ${v.seguro.compañía || '—'} · Póliza ${v.seguro.poliza || '—'}`,
                monto: costoS
              });
              totalSeguro += costoS;
            }
          }
        }
      }

      const combSnap = await vDoc.ref.collection('combustible').get();
      combSnap.docs.forEach(d => {
        const c = d.data();
        const fecha = c.fecha?.toDate ? c.fecha.toDate() : new Date(c.fecha);
        if (fecha < filterDesde || fecha > filterHasta) return;
        if (vehiculo && vehiculo !== 'todos' && !patente.toLowerCase().includes(vehiculo.toLowerCase())) return;
        if (categoria && categoria !== 'todas' && categoria !== 'Combustible') return;
        items.push({ fecha, categoria: 'Combustible', vehiculo: patente, detalle: `${c.litros?.toFixed(1)}L ${c.tipo || ''}`, monto: Number(c.importe) || 0 });
        totalComb += Number(c.importe) || 0;
      });

      const repSnap = await vDoc.ref.collection('repuestos').get();
      repSnap.docs.forEach(d => {
        const r = d.data();
        const fecha = r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha);
        if (fecha < filterDesde || fecha > filterHasta) return;
        if (vehiculo && vehiculo !== 'todos' && !patente.toLowerCase().includes(vehiculo.toLowerCase())) return;
        if (categoria && categoria !== 'todas' && categoria !== 'Repuestos') return;
        items.push({ fecha, categoria: 'Repuestos', vehiculo: patente, detalle: r.pieza || '', monto: Number(r.costo) || 0 });
        totalRep += Number(r.costo) || 0;
      });
    }

    maintenanceSnap.docs.forEach(d => {
      const m = d.data();
      const fecha = m.fechaRealizacion?.toDate ? m.fechaRealizacion.toDate() : new Date(m.fechaRealizacion || m.createdAt);
      if (fecha < filterDesde || fecha > filterHasta) return;
      if (!m.costo) return;
      const vehRef = m.vehiculoPatente || m.herramientaCodigo || '—';
      if (vehiculo && vehiculo !== 'todos' && !vehRef.toLowerCase().includes(vehiculo.toLowerCase())) return;
      if (categoria && categoria !== 'todas' && categoria !== 'Mantenimiento') return;
      items.push({ fecha, categoria: 'Mantenimiento', vehiculo: vehRef, detalle: m.descripcion || m.tipo || '', monto: Number(m.costo) || 0 });
      totalMto += Number(m.costo) || 0;
    });

    items.sort((a, b) => b.fecha - a.fecha);

    res.json({ items, totales: { combustible: totalComb, repuestos: totalRep, mantenimiento: totalMto, vtv: totalVTV, seguro: totalSeguro } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/alerts', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('maintenance').where('estado', '!=', 'Realizado').get();
    const now = new Date();
    const alerts = [];

    snapshot.docs.forEach(d => {
      const m = d.data();
      const venc = m.proximaFechaVencimiento?.toDate ? m.proximaFechaVencimiento.toDate() : new Date(m.proximaFechaVencimiento);
      const diff = Math.ceil((venc - now) / (1000 * 60 * 60 * 24));

      let level = 'none';
      let label = '';
      if (diff <= 0) { level = 'critical'; label = 'Vencido'; }
      else if (diff <= 1) { level = 'critical'; label = 'Vence hoy'; }
      else if (diff <= 7) { level = 'warning'; label = 'Próximo a vencer'; }
      else if (diff <= 15) { level = 'info'; label = 'Por vencer'; }

      if (level !== 'none') {
        alerts.push({
          id: d.id,
          level,
          label,
          days: diff,
          descripcion: m.descripcion,
          proximaFechaVencimiento: venc,
          vehiculoPatente: m.vehiculoPatente,
          herramientaCodigo: m.herramientaCodigo,
          tipo: m.tipo
        });
      }
    });

    alerts.sort((a, b) => a.days - b.days);
    res.json(alerts.slice(0, 50));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/report/export', verifyToken, async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const path = require('path');
    const fs = require('fs');

    const { desde, hasta, categoria, vehiculo } = req.query;
    const filterDesde = desde ? new Date(desde) : new Date(0);
    const filterHasta = hasta ? new Date(hasta + 'T23:59:59') : new Date('2100-01-01');
    const now = new Date();

    const [vehiclesSnap, maintenanceSnap] = await Promise.all([
      db.collection('vehicles').get(),
      db.collection('maintenance').get()
    ]);

    const vehicleMap = {};
    vehiclesSnap.docs.forEach(d => {
      const v = d.data();
      vehicleMap[d.id] = { patente: v.patente || '—', interno: v.interno || '', marca: v.marca || '', modelo: v.modelo || '' };
    });

    const rows = [];
    const catTotals = { Combustible: 0, Repuestos: 0, Mantenimiento: 0, VTV: 0, Seguro: 0 };

    for (const vDoc of vehiclesSnap.docs) {
      const vInfo = vehicleMap[vDoc.id];
      const patente = vInfo.patente;
      const v = vDoc.data();

      if (v.vtv?.fechaVencimiento || v.vtv?.fechaRealizacion) {
        const fecha = v.vtv.fechaVencimiento?.toDate
          ? v.vtv.fechaVencimiento.toDate()
          : v.vtv.fechaRealizacion?.toDate
            ? v.vtv.fechaRealizacion.toDate()
            : new Date();
        if (fecha >= filterDesde && fecha <= filterHasta) {
          if (!categoria || categoria === 'todas' || categoria === 'VTV') {
            if (!vehiculo || vehiculo === 'todos' || patente.toLowerCase().includes(vehiculo.toLowerCase())) {
              const costo = Number(v.vtv.costo) || 0;
              catTotals.VTV += costo;
              rows.push({
                fecha, categoria: 'VTV', vehiculo: patente, interno: vInfo.interno,
                detalle: `VTV · ${v.vtv.centroMedicion || '—'} · ${v.vtv.resultado || 'Pendiente'}`,
                monto: costo, proveedor: v.vtv.centroMedicion || '', observaciones: ''
              });
            }
          }
        }
      }

      if (v.seguro?.fechaVencimiento || v.seguro?.costo) {
        const fecha = v.seguro.fechaVencimiento?.toDate
          ? v.seguro.fechaVencimiento.toDate()
          : new Date();
        if (fecha >= filterDesde && fecha <= filterHasta) {
          if (!categoria || categoria === 'todas' || categoria === 'Seguro') {
            if (!vehiculo || vehiculo === 'todos' || patente.toLowerCase().includes(vehiculo.toLowerCase())) {
              const costoS = Number(v.seguro.costo) || 0;
              catTotals.Seguro += costoS;
              rows.push({
                fecha, categoria: 'Seguro', vehiculo: patente, interno: vInfo.interno,
                detalle: `Seguro · ${v.seguro.compañía || '—'}`,
                monto: costoS, proveedor: v.seguro.compañía || '', observaciones: ''
              });
            }
          }
        }
      }

      const combSnap = await vDoc.ref.collection('combustible').get();
      combSnap.docs.forEach(d => {
        const c = d.data();
        const fecha = c.fecha?.toDate ? c.fecha.toDate() : new Date(c.fecha);
        if (fecha < filterDesde || fecha > filterHasta) return;
        if (vehiculo && vehiculo !== 'todos' && !patente.toLowerCase().includes(vehiculo.toLowerCase())) return;
        if (categoria && categoria !== 'todas' && categoria !== 'Combustible') return;
        catTotals.Combustible += Number(c.importe) || 0;
        rows.push({
          fecha, categoria: 'Combustible', vehiculo: patente, interno: vInfo.interno,
          detalle: `${(c.litros || 0).toFixed(1)} L — ${c.tipo || ''}`,
          monto: Number(c.importe) || 0, proveedor: c.proveedor || '', observaciones: c.observaciones || ''
        });
      });

      const repSnap = await vDoc.ref.collection('repuestos').get();
      repSnap.docs.forEach(d => {
        const r = d.data();
        const fecha = r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha);
        if (fecha < filterDesde || fecha > filterHasta) return;
        if (vehiculo && vehiculo !== 'todos' && !patente.toLowerCase().includes(vehiculo.toLowerCase())) return;
        if (categoria && categoria !== 'todas' && categoria !== 'Repuestos') return;
        catTotals.Repuestos += Number(r.costo) || 0;
        rows.push({
          fecha, categoria: 'Repuestos', vehiculo: patente, interno: vInfo.interno,
          detalle: r.pieza || '', monto: Number(r.costo) || 0,
          proveedor: r.proveedor || '', observaciones: r.observaciones || ''
        });
      });
    }

    maintenanceSnap.docs.forEach(d => {
      const m = d.data();
      const fecha = m.fechaRealizacion?.toDate ? m.fechaRealizacion.toDate() : new Date(m.fechaRealizacion || m.createdAt);
      if (fecha < filterDesde || fecha > filterHasta) return;
      if (!m.costo) return;
      const vehRef = m.vehiculoPatente || m.herramientaCodigo || '—';
      if (vehiculo && vehiculo !== 'todos' && !vehRef.toLowerCase().includes(vehiculo.toLowerCase())) return;
      if (categoria && categoria !== 'todas' && categoria !== 'Mantenimiento') return;
      catTotals.Mantenimiento += Number(m.costo) || 0;
      rows.push({
        fecha, categoria: 'Mantenimiento', vehiculo: vehRef, interno: '',
        detalle: m.descripcion || m.tipo || 'Mantenimiento',
        monto: Number(m.costo) || 0, proveedor: m.proveedor || m.taller || '', observaciones: m.observaciones || ''
      });
    });

    rows.sort((a, b) => b.fecha - a.fecha);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Grupo Falpat SRL';
    wb.created = now;
    wb.modified = now;

    const wbProps = {
      title: 'Reporte de Gastos',
      subject: 'Gastos operativos',
      keywords: 'gastos, combustible, repuestos, mantenimiento, grupo falpat',
      category: 'Reportes',
      company: 'Grupo Falpat SRL',
      manager: 'Administración'
    };
    Object.assign(wb, wbProps);

    const ws = wb.addWorksheet('Reporte de Gastos', {
      views: [{ state: 'frozen', ySplit: 8 }]
    });

    ws.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Categoría', key: 'categoria', width: 16 },
      { header: 'Vehículo', key: 'vehiculo', width: 14 },
      { header: 'Interno', key: 'interno', width: 10 },
      { header: 'Detalle', key: 'detalle', width: 40 },
      { header: 'Monto', key: 'monto', width: 16 },
      { header: 'Proveedor', key: 'proveedor', width: 22 },
      { header: 'Observaciones', key: 'observaciones', width: 30 }
    ];

    const PRIMARY = 'FF6B35';
    const DARK = '1A1D27';
    const MID = '2A2D3A';
    const LIGHT = 'F1F3F8';
    const MUTED = '8E94A8';
    const WHITE = 'FFFFFF';

    const headerRow = 1;
    ws.mergeCells(headerRow, 1, headerRow, 2);
    const logoCell = ws.getCell(headerRow, 1);
    logoCell.value = 'GF';
    logoCell.font = { name: 'Calibri', size: 28, bold: true, color: { argb: WHITE } };
    logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    logoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    logoCell.border = {
      top: { style: 'medium', color: { argb: PRIMARY } },
      bottom: { style: 'medium', color: { argb: PRIMARY } },
      left: { style: 'medium', color: { argb: PRIMARY } },
      right: { style: 'medium', color: { argb: PRIMARY } }
    };

    ws.mergeCells(headerRow, 3, headerRow, 8);
    const titleCell = ws.getCell(headerRow, 3);
    titleCell.value = 'Grupo Falpat SRL';
    titleCell.font = { name: 'Calibri', size: 22, bold: true, color: { argb: PRIMARY } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(headerRow).height = 55;

    const subtitleRow = 2;
    ws.mergeCells(subtitleRow, 1, subtitleRow, 8);
    const desdeStr = desde ? new Date(desde).toLocaleDateString('es-AR') : '—';
    const hastaStr = hasta ? new Date(hasta).toLocaleDateString('es-AR') : '—';
    const subCell = ws.getCell(subtitleRow, 1);
    subCell.value = `Reporte de Gastos — Período: ${desdeStr} al ${hastaStr}`;
    subCell.font = { name: 'Calibri', size: 13, color: { argb: MUTED } };
    subCell.alignment = { vertical: 'middle' };
    ws.getRow(subtitleRow).height = 28;

    const infoRow = 3;
    ws.mergeCells(infoRow, 1, infoRow, 8);
    const infoCell = ws.getCell(infoRow, 1);
    infoCell.value = `Generado el ${now.toLocaleString('es-AR')} · Total de registros: ${rows.length}`;
    infoCell.font = { name: 'Calibri', size: 10, color: { argb: '5C6378' } };
    infoCell.alignment = { vertical: 'middle' };
    ws.getRow(infoRow).height = 22;

    const summaryStartRow = 5;
    const summaryHeaders = ['Total Combustible', 'Total Repuestos', 'Total Mantenimiento', 'Total VTV', 'Total Seguro', 'Gran Total'];
    const summaryValues = [
      catTotals.Combustible, catTotals.Repuestos, catTotals.Mantenimiento,
      catTotals.VTV, catTotals.Seguro,
      catTotals.Combustible + catTotals.Repuestos + catTotals.Mantenimiento + catTotals.VTV + catTotals.Seguro
    ];
    const summaryColors = [PRIMARY, '10B981', '3B82F6', '8B5CF6', 'F59E0B', 'FF3366'];

    summaryHeaders.forEach((label, i) => {
      const col = i * 2 + 1;
      ws.mergeCells(summaryStartRow, col, summaryStartRow, col + 1);

      const cell = ws.getCell(summaryStartRow, col);
      cell.value = label;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: summaryColors[i] } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: WHITE } },
        bottom: { style: 'thin', color: { argb: WHITE } },
        left: { style: 'thin', color: { argb: WHITE } },
        right: { style: 'thin', color: { argb: WHITE } }
      };

      const valCell = ws.getCell(summaryStartRow + 1, col);
      valCell.value = `$ ${summaryValues[i].toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
      valCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: summaryColors[i] } };
      valCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0A0D17' } };
      valCell.border = {
        top: { style: 'thin', color: { argb: MUTED } },
        bottom: { style: 'thin', color: { argb: MUTED } },
        left: { style: 'thin', color: { argb: MUTED } },
        right: { style: 'thin', color: { argb: MUTED } }
      };
    });
    ws.mergeCells(summaryStartRow, 9, summaryStartRow + 1, 9);

    const dataStartRow = 8;

    const headerRowObj = ws.getRow(dataStartRow);
    ws.columns.forEach((col, i) => {
      const cell = headerRowObj.getCell(i + 1);
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'medium', color: { argb: PRIMARY } },
        bottom: { style: 'medium', color: { argb: PRIMARY } },
        left: { style: 'thin', color: { argb: MID } },
        right: { style: 'thin', color: { argb: MID } }
      };
    });
    headerRowObj.height = 28;

    const catColors = { Combustible: PRIMARY, Repuestos: '10B981', Mantenimiento: '3B82F6' };

    let rowNum = dataStartRow + 1;
    rows.forEach((r, idx) => {
      const row = ws.getRow(rowNum);
      const isEven = idx % 2 === 0;

      row.getCell(1).value = r.fecha;
      row.getCell(1).numFmt = 'dd/mm/yyyy';
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(2).value = r.categoria;
      row.getCell(2).font = { name: 'Calibri', size: 11, bold: true, color: { argb: catColors[r.categoria] || MUTED } };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(3).value = r.vehiculo;
      row.getCell(4).value = r.interno;
      row.getCell(5).value = r.detalle;

      row.getCell(6).value = r.monto;
      row.getCell(6).numFmt = '$ #,##0.00';
      row.getCell(6).font = { name: 'Calibri', size: 11, bold: true, color: { argb: LIGHT } };
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

      row.getCell(7).value = r.proveedor;
      row.getCell(8).value = r.observaciones;

      for (let c = 1; c <= 8; c++) {
        const cell = row.getCell(c);
        if (!cell.font) cell.font = { name: 'Calibri', size: 10, color: { argb: 'D0D4DF' } };
        if (!cell.alignment) cell.alignment = { vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? '0F1220' : '161929' } };
        cell.border = {
          bottom: { style: 'hair', color: { argb: '2A2D3A' } }
        };
      }

      row.height = 22;
      rowNum++;
    });

    const totalRow = ws.getRow(rowNum);
    ws.mergeCells(totalRow.number, 1, totalRow.number, 5);
    totalRow.getCell(1).value = `Total general (${rows.length} registros)`;
    totalRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

    const grandTotal = rows.reduce((s, r) => s + r.monto, 0);
    totalRow.getCell(6).value = grandTotal;
    totalRow.getCell(6).numFmt = '$ #,##0.00';
    totalRow.getCell(6).font = { name: 'Calibri', size: 12, bold: true, color: { argb: PRIMARY } };
    totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

    totalRow.getCell(7).value = '';
    totalRow.getCell(8).value = '';

    for (let c = 1; c <= 8; c++) {
      const cell = totalRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A1D27' } };
      cell.border = {
        top: { style: 'medium', color: { argb: PRIMARY } },
        bottom: { style: 'double', color: { argb: PRIMARY } },
        left: c === 1 ? { style: 'medium', color: { argb: PRIMARY } } : undefined,
        right: c === 8 ? { style: 'medium', color: { argb: PRIMARY } } : undefined
      };
    }
    totalRow.height = 30;

    const footerRow = rowNum + 2;
    ws.mergeCells(footerRow, 1, footerRow, 8);
    const footerCell = ws.getCell(footerRow, 1);
    footerCell.value = 'Grupo Falpat SRL — Sistema de Control de Mantenimiento — Documento generado automáticamente';
    footerCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: '5C6378' } };
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.pageSetup.orientation = 'landscape';
    ws.pageSetup.fitToPage = true;
    ws.pageSetup.fitToWidth = 1;
    ws.pageSetup.paperSize = 9;
    ws.pageSetup.margins = {
      left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-gastos-${now.toISOString().split('T')[0]}.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

