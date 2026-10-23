'use strict';
/*
 * Carga el inventario de Carlos Casares (Excel de 3 solapas) al catálogo de
 * elementos y lo asigna a la obra Carlos Casares.
 *
 * DRY-RUN por defecto: solo lee y muestra qué haría.
 *   node scripts/importar-casares.js
 *   node scripts/importar-casares.js --apply
 *
 * Es idempotente:
 *   - si el elemento ya está en el catálogo (mismo tipo + sector + nombre), lo
 *     reutiliza y no lo duplica;
 *   - si ya está asignado a la obra (mismo interno + sector, sin devolver), no
 *     vuelve a asignarlo.
 *
 * No actualiza datos existentes: si hay que corregir un stock o un detalle, se
 * edita desde la web o se borra el elemento y se vuelve a correr.
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const DEFAULT_EXCEL = path.join(__dirname, '..', 'PATENTE', 'Casares', 'Inventario_Equipos_y_Herramientas.xlsx');
const DEFAULT_CENTRO = 'Carlos Casares';
const TIPOS_PREFIJO = { vehiculo: 'V', herramienta: 'H', equipo: 'E', ropa: 'R', material: 'M' };

function norm(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

function normKey(s) {
  return norm(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/* Cada fila del Excel tiene su nombre "de salida", tipo y, cuando se puede,
   marca/modelo. Las claves son normKey(nombre original). */
const OVERRIDES = {
  // ── Planta Dosificadora ──
  'planta dosificadora (marca tecnus, modelo tm 30)': { nombre: 'Planta dosificadora', marca: 'Tecnus', modelo: 'Tm 30', tipo: 'equipo' },
  'tolva de arido, balanza de cemento': { nombre: 'Tolva de árido y balanza de cemento', tipo: 'equipo' },
  'rolos de cintas': { nombre: 'Rolos de cintas', tipo: 'equipo' },
  'electrovalbulas': { nombre: 'Electroválvulas', tipo: 'equipo' },
  'motor y reductora': { nombre: 'Motor y reductora', tipo: 'equipo' },
  'tornillos de cemento': { skip: true, motivo: 'Se detalla en los tornillos de 8 m y 4 m' },
  'tornillo de cemento de 8 metros': { nombre: 'Tornillo de cemento de 8 m', tipo: 'equipo' },
  'tornillo de cemento de 4 metros': { nombre: 'Tornillo de cemento de 4 m', tipo: 'equipo' },
  'tablero de sistema de despachos': { nombre: 'Tablero de sistema de despachos', tipo: 'equipo' },
  'bomba de agua': { nombre: 'Bomba de agua', tipo: 'equipo' },
  'compresor de aire (marca condor, 7,5 hp)': { nombre: 'Compresor de aire', marca: 'Cóndor', modelo: '7,5 Hp', tipo: 'equipo' },

  // ── Silo Móvil ──
  'silo movil marca tecnus modelo tcm 65 tn': { nombre: 'Silo móvil', marca: 'Tecnus', modelo: 'Tcm 65 Tn', tipo: 'equipo' },
  'motor': { nombre: 'Motor', tipo: 'equipo' },
  'reductor': { nombre: 'Reductor', tipo: 'equipo' },
  'patas extensoras': { nombre: 'Patas extensoras', tipo: 'equipo' },
  'limpio de cemento': { skip: true, motivo: 'Es un estado del silo; se agrega a su descripción' },
  'sistema de aire completo con un pulmon instalado': { nombre: 'Sistema de aire completo con pulmón instalado', tipo: 'equipo' },
  'ruedas': { nombre: 'Ruedas', tipo: 'equipo' },

  // ── Contenedor ──
  'cabina de despachos h°': { nombre: 'Cabina de despachos H°', tipo: 'equipo' },
  'mesa con mueble, alacena': { nombre: 'Mesa con mueble y alacena', tipo: 'equipo' },
  'cocina electrica': { nombre: 'Cocina eléctrica', tipo: 'equipo' },
  'escritorio': { nombre: 'Escritorio', tipo: 'equipo' },
  'aire acondicionado': { nombre: 'Aire acondicionado', tipo: 'equipo' },
  'escritorio fijo': { nombre: 'Escritorio fijo', tipo: 'equipo' },
  'sillas en malas condiciones oficina': { nombre: 'Sillas de oficina', detalle: 'En malas condiciones', tipo: 'equipo' },
  'mesa de trabajo con una morza n° 5 marca barbero': { nombre: 'Mesa de trabajo con morsa N° 5', marca: 'Barbero', tipo: 'herramienta' },
  'estanterias fijas': { nombre: 'Estanterías fijas', tipo: 'equipo' },
  'motor de 5 hp reparado': { nombre: 'Motor de 5 Hp', tipo: 'equipo' },
  'bomba de agua reparada': { nombre: 'Bomba de agua', tipo: 'equipo' },
  'instalacion electrica con un reflector y dos termicas': { nombre: 'Instalación eléctrica con reflector y dos térmicas', tipo: 'equipo' },
  'tablero vacio de herramientas': { nombre: 'Tablero vacío de herramientas', tipo: 'equipo' },
  'barretas grandes de gomeria': { nombre: 'Barretas grandes de gomería', tipo: 'herramienta' },
  'barreta chica y chauchita': { nombre: 'Barreta chica y chauchita', tipo: 'herramienta' },
  'caja de herramientas nueva completa marca total': { nombre: 'Caja de herramientas completa', marca: 'Total', tipo: 'herramienta' },
  'llaves de mano, tubos': { nombre: 'Llaves de mano y tubos', tipo: 'herramienta' },
  'llaves alen': { nombre: 'Llaves Allen', tipo: 'herramienta' }
};

const SECTORES = {
  'Planta Dosificadora': 'Planta Dosificadora',
  'Silo Movil': 'Silo Móvil'
};

function limpiarDetalle(s) {
  const d = norm(s);
  return d === '-' ? '' : d;
}

/* Lee el Excel y devuelve { items, omitidos }. No toca Firestore. */
function leerInventario(excelPath = DEFAULT_EXCEL) {
  if (!fs.existsSync(excelPath)) throw new Error('No existe el Excel: ' + excelPath);
  const wb = XLSX.readFile(excelPath);
  const items = [];
  const omitidos = [];

  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
    const esContenedor = sheet === 'Contenedor';
    const nombreIdx = esContenedor ? 2 : 1;
    const detalleIdx = esContenedor ? 3 : 2;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      if (r.every((x) => norm(x) === '')) continue;

      const nombreOriginal = norm(r[nombreIdx]);
      if (!nombreOriginal) continue;
      if (normKey(nombreOriginal) === 'cantidad') continue;

      const ov = OVERRIDES[normKey(nombreOriginal)] || {};
      if (ov.skip) {
        omitidos.push({ hoja: sheet, fila: i + 1, nombreOriginal, motivo: ov.motivo || 'Omitido' });
        continue;
      }

      const cantidad = parseInt(r[0], 10);
      const detalle = limpiarDetalle(ov.detalle !== undefined ? ov.detalle : r[detalleIdx]);
      let sector;
      if (esContenedor) {
        const cont = norm(r[1]);
        sector = cont ? `Contenedor ${cont}` : 'Contenedor';
      } else {
        sector = SECTORES[sheet] || sheet;
      }

      items.push({
        hoja: sheet,
        fila: i + 1,
        sector,
        tipo: ov.tipo || 'equipo',
        nombre: ov.nombre || nombreOriginal,
        marca: ov.marca || '',
        modelo: ov.modelo || '',
        stock: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
        descripcion: detalle
      });
    }
  }

  // "Limpio De Cemento" es un estado del silo, no un elemento aparte.
  const silo = items.find((x) => x.sector === 'Silo Móvil' && x.nombre === 'Silo móvil');
  if (silo) {
    silo.descripcion = [silo.descripcion, 'Limpio de cemento'].filter(Boolean).join('. ') + '.';
    silo.descripcion = silo.descripcion.replace(/\.\.$/, '.');
  }

  return { items, omitidos };
}

async function getNextCatalogNumber(db, tipo) {
  const prefijo = TIPOS_PREFIJO[tipo];
  if (!prefijo) throw new Error('Tipo inválido: ' + tipo);
  const counterRef = db.collection('counters').doc(tipo);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(counterRef);
    if (!doc.exists) {
      const snap = await db.collection('elementos_catalogo').where('tipo', '==', tipo).get();
      let max = 0;
      snap.docs.forEach((d) => {
        const m = String(d.data().interno || '').match(new RegExp('^' + prefijo + '0*(\\d+)$'));
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      tx.set(counterRef, { current: max + 1 });
      return { number: max + 1, formatted: prefijo + String(max + 1).padStart(3, '0') };
    }
    const next = Number(doc.data().current || 0) + 1;
    tx.update(counterRef, { current: next });
    return { number: next, formatted: prefijo + String(next).padStart(3, '0') };
  });
}

async function buscarCentro(db, nombre) {
  const exacto = await db.collection('centros').where('nombre', '==', nombre).get();
  if (!exacto.empty) return exacto.docs[0];
  const todos = await db.collection('centros').get();
  return todos.docs.find((d) => normKey(d.data().nombre) === normKey(nombre)) || null;
}

function claveCatalogo(x) {
  return `${x.tipo}|${normKey(x.sector)}|${normKey(x.nombre)}`;
}

function claveAsignacion(x) {
  return `${normKey(x.interno)}|${normKey(x.sector)}`;
}

/* Devuelve el plan contra los datos actuales, sin escribir. */
async function planificar(db, items, centroNombre = DEFAULT_CENTRO) {
  const centro = await buscarCentro(db, centroNombre);
  if (!centro) throw new Error('No se encontró la obra "' + centroNombre + '"');

  const catSnap = await db.collection('elementos_catalogo').get();
  const cat = new Map();
  catSnap.docs.forEach((d) => {
    const x = { id: d.id, ...d.data() };
    cat.set(claveCatalogo(x), x);
  });

  const asigSnap = await db.collection(`centros/${centro.id}/elementos`).get();
  const asig = new Map();
  asigSnap.docs.forEach((d) => {
    const x = { id: d.id, ...d.data() };
    if (!x.fechaDevolucion) asig.set(claveAsignacion(x), x);
  });

  const filas = items.map((item) => {
    const existente = cat.get(claveCatalogo(item));
    return {
      item,
      accion: existente ? 'asignar_existente' : 'crear_y_asignar',
      interno: existente ? existente.interno : null,
      yaAsignado: existente ? asig.has(claveAsignacion({ interno: existente.interno, sector: item.sector })) : false
    };
  });

  return { centro, filas };
}

/* Ejecuta el plan. Devuelve el resumen de lo creado/reutilizado. */
async function ejecutar(db, items, opts = {}) {
  const centroNombre = opts.centroNombre || DEFAULT_CENTRO;
  const { centro, filas } = await planificar(db, items, centroNombre);

  const resumen = {
    centroId: centro.id,
    centroNombre: centro.data().nombre,
    creadosCatalogo: 0,
    reutilizadosCatalogo: 0,
    creadosAsignados: 0,
    yaAsignados: 0
  };

  for (const f of filas) {
    const item = f.item;
    let interno = f.interno;

    if (f.accion === 'crear_y_asignar') {
      const { formatted } = await getNextCatalogNumber(db, item.tipo);
      interno = formatted;
      await db.collection('elementos_catalogo').add({
        tipo: item.tipo,
        interno,
        nombre: item.nombre,
        descripcion: item.descripcion,
        marca: item.marca,
        modelo: item.modelo,
        sector: item.sector,
        stock: item.stock,
        createdAt: new Date()
      });
      resumen.creadosCatalogo++;
    } else {
      resumen.reutilizadosCatalogo++;
    }

    if (f.yaAsignado) {
      resumen.yaAsignados++;
      continue;
    }

    await db.collection(`centros/${centro.id}/elementos`).add({
      interno,
      elementoTipo: item.tipo,
      sector: item.sector,
      origenCentro: null,
      fechaAsignacion: new Date(),
      fechaDevolucion: '',
      observaciones: item.descripcion,
      createdAt: new Date()
    });
    resumen.creadosAsignados++;
  }

  return resumen;
}

function imprimirPlan(plan) {
  const { centro, filas } = plan;
  console.log(`Obra: ${centro.data().nombre} (${centro.id})`);
  console.log('');
  console.log('Sector             | Tipo        | Interno | Elemento                                      | Stock | Acción');
  console.log('-------------------+-------------+---------+-----------------------------------------------+-------+------------------');
  for (const f of filas) {
    const i = f.item;
    const interno = f.interno || '(nuevo)';
    console.log(
      `${i.sector.padEnd(18).slice(0, 18)} | ${i.tipo.padEnd(11).slice(0, 11)} | ${String(interno).padEnd(7).slice(0, 7)} | ${i.nombre.padEnd(45).slice(0, 45)} | ${String(i.stock).padEnd(5)} | ${f.accion}${f.yaAsignado ? ' (ya asignado)' : ''}`
    );
  }
  const crear = filas.filter((f) => f.accion === 'crear_y_asignar').length;
  const asignar = filas.filter((f) => !f.yaAsignado).length;
  console.log('');
  console.log(`Total: ${filas.length} elementos · ${crear} nuevos en catálogo · ${asignar} asignaciones a crear`);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const archivoArg = args.find((a) => a.startsWith('--archivo='));
  const centroArg = args.find((a) => a.startsWith('--centro='));
  const excelPath = archivoArg ? path.resolve(archivoArg.split('=')[1]) : DEFAULT_EXCEL;
  const centroNombre = centroArg ? centroArg.split('=')[1] : DEFAULT_CENTRO;

  const { items, omitidos } = leerInventario(excelPath);
  console.log('Archivo:', excelPath);
  console.log('Elementos detectados:', items.length);
  if (omitidos.length) {
    console.log('Filas omitidas:');
    omitidos.forEach((o) => console.log(`  - ${o.hoja} fila ${o.fila}: "${o.nombreOriginal}" (${o.motivo})`));
  }

  // La lectura de Firestore es necesaria para saber qué ya existe. El script
  // local usa la misma base que producción, pero DEV_READ_ONLY no aplica acá:
  // por eso el modo por defecto es dry-run y --apply es explícito.
  const { db } = require('../config/firebase');
  const plan = await planificar(db, items, centroNombre);
  console.log('');
  imprimirPlan(plan);

  if (!apply) {
    console.log('');
    console.log('DRY-RUN: no se escribió nada. Para cargar de verdad: --apply');
    return;
  }

  const resumen = await ejecutar(db, items, { centroNombre });
  console.log('');
  console.log('RESULTADO:');
  console.log('  Catálogo nuevo:      ', resumen.creadosCatalogo);
  console.log('  Catálogo reutilizado:', resumen.reutilizadosCatalogo);
  console.log('  Asignaciones nuevas: ', resumen.creadosAsignados);
  console.log('  Ya asignados:        ', resumen.yaAsignados);
}

if (require.main === module) {
  main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}

module.exports = {
  DEFAULT_EXCEL,
  DEFAULT_CENTRO,
  OVERRIDES,
  leerInventario,
  planificar,
  ejecutar,
  getNextCatalogNumber,
  buscarCentro,
  normKey
};
