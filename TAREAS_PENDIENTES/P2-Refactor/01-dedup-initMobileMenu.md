# TAREA P2-1: Unificar `initMobileMenu()` duplicada

**Prioridad:** MEDIA
**Archivos afectados:**
- `public/js/auth-client.js` (líneas 371-376) — ya tiene la función
- `public/js/vehicles.js` (líneas 22-29) — duplicada
- `public/js/maintenance.js` (líneas 16-23) — duplicada
- `public/js/reports.js` (líneas 10-17) — duplicada
- `public/js/admin.js` (líneas 10-17) — duplicada
- `public/js/dashboard.js` (líneas 23-30) — duplicada

**Problema:** La misma función idéntica está definida en 6 archivos.

---

## Cambio requerido

`auth-client.js` ya tiene esta función en el listener de `DOMContentLoaded` (líneas 368-376). Como `auth-client.js` se carga en TODAS las páginas vía `footer.ejs`, la función ya está disponible globalmente.

### Pasos:

1. **Eliminar** la definición de `initMobileMenu()` de cada archivo:
   - `public/js/vehicles.js` — eliminar líneas 22-29
   - `public/js/maintenance.js` — eliminar líneas 16-23
   - `public/js/reports.js` — eliminar líneas 10-17
   - `public/js/admin.js` — eliminar líneas 10-17
   - `public/js/dashboard.js` — eliminar líneas 23-30

2. **Mover** la función `initMobileMenu()` a `auth-client.js` como función global (fuera del DOMContentLoaded):

```js
function initMobileMenu() {
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.remove('hidden');
  });
  document.getElementById('mobile-menu-backdrop')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
}
```

3. **Eliminar** el bloque de DOMContentLoaded de `auth-client.js` que solo contenía esto (líneas 368-376), ya que cada página llama `initMobileMenu()` en su propio DOMContentLoaded.

---

## Verificación

1. Navegar por todas las páginas (dashboard, vehicles, maintenance, reports, admin)
2. El menú hamburguesa en mobile debe abrir y cerrar correctamente en todas
3. No debe haber errores en consola (`initMobileMenu is not defined`)
