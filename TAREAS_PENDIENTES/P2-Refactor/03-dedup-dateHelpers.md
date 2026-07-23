# TAREA P2-3: Unificar `setDateField()` y `getDateValue()` duplicadas

**Prioridad:** MEDIA
**Archivos afectados:**
- `public/js/vehicles.js` (líneas 275-280, 287-290)
- `public/js/vehicle-detail.js` (líneas 335-340, 342-345)

**Problema:** Funciones idénticas duplicadas en 2 archivos.

---

## Cambio requerido

1. **Agregar** ambas funciones en `public/js/auth-client.js`:

```js
function setDateField(id, val) {
  const el = document.getElementById(id);
  if (!val) { el.value = ''; return; }
  const d = val.toDate ? val.toDate() : new Date(val);
  el.value = d.toISOString().split('T')[0];
}

function getDateValue(id) {
  const val = document.getElementById(id).value;
  return val ? firebase.firestore.Timestamp.fromDate(new Date(val + 'T00:00:00')) : null;
}
```

2. **Eliminar** de `public/js/vehicles.js`:
   - `setDateField` (líneas 275-280)
   - `getDateValue` (líneas 287-290)

3. **Eliminar** de `public/js/vehicle-detail.js`:
   - `setDateField` (líneas 335-340)
   - `getDateValue` (líneas 342-345)

---

## Verificación

1. Editar vehículo desde la lista `/vehicles` → fechas deben cargar correctamente
2. Editar vehículo desde detalle `/vehicle/:id` → fechas deben cargar correctamente
3. Crear/editar mantenimiento → fechas deben funcionar
4. No errores en consola
