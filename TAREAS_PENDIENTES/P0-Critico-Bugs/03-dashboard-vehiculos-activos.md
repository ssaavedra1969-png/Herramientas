# TAREA P0-3: Fix filtro de vehículos activos en dashboard

**Prioridad:** CRITICO
**Archivo:** `routes/admin.js`
**Problema:** El endpoint `/api/admin/dashboard` (línea 48) cuenta vehículos activos con `d.data().estado === 'Activo'` pero el campo real en el modelo de datos es `estadoGeneral`. La tarjeta de "Vehículos Activos" del dashboard siempre muestra 0 o un número incorrecto.

---

## Cambio requerido

### `routes/admin.js` línea 48

**ANTES:**
```js
const vehiculosActivos = vehiclesSnap.docs.filter(d => d.data().estado === 'Activo').length;
```

**DESPUÉS:**
```js
const vehiculosActivos = vehiclesSnap.docs.filter(d => d.data().estadoGeneral !== 'Baja').length;
```

---

## Verificación

1. Ir al `/dashboard`
2. La tarjeta "Vehículos Activos" debe mostrar el número correcto de vehículos que NO tienen `estadoGeneral: 'Baja'`
3. Si no hay vehículos dados de baja, debe mostrar el total de vehículos
