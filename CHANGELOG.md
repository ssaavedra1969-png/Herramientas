# CHANGELOG — Sistema de Control de Mantenimiento

Cambios registrados por sesión. Última actualización: 2026-08-06.

## 2026-08-06 — Ficha de Service para el Taller + P3 Cosmético (branding y logo)

### Ficha de Service imprimible (commit `88a32b1`)
- Nueva vista `views/fichas-taller-bulk.ejs` + ruta `GET /vehicles/fichas-taller-bulk` (`server.js`) + acceso **"Fichas Taller"** en el sidebar (solo Admin).
- Ficha A4 para imprimir/llenar a mano: header degradado con logo, patente manual, checklist de 16 services + "Otro/Reparación", VTV con 2 fechas, observaciones y firmas.
- Logo `public/images/fp.png`.

### P3 Cosmético (commit `002db52`)
- **P3-1**: copyright 2024 → 2026 (`views/login.ejs`).
- **P3-3**: branding unificado **"Grupo Falpat SRL"** en sidebar y menú móvil.
- **P3-4**: `logo.svg` con colores del tema (`#6C3CE1` → `#00D4FF`).
- **Logo 3D transparente**: `public/images/fp3d.png` generado desde `fp1.png` (fondo blanco recortado, relieve emboss, acabado perla metálico + sombra suave), aplicado en login, sidebar y menú móvil. Favicon `favicon.png` (64 px) desde el mismo logo.

### Commits
- `88a32b1` Feat: ficha de service imprimible para el taller (Fichas Taller)
- `002db52` Feat(P3): branding unificado Grupo Falpat SRL, copyright 2026, logo 3D transparente y favicon

### Deploys (Vercel, producción)
- `88a32b1` → deploy `HvTJWudSEXe2ZTic4f7wyhzdcV4y` (Ready)
- `002db52` → deploy `cinR94g1cPtwfxm9K8cUqBcmrf5e` (Ready)
- Alias de producción: https://falpat-control-de-vehiculos.vercel.app

### Resguardo
- Sin cambios de datos en Firestore (solo vistas y assets). No se requirió backup.

## 2026-08-05 — Fix rendimiento: se eliminó el polling de "Últimos Services"

- **Problema**: la sección "Últimos Services" recargaba con `setInterval` cada 30 s, disparando ~300 lecturas de Firestore por fetch (~36.000 lecturas/hora con el dashboard abierto).
- **Solución** (`public/js/dashboard.js`, `routes/admin.js`):
  - Se eliminó el `setInterval` de 30 s. Ahora la sección se refresca **solo cuando cambian los datos**: el snapshot real-time de vehículos dispara la recarga con un debounce de 800 ms (cubre edición/alta de services en cualquier pestaña).
  - **Caché en servidor** con TTL de 30 s (`LATEST_SERVICES_TTL`) en `GET /api/admin/latest-services`: si ya se respondió hace <30 s, no vuelve a golpear Firestore.
  - Sin cambios en los datos = 0 lecturas por parte de esta sección.

### Commits
- `b81f89b` Fix rendimiento: eliminar polling en ultimos services, usar snapshot + cache TTL 30s en servidor
- `06fd16b` Remover contador temporal de medicion en latest-services

### Deploys (Vercel, producción)
- `b81f89b` → deploy `3k8eg2xq2` (Ready)

### Resguardo
- Backup local en `backups/backup-2026-08-05T21-17-24.json` (vehicles: 47, maintenance: 0, users: 5). Nota: `backups/` está en `.gitignore`, no se sube a git.

### Resguardo
- Mismo backup del cierre de día: `backups/backup-2026-08-05T17-29-12-051Z`.

## 2026-08-05 — Sección "Últimos Services" en Dashboard

- **Nueva sección** en `views/dashboard.ejs` + `public/js/dashboard.js` + `routes/admin.js` + `public/css/styles.css`:
  - Muestra los vehículos con actividad de service más reciente (**un vehículo por fila**, ordenados por fecha del último service).
  - Diseño tipo timeline con línea gradiente, puntos brillantes, animación escalonada de entrada y hover glow.
  - Al hacer clic se despliega un **acordeón** (uno a la vez) con la **lista de services realizados** de ese vehículo (tipo, fecha, km, proveedor, letra chica).
  - Botón **"Ver vehículo completo →"** dentro del panel (opcional, no navega directo).
  - Badge contador de vehículos y tiempo relativo ("hace 2 d", "ayer").
- **Endpoint nuevo** `GET /api/admin/latest-services` (`routes/admin.js`): agrega los últimos 5 services de cada vehículo activo (no Baja) y devuelve los 10 vehículos con actividad más reciente.

### Commits
- `950866f` Feat sección Últimos Services en dashboard con acordeón por vehículo

### Resguardo
- Backup local en `backups/backup-2026-08-05T17-29-12-051Z` (vehicles: 47, maintenance: 0, users: 5). Nota: `backups/` está en `.gitignore`, no se sube a git.

## 2026-08-05 — Versión móvil + vista pública QR

- **Vista pública QR** (`views/vehicle-qr-public.ejs`, `server.js`):
  - Se eliminó la sección "Estado Operativo" (kilometraje, horómetro, VTV, seguro, trompo).
  - Se agregó la sección **Chofer** (chofer, DNI, registro, centro de trabajo). Empresa se mantiene en la ficha del vehículo.
  - Se agregó **"Próximos Services"** con desglose por tipo de service (desde `serviceSummary`, ordenado por `proximoKm`).
  - Se agregó **"Últimos movimientos"** con los últimos 5 services y 5 repuestos (fecha, km, badge Service/Repuesto).
  - `server.js` ahora carga subcolecciones services/repuestos al renderizar la vista.
- **Responsividad móvil**:
  - `vehicle-qr-public.ejs`: viewport sin `user-scalable=no` (zoom por pellizco habilitado); inputs de 15px → 16px (evita auto-zoom iOS).
  - `vehicle-detail.ejs`: botón "Título" pasa de `hidden` a `hidden sm:inline-flex` (visible desde 640px).
  - `public/css/styles.css`: `#qrcode canvas/img` y `#barcode-svg` con `max-width:100%; height:auto`.
- **Fix buscador de vehículos** (`public/js/vehicles.js`): cada snapshot de Firestore re-renderizaba todos los vehículos ignorando el filtro activo; ahora usa `applyFilters()`.
- **Vistas del historial** (`public/js/vehicle-detail.js`, `vehicle-detail.ejs`): línea de tiempo, sección, mes y proveedor.
- **Fix crash** en `editService` cuando el tipo de service no tiene fluido asociado.

### Commits
- `73773a5` Fix crash en editService
- `6e547d0` Feat vistas del historial
- `b13c10d` Fix filtro/búsqueda de vehículos
- `d0d42e6` Feat versión móvil + vista QR con próximos services y últimos movimientos
- `ce0a8dc` Fix vista QR: quitar Estado Operativo, agregar sección Chofer

### Deploys (Vercel, producción)
- `d0d42e6` → deploy `c5k5sauh4` (Ready)
- `ce0a8dc` → deploy automático (Ready)
- Alias de producción: https://falpat-control-de-vehiculos.vercel.app

### Resguardo
- Backup local en `backups/backup-2026-08-05T14-41-00-710Z` (vehicles: 47, maintenance: 0, users: 5). Nota: `backups/` está en `.gitignore`, no se sube a git.
