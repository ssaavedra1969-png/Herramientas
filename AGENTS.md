# Grupo Falpat SRL — Sistema de Control de Mantenimiento

## REGLAS CRITICAS — ANTES DE CUALQUIER TAREA

Este proyecto se desarrolla en paralelo en 2 PC. VIOLAR ESTAS REGLAS GENERA PERDIDA DE CAMBIOS.

### Sincronización (SIEMPRE hacer esto antes de editar)

```
git stash && git pull origin main && git stash pop
```

Si hay conflictos: resolver manualmente (mirar qué línea quedó de cada lado), luego `git add .` y `git commit`.

### Reglas

1. **SIEMPRE git pull ANTES de editar.** Ejecutar el comando de sincronización de arriba antes de tocar cualquier archivo.
2. **NUNCA commitear/pushear sin confirmar.** Si el usuario dice "probar en local", solo iniciar servidor. NO commitear.
3. **Si el repo tiene cambios nuevos, AVISAR** antes de seguir. No asumir que el código local es el más reciente.
4. **NUNCA sobreescribir producción.** No hacer cambios en archivos compartidos sin pull previo.
5. **Si el usuario dice "volvió atras"**: NO intentar arreglar rápido. Hacer `git log` y explicar qué pasó.

### Hook pre-commit

Si el hook detecta que el branch está desactualizado, bloquea el commit. Hacer `git pull origin main` antes de commitear. Para saltar el hook (NO recomendado): `git commit --no-verify`.

### Rutina diaria (INICIO y CIERRE de cada sesión)

**Al INICIAR sesión (antes de tocar archivos):**
```bash
git pull origin main
npm start
```

**Al CERRAR sesión (antes de irse):**
```bash
git add .
git commit -m "descripcion"
git push origin main
```

Si el push falla: `git pull origin main` y repetir el push.

La IA SIEMPRE debe ejecutar `git pull origin main` al inicio de cada sesión.

Archivo completo de reglas: `GUIA-INSTALACION.txt` (sección "ANEXO — REGLAS PARA IA")

## Stack
- **Runtime:** Node.js + Express
- **Templates:** EJS
- **Database:** Firebase Firestore (project: `engaged-card-450213-d7`)
- **Auth:** Firebase Auth (Google + email/password) + session cookies
- **Frontend:** Tailwind CSS 3, Chart.js 4, SweetAlert2, PapaParse, XLSX
- **Deploy:** Vercel (`vercel --prod`) → https://falpat-control-de-vehiculos.vercel.app

## Proyecto local
```bash
cd "C:\AI\Antigravity\FALPAT srl\Falpat Herramientas"
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
  maintenance.js             # CRUD mantenimientos
  admin.js                   # Dashboard stats, reports, backup
views/
  dashboard.ejs              # Dashboard principal
  vehicles.ejs               # Listado vehículos + modal CRUD + import CSV/Excel
  vehicle-detail.ejs         # Detalle vehículo (combustible/repuestos)
  maintenance.ejs            # Listado mantenimientos + modal CRUD
  reports.ejs                # Reportes financieros
  admin.ejs                  # Gestión de usuarios
  partials/head.ejs          # Head con SDKs CDN
  partials/sidebar.ejs       # Sidebar navegación
  partials/footer.ejs        # Firebase init + auth-client.js
public/js/
  auth-client.js             # Helpers: isAdmin(), getAuthHeaders(), deleteWithBackup(), etc.
  dashboard.js               # Dashboard: clock, search, modales alertas, fleet health, empresas, alertas VTV/choferes
  vehicles.js                # CRUD, bulk delete, filtros, import CSV/Excel (modal edit NO cierra con click afuera)
  vehicle-detail.js          # Combustible + repuestos CRUD (sin backdrop click-to-close en modal)
  maintenance.js             # CRUD mantenimientos
  reports.js                 # Reportes financieros
  admin.js                   # Roles de usuario
scripts/
  subir-documentos.js        # Sube la carpeta PATENTE/ a producción (pull+add+commit+push) → npm run subir:docs
PATENTE/
  {patente}/{tipo}.ext        # Documentos obligatorios versionados (fuente leída por la app en Vercel)
```

## Firestore Collections

### `vehicles`
Campos clave: patente, interno, tipo, subtipo, marca, modelo, año, chasis, numeroMotor, capacidadCarga, kilometraje, horometro, estadoGeneral, vtv (map), seguro (map), proximoServiceKm, proximoServiceFecha, centroTrabajo, conductorHabitual, empresa, observaciones, fotoURL, multas[], documentos[]
Subcolecciones: `combustible` (fecha, litros, importe, tipo, km, proveedor), `repuestos` (fecha, pieza, costo, proveedor, tipo)

### `maintenance`
Campos clave: tipo (Mecánico/Legal), vehiculoId, fechaRealizacion, proximaFechaVencimiento, kilometrajeHoras, descripcion, costo, responsable, estado, comprobanteURL

### `users`
Campos clave: role (Admin|Usuario), displayName, email

### `counters`
Documento único con campo `current` para auto-increment de números internos de vehículos.

## Auth y permisos
- `isAdmin()` = `currentUserData?.role === 'Admin'`
- Middleware: `verifyToken` (API), `requireAdmin` (API 403), `loadUser` (SSR global), `requireAuth` (redirect a /login), `requireAdminPage` (redirect a /dashboard)
- Primer usuario registrado se convierte automáticamente en Admin
- UI Admin-only: botones editar/eliminar, checkboxes bulk, barra bulk, import CSV, botón Nuevo

## Patrones importantes
- **Bulk delete:** Los checkboxes se renderizan condicionalmente (`isAdmin()` en JS y `currentUserData?.role === 'Admin'` en EJS). `deleteMultipleWithBackup()` descarga backup JSON antes de eliminar.
- **Auto-increment:** `getNextVehicleNumber()` usa transacción en `counters` para generar `V-XXXXX`.
- **Real-time:** Todas las páginas usan `onSnapshot()` de Firestore, no hay recarga manual.
- **Toast + modales:** `showToast()`, `showModal()`, `hideModal()` en auth-client.js.
- **Filtros dinámicos:** `populateFilterDropdowns()` llena selects desde los datos reales de Firestore.
- **CSV/Excel import:** Usa PapaParse (CSV) y XLSX (Excel) con preview y validación de duplicados.
- **Backup defensivo:** Antes de eliminar registros, se descarga backup completo de la base.

## Documentación obligatoria por vehículo

La documentación (Título, Cédula, Seguro, Registro del chofer) se maneja con la **carpeta `PATENTE/{patente}/`** versionada en git, que llega a Vercel por integración Git. **NO usa Firebase Storage** (plan Spark = sin Storage, 404 bucket).

### Cómo funciona
- **Archivos:** se ponen en `PATENTE/{patente}/` con el nombre del tipo: `titulo`, `cedula`, `seguro`, `registro`, `vtv` (solo patente, sin sufijo). Un archivo por tipo, prioridad de extensión `pdf > jpg > jpeg > png`. (Ej. `PATENTE/AG719TT/seguro.pdf`).
- **Los 5 tipos** se leen. El vencimiento de la fila VTV sale del campo `vtv` del vehículo; los demás del mapa `documentacion` (carga manual en la web).
- **Eliminación:** botón "Eliminar" en la ficha (solo Admin) → `DELETE /api/vehicles/:id/documentos/:tipo` (routes/vehicles.js), descarga copia de respaldo antes de borrar. En Vercel el FS es de solo lectura: borrar localmente + `npm run subir:docs`.
- **Las carpetas vacías NO se versionan en git** (git ignora carpetas vacías); se suben solas cuando tienen archivos.
- **Vencimiento:** se carga **MANUALMENTE** en la web (ficha del vehículo → Documentación). La app NO lee la fecha del PDF (se decidió abandonar la detección automática).
- **Lectura backend:** `GET /api/vehicles/:id/documentos` (routes/vehicles.js) lista los archivos de `PATENTE/{patente}/`; static `/documentos` en server.js sirve los archivos.

### Cómo subir documentos a producción (carga masiva)
1. Poné cada PDF en `PATENTE/{patente}/` en la PC local.
2. Cargá la fecha de vencimiento en la web (por vehículo).
3. En terminal, corré **un solo comando**:
   ```
   npm run subir:docs
   ```
   El script (`scripts/subir-documentos.js`) hace `git pull origin main` → detecta qué vehículos se tocaron → `git add PATENTE/` → `git commit` → `git push origin main`. Solo toca la carpeta `PATENTE/` (no commitea código).
4. Vercel despliega automáticamente (~1-2 min).

### Nota crítica
- **Storage no disponible** (no intentar migrar a Firebase Storage; el bucket no existe en el plan gratuito).
- `config/firebase.js`: el Admin SDK local necesita `projectId: sa.project_id` explícito.
- `titulo/` (41 PDFs) es el patrón previo de versionado que replicó `PATENTE/`.

