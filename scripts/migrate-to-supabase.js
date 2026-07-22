// ============================================================
// Grupo Falpat SRL - Script de migracion de datos
// Firebase Firestore -> Supabase PostgreSQL
//
// USO:
//   node scripts/migrate-to-supabase.js
//
// REQUIERE:
//   - npm install firebase-admin @supabase/supabase-js dotenv
//   - Variables de entorno de Firebase y Supabase configuradas
// ============================================================

require('dotenv').config();
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// ---- Firebase Admin init ----
function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (require('fs').existsSync(filePath)) {
      return JSON.parse(require('fs').readFileSync(filePath, 'utf8'));
    }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.replace(/^['"]/, '').replace(/['"]$/, ''));
  }
  const localFile = require('path').join(__dirname, '..', 'engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json');
  if (require('fs').existsSync(localFile)) {
    return JSON.parse(require('fs').readFileSync(localFile, 'utf8'));
  }
  return null;
}

const serviceAccount = getServiceAccount();
if (serviceAccount) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

// ---- Supabase client init ----
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ---- Helpers ----
function firestoreTimestampToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  return null;
}

function flattenTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && val.seconds !== undefined) {
      result[key] = firestoreTimestampToDate(val);
    } else if (val && typeof val === 'object' && typeof val.toDate === 'function') {
      result[key] = val.toDate();
    } else if (Array.isArray(val)) {
      result[key] = val.map(item => flattenTimestamps(item));
    } else if (val && typeof val === 'object') {
      result[key] = flattenTimestamps(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ---- Migration functions ----

async function migrateUsers() {
  console.log('\n--- Migrando users ---');
  const snap = await db.collection('users').get();
  let count = 0;

  for (const doc of snap.docs) {
    const data = flattenTimestamps(doc.data());
    const { error } = await supabase
      .from('users')
      .upsert({
        id: doc.id,
        email: data.email || '',
        display_name: data.displayName || data.display_name || '',
        role: data.role || 'Usuario',
        created_at: data.createdAt || data.created_at || new Date(),
        updated_at: data.updatedAt || data.updated_at || null,
      }, { onConflict: 'id' });

    if (error) console.error(`  Error user ${doc.id}:`, error.message);
    else count++;
  }
  console.log(`  ${count} usuarios migrados`);
  return count;
}

async function migrateVehicles() {
  console.log('\n--- Migrando vehicles ---');
  const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
  let count = 0;
  let maxNum = 0;

  for (const doc of snap.docs) {
    const d = flattenTimestamps(doc.data());
    const interno = d.interno || d.numeroInterno || '';
    const numMatch = interno.match(/V-(\d+)/);
    if (numMatch) maxNum = Math.max(maxNum, parseInt(numMatch[1]));

    const vehicleRow = {
      id: doc.id,
      interno: interno,
      patente: (d.patente || '').toUpperCase().trim(),
      marca: d.marca || '',
      modelo: d.modelo || '',
      ano: parseInt(d.ano || d.anio || d.año) || 0,
      chasis: d.chasis || '',
      tipo: d.tipo || '',
      subtipo: d.subtipo || '',
      numero_motor: d.numeroMotor || '',
      capacidad_carga: d.capacidadCarga || null,
      kilometraje: parseInt(d.kilometraje) || 0,
      horometro: parseInt(d.horometro) || 0,
      estado_general: d.estadoGeneral || d.estado || 'Bueno',
      fecha_ultima_revision: d.fechaUltimaRevision || null,
      proximo_service_km: d.proximoServiceKm || null,
      proximo_service_fecha: d.proximoServiceFecha || null,
      centro_trabajo: d.centroTrabajo || '',
      conductor_habitual: d.conductorHabitual || '',
      empresa: d.empresa || '',
      observaciones: d.observaciones || '',
      foto_url: d.fotoURL || '',
      carga_trompo: d.cargaTrompo || '',

      // VTV
      vtv_fecha_realizacion: d.vtv?.fechaRealizacion || d.vtv?.fecha_realizacion || null,
      vtv_fecha_vencimiento: d.vtv?.fechaVencimiento || d.vtv?.fecha_vencimiento || null,
      vtv_costo: d.vtv?.costo || null,
      vtv_centro_medicion: d.vtv?.centroMedicion || d.vtv?.centro_medicion || '',
      vtv_resultado: d.vtv?.resultado || 'Pendiente',

      // Seguro
      seguro_compania: d.seguro?.compañia || d.seguro?.compania || d.seguro?.compañia || '',
      seguro_poliza: d.seguro?.poliza || '',
      seguro_tipo: d.seguro?.tipo || '',
      seguro_fecha_vencimiento: d.seguro?.fechaVencimiento || d.seguro?.fecha_vencimiento || null,
      seguro_costo: d.seguro?.costo || null,

      // Trompo
      trompo_tipo: d.trompo?.tipo || '',
      trompo_numero_serie: d.trompo?.numeroSerie || d.trompo?.numero_serie || '',
      trompo_marca: d.trompo?.marca || '',
      trompo_capacidad: d.trompo?.capacidad || '',
      trompo_modelo: d.trompo?.modelo || '',
      trompo_otro: d.trompo?.otro || '',

      // Arrays
      multas: d.multas || [],
      documentos: d.documentos || [],

      created_at: d.createdAt || d.created_at || new Date(),
      fecha_alta: d.fechaAlta || d.fecha_alta || new Date(),
      updated_at: d.updatedAt || d.updated_at || null,
    };

    const { error } = await supabase
      .from('vehicles')
      .upsert(vehicleRow, { onConflict: 'id' });

    if (error) {
      console.error(`  Error vehicle ${doc.id} (${vehicleRow.patente}):`, error.message);
    } else {
      count++;
    }
  }

  // Actualizar contador
  if (maxNum > 0) {
    await supabase
      .from('counters')
      .upsert({ key: 'vehicles', current_value: maxNum }, { onConflict: 'key' });
    console.log(`  Counter actualizado a V-${String(maxNum).padStart(5, '0')}`);
  }

  console.log(`  ${count} vehiculos migrados`);
  return count;
}

async function migrateSubcollection(vehicleId, collectionName, tableName) {
  const snap = await db.collection('vehicles').doc(vehicleId).collection(collectionName).get();
  let count = 0;

  for (const doc of snap.docs) {
    const d = flattenTimestamps(doc.data());
    let row = { id: doc.id, vehicle_id: vehicleId };

    if (tableName === 'combustible') {
      row = {
        ...row,
        fecha: d.fecha || null,
        litros: d.litros || 0,
        importe: d.importe || 0,
        tipo: d.tipo || 'Gasoil',
        km: d.km || null,
        proveedor: d.proveedor || '',
        observaciones: d.observaciones || '',
        created_at: d.createdAt || d.created_at || new Date(),
      };
    } else if (tableName === 'repuestos') {
      row = {
        ...row,
        fecha: d.fecha || null,
        pieza: d.pieza || '',
        costo: d.costo || 0,
        proveedor: d.proveedor || '',
        tipo: d.tipo || 'Mantenimiento',
        km: d.km || null,
        observaciones: d.observaciones || '',
        created_at: d.createdAt || d.created_at || new Date(),
      };
    }

    const { error } = await supabase
      .from(tableName)
      .upsert(row, { onConflict: 'id' });

    if (error) console.error(`    Error ${tableName} ${doc.id}:`, error.message);
    else count++;
  }
  return count;
}

async function migrateCombustibleAndRepuestos() {
  console.log('\n--- Migrando combustible y repuestos (subcolecciones) ---');
  const vehiclesSnap = await db.collection('vehicles').get();
  let combustibleTotal = 0;
  let repuestosTotal = 0;

  for (const vDoc of vehiclesSnap.docs) {
    const c = await migrateSubcollection(vDoc.id, 'combustible', 'combustible');
    const r = await migrateSubcollection(vDoc.id, 'repuestos', 'repuestos');
    combustibleTotal += c;
    repuestosTotal += r;
    if (c > 0 || r > 0) {
      console.log(`  Vehicle ${vDoc.id}: ${c} combustible, ${r} repuestos`);
    }
  }
  console.log(`  Total: ${combustibleTotal} combustible, ${repuestosTotal} repuestos`);
  return { combustibleTotal, repuestosTotal };
}

async function migrateMaintenance() {
  console.log('\n--- Migrando maintenance ---');
  const snap = await db.collection('maintenance').get();
  let count = 0;

  for (const doc of snap.docs) {
    const d = flattenTimestamps(doc.data());
    const { error } = await supabase
      .from('maintenance')
      .upsert({
        id: doc.id,
        tipo: d.tipo || 'Mecanico',
        vehicle_id: d.vehiculoId || d.vehicle_id || null,
        vehiculo_patente: d.vehiculoPatente || d.vehiculo_patente || null,
        vehiculo_interno: d.vehiculoInterno || d.vehiculo_interno || null,
        fecha_realizacion: d.fechaRealizacion || d.fecha_realizacion || null,
        proxima_fecha_vencimiento: d.proximaFechaVencimiento || d.proxima_fecha_vencimiento || null,
        kilometraje_horas: d.kilometrajeHoras || d.kilometraje_horas || null,
        descripcion: d.descripcion || '',
        costo: d.costo || null,
        responsable: d.responsable || '',
        estado: d.estado || 'Pendiente',
        comprobante_url: d.comprobanteURL || d.comprobante_url || '',
        created_at: d.createdAt || d.created_at || new Date(),
        updated_at: d.updatedAt || d.updated_at || null,
      }, { onConflict: 'id' });

    if (error) console.error(`  Error maintenance ${doc.id}:`, error.message);
    else count++;
  }
  console.log(`  ${count} mantenimientos migrados`);
  return count;
}

async function migrateTools() {
  console.log('\n--- Migrando tools ---');
  const snap = await db.collection('tools').get();
  let count = 0;

  for (const doc of snap.docs) {
    const d = flattenTimestamps(doc.data());
    const { error } = await supabase
      .from('tools')
      .upsert({
        id: doc.id,
        codigo_interno: d.codigoInterno || d.codigo_interno || '',
        nombre: d.nombre || '',
        tipo_herramienta: d.tipoHerramienta || d.tipo_herramienta || '',
        categoria: d.categoria || '',
        marca: d.marca || '',
        modelo: d.modelo || '',
        numero_serie: d.numeroSerie || d.numero_serie || '',
        valor_compra: d.valorCompra || d.valor_compra || 0,
        fecha_compra: d.fechaCompra || d.fecha_compra || null,
        proveedor: d.proveedor || '',
        garantia_vence: d.garantiaVence || d.garantia_vence || null,
        estado_general: d.estadoGeneral || d.estado_general || 'Bueno',
        ubicacion_actual: d.ubicacionActual || d.ubicacion_actual || '',
        responsable_actual: d.responsableActual || d.responsable_actual || '',
        fecha_ultimo_control: d.fechaUltimoControl || d.fecha_ultimo_control || null,
        proximo_control: d.proximoControl || d.proximo_control || null,
        tiempo_uso_acumulado: d.tiempoUsoAcumulado || d.tiempo_uso_acumulado || 0,
        observaciones: d.observaciones || '',
        created_at: d.createdAt || d.created_at || new Date(),
        updated_at: d.updatedAt || d.updated_at || null,
      }, { onConflict: 'id' });

    if (error) console.error(`  Error tool ${doc.id}:`, error.message);
    else count++;
  }
  console.log(`  ${count} herramientas migradas`);
  return count;
}

// ---- Main ----
async function main() {
  console.log('========================================');
  console.log('Migracion Firebase -> Supabase');
  console.log('Grupo Falpat SRL');
  console.log('========================================');

  const startTime = Date.now();

  try {
    const users = await migrateUsers();
    const vehicles = await migrateVehicles();
    const subs = await migrateCombustibleAndRepuestos();
    const maintenance = await migrateMaintenance();
    const tools = await migrateTools();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n========================================');
    console.log('RESUMEN DE MIGRACION');
    console.log('========================================');
    console.log(`  Usuarios:       ${users}`);
    console.log(`  Vehiculos:      ${vehicles}`);
    console.log(`  Combustible:    ${subs.combustibleTotal}`);
    console.log(`  Repuestos:      ${subs.repuestosTotal}`);
    console.log(`  Mantenimientos: ${maintenance}`);
    console.log(`  Herramientas:   ${tools}`);
    console.log(`  Tiempo total:   ${elapsed}s`);
    console.log('========================================');
    console.log('Migracion completada!');
  } catch (err) {
    console.error('\nERROR FATAL:', err);
    process.exit(1);
  }
}

main();
