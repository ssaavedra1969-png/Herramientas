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
    const vehiclesSnap = await db.collection('vehicles').get();
    const now = new Date();
    const vehiculosActivos = vehiclesSnap.docs.filter(d => d.data().estado === 'Activo').length;
    res.json({ vehiculosActivos, vencidosHoy: 0, proximos7: 0, monthlyData: {} });
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
    let totalVTV = 0;
    let totalSeguro = 0;

    for (const vDoc of vehiclesSnap.docs) {
      const v = vDoc.data();
      const patente = v.patente || '—';

      const combSnap = await vDoc.ref.collection('combustible')
        .orderBy('fecha', 'desc').limit(100).get();

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

      if (v.vtv?.costo) {
        totalVTV += Number(v.vtv.costo) || 0;
        ultimosMovimientos.push({
          tipo: 'VTV', patente, desc: `VTV · ${v.vtv.centroMedicion || '—'} · ${v.vtv.resultado || 'Pendiente'}`,
          importe: Number(v.vtv.costo) || 0, fecha: v.vtv.fechaVencimiento || v.vtv.fechaRealizacion
        });
      }

      if (v.seguro?.costo) {
        totalSeguro += Number(v.seguro.costo) || 0;
        ultimosMovimientos.push({
          tipo: 'Seguro', patente, desc: `Seguro · ${v.seguro.compania || v.seguro.compañía || '—'}`,
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
      donut: { combustible: totalCombustible, repuestos: totalRepuestos, vtv: totalVTV, seguro: totalSeguro },
      gastoVehiculos: gastoVehiculosEntries.map(([vehiculo, monto]) => ({ vehiculo, monto })),
      ultimosMovimientos: ultimosMovimientos.slice(0, 15)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/backup', verifyToken, requireAdmin, async (req, res) => {
  try {
    const COLLECTIONS = ['vehicles', 'users'];

    function serializeTimestamps(data) {
      if (!data || typeof data !== 'object') return data;
      if (Array.isArray(data)) return data.map(serializeTimestamps);
      const out = {};
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object') {
          if (v.toDate && typeof v.toDate === 'function') {
            out[k] = { __type: 'timestamp', value: v.toDate().toISOString() };
          } else if (v.constructor?.name === 'Timestamp') {
            out[k] = { __type: 'timestamp', value: new admin.firestore.Timestamp(v.seconds, v.nanoseconds).toDate().toISOString() };
          } else {
            out[k] = serializeTimestamps(v);
          }
        } else {
          out[k] = v;
        }
      }
      return out;
    }

    const allData = {};
    let total = 0;

    for (const col of COLLECTIONS) {
      try {
        const snap = await db.collection(col).get();
        const docs = snap.docs.map(d => ({ id: d.id, ...serializeTimestamps(d.data()) }));
        allData[col] = docs;
        total += docs.length;
      } catch (e) {
        allData[col] = [];
      }
    }

    const backup = {
      _meta: { exportado: new Date().toISOString(), totalDocumentos: total, collections: COLLECTIONS },
      ...allData
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/report', verifyToken, async (req, res) => {
  try {
    const { desde, hasta, categoria, vehiculo } = req.query;
    const filterDesde = desde ? new Date(desde) : new Date(0);
    const filterHasta = hasta ? new Date(hasta + 'T23:59:59') : new Date('2100-01-01');

    const vehiclesSnap = await db.collection('vehicles').get();

    const items = [];
    let totalComb = 0, totalRep = 0, totalVTV = 0, totalSeguro = 0;

    for (const vDoc of vehiclesSnap.docs) {
      const v = vDoc.data();
      const patente = v.patente || '—';

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
                detalle: `Seguro · ${v.seguro.compania || v.seguro.compañía || '—'} · Póliza ${v.seguro.poliza || '—'}`,
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
        items.push({ fecha, categoria: 'Combustible', vehiculo: patente, detalle: `${c.litros?.toFixed(1)}L ${c.tipo || ''}`, monto: Number(c.importe) || 0, proveedor: c.proveedor || '' });
        totalComb += Number(c.importe) || 0;
      });

      const repSnap = await vDoc.ref.collection('repuestos').get();
      repSnap.docs.forEach(d => {
        const r = d.data();
        const fecha = r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha);
        if (fecha < filterDesde || fecha > filterHasta) return;
        if (vehiculo && vehiculo !== 'todos' && !patente.toLowerCase().includes(vehiculo.toLowerCase())) return;
        if (categoria && categoria !== 'todas' && categoria !== 'Repuestos') return;
        items.push({ fecha, categoria: 'Repuestos', vehiculo: patente, detalle: r.pieza || '', monto: Number(r.costo) || 0, proveedor: r.proveedor || '' });
        totalRep += Number(r.costo) || 0;
      });
    }

    items.sort((a, b) => b.fecha - a.fecha);

    res.json({ items, totales: { combustible: totalComb, repuestos: totalRep, vtv: totalVTV, seguro: totalSeguro } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/alerts', verifyToken, async (req, res) => {
  try {
    const vehiclesSnap = await db.collection('vehicles').get();
    const now = new Date();
    const alerts = [];
    for (const vDoc of vehiclesSnap.docs) {
      const v = vDoc.data();
      const patente = v.patente || '—';
      if (v.vtv?.fechaVencimiento) {
        const venc = v.vtv.fechaVencimiento.toDate ? v.vtv.fechaVencimiento.toDate() : new Date(v.vtv.fechaVencimiento);
        const diff = Math.ceil((venc - now) / 86400000);
        if (diff <= 30) alerts.push({ id: vDoc.id + '-vtv', level: diff <= 0 ? 'critical' : diff <= 7 ? 'warning' : 'info', label: diff <= 0 ? 'VTV Vencida' : 'VTV Próxima', days: diff, vehiculoPatente: patente, tipo: 'VTV' });
      }
      if (v.seguro?.fechaVencimiento) {
        const venc = v.seguro.fechaVencimiento.toDate ? v.seguro.fechaVencimiento.toDate() : new Date(v.seguro.fechaVencimiento);
        const diff = Math.ceil((venc - now) / 86400000);
        if (diff <= 30) alerts.push({ id: vDoc.id + '-seg', level: diff <= 0 ? 'critical' : diff <= 7 ? 'warning' : 'info', label: diff <= 0 ? 'Seguro Vencido' : 'Seguro Próximo', days: diff, vehiculoPatente: patente, tipo: 'Seguro' });
      }
    }
    alerts.sort((a, b) => a.days - b.days);
    res.json(alerts.slice(0, 50));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/vehicles-basic', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
    const now = new Date();
    const vehicles = snap.docs.map(d => {
      const v = d.data();
      const fd = (ts) => {
        if (!ts) return null;
        const dt = ts.toDate ? ts.toDate() : new Date(ts);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
      };
      const vtvVen = fd(v.vtv?.fechaVencimiento);
      const segVen = fd(v.seguro?.fechaVencimiento);
      const diffVtv = vtvVen ? Math.ceil((new Date(vtvVen) - now) / 86400000) : null;
      const diffSeg = segVen ? Math.ceil((new Date(segVen) - now) / 86400000) : null;
      return {
        patente: v.patente || '',
        interno: v.interno || '',
        marca: v.marca || '',
        modelo: v.modelo || '',
        anio: v.anio || '',
        tipo: v.tipo || '',
        subtipo: v.subtipo || '',
        empresa: v.empresa || '',
        conductor: v.conductorHabitual || '',
        kilometraje: v.kilometraje || '',
        horometro: v.horometro || '',
        capacidadCarga: v.capacidadCarga || '',
        estadoGeneral: v.estadoGeneral || '',
        vtvResultado: v.vtv?.resultado || '',
        vtvCentro: v.vtv?.centroMedicion || '',
        vtvVencimiento: vtvVen,
        vtvDiasRestantes: diffVtv,
        vtvCosto: Number(v.vtv?.costo) || 0,
        seguroCompania: v.seguro?.compania || v.seguro?.compañía || '',
        seguroPoliza: v.seguro?.poliza || '',
        seguroVencimiento: segVen,
        seguroDiasRestantes: diffSeg,
        seguroCosto: Number(v.seguro?.costo) || 0,
        proximoServiceKm: v.proximoServiceKm || '',
        proximoServiceFecha: fd(v.proximoServiceFecha),
        trompo: v.trompo || false,
        marcaTrompo: v.marcaTrompo || '',
        serieTrompo: v.serieTrompo || '',
        modeloTrompo: v.modeloTrompo || '',
        cargaM3Trompo: v.cargaM3Trompo || '',
        observaciones: v.observaciones || ''
      };
    });
    res.json({ vehicles, total: vehicles.length });
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

    const [vehiclesSnap] = await Promise.all([
      db.collection('vehicles').get()
    ]);

    const vehicleMap = {};
    vehiclesSnap.docs.forEach(d => {
      const v = d.data();
      vehicleMap[d.id] = { patente: v.patente || '—', interno: v.interno || '', marca: v.marca || '', modelo: v.modelo || '' };
    });

    const rows = [];
    const catTotals = { Combustible: 0, Repuestos: 0, VTV: 0, Seguro: 0 };

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
                detalle: `Seguro · ${v.seguro.compania || v.seguro.compañía || '—'}`,
                monto: costoS, proveedor: v.seguro.compania || v.seguro.compañía || '', observaciones: ''
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

    rows.sort((a, b) => b.fecha - a.fecha);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Grupo Falpat SRL';
    wb.created = now;
    wb.modified = now;

    const wbProps = {
      title: 'Reporte de Gastos',
      subject: 'Gastos operativos',
      keywords: 'gastos, combustible, repuestos, grupo falpat',
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
    const summaryHeaders = ['Total Combustible', 'Total Repuestos', 'Total VTV', 'Total Seguro', 'Gran Total'];
    const summaryValues = [
      catTotals.Combustible, catTotals.Repuestos,
      catTotals.VTV, catTotals.Seguro,
      catTotals.Combustible + catTotals.Repuestos + catTotals.VTV + catTotals.Seguro
    ];
    const summaryColors = [PRIMARY, '10B981', '8B5CF6', 'F59E0B', 'FF3366'];

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

    const catColors = { Combustible: PRIMARY, Repuestos: '10B981' };

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
    footerCell.value = 'Grupo Falpat SRL — Sistema de Control Vehicular — Documento generado automáticamente';
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

