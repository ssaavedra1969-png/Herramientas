# CHANGELOG — Sistema de Control de Mantenimiento

Cambios registrados por sesión. Última actualización: 2026-08-05.

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
