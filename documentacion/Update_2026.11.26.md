# Update 2026-11-26 — Fixes UI/permisos, auditoría de docs y deploy

## Resumen

Sesión de puesta al día y correcciones menores. Se auditó la app en modo lectura (documentación, backend, frontend, scripts/tests), se corrigieron 4 hallazgos concretos de UI/permisos, se actualizó documentación y se desplegó a producción. No se tocaron datos de Firestore, no se aplicó `stash@{0}`, no se modificó `PATENTE/`.

## Estado de git/deploy

- **Inicio**: `HEAD == origin/main == ce283fb` (handoff 11-25 ya deployado).
- **Durante sync**: `origin/main` había avanzado con docs de `PATENTE/` (`8b74082..9dce0aa`, `d3c0daa`, `022a2cb`) y 4 PDFs locales sin trackear eran byte-idénticos al remoto; se respaldaron en temp y se hizo fast-forward/rebase con `--autostash`.
- **Commit final**: `ae9ec74a3b833757698222acdfef33bd33a583fb` — "Fix: auth plantilla Excel, mobile centros y permisos UI".
- **Push**: `origin/main == HEAD == ae9ec74`. Vercel desplegó automáticamente por push a `main`.
- **Verificación prod**: `/js/command-palette.js?v=ae9ec74` contiene `/informes`; `/js/vehicles.js?v=ae9ec74` contiene `getAuthHeaders()` en la plantilla Excel.
- **Working tree pendiente** (no commiteado, ajeno a esta sesión): borrados/modificados en `PATENTE/*/BACKUP/seguro_al ...pdf`, `PATENTE/AH052ZE/registro.pdf`, `PATENTE/AE449YW/vtv.pdf`, y `?? PATENTE/Vtos/BACKUP/`.

## Cambios de código

| Archivo | Cambio | Motivo |
|---|---|---|
| `public/js/vehicles.js:1033` | `fetch('/api/vehicles/template/excel', { headers: await getAuthHeaders() })` | La ruta `GET /api/vehicles/template/excel` exige `verifyToken` (`routes/vehicles.js:754`); sin header devolvía 401. |
| `views/centros.ejs` | Se incluyó `partials/mobile-menu.ejs` antes de los scripts | `centros.js` esperaba `#mobile-menu` / `#mobile-menu-backdrop`; la vista solo tenía el botón. |
| `views/partials/sidebar.ejs` | `Reportes` envuelto en `<% if (isAdmin) { %>` | `/reports` ya es `requireAuth + requireAdminPage`; la UI no debe mostrarlo a `Usuario`. |
| `views/partials/mobile-menu.ejs` | `Reportes` envuelto en guard Admin | Misma razón; paridad desktop/móvil. |
| `public/js/command-palette.js` | `Reportes` movido de `NAV` a `ADMIN_NAV`; agregado `/informes` a `ADMIN_NAV` | `navVisible()` ya filtra por rol; `/informes` faltaba en la paleta. |
| `public/js/reports.js:1196-1199` | Comentario corregido a "próximos hasta 90 días, excluye vencidos" | El código real (`lib/informe-vencimientos.js:120`, `routes/admin.js`) usa ventana default 90 y excluye `dias < 0`. |
| `views/vehicles.ejs:851-852` | jsPDF fijado a `2.5.1` / `jspdf-autotable 3.8.2` | Antes usaba `@latest`; se alineó con las otras vistas. |

## Cambios de documentación

- `AGENTS.md`: ruta local `Herramientas`; deploy por push a `main`; `npm start = node start.js`; aviso de stash viejo en inicio de sesión; `maintenance.js/ejs` removidos de estructura; conteos de tests actualizados (10 suites / 296 checks); registro de sesión 11-25; nota de `firestore.rules` maintenance huérfano.
- `documentacion/README.md`: descripción del handoff 11-25 actualizada con `ce283fb`.
- `documentacion/CHANGELOG.md`: agregadas entradas 2026-11-26 y 2026-11-25.
- `tests/README.md`: actualizado de 4 suites / 105 checks a 10 suites / 296 checks.
- `documentacion/Update_2026.11.26.md`: este archivo.

## Verificación

- `node --check`: OK en `public/js/vehicles.js`, `public/js/reports.js`, `public/js/command-palette.js`.
- `ejs.compile`: OK en `views/centros.ejs`, `views/partials/sidebar.ejs`, `views/partials/mobile-menu.ejs`, `views/vehicles.ejs`.
- `npm test`: **296 OK, 0 FAIL** (10 suites: escrituras 47, negocio 39, numeracion 16, import 17, deshabilitado 30, inventario 21, informes 42, flota 40, github 9, empleados 35).
- Producción: checks por URL con `?v=ae9ec74`.

## Hallazgos documentados (no corregidos en código)

- `firestore.rules:41-45` mantiene el bloque `match /maintenance/{document=...}`; el módulo maintenance fue fusionado en `vehicles/{id}/services`. **No se tocó**: cambiar reglas requiere `scripts/deploy-rules.js` y escribe en producción.
- `*-firebase-adminsdk-*.json` existe en la raíz pero está cubierto por `.gitignore:7` y no está trackeado (`git ls-files` vacío). No se borró por paths hardcodeados en scripts.
- `tests/README.md` anterior decía 4 suites/105; `AGENTS.md` tenía 285 en un punto. Quedaron alineados a 296/10.
- El deploy manual `vercel --prod` puede devolver "Not authorized" aunque `vercel whoami` funcione; el flujo confiable es `git push origin main`.
- `DEV_READ_ONLY=true` es middleware en `/api/`, no bloqueo de Firestore: un harness que monte rutas sin él y con `db` real puede escribir en producción.
- `npm test` usa Firestore falso; no reemplaza verificación visual ni validación con datos reales.

## No realizado / fuera de alcance

- No se ejecutó `npm run subir:docs` ni se commitearon cambios de `PATENTE/`.
- No se tocaron reglas de Firestore en producción.
- No se modificó el flujo Empleados → espejos (confirmado OK por el usuario).
- No se aplicó `stash@{0}`.
- No se borraron service account JSON de la raíz.

## Comandos de referencia

```powershell
git pull origin main
git status --short
npm test
node --check public/js/vehicles.js public/js/reports.js public/js/command-palette.js
# deploy: git push origin main
```