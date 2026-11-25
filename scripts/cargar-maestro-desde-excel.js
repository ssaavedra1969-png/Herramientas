const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
require(path.join(R, 'node_modules', 'dotenv')).config({ path: path.join(R, '.env') });
const { db } = require(path.join(R, 'config', 'firebase'));
const { actualizarEmpleado } = require(path.join(R, 'lib', 'empleados'));
const XLSX = require(path.join(R, 'node_modules', 'xlsx'));

const EXCEL = path.join(R, 'PATENTE', 'Vtos', 'REVISAR_VENCIMIENTOS_CHOFERES_2026-11-24.xlsx');
const BACKUP_DIR = path.join(R, 'PATENTE', 'Vtos', 'BACKUP');
const BACKUP_FILE = path.join(BACKUP_DIR, 'maestro-choferes_2026-11-25.json');
const CANONICAL_PAZ = '5xs6kTtuc3ov7GYsX8Xp';
const DUPLICATE_PAZ = 'X1CVzzhm7m7h3AKWB7Wg';
const DNI_PAZ = '33331683';
const USUARIO = 'carga-excel-2026-11-25';
const APLICAR = process.argv.includes('--apply');
const HACER_BACKUP = process.argv.includes('--backup');

function p2(n) {
  return String(n).padStart(2, '0');
}

function normNombre(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normDni(v) {
  return String(v || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function fmtFecha(v) {
  if (v == null || v === '') return '';
  if (typeof v.toDate === 'function') {
    const d = v.toDate();
    if (isNaN(d.getTime())) return String(v);
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  const s = String(v).trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return p2(+m[1]) + '/' + p2(+m[2]) + '/' + m[3];
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return p2(+m[3]) + '/' + p2(+m[2]) + '/' + m[1];
  return s;
}

function fechaExcel(v) {
  if (v == null || v === '') return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear();
}

function docFecha(v, tipo) {
  const doc = (v && v.documentacion && v.documentacion[tipo]) || null;
  return fmtFecha(doc && doc.fechaVencimiento);
}

(async () => {
  const [snapEmpleados, snapVehiculos] = await Promise.all([
    db.collection('employees').get(),
    db.collection('vehicles').get()
  ]);

  if (HACER_BACKUP) {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(BACKUP_FILE, JSON.stringify({
      fecha: new Date().toISOString(),
      employees: snapEmpleados.docs.map(d => ({ id: d.id, data: d.data() })),
      vehicles: snapVehiculos.docs.map(d => ({ id: d.id, data: d.data() }))
    }, null, 2));
    console.log('BACKUP=' + BACKUP_FILE);
    console.log('EMPLOYEES=' + snapEmpleados.size + ' VEHICLES=' + snapVehiculos.size);
    return;
  }

  const wb = XLSX.readFile(EXCEL, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Revision choferes'], { defval: '', raw: true });
  const grupos = new Map();

  rows.forEach((r, i) => {
    const chofer = String(r.Chofer || '').trim();
    const dni = normDni(r['N° DNI']);
    const clave = dni || ('SIN_DNI:' + normNombre(chofer));
    const patente = String(r['Patente(s)'] || '').trim().toUpperCase();
    const interno = String(r.Int || '').trim();
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        chofer,
        dni,
        registro: normDni(r['N° Registro']),
        dniVto: fechaExcel(r['Vto DNI']),
        regVto: fechaExcel(r['Vto Registro']),
        patentes: [],
        filas: []
      });
    }
    const g = grupos.get(clave);
    g.patentes.push({ patente, interno, fila: i + 1 });
    g.filas.push(i + 1);
    if (fechaExcel(r['Vto DNI'])) g.dniVto = fechaExcel(r['Vto DNI']);
    if (fechaExcel(r['Vto Registro'])) g.regVto = fechaExcel(r['Vto Registro']);
  });

  const empleados = snapEmpleados.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() || {} }));
  const vehiculos = snapVehiculos.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() || {} }));
  const porDni = new Map();
  empleados.forEach(e => {
    const dni = normDni(e.data.dni);
    if (!dni) return;
    if (!porDni.has(dni)) porDni.set(dni, []);
    porDni.get(dni).push(e);
  });

  const vehiculosPorPatente = new Map();
  vehiculos.forEach(v => {
    const patente = String(v.data.patente || '').toUpperCase();
    if (!vehiculosPorPatente.has(patente)) vehiculosPorPatente.set(patente, []);
    vehiculosPorPatente.get(patente).push(v);
  });

  const planes = [];
  const errores = [];

  for (const g of grupos.values()) {
    let perfil;
    if (g.dni) {
      const candidatos = porDni.get(g.dni) || [];
      if (candidatos.length === 1) perfil = candidatos[0];
      else if (candidatos.length > 1 && g.dni === DNI_PAZ) {
        perfil = candidatos.find(e => e.id === CANONICAL_PAZ);
      }
      if (!perfil) errores.push(g.chofer + ': no se pudo resolver perfil por DNI ' + g.dni);
    } else {
      const candidatos = empleados.filter(e => normNombre(e.data.nombre) === normNombre(g.chofer));
      if (candidatos.length !== 1) errores.push(g.chofer + ': no se pudo resolver perfil por nombre (' + candidatos.length + ')');
      else perfil = candidatos[0];
    }
    if (errores.length) continue;

    const patenteActual = String(perfil.data.patenteActual || '').toUpperCase();
    if (patenteActual && !g.patentes.some(x => x.patente === patenteActual)) {
      errores.push(g.chofer + ': patenteActual ' + patenteActual + ' no está en el Excel');
      continue;
    }

    const vinculados = [];
    for (const item of g.patentes) {
      const lista = vehiculosPorPatente.get(item.patente) || [];
      if (lista.length !== 1) {
        errores.push(item.patente + ': se esperaba 1 vehículo, hay ' + lista.length);
        continue;
      }
      const v = lista[0];
      if (String(v.data.interno || '') !== item.interno) {
        errores.push(item.patente + ': interno ' + v.data.interno + ' != ' + item.interno);
        continue;
      }
      const idsPermitidos = new Set([perfil.id]);
      const idVehiculo = String(v.data.empleadoId || '');
      if (idVehiculo && !idsPermitidos.has(idVehiculo)) {
        errores.push(item.patente + ': empleadoId ' + idVehiculo + ' no corresponde a ' + perfil.id);
        continue;
      }
      const choferVehiculo = normNombre(v.data.chofer);
      if (choferVehiculo && choferVehiculo !== normNombre(g.chofer)) {
        errores.push(item.patente + ': chofer ' + v.data.chofer + ' != ' + g.chofer);
        continue;
      }
      vinculados.push({ patente: item.patente, interno: item.interno, fila: item.fila, vehiculo: v });
    }
    if (errores.length) continue;

    const detalles = [];
    if (fmtFecha(perfil.data.vencimientoDNI) !== g.dniVto) detalles.push('emp DNI ' + (fmtFecha(perfil.data.vencimientoDNI) || '-') + '->' + (g.dniVto || '-'));
    if (fmtFecha(perfil.data.vencimientoRegistro) !== g.regVto) detalles.push('emp REG ' + (fmtFecha(perfil.data.vencimientoRegistro) || '-') + '->' + (g.regVto || '-'));
    vinculados.forEach(x => {
      const v = x.vehiculo.data;
      if (fmtFecha(v.vencimientoDNI) !== g.dniVto || docFecha(v, 'dni') !== g.dniVto) {
        detalles.push(x.patente + ' DNI ' + (fmtFecha(v.vencimientoDNI) || '-') + '/' + (docFecha(v, 'dni') || '-') + '->' + (g.dniVto || '-'));
      }
      if (fmtFecha(v.vencimientoRegistro) !== g.regVto || docFecha(v, 'registro') !== g.regVto) {
        detalles.push(x.patente + ' REG ' + (fmtFecha(v.vencimientoRegistro) || '-') + '/' + (docFecha(v, 'registro') || '-') + '->' + (g.regVto || '-'));
      }
    });

    planes.push({
      chofer: g.chofer,
      dni: g.dni,
      perfil,
      vinculados,
      dniVto: g.dniVto,
      regVto: g.regVto,
      detalles
    });
  }

  const vacios = planes.filter(p => !p.dniVto || !p.regVto).length;
  const vehiculosAfectados = planes.reduce((n, p) => n + p.vinculados.length, 0);

  console.log('FILAS=' + rows.length + ' PERFILES=' + grupos.size + ' VEHICULOS=' + vehiculosAfectados + ' VACIOS=' + vacios + ' ALTAS=0');
  console.log('DEDUPE_PAZ=' + CANONICAL_PAZ + ' <- AF170SV | duplicado ' + DUPLICATE_PAZ + ' -> inactivo');

  if (errores.length) {
    console.log('ERRORES=' + errores.length);
    errores.forEach(e => console.log('  ' + e));
    process.exit(1);
  }

  console.log('\n--- PLAN ---');
  planes.forEach((p, i) => {
    console.log(p2(i + 1) + ' ' + String(p.chofer).padEnd(24) + p.perfil.id + '\t' + p.vinculados.map(x => x.patente + '/' + x.interno).join(',') + '\tDNI=' + (p.dniVto || '-') + '\tREG=' + (p.regVto || '-') + '\t' + p.detalles.join(' | '));
  });

  if (APLICAR) {
    if (!fs.existsSync(BACKUP_FILE)) throw new Error('Falta el backup: ' + BACKUP_FILE);

    const canonical = await db.collection('employees').doc(CANONICAL_PAZ).get();
    if (!canonical.exists) throw new Error('No existe el perfil canónico de Paz');
    const af170 = await db.collection('vehicles').where('patente', '==', 'AF170SV').get();
    if (af170.size !== 1) throw new Error('AF170SV: se esperaba 1 vehículo, hay ' + af170.size);
    await af170.docs[0].ref.update({ empleadoId: CANONICAL_PAZ });
    const duplicado = await db.collection('employees').doc(DUPLICATE_PAZ).get();
    if (duplicado.exists) {
      await duplicado.ref.update({
        activo: false,
        patenteActual: '',
        actualizadoEn: new Date().toISOString(),
        actualizadoPor: USUARIO
      });
      console.log('\nDUPLICADO_DESACTIVADO=1');
    } else {
      console.log('\nDUPLICADO_YA_AUSENTE=1');
    }
    console.log('DEDUPE_APLICADO=1');

    let escritos = 0;
    for (const p of planes) {
      await actualizarEmpleado(db, p.perfil.id, {
        vencimientoDNI: p.dniVto,
        vencimientoRegistro: p.regVto
      }, USUARIO);
      escritos++;
    }
    console.log('EMPLEADOS_ACTUALIZADOS=' + escritos + '/' + planes.length);
    console.log('VEHICULOS_REFLEJADOS=' + vehiculosAfectados);
    return;
  }

  console.log('\nDRY-RUN: no se escribió nada. Requiere --backup previo y luego --apply.');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
