const { db } = require('../config/firebase');
const XLSX = require('xlsx');
const path = require('path');

(async () => {
  const snap = await db.collection('vehicles').orderBy('interno').get();
  const rows = snap.docs.map(d => {
    const v = d.data();
    return {
      id: d.id,
      interno: v.interno || '',
      patente: v.patente || '',
      marca: v.marca || '',
      modelo: v.modelo || '',
      año: v.año || v.anio || '',
      tipo: v.tipo || '',
      subtipo: v.subtipo || '',
      chasis: v.chasis || '',
      numeroMotor: v.numeroMotor || '',
      capacidadCarga: v.capacidadCarga ?? '',
      kilometraje: v.kilometraje ?? '',
      horometro: v.horometro ?? '',
      estadoGeneral: v.estadoGeneral || '',
      vtv_fechaRealizacion: v.vtv?.fechaRealizacion?.toDate?.()?.toISOString().split('T')[0] || v.vtv?.fechaRealizacion || '',
      vtv_fechaVencimiento: v.vtv?.fechaVencimiento?.toDate?.()?.toISOString().split('T')[0] || v.vtv?.fechaVencimiento || '',
      vtv_costo: v.vtv?.costo ?? '',
      vtv_centroMedicion: v.vtv?.centroMedicion || '',
      vtv_resultado: v.vtv?.resultado || '',
      seguro_compania: v.seguro?.compania || v.seguro?.compañía || '',
      seguro_poliza: v.seguro?.poliza || '',
      seguro_tipo: v.seguro?.tipo || '',
      seguro_vencimiento: v.seguro?.fechaVencimiento?.toDate?.()?.toISOString().split('T')[0] || v.seguro?.fechaVencimiento || '',
      seguro_costo: v.seguro?.costo ?? '',
      proximoServiceKm: v.proximoServiceKm ?? '',
      proximoServiceFecha: v.proximoServiceFecha?.toDate?.()?.toISOString().split('T')[0] || v.proximoServiceFecha || '',
      centroTrabajo: v.centroTrabajo || '',
      chofer: v.chofer || '',
      dni: v.dni || '',
      vencimientoDNI: v.vencimientoDNI?.toDate?.()?.toISOString().split('T')[0] || v.vencimientoDNI || '',
      registro: v.registro || '',
      vencimientoRegistro: v.vencimientoRegistro?.toDate?.()?.toISOString().split('T')[0] || v.vencimientoRegistro || '',
      empresa: v.empresa || '',
      'trompo (raw)': v.trompo === true ? 'Si' : 'No',
      marcaTrompo: v.marcaTrompo || '',
      serieTrompo: v.serieTrompo || '',
      modeloTrompo: v.modeloTrompo || '',
      cargaM3Trompo: v.cargaM3Trompo || '',
      observaciones: v.observaciones || '',
      fechaAlta: v.fechaAlta?.toDate?.()?.toISOString().split('T')[0] || v.createdAt?.toDate?.()?.toISOString().split('T')[0] || '',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Vehículos');
  const outPath = path.join(__dirname, '..', 'vehiculos_completo.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`✅ Exportado: ${outPath} (${rows.length} vehículos)`);
  process.exit(0);
})().catch(e => { console.error('❌', e); process.exit(1); });
