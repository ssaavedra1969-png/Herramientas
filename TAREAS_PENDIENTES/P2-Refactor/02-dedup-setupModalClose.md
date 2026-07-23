# TAREA P2-2: Unificar `setupModalClose()` duplicada

**Prioridad:** MEDIA
**Archivos afectados:**
- `public/js/vehicles.js` (líneas 31-35)
- `public/js/maintenance.js` (líneas 25-29)
- `public/js/admin.js` (líneas 19-23)

**Problema:** La misma función está duplicada en 3 archivos.

---

## Cambio requerido

1. **Agregar** `setupModalClose()` como función global en `public/js/auth-client.js`:

```js
function setupModalClose(modalId) {
  document.getElementById(modalId)?.addEventListener('click', (e) => {
    if (e.target === document.getElementById(modalId)) hideModal(modalId);
  });
}
```

2. **Eliminar** la definición de `setupModalClose()` de:
   - `public/js/vehicles.js` — eliminar líneas 31-35
   - `public/js/maintenance.js` — eliminar líneas 25-29
   - `public/js/admin.js` — eliminar líneas 19-23

---

## Verificación

1. Abrir y cerrar modales en vehicles, maintenance, admin
2. Click fuera del modal debe cerrarlo
3. No errores en consola
