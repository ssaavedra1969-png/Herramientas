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

La documentación (Título, Cédula, Seguro, Registro del chofer, DNI del chofer, VTV) se maneja con la **carpeta `PATENTE/{patente}/`** versionada en git, que llega a Vercel por integración Git. **NO usa Firebase Storage** (plan Spark = sin Storage, 404 bucket).

### Cómo funciona
- **Archivos:** se ponen en `PATENTE/{patente}/` con el nombre del tipo: `titulo`, `cedula`, `seguro`, `registro`, `vtv`, `dni` (solo patente, sin sufijo). Un archivo por tipo, prioridad de extensión `pdf > jpg > jpeg > png`. (Ej. `PATENTE/AG719TT/seguro.pdf`).
- **Los 6 tipos** se leen. El vencimiento de la fila VTV sale del campo `vtv` del vehículo; Seguro del campo `seguro`, Registro de `vencimientoRegistro`, DNI de `vencimientoDNI`; los demás del mapa `documentacion` (carga manual en la web).
- **Subida manual desde la web (Admin):** botón "Subir" en cada slot → `POST /api/vehicles/:id/documentos/:tipo/upload` (routes/vehicles.js). Guarda el archivo en la sub-collección `docsadjuntos/{tipo}` (como bytes) y el metadata en el campo `docsAdjuntos.{tipo}` del vehículo. Límite 700KB (1MB por doc Firestore, plan Spark). PDF/JPG/PNG. El subido PRIORIZA sobre el de la carpeta. Lectura autenticada: `GET /api/vehicles/:id/documentos/adjunto/:tipo` (frontend usa `abrirDocumento(key)`).
- **Eliminación:** botón "Eliminar" en la ficha (solo Admin) → `DELETE /api/vehicles/:id/documentos/:tipo` (routes/vehicles.js), descarga copia de respaldo antes de borrar; borra el archivo de carpeta Y el subido si existen. En Vercel el FS es de solo lectura: borrar localmente + `npm run subir:docs`.
- **Las carpetas vacías NO se versionan en git** (git ignora carpetas vacías); se suben solas cuando tienen archivos.
- **Vencimiento:** se carga **MANUALMENTE** en la web (ficha del vehículo → Documentación). La app NO lee la fecha del PDF (se decidió abandonar la detección automática).
- **Lectura backend:** `GET /api/vehicles/:id/documentos` (routes/vehicles.js) lista los archivos de `PATENTE/{patente}/` más los subidos en Firestore; static `/documentos` en server.js sirve los archivos de la carpeta.

### Cómo subir documentos a producción (carga masiva)
1. Poné cada PDF en `PATENTE/{patente}/` en la PC local.
2. Cargá la fecha de vencimiento en la web (por vehículo).
3. En terminal, corré **un solo comando**:
   ```
   npm run subir:docs
   ```
   El script (`scripts/subir-documentos.js`) hace `git pull origin main` → detecta qué vehículos se tocaron → `git add PATENTE/` → `git commit` → `git push origin main`. Solo toca la carpeta `PATENTE/` (no commitea código).
4. Vercel despliega automáticamente (~1-2 min).

### Subir documentos desde la Web (botón "Publicar Documentos", cualquier PC)

Desde la app web (producción o local) el Admin puede subir documentos **sin tocar git** ni la PC local, con el botón **Utilidades → Publicar Documentos** (solo Admin):

- **Qué hace:** sube PDFs directamente a GitHub (a `PATENTE/{patente}/{tipo}.pdf`) vía la **GitHub Contents API**, usando un token. Al subir un tipo, **borra los obsoletos** del mismo tipo (ej. al subir `cedula.pdf` borra `cedula.jpeg`, `cedula1.jpeg`). El commit llega a `main` y Vercel redespliega solo.
- **Endpoint:** `POST /api/vehicles/documentos/publicar-github` (routes/vehicles.js, `verifyToken` + `requireAdmin`). Recibe JSON `{ archivos: [{ patente, tipo, base64 }] }`. El nombre del archivo en el frontend define el `tipo` (titulo/cedula/seguro/registro/vtv/dni).
- **Frontend:** botón en `views/partials/sidebar.ejs` (submenú Utilidades, solo `isAdmin`) + `public/js/publicar-documentos.js` (modal con patente + multi-PDF, base64 via `getAuthHeaders()`). Se carga en `views/partials/footer.ejs`.
- **Token:** `process.env.GITHUB_TOKEN` (var de entorno). Existe en **Vercel `production`** y en `.env` local (NO se commitea, está en `.gitignore`). Repo: `process.env.GITHUB_REPO` (default `ssaavedra1969-png/Herramientas`). Crear token en GitHub → Settings → Developer settings → **Fine-grained tokens** → solo repo `Herramientas` → `Contents: Read and write`.
- **`devReadOnly`**: el endpoint está **exento** en `middleware/dev-readonly.js` porque NO escribe en Firestore (solo llama a GitHub), así que funciona en local `DEV_READ_ONLY=true`.
- **CORS:** `server.js` permite `http://localhost:3000` **siempre** (no depende de `NODE_ENV`), porque el `.env` local usa `NODE_ENV=production` y sin esto los fetch locales fallan con 500 por CORS.
- **Límites/validaciones:** solo Admin, solo los 6 tipos, solo `.pdf` (el frontend acepta PDF), máx 2MB/archivo, máx 20 archivos, patente 4-10 alfanumérica.
- ⚠️ El botón crea/actualiza el `.pdf` en GitHub, pero **no borra archivos en la PC local** ni hace `git add`/commit local del código. Para alinear la PC local con lo que subió el botón, correr `git pull origin main` (los PDFs que el botón subió llegan así al working tree local).

### Nota crítica
- **Storage no disponible** (no intentar migrar a Firebase Storage; el bucket no existe en el plan gratuito).
- `config/firebase.js`: el Admin SDK local necesita `projectId: sa.project_id` explícito.
- `titulo/` (41 PDFs) es el patrón previo de versionado que replicó `PATENTE/`.

## Registro de cambios recientes (para puesta al día de IA)

Último commit: `bff219a` (todo pusheado, working tree limpio).

- **Botón "Publicar documentos" desplegado a producción** (commit `bff219a`): sube PDFs optimizados a GitHub vía la GitHub Contents API con token `GITHUB_TOKEN` (configurado en Vercel production y `.env` local), sin tocar git ni la PC local. Fix CORS para permitir `http://localhost:3000` siempre. Ver sección "Subir documentos desde la Web (botón Publicar Documentos)".
- **Docs**: AH125AG cédula optimizada (2 págs verticales, legibilidad), AI484IB título, AG469YL cédula (commit `d3a5d51`).

- **Herramienta "Optimizaciones" integrada al menú** (commit `9a623eb`): menú **Utilidades → Optimizar Adjuntos** abre el optimizador local (`OPTIMIZADOR_URL`, default `http://localhost:8642`, inyectada en `middleware/auth.js`). `.gitignore` ahora excluye `**/_originales/`. Ver sección "Optimizaciones — herramienta de adjuntos (FUERA del repo)".
- **Docs**: AE192RO vtv optimizado (3,1 MB → 1,14 MB, -63%) y PCS413 cedula estandarizada (commit `af33acd`).

- **Página pública del QR del vehículo (`vehicle-qr-public.ejs`)** — vista móvil que abre quien escanea el QR pegado al camión (ruta `GET /vehicle/:id/qr` en server.js, **pública, sin auth**). Se rediseñó para el usuario común: header con logo Falpat (`/images/fp3d.png` reemplazó al icono de camioncito), sección **Vencimientos** (VTV, Seguro, Service, Matafuego con días restantes/estado de color, se pasa el array `vencimientos` desde el server), y sección **Documentos del vehículo** al final (solo Cédula, Seguro y VTV, solo lectura, enlaces a `/documentos/{patente}/{archivo}`). El server calcula los vencimientos y escanea la carpeta `PATENTE/` (helper `scanDocsCarpeta(patente)` local en server.js, docs del folder = públicos; los subidos manualmente NO se muestran acá porque requieren auth).
- **Ficha interna móvil (`vehicle-detail.ejs` + `public/js/vehicle-detail.js`)** — agregado hero mobile con logo Falpat + chips de vencimientos (VTV/Seguro/Service) y sección "Documentos del vehículo" al final solo en mobile (`md:hidden`). Desktop sin cambios.
- **Menú "Utilidades"** desplegable (sidebar + menú móvil): agrupa Escáner QR, Stickers QR y Fichas Taller; scanner marca `?pagina=scan`.
- **Reports re-diseñado** (commit `436140f`): reporte de flota con filtros por cualquier campo, sección documentación, export Excel/PDF, endpoint `/api/admin/report/flota`.
- **Docs**: se agregó el 6to documento obligatorio **DNI del chofer** (commit `4164361`): slot DNI en modal, vencimiento atado a `vencimientoDNI`, upload/lectura/eliminación de subidos, reportes/import/export con DNI.

### Quirks importantes (no repetir errores)
- **Pre-commit hook**: bloquea el commit si `HEAD != origin/main`, lo que incluye estar ADELANTADO (commits locales sin pushear). No es un error real: la alerta dice "DESACTUALIZADO" pero aplica también cuando quedaron commits sin pushear. Solución: `git push origin main` del commit pendiente ANTES de commitear de nuevo. Verificar con: `git rev-parse HEAD` vs `git rev-parse origin/main`.
- **Deploy por `vercel --prod --yes` NO equivale a pushear git**: producción siempre quedó al día, pero origin quedó atrás (commit `a1176ec` estuvo solo en Vercel). Al cerrar sesión, chequear que `origin/main == HEAD`.
- **Server local**: `node server.js` NO recarga en caliente cambios de server.js/rutas (solo vistas y estáticos). Tras tocar rutas: matar el proceso del puerto 3000 (`Get-NetTCPConnection -LocalPort 3000`) y relanzar `node server.js` (o `npm run dev` = `node --watch server.js`). Vistas `.ejs` y `public/` se ven al refrescar.
- **`DEV_READ_ONLY=true` en `.env`**: en local TODAS las escrituras a Firestore están bloqueadas (usa la misma base que producción). Revisar antes de "probar" funciones de guardado.

## Optimizaciones — herramienta de adjuntos (FUERA del repo)

Proyecto aparte en `C:\AI\Antigravity\FALPAT srl\Optimizaciones` (no es parte del repo Herramientas). Convierte PDFs/fotos de `PATENTE/` en un **PDF A4 estandarizado y liviano** con marca de agua en banda diagonal **"Propiedad de Grupo Falpat SRL"**. 100% local (Python + Flask + PyMuPDF + Pillow), **no** toca Firebase ni se despliega en Vercel. Solo escribe archivos en la carpeta `PATENTE/`.

- **Arranque:** `Optimizaciones\iniciar.bat` → `http://localhost:8642`. Menú del sistema: **Utilidades → Optimizar Adjuntos** (URL en `OPTIMIZADOR_URL`, default `http://localhost:8642`; inyectada en `middleware/auth.js`).
- **Batch:** `python cli.py` (en `Optimizaciones`) re-procesa toda `PATENTE/`; mueve los originales a `PATENTE/{patente}/_originales/` (excluido de git en `.gitignore`).
- **Reglas internas:**
  - PDF fuente → se rasteriza ~150 dpi y re-encodea a JPEG (comprime escaneos: ej. AE192RO vtv 3,1 MB → 1,1 MB, -63%).
  - Hoja auto-orientada según contenido (apaisada si es ancha) + dos elementos chicos comparten hoja.
  - Salida siempre `PATENTE/{patente}/{tipo}.pdf` (la app ya prioriza `.pdf`).
  - Luego de optimizar, publicar con `npm run subir:docs`.
- **Config:** `Optimizaciones\config.json` (`patente_dir`, `port`, `jpeg_quality`, `watermark_opacity/fontsize/angle`).

