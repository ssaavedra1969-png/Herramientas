# TAREAS PENDIENTES — Grupo Falpat SRL

**Fecha de análisis:** 2026-07-20
**Proyecto:** Sistema de Control de Mantenimiento
**Rama:** `main` (commit `5a47629`)

## Cómo usar esta carpeta

Cada archivo `.md` es una tarea independiente con:
- **Descripción** del problema
- **Archivos afectados** con líneas exactas
- **Instrucciones paso a paso** para resolverla
- **Verificación** de que quedó correcto

Ejecutar las tareas en orden de prioridad: P0 → P1 → P2 → P3.

---

## P0 — CRÍTICO (Bugs que rompen funcionalidad)

| # | Archivo | Tarea |
|---|---------|-------|
| 1 | `P0-Critico-Bugs/01-maintenance-campo-incorrecto.md` | Fix campo `numeroInterno` → `interno` en mantenimiento |
| 2 | `P0-Critico-Bugs/02-maintenance-filtro-incorrecto.md` | Fix filtro `.where('estado')` → `estadoGeneral` |
| 3 | `P0-Critico-Bugs/03-dashboard-vehiculos-activos.md` | Fix filtro `estado === 'Activo'` → `estadoGeneral !== 'Baja'` |

## P1 — SEGURIDAD

| # | Archivo | Tarea |
|---|---------|-------|
| 1 | `P1-Seguridad/01-eliminar-debug-endpoint.md` | Eliminar `GET /api/auth/debug` sin auth |
| 2 | `P1-Seguridad/02-cerrar-cors.md` | Restringir CORS al dominio de Vercel |
| 3 | `P1-Seguridad/03-admin-promotion-transaccion.md` | Mover auto-promoción Admin a transacción server-side |
| 4 | `P1-Seguridad/04-maintenance-post-auth.md` | Unificar auth en POST maintenance con `requireAdmin` |
| 5 | `P1-Seguridad/05-admin-routes-auth.md` | Agregar `requireAdmin` a endpoints admin-only |

## P2 — REFACTOR (Calidad de código y performance)

| # | Archivo | Tarea |
|---|---------|-------|
| 1 | `P2-Refactor/01-dedup-initMobileMenu.md` | Unificar `initMobileMenu()` duplicada en 6 archivos |
| 2 | `P2-Refactor/02-dedup-setupModalClose.md` | Unificar `setupModalClose()` duplicada en 3 archivos |
| 3 | `P2-Refactor/03-dedup-dateHelpers.md` | Unificar `setDateField()`/`getDateValue()` duplicadas |
| 4 | `P2-Refactor/04-dedup-auth-promotion.md` | Extraer lógica de promoción Admin a función compartida |
| 5 | `P2-Refactor/05-refactor-admin-routes.md` | Eliminar duplicación en `routes/admin.js` (~300 líneas) |
| 6 | `P2-Refactor/06-cache-busting.md` | Reemplazar `Date.now()` por hash en footer.ejs |
| 7 | `P2-Refactor/07-delete-with-swal.md` | Reemplazar `confirm()` por SweetAlert2 en vehicle-detail.js |
| 8 | `P2-Refactor/08-remove-console-logs.md` | Limpiar `console.log` de producción |
| 9 | `P2-Refactor/09-dedup-print-css.md` | Eliminar bloque `@media print` duplicado en styles.css |
| 10 | `P2-Refactor/10-npm-ci-limpiar.md` | Ejecutar `npm ci` para limpiar paquetes extraneos |

## P3 — COSMÉTICO (Texto, UI, branding)

| # | Archivo | Tarea |
|---|---------|-------|
| 1 | `P3-Cosmetico/01-copyright-2026.md` | Actualizar copyright 2024 → 2026 |
| 2 | `P3-Cosmetico/02-boton-csv-a-excel.md` | Cambiar texto "Exportar CSV" → "Exportar Excel" |
| 3 | `P3-Cosmetico/03-branding-consistente.md` | Unificar "Falpat SRL" vs "Grupo Falpat SRL" |
| 4 | `P3-Cosmetico/04-logo-theme-match.md` | Revisar consistencia de colores del logo.svg |
