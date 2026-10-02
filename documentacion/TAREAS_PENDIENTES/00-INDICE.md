# TAREAS PENDIENTES — Grupo Falpat SRL

**Fecha de análisis:** 2026-07-20
**Proyecto:** Sistema de Control de Mantenimiento
**Rama:** `main` (commit `5a47629`)

## PUNTO DE RESTAURA (2026-08-06, ANTES de ejecutar P0)

- **Código (git):** tag **`pre-p0`** = commit `90c33e2` → `git checkout pre-p0` (o `git reset --hard pre-p0`)
- **Datos (Firestore):** backup `backups/backup-2026-08-06T19-14-58-661Z` (47 vehicles, 0 maintenance, 5 users)
- **Restaurar datos:**
  ```bash
  node scripts/restore-firebase.js backups/backup-2026-08-06T19-14-58-661Z
  ```
- Cada instructivo P0 incluye esta misma sección al final.

## PENDIENTES DE LA SESIÓN 2026-10-02 (ver `../Update_2026.10.02.md`)

| # | Qué falta | Por qué |
|---|-----------|---------|
| 1 | **Imprimir el reporte de Vencimientos en una hoja real** y mirarlo a distancia. | El CSS se calibró para pizarra (negro/blanco, 11pt, bordes gruesos), pero **verificar el papel es lo único que no se puede hacer desde el código**. Hay que probar también el caso de la empresa larga, que es el que parte el título del PDF en 2 líneas y recalcula el `startY` de la tabla. |
| 2 | **Revisar la card Documentación contra GitHub en producción.** | El fix de `2da46a4` cambió la fuente de verdad de los PDFs (de disco a API de GitHub) y **la caché dura 10 minutos**: si se sube un documento, el reporte puede seguir mostrando "falta" hasta que expire. Probar que `GITHUB_TOKEN` está configurado en Vercel; sin token cae al modo de a uno y son 57 requests por cache miss. |
| 3 | **Cargar en la web las fechas de vencimiento de los DNI y Registro nuevos.** | El 2026-10-02 se commitearon 10 PDF nuevos en `PATENTE/`: `AE344VR/{dni,registro}.pdf`, `AE449YW/{dni,registro}.pdf`, `AG148TK/{dni,registro}.pdf` + `cedula.pdf` optimizada (se borró el duplicado `cedula1.pdf`), `AG719US/dni.pdf`, `AG976PE/{dni,registro}.pdf`. Con eso la documentación en disco pasó de Registro 11 → **13** y de DNI 10 → **12**, y los faltantes bajaron de 160 a **156**. Pero **el archivo no carga la fecha**: el reporte de Vencimientos sigue sin verlos hasta que la fecha se cargue a mano en la ficha del vehículo (`vencimientoDNI` / `documentacion.<tipo>.fechaVencimiento`). |
| 4 | **Correr `npm run generar:control` y `npm run generar:matafuego` en la otra PC.** | Los `.xlsx` de `PATENTE/Reportes/` están ignorados por git: no viajan al repo. |

## PENDIENTES DE LA SESIÓN 2026-09-28 (ver `../Update_2026.09.28.md`)

| # | Qué falta | Por qué |
|---|-----------|---------|
| 1 | **Probar un borrado real de una obra en producción** (crear una obra de prueba, asignarle un elemento, confirmar que el `DELETE` se niega con 409, devolverlo y después eliminarla). | El camino de escritura de `DELETE /api/centros/:id` se verificó contra un `db` fake (29/29), pero **nunca se ejecutó contra Firestore real** porque `DEV_READ_ONLY=true` bloquea las escrituras en local. El 409 (la parte que protege los datos) ya está verificado. |
| 2 | **Revisar en pantalla el dashboard** con los nuevos números (28 por vencer / 25 vencidos) y la separación de vencidos. | Los conteos se simularon con los datos reales, pero no hubo revisión visual de las 4 tarjetas en el navegador. |
| 3 | **Correr `npm run generar:control` en la otra PC** antes de usar los Excel. | Los `.xlsx` están ignorados por git: no viajan al repo y hay que regenerarlos donde se los vaya a usar. |

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
| ~~1~~ | ~~`P0-Critico-Bugs/01-maintenance-campo-incorrecto.md`~~ | ~~Fix campo `numeroInterno` → `interno` en mantenimiento~~ — **OBSOLETA** (archivos eliminados en `4e71bb8`) |
| ~~2~~ | ~~`P0-Critico-Bugs/02-maintenance-filtro-incorrecto.md`~~ | ~~Fix filtro `.where('estado')` → `estadoGeneral`~~ — **OBSOLETA** (archivos eliminados en `4e71bb8`) |
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
