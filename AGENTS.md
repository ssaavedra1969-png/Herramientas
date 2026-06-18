# Grupo Falpat SRL — Sistema de Control de Mantenimiento

## Stack
- **Runtime:** Node.js + Express
- **Templates:** EJS
- **Database:** Firebase Firestore (project: `engaged-card-450213-d7`)
- **Auth:** Firebase Auth (Google + email/password) + session cookies
- **Frontend:** Tailwind CSS 3, Chart.js 4, SweetAlert2, PapaParse, XLSX
- **Deploy:** Vercel (`vercel --prod`) → https://herramientas-five.vercel.app

## Proyecto local
```bash
cd C:\AI\Antigravity\Herramientas
npm start           # Inicia servidor en puerto 3000
vercel --prod       # Deploy a producción
```

## Estructura
```
server.js                    # Entry point (Express + rutas)
config/firebase.js           # Admin SDK init
middleware/auth.js           # verifyToken, requireAdmin, loadUser, requireAuth
routes/
  auth.js                    # Login/session
  vehicles.js                # CRUD vehículos + combustible/repuestos subcolecciones
  tools.js                   # CRUD herramientas
  maintenance.js             # CRUD mantenimientos
  admin.js                   # Dashboard stats, reports, backup
views/
  dashboard.ejs              # Dashboard principal (tabs vehículos/herramientas)
  vehicles.ejs               # Listado vehículos + modal CRUD + import CSV/Excel
  vehicle-detail.ejs         # Detalle vehículo (combustible/repuestos)
  tools.ejs                  # Listado herramientas + modal CRUD + import CSV
  maintenance.ejs            # Listado mantenimientos + modal CRUD
  reports.ejs                # Reportes financieros
  admin.ejs                  # Gestión de usuarios
  partials/head.ejs          # Head con SDKs CDN
  partials/sidebar.ejs       # Sidebar navegación
  partials/footer.ejs        # Firebase init + auth-client.js
public/js/
  auth-client.js             # Helpers: isAdmin(), getAuthHeaders(), deleteWithBackup(), etc.
  dashboard.js               # Listeners, charts, alertas VTV, empresas
  vehicles.js                # CRUD, bulk delete, filtros, import CSV/Excel
  vehicle-detail.js          # Combustible + repuestos CRUD
  tools.js                   # CRUD, bulk delete, import CSV
  maintenance.js             # CRUD mantenimientos
  reports.js                 # Reportes financieros
  admin.js                   # Roles de usuario
```

## Firestore Collections

### `vehicles`
Campos clave: patente, interno, tipo, subtipo, marca, modelo, año, chasis, numeroMotor, capacidadCarga, kilometraje, horometro, estadoGeneral, vtv (map), seguro (map), proximoServiceKm, proximoServiceFecha, centroTrabajo, conductorHabitual, empresa, observaciones, fotoURL, multas[], documentos[]
Subcolecciones: `combustible` (fecha, litros, importe, tipo, km, proveedor), `repuestos` (fecha, pieza, costo, proveedor, tipo)

### `tools`
Campos clave: nombre, codigoInterno, tipoHerramienta, categoria, marca, modelo, numeroSerie, valorCompra, fechaCompra, proveedor, garantiaVence, estadoGeneral, ubicacionActual, responsableActual, fechaUltimoControl, proximoControl, tiempoUsoAcumulado, observaciones, fotoURL, documentoURL

### `maintenance`
Campos clave: tipo (Mecánico/Legal), vehiculoId, herramientaId, fechaRealizacion, proximaFechaVencimiento, kilometrajeHoras, descripcion, costo, responsable, estado, comprobanteURL

### `users`
Campos clave: role (Admin|Usuario), displayName, email

### `counters`
Documento único con campo `current` para auto-increment de números internos de vehículos.

## Auth y permisos
- `isAdmin()` = `currentUserData?.role === 'Admin'`
- Middleware: `verifyToken` (API), `requireAdmin` (API 403), `loadUser` (SSR global), `requireAuth` (redirect a /login), `requireAdminPage` (redirect a /dashboard)
- Primer usuario registrado se convierte automáticamente en Admin
- UI Admin-only: botones editar/eliminar, checkboxes bulk, barra bulk, cards de herramientas, import CSV, botón Nuevo

## Cambios recientes (este commit)
- **Dashboard vehículos:** cards Vehículos Activos + Empresas (con listado), alertas VTV, gráficos Combustible + Gasto por Vehículo. Eliminado: Mantenimientos por Mes, Distribución de Gastos, Últimos Movimientos, Vehículos Recientes.
- **Vehículos:** columna y filtro Sub Tipo agregados, filtro Estado eliminado.
- **Herramientas:** bulk delete con checkboxes + barra de selección + deleteSelectedTools().
- **Perfiles:** botones de eliminar/editar, checkboxes y bulk bar solo visibles para Admin.

## Patrones importantes
- **Bulk delete:** Los checkboxes se renderizan condicionalmente (`isAdmin()` en JS y `currentUserData?.role === 'Admin'` en EJS). `deleteMultipleWithBackup()` descarga backup JSON antes de eliminar.
- **Auto-increment:** `getNextVehicleNumber()` usa transacción en `counters` para generar `V-XXXXX`.
- **Real-time:** Todas las páginas usan `onSnapshot()` de Firestore, no hay recarga manual.
- **Toast + modales:** `showToast()`, `showModal()`, `hideModal()` en auth-client.js.
- **Filtros dinámicos:** `populateFilterDropdowns()` llena selects desde los datos reales de Firestore.
- **CSV/Excel import:** Usa PapaParse (CSV) y XLSX (Excel) con preview y validación de duplicados.
- **Backup defensivo:** Antes de eliminar registros, se descarga backup completo de la base.
