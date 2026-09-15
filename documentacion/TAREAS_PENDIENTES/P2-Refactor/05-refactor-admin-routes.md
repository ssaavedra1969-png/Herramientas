# TAREA P2-5: Eliminar duplicación en `routes/admin.js`

**Prioridad:** MEDIA
**Archivo:** `routes/admin.js` (709 líneas)
**Problema:** Los endpoints `/dashboard/financial` (líneas 80+), `/report` (~línea 216), y `/report/export` (~línea 364) contienen ~300 líneas de lógica casi idéntica: iterar vehículos, cargar subcolecciones combustible/repuestos, filtrar por fechas/categorías.

---

## Cambio requerido

### 1. Extraer función auxiliar compartida

Crear una función que cargue todos los datos financieros:

```js
async function fetchFinancialData({ desde, hasta, categoria, vehiculo } = {}) {
  const vehiclesSnap = await db.collection('vehicles').get();
  const items = [];

  for (const vDoc of vehiclesSnap.docs) {
    const v = vDoc.data();
    const patente = v.patente || '—';
    const interno = v.interno || '';

    // Combustible
    const combSnap = await vDoc.ref.collection('combustible').orderBy('fecha', 'desc').get();
    for (const d of combSnap.docs) {
      const c = d.data();
      const fecha = c.fecha?.toDate ? c.fecha.toDate() : new Date(c.fecha);
      items.push({
        fecha, categoria: 'Combustible', vehiculo: `${patente} (${interno})`,
        detalle: `${c.litros || 0}L — ${c.tipo || ''}`, monto: c.importe || 0
      });
    }

    // Repuestos
    const repSnap = await vDoc.ref.collection('repuestos').orderBy('fecha', 'desc').get();
    for (const d of repSnap.docs) {
      const r = d.data();
      const fecha = r.fecha?.toDate ? r.fecha.toDate() : new Date(r.fecha);
      items.push({
        fecha, categoria: 'Repuestos', vehiculo: `${patente} (${interno})`,
        detalle: r.pieza || '', monto: r.costo || 0
      });
    }

    // VTV
    if (v.vtv?.costo) {
      const fecha = v.vtv.fechaVencimiento?.toDate ? v.vtv.fechaVencimiento.toDate() : new Date(v.vtv.fechaVencimiento);
      items.push({
        fecha, categoria: 'VTV', vehiculo: `${patente} (${interno})`,
        detalle: v.vtv.centroMedicion || 'VTV', monto: v.vtv.costo
      });
    }

    // Seguro
    if (v.seguro?.costo) {
      const fecha = v.seguro.fechaVencimiento?.toDate ? v.seguro.fechaVencimiento.toDate() : new Date(v.seguro.fechaVencimiento);
      items.push({
        fecha, categoria: 'Seguro', vehiculo: `${patente} (${interno})`,
        detalle: v.seguro.compañía || 'Seguro', monto: v.seguro.costo
      });
    }
  }

  // Mantenimiento
  const mtoSnap = await db.collection('maintenance').get();
  for (const d of mtoSnap.docs) {
    const m = d.data();
    const fecha = m.fechaRealizacion?.toDate ? m.fechaRealizacion.toDate() : new Date(m.fechaRealizacion);
    items.push({
      fecha, categoria: 'Mantenimiento', vehiculo: m.vehiculoPatente || '—',
      detalle: m.descripcion || '', monto: m.costo || 0
    });
  }

  // Filtrar
  let filtered = items;
  if (desde) filtered = filtered.filter(i => i.fecha >= new Date(desde));
  if (hasta) filtered = filtered.filter(i => i.fecha <= new Date(hasta + 'T23:59:59'));
  if (categoria) filtered = filtered.filter(i => i.categoria === categoria);
  if (vehiculo) filtered = filtered.filter(i => i.vehiculo.includes(vehiculo));

  filtered.sort((a, b) => a.fecha - b.fecha);
  return filtered;
}
```

### 2. Reescribir los 3 endpoints usando la función auxiliar

```js
// GET /dashboard/financial
router.get('/dashboard/financial', verifyToken, requireAdmin, async (req, res) => {
  try {
    const items = await fetchFinancialData();
    // Agregar logic for combustibleChart, gastoVehiculos, etc.
    // ...
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /report
router.get('/report', verifyToken, requireAdmin, async (req, res) => {
  try {
    const items = await fetchFinancialData(req.query);
    res.json({ items: items.map(i => ({ ...i, fecha: i.fecha.toISOString() })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Verificación

1. Dashboard financiero muestra mismos datos que antes
2. Reportes con filtros funcionan igual
3. Export Excel funciona igual
4. El código es ~200 líneas más corto
5. No hay regressiones en funcionalidad
