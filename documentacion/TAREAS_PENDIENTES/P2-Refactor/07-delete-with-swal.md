# TAREA P2-7: Reemplazar `confirm()` por SweetAlert2

**Prioridad:** BAJA
**Archivo:** `public/js/vehicle-detail.js`
**Problema:** Las funciones `deleteCombustible()` (línea 593) y `deleteRepuesto()` (línea 603) usan `confirm()` nativo del navegador en vez de SweetAlert2 que ya está cargado globalmente y se usa en el resto de la app.

---

## Cambio requerido

### `public/js/vehicle-detail.js` — Reemplazar `confirm()` con `Swal.fire()`

**ANTES (línea 593):**
```js
async function deleteCombustible(id) {
  if (!isAdmin() || !confirm('¿Eliminar esta carga de combustible?')) return;
```

**DESPUÉS:**
```js
async function deleteCombustible(id) {
  if (!isAdmin()) return;
  const result = await Swal.fire({
    title: '¿Eliminar carga de combustible?',
    text: 'Esta acción no se puede deshacer',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6B7280',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    background: '#0F1220',
    color: '#F1F3F8'
  });
  if (!result.isConfirmed) return;
```

**ANTES (línea 603):**
```js
async function deleteRepuesto(id) {
  if (!isAdmin() || !confirm('¿Eliminar este repuesto?')) return;
```

**DESPUÉS:**
```js
async function deleteRepuesto(id) {
  if (!isAdmin()) return;
  const result = await Swal.fire({
    title: '¿Eliminar repuesto?',
    text: 'Esta acción no se puede deshacer',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6B7280',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    background: '#0F1220',
    color: '#F1F3F8'
  });
  if (!result.isConfirmed) return;
```

---

## Verificación

1. Ir a detalle de vehículo con combustible registrado
2. Hacer click en eliminar → debe aparecer SweetAlert2 con el tema oscuro, no el `confirm()` nativo
3. Confirmar → se elimina
4. Cancelar → no se elimina
5. Repetir para repuestos
