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

Archivo completo de reglas: `documentacion/GUIA-INSTALACION.txt` (sección "ANEXO — REGLAS PARA IA")

Toda la documentación del proyecto está en `documentacion/` (índice: `documentacion/README.md`).

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
  centros.ejs                # Centros de Trabajo / Obras (lista, catálogo, modales crear/editar/eliminar)
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
  centros.js                 # Obras: tabla, catálogo, asignar/devolver, editar, eliminar
scripts/
  subir-documentos.js        # Sube la carpeta PATENTE/ a producción (pull+add+commit+push) → npm run subir:docs
  cargar-vencimientos.js     # Vencimientos desde Excel de PATENTE/Vtos/ → npm run cargar:vencimientos
  generar-control-documentacion.js  # Genera CONTROL_FALTANTES / CONTROL_VENCIDOS en PATENTE/Reportes/ → npm run generar:control
  inspeccionar-counters.js    # SOLO LECTURA: cómo se llaman los docs de counters y si hay internos duplicados → npm run inspect:counters
tests/
  fake-firestore.js          # Firestore falso en memoria (permite testear escrituras sin producción)
  helpers.js                 # Lo inyecta en require.cache + monta routes/*.js + reporter
  escrituras.test.js         # Auth, roles, obras, elementos, vehículos → npm run test:escrituras
  negocio.test.js            # Contador del catálogo, recomputeServiceSummary, FieldValue.delete() → npm run test:negocio
  vehiculos-numeracion.test.js  # Numeración de vehículos (código cliente) → npm run test:numeracion
  import-vehiculos.test.js   # Import masivo de vehículos (código cliente) → npm run test:import
  README.md                  # Cómo escribir tests + las trampas del fake
PATENTE/
  {patente}/{tipo}.ext        # Documentos obligatorios versionados (fuente leída por la app en Vercel)
  Reportes/                   # Excel de control generados por npm run generar:control (ignorados por git)
```

## Firestore Collections

### `vehicles`
Campos clave: patente, interno, tipo, subtipo, marca, modelo, año, chasis, numeroMotor, capacidadCarga, kilometraje, horometro, estadoGeneral, vtv (map), seguro (map), proximoServiceKm, proximoServiceFecha, centroTrabajo, conductorHabitual, empresa, observaciones, fotoURL, multas[], documentos[]
Subcolecciones: `combustible` (fecha, litros, importe, tipo, km, proveedor), `repuestos` (fecha, pieza, costo, proveedor, tipo), **`services`** (fecha, tipo, km, intervaloKm, proximoKm, proximoFecha, costo, proveedor)

> **No existe la colección `maintenance` ni `routes/maintenance.js`.** Se
> fusionó con services: los mantenimientos viven en `vehicles/{id}/services` y
> se listan vía `GET /api/vehicles/:id/services` y `/api/vehicles/services/panel`.
> Las referencias a `routes/maintenance.js` que quedan en esta doc y en
> `documentacion/README.md` son un residuo a limpiar.

### `users`
Campos clave: role (Admin|Usuario), displayName, email

### `counters`
Doc con campo `current` para auto-increment. Hay **varios docs**, no uno solo. **VERIFICADO contra producción el 2026-09-29 con `npm run inspect:counters` (solo lectura):**

| Doc | `current` | Quién lo usa |
|-----|-----------|--------------|
| `counters/herramienta` | 3 | `getNextCatalogNumber()` → prefijo `H` |
| `counters/equipo` | 3 | ídem, prefijo `E` |
| `counters/ropa` | 3 | ídem, prefijo `R` |
| `counters/material` | 2 | ídem, prefijo `M` |
| `counters/vehiculo` | **NO EXISTE** | solo si se agrega un elemento de tipo vehículo al catálogo |
| `counters/vehicles` | **NO EXISTE** | `getNextVehicleNumber()` (cliente) |

**La doc histórica estaba mal:** decía `vehicles-{tipo}` y `cat-{prefijo}`. **No existe ningún doc con esos nombres.** El código busca `doc(tipo)` y **acierta**: los 4 counters del catálogo existen, así que la rama de incremento es la que corre y el fix `d98d8d8` sí es efectivo.

**Los 2 counters de vehículo NO existen**, y es el dato importante: la numeración de vehículos **siempre** cae en la rama "derivar del máximo de los internos reales". Por eso nunca hubo duplicados (y por eso el bug llevaba tiempo latente). Pero apenas se cree el doc, a la segunda alta se disparaba — por eso el fix de `auth-client.js:270` era urgente, no cosmético.

### `centros` (Centros de Trabajo / Obras)
Doc de catálogo por obra: `nombre`, `estado` (`activa`|`pausada`|`cerrada`), `ubicacion`, `observaciones`, `createdAt`, `updatedAt`.
Subcolección `elementos/{docId}`: `elementoId`, `elementoTipo` (`vehiculo`|`herramienta`|`equipo`|`ropa`|`material`), `fechaAsignacion`, `fechaDevolucion` ("" = asignado), `origenCentro`, `observaciones`.
**Se puede eliminar una obra, pero `DELETE /api/centros/:id` se niega con 409 si queda algún elemento sin devolver** (lee la subcolección y filtra en memoria, NO con `where('fechaDevolucion','==','')`: los elementos viejos no tienen ese campo y se colarían). Detalle: `documentacion/Update_2026.09.28.md`.

### `elementos_catalogo`
Catálogo de elementos no-vehículo: `nombre`, `interno` (con prefijo por tipo), `tipo`, `marca`, `modelo`, `descripcion`, `stock`. Alimenta el selector de elementos de las obras. Editable desde la pestaña Catálogo de `/centros`.

## Auth y permisos
- `isAdmin()` = `currentUserData?.role === 'Admin'`
- Middleware: `verifyToken` (API), `requireAdmin` (API 403), `loadUser` (SSR global), `requireAuth` (redirect a /login), `requireAdminPage` (redirect a /dashboard)
- Primer usuario registrado se convierte automáticamente en Admin
- UI Admin-only: botones editar/eliminar, checkboxes bulk, barra bulk, import CSV, botón Nuevo

## Patrones importantes
- **Bulk delete:** Los checkboxes se renderizan condicionalmente (`isAdmin()` en JS y `currentUserData?.role === 'Admin'` en EJS). `deleteMultipleWithBackup()` descarga backup JSON antes de eliminar.
- **Auto-increment:** `getNextVehicleNumber()` — **es CLIENTE**, está en `public/js/auth-client.js:258` (no en `routes/`), usa transacción en `counters/vehicles` y genera `V-XXX`. **Tenía el mismo off-by-one que el del catálogo** (guardaba `{current: max}` y devolvía `max+1`, línea 270) → la segunda alta tras perder el counter repetía el `V-XXX`. **Corregido y cubierto por `npm run test:numeracion`** (16 checks, en `tests/vehiculos-numeracion.test.js`, que extrae la función del archivo por texto y la evalúa con `new Function` contra el db falso). El de `routes/centros.js` (`getNextCatalogNumber`) se corrigió en `d98d8d8`.
- **El import masivo tiene numeración propia** (`executeCsvImport`, `vehicles.js:1160`) y **no hereda** las protecciones de `getNextVehicleNumber()`. Por eso tiene su propia suite: `npm run test:import` (17 checks, `tests/import-vehiculos.test.js`). Cualquier cambio acá necesita el mismo tratamiento que un counter.
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

### Nota crítica
- **Storage no disponible** (no intentar migrar a Firebase Storage; el bucket no existe en el plan gratuito).
- `config/firebase.js`: el Admin SDK local necesita `projectId: sa.project_id` explícito.
- `titulo/` (41 PDFs) es el patrón previo de versionado que replicó `PATENTE/`.

## Registro de cambios recientes (para puesta al día de IA)

Último commit: **`b95bf61`** (pusheado a `origin/main`, working tree limpio, **desplegado y verificado en producción**). La sesión del 2026-09-29 cerró con 3 bugs de numeración corregidos, un harness de tests nuevo (105 checks) y una auditoría sin hallazgos.

**Los tres bugs de numeración de la sesión (todos el mismo patrón: un off-by-one al inicializar un counter):**

| # | Dónde | Síntoma |
|---|-------|---------|
| 1 | `routes/centros.js` → `getNextCatalogNumber()` | La 2ª alta de un tipo repetía el `interno` del catálogo (`H008, H008, H009...`) |
| 2 | `public/js/auth-client.js:270` → `getNextVehicleNumber()` | La 2ª alta de un vehículo repetía el `V-XXX`. **Más grave:** `counters/vehicles` no existe, así que la numeración cae *siempre* en la rama rota |
| 3 | `public/js/vehicles.js:1160` → `executeCsvImport()` | El import no detectaba internos repetidos **dentro del propio archivo**, y su `catch (_) {}` silencioso dejaba el counter atrás → la próxima alta manual reusaba un número |

- **Counters: CONFIRMADO contra producción** con `npm run inspect:counters` (solo lectura). La doc histórica estaba mal: decía `cat-{prefijo}` y `vehicles-{tipo}`; **no existe ningún doc con esos nombres**. Los reales son `counters/{tipo}` — exactamente lo que busca el código. Los 4 del catálogo existen (current 3/3/3/2) y `counters/vehicles` NO existe. **No hay internos duplicados** en ninguna colección (11 elementos de catálogo, 54 vehículos V001-V054). **No hay nada que limpiar.**

- **Import masivo corregido** (`executeCsvImport`) — ahora aborta si un interno se repite dentro del mismo Excel (mensaje distinto al de "ya existe en la base"), y si falla el `set` del counter avisa con el riesgo en vez de tragárselo. `showToast()` ganó un 3er parámetro opcional de duración (default 4000 → las 108 llamadas existentes no cambian; los avisos con `\n` duran 6 s).

- **Harness de tests (`tests/`, nuevo)** — `npm test` = 105 checks en ~4 s, sin tocar producción. `tests/helpers.js` reemplaza `config/firebase.js` en `require.cache` **antes** de montar `routes/*.js`, así que las rutas se ejercitan tal cual están escritas. **Resuelve el problema de probar escrituras:** el `.env` local apunta a la base real y `DEV_READ_ONLY=true` bloquea todo con 403, así que antes no había forma de testear los forms de guardado sin escribir en producción. El harness **no** monta `middleware/dev-readonly.js` a propósito (queda sin efecto igual, porque el `db` es falso). Las 2 suites de cliente (`test:numeracion`, `test:import`) extraen la función del archivo por texto con regex y la evalúan con `new Function` contra el db falso. **Trampas del fake y del harness en `tests/README.md`** — no repetirlas.

- **Auditoría 2026-09-29 — sin hallazgos** — `node --check` limpio en rutas, middleware, config, 14 JS de `public/js` y 8 scripts. Las 19 vistas EJS compilan: 0 includes rotos, 0 assets rotos, 0 tags desbalanceados. Los 63 archivos de `public/` responden 200. CSS balanceado (`themes.css` 448/448). Logs limpios, sin restos de debug. **49 rutas backend vs 28 llamadas del frontend → 0 llamadas rotas.** Las 4 rutas sin guarda son legítimas: las 3 de login + `vehicles/services/panel-mock` (solo datos falsos).

- **Pendiente abierto:** revisión visual de los 4 temas (el punto más ciego — el contrast checker pasa pero no ve un botón mal alineado); limpiar las referencias a `maintenance` (módulo que ya no existe, ver arriba); `panel-mock` sin auth y `/service` sin `requireAdmin`.

- **Vencimientos del dashboard (commit `0ecb9a8`)** — cada tipo de documento se cuenta dos veces en `public/js/dashboard.js`: `vencidos` (fecha pasada) y `proximos` (1 a 30 días). **El número grande de la tarjeta cuenta solo los que están por vencer** (es la lista de trabajo) y los vencidos van aparte con su cantidad. Estado real de la flota: 28 por vencer / 25 vencidos (VTV 2+6, Seguro 26+10, Cédula 0+6, Registro 0+2, DNI 0+1). La documentación sale de la **carpeta `PATENTE/{patente}/`**, no del mapa `documentacion`; el archivo subido desde la web tiene prioridad. Service sigue por fecha y por km. Detalle: `documentacion/Update_2026.09.28.md`.

- **Vencimientos del dashboard (commit `0ecb9a8`)** — cada tipo de documento se cuenta dos veces en `public/js/dashboard.js`: `vencidos` (fecha pasada) y `proximos` (1 a 30 días). **El número grande de la tarjeta cuenta solo los que están por vencer** (es la lista de trabajo) y los vencidos van aparte con su cantidad. Estado real de la flota: 28 por vencer / 25 vencidos (VTV 2+6, Seguro 26+10, Cédula 0+6, Registro 0+2, DNI 0+1). La documentación sale de la **carpeta `PATENTE/{patente}/`**, no del mapa `documentacion`; el archivo subido desde la web tiene prioridad. Service sigue por fecha y por km. Detalle: `documentacion/Update_2026.09.28.md`.

- **Excel de control de documentación (`npm run generar:control`)** — `scripts/generar-control-documentacion.js` genera en `PATENTE/Reportes/`: `CONTROL_FALTANTES_YYYY-MM-DD.xlsx` (un renglón por documento faltante; 158 al 2026-09-28) y `CONTROL_VENCIDOS_YYYY-MM-DD.xlsx` (documentos vencidos; 25 al 2026-09-28). Se regeneran con ese comando; **los `.xlsx` NO van a git** (ignorados), así que en otra PC hay que correrlo.

- **Editar y eliminar Obras (commit `0ecb9a8`)** — `PUT /api/centros/:id` ahora acepta `nombre` y valida `estado`; `DELETE /api/centros/:id` (Admin) borra la subcolección `elementos` por lotes de 400 y el doc, pero **se niega con 409 si queda algún elemento sin devolver**. En la UI (`views/centros.ejs` + `public/js/centros.js`): botones editar/eliminar en la tabla y en el detalle, 2 modales nuevos, y **guardas `isAdmin()` que falban** (la página es `requireAuth`, no admin-only, así que antes los botones se le mostraban a cualquiera y fallaban con 403). Al abrir el modal de borrado se pide `GET /api/centros/:id` porque **`asignados`/`totalElementos` solo vienen en el detalle, no en la lista**.

- **Rediseño visual del shell (commit `970afba`)** — 4 temas, topbar con reloj, ranking de empresas y services. Ver detalle abajo en "Sistema de temas y shell".

- **Carpeta de Documentación física (`carpeta-docs.ejs`)** — menú **Utilidades → Carpeta Docs** (admin, `target="_blank"`, ruta `GET /vehicles/carpeta-docs` en server.js): imprime **1 hoja (o varias) de índice maestro** (tabla con N°/interno/patente/marca-modelo/año/empresa/folio de los 52 vehículos de la flota, ordenados por interno, paginada en A4 a 20 filas la 1ra página y 26 el resto, con título en todas las hojas y pie "Página X de Y") + **1 carátula por vehículo** (A4 vertical). Cada carátula muestra: folio, interno + patente en grande, N° BET, tipo/subtipo, grilla de 4 datos (marca/modelo, año, chasis, motor; si el campo está vacío queda en blanco para completar a mano) y checklist de los 7 documentos a archivar en orden fijo (Título, Cédula, Seguro, VTV, Registro, DNI, Service) con fecha de vencimiento automática (desde `seguro.fechaVencimiento`, `vtv.fechaVencimiento`, `vencimientoRegistro`, `vencimientoDNI`, `proximoServiceFecha`), casilla "Adjuntado" y celda de folio interno; el número de página corre globalmente (índice + carátulas). Logo incrustado como data URI (`fp3d.png`, calculado en la ruta) para que figure siempre al imprimir. Uso: imprimir el índice y las carátulas, las carátulas en cartulina para separar cada vehículo en el bibliorato.

  **Modo "Solo Novedades"** (Para imprimir solo lo nuevo al agregar vehículos/documentos): la carpeta recuerda la última impresión en Firestore (`config/carpetaDocs.ultimaGeneracion`, se marca con el botón **"✓ Marcar impresos hoy"** → `POST /vehicles/carpeta-docs/marcar`). En modo novedades:
  - **Índice**: siempre completo (no cambió).
  - **Carátulas**: solo los vehículos nuevos (`createdAt >= desde`) o con documentos tocados desde esa fecha; el **folio es estable** (posición en el índice completo, no la corrida impresa) y el contador de pie de página cuenta solo las hojas impresas.
  - **Documentos** (botón verde `GET /vehicles/carpeta-docs/pdf?solo=novedades&desde=YYYY-MM-DD`): vehículo nuevo → todos sus PDFs; vehículo existente → solo los tipos que cambiaron.
  - La detección de documentos tocados la hace `cambiosDesde(fechaISO)` en `lib/github-docs.js`: lista commits de GitHub que tocaron `PATENTE/` desde la fecha (la API de commits no devuelve `files`, por eso fetchea el detalle por SHA, acotado a 25) y filtra con regex `PATENTE/{patente}/{tipo}.ext`.
  - Toggles en la barra de la herramienta: **Solo Novedades** (usa la fecha guardada) / **Ver Todo** (`?desde=all`). Sin fecha guardada aún, todo se considera novedad.
  - `DEV_READ_ONLY=true` (local) bloquea el botón "Marcar impresos hoy" (solo funciona en producción/Vercel).

- **Herramienta "Optimizaciones" — SACADA DEL MENÚ** (commit `fec5469`, 2026-10-01). Antes había una entrada **Utilidades → Optimizar Adjuntos** (`OPTIMIZADOR_URL`, default `http://localhost:8642`) agregada en `9a623eb`; se quitó porque quedó como app local separada (`Optimizaciones\iniciar.bat`). **Ya no existe ni el link ni la variable `OPTIMIZADOR_URL`** — se abre a mano desde el `.bat`. No reintroducirla sin avisar.
- **Docs**: AE192RO vtv optimizado (3,1 MB → 1,14 MB, -63%) y PCS413 cedula estandarizada (commit `af33acd`).

- **Página pública del QR del vehículo (`vehicle-qr-public.ejs`)** — vista móvil que abre quien escanea el QR pegado al camión (ruta `GET /vehicle/:id/qr` en server.js, **pública, sin auth**). Se rediseñó para el usuario común: header con logo Falpat (`/images/fp3d.png` reemplazó al icono de camioncito), sección **Vencimientos** (VTV, Seguro, Service, Matafuego con días restantes/estado de color, se pasa el array `vencimientos` desde el server), y sección **Documentos del vehículo** al final (solo Cédula, Seguro y VTV, solo lectura, enlaces a `/documentos/{patente}/{archivo}`). El server calcula los vencimientos y escanea la carpeta `PATENTE/` (helper `scanDocsCarpeta(patente)` local en server.js, docs del folder = públicos; los subidos manualmente NO se muestran acá porque requieren auth).
- **Ficha interna móvil (`vehicle-detail.ejs` + `public/js/vehicle-detail.js`)** — agregado hero mobile con logo Falpat + chips de vencimientos (VTV/Seguro/Service) y sección "Documentos del vehículo" al final solo en mobile (`md:hidden`). Desktop sin cambios.
- **Menú "Utilidades"** — desktop (commit `970afba`): **ya NO es desplegable**, es un encabezado de sección estático con los links sueltos. Solo el menú móvil (`mobile-menu.ejs`) lo mantiene colapsable. Agrupa Escáner QR + (solo Admin) Stickers QR, Fichas Taller y Carpeta Docs; scanner marca `?pagina=scan`. **Regla: el menú móvil debe tener los mismos destinos que el desktop** — en 2026-10-01 se le agregaron `/centros` y `Carpeta Docs`, que faltaban.
- **Reports re-diseñado** (commit `436140f`): reporte de flota con filtros por cualquier campo, sección documentación, export Excel/PDF, endpoint `/api/admin/report/flota`.
- **Docs**: se agregó el 6to documento obligatorio **DNI del chofer** (commit `4164361`): slot DNI en modal, vencimiento atado a `vencimientoDNI`, upload/lectura/eliminación de subidos, reportes/import/export con DNI.

## Sistema de temas y shell (commit `970afba`)

Todo el diseño vive en `public/css/themes.css` (~1.950 líneas), cargado como **último** stylesheet en `views/partials/head.ejs` para pisar a `styles.css` con los tokens.

### 4 temas (`data-theme` en `<html>`)
| Tema | Fondo | Carácter |
|------|-------|----------|
| `pro` (default) | noche índigo `#0a0b16` | acento eléctrico `#818cf8` |
| `claro` | papel cálido `#d9d1c0` | **teñido, no blanco** — el usuario pidió explícitamente que no sea brillante |
| `industrial` | grafito `#17140f` | ámbar `#fbbf24`, "sensorial flota" |
| `auto` | sigue al sistema | claro apagado `#d5e0e2` / oscuro violeta |

Los 4 se **reescribieron** para que sean visualmente distintos (antes eran casi el mismo azul oscuro). Tema claro lleva 6 superficies distintas, todas taupe, sin blanco puro.

### Tokens derivados (en `:root`)
`--ac-solid` / `--ac-solid-hover` (para que el texto de los botones no dependa del acento), `--grad-brand`, `--grad-brand-text`, `--grad-surface`, `--grad-hero`, `--grad-clock`.

`--grad-clock` se construye con `color-mix(in srgb, var(--ac) 15%, var(--bg-raised))` → `var(--bg-overlay)`, así **se adapta solo a los 4 temas** en vez de tener un color fijo por tema que después se desincroniza.

### Capa de normalización
`themes.css` remapa **73 clases Tailwind estándar** por rol (fondos, textos, bordes). Antes de esto, `bg-white`, `text-gray-800`, etc. ignoraban los temas y rompían el claro. **Al agregar una clase de color nueva hay que pasarle por esta capa o dejarla en tokens.**

### Reloj (`public/js/clock.js`)
Fecha y hora en **formato vertical** (fecha arriba, hora abajo) en una caja de bordes redondeados con degradé. Dos montajes:
- `.topbar-clock` → último hijo de `views/partials/topbar.ejs` (dashboard y vehículos), pegado al margen derecho con `margin-right: calc(var(--sp-5) * -1)`.
- `.clock-float` → esquina superior derecha en las páginas **sin** topbar, oculto en móvil.

**No mover el reloj a `position: absolute`**: se probó y tapó los botones de acción del topbar. Tiene que quedar como hijo flex normal al final de la barra.

### Topbar (`views/partials/topbar.ejs`)
Solo se incluye en `dashboard.ejs` y `vehicles.ejs`. Contiene: menú móvil, migas de pan, buscador global, acciones y reloj. Los botones de acción (Vehículo / Service) están condicionados por `_isAdmin` y por la página actual — **si el usuario no los ve, primero verificar el rol de la sesión, no el CSS.**

### Cache-busting
`server.js` calcula `app.locals.assetV` con el **mtime de `themes.css`**; `head.ejs` lo manda como `?v=<mtime>` en el CSS y los JS. Al guardar el CSS el valor cambia solo. Sin esto el navegador sigue sirviendo versiones viejas y hace perder tiempo.

### Verificación
Scripts temporales en `C:\Users\EFECTI~1\AppData\Local\Temp\opencode\`:
- `contrast.js` — auditor WCAG de los 4 temas. Incluye un chequeo de la caja del reloj sobre el degradé. **0 fallas, 1 aviso informativo** (blanco sobre `--ac` de Pro, combinación que no usa ningún botón real: los botones usan `--ac-solid` y dan 5.4–8.6:1).
- `check-dash.js` — 19 checks del dashboard (7 tarjetas, ranking, services, reloj).
- `check-restore.js` — renderiza `head.ejs` + `topbar.ejs` y verifica que los botones sigan presentes. **Correrlo si se toca el topbar.**
- `audit2.js` / `audit3.js` / `audit4.js` — inventarios de colores inline, arbitrarios y paleta Tailwind.

Corrida rápida: `node --check` en cada JS modificado, llaves CSS balanceadas (447/447), EJS renderizado, y los 4 assets con HTTP 200 en local y en producción.

### Pendiente de armonización
- **118 colores inline** en las vistas siguen hardcodeados → migrar a tokens.
- **3.185 clases Tailwind** de spacing/tipografía/radio sin override propio.
- Auditar los CSS legacy: `theme-switcher.css`, `theme-modern.css`, `theme-premium.css`, `theme-sutil.css`, `styles.css`.
- La command palette recibe la flota real solo en `/vehicles`.
- Sin revisión visual autenticada de los 4 temas en desktop/móvil.

### Quirks importantes (no repetir errores)
- **Pre-commit hook**: bloquea el commit si `HEAD != origin/main`, lo que incluye estar ADELANTADO (commits locales sin pushear). No es un error real: la alerta dice "DESACTUALIZADO" pero aplica también cuando quedaron commits sin pushear. Solución: `git push origin main` del commit pendiente ANTES de commitear de nuevo. Verificar con: `git rev-parse HEAD` vs `git rev-parse origin/main`.
- **Deploy por `vercel --prod --yes` NO equivale a pushear git**: producción siempre quedó al día, pero origin quedó atrás (commit `a1176ec` estuvo solo en Vercel). Al cerrar sesión, chequear que `origin/main == HEAD`.
- **Server local**: `node server.js` NO recarga en caliente cambios de server.js/rutas (solo vistas y estáticos). Tras tocar rutas: matar el proceso del puerto 3000 (`Get-NetTCPConnection -LocalPort 3000`) y relanzar `node server.js` (o `npm run dev` = `node --watch server.js`). Vistas `.ejs` y `public/` se ven al refrescar.
- **`DEV_READ_ONLY=true` en `.env`**: en local TODAS las escrituras a Firestore están bloqueadas (usa la misma base que producción). Revisar antes de "probar" funciones de guardado. **Para probar escrituras usar `npm test`** (harness con Firestore falso), NO bajar el read-only: escribiría en la base real.
- **La guarda read-only es un MIDDLEWARE montado en `server.js` (`app.use('/api/', devReadOnly)`), NO un bloqueo a nivel Firestore.** Un test/harness que monte `routes/x.js` en su propio Express **se saltea la guarda y escribe en la base de producción**. Para probar endpoints de escritura: (a) montar también `middleware/dev-readonly.js` en el harness, o (b) fakear `config/firebase.js` en `require.cache` con un `db` falso y ejercitar la ruta real (así se prueban batches, 409 y validaciones sin riesgo). Con el fake hay que emular a mano los `where`, los lotes (un `commit` borra SOLO los refs del lote) y `doc.exists`.
- **Un commit por sesión si usás el pre-commit hook**: el hook bloquea cuando `HEAD != origin/main`, así que para commitear un segundo cambio en la misma sesión hay que pushear el primero.
- **Probar contra un fake también destapa bugs reales**: en la sesión del 2026-09-28 el fake de centros encontró que el `PUT` no recortaba `ubicacion`/`observaciones` (el `POST` sí) y que la tabla de obras no tenía guardas `isAdmin()` (la página es `requireAuth`, no admin-only). En la del 2026-09-29 encontró el off-by-one del contador (§2 del registro) — y de paso, que **el mismo bug estaba sin corregir en `public/js/auth-client.js:270`** (numeración de vehículos, código cliente, fuera del alcance del harness).
- **El código cliente se puede testear sin navegador:** `getNextVehicleNumber()` es un archivo que se carga por `<script>` (no ESM), así que se **extrae del texto** con regex y se evalúa con `new Function('db', src + 'return fn;')` inyectándole el db falso. Es la técnica de `tests/vehiculos-numeracion.test.js`. Sirve para cualquier función pura de `public/js/` que solo dependa de `db` y de `Date`. **Ojo: las dos ramas del off-by-one (`set current: max` vs `max+1`) solo se distinguen con un assert sobre el valor persistido**, no con el valor devuelto: las dos devuelven el mismo número la primera vez. El assert clave es que la **segunda** llamada dé un número distinto.
- **`npm run inspect:counters` es SOLO LECTURA** (no escribe en Firestore). Sirve para verificar contra producción cómo se llaman los docs de `counters` y si hay internos duplicados. Re-correrlo si alguien suspects que los counters quedaron desincronizados.
- **La guarda read-only es un MIDDLEWARE montado en `server.js` (`app.use('/api/', devReadOnly)`), NO un bloqueo a nivel Firestore.** Un test/harness que monte `routes/x.js` en su propio Express **se saltea la guarda y escribe en la base de producción**. Para probar endpoints de escritura: (a) montar también `middleware/dev-readonly.js` en el harness, o (b) fakear `config/firebase.js` en `require.cache` con un `db` falso y ejercitar la ruta real (así se prueban batches, 409 y validaciones sin riesgo). Con el fake hay que emular a mano los `where`, los lotes (un `commit` borra SOLO los refs del lote) y `doc.exists`.
- **Un commit por sesión si usás el pre-commit hook**: el hook bloquea cuando `HEAD != origin/main`, así que para commitear un segundo cambio en la misma sesión hay que pushear el primero.
- **Probar contra un fake también destapa bugs reales**: en la sesión del 2026-09-28 el fake de centros encontró que el `PUT` no recortaba `ubicacion`/`observaciones` (el `POST` sí) y que la tabla de obras no tenía guardas `isAdmin()` (la página es `requireAuth`, no admin-only).
- **Los contadores de subcolecciones no vienen en los endpoints de lista**: p. ej. `asignados`/`totalElementos` solo vienen en `GET /api/centros/:id`, no en `GET /api/centros`. Si la UI los necesita, que pida el detalle.
- **Campos con `undefined` en `update()` de Firestore tiran error**: armar el objeto solo con las claves que tienen valor (mismo cuidado que en `cargar-vencimientos.js`).

## Carga masiva de vencimientos (Excel → Firestore)

Herramienta: **`npm run cargar:vencimientos`** → `scripts/cargar-vencimientos.js`.

**Origen:** lee el Excel que genera el análisis de documentos en `PATENTE/Vtos/CONTROL_VENCIMIENTOS_<fecha>.xlsx` (hoja con columnas `Patente | Tipo documento | Vencimiento | Nota`). Toma el archivo más reciente de la carpeta.

**Mapa de campos (mismo patrón que el modal de documentación de la web):**

| Tipo en Excel | Campo principal | Campo genérico |
|---------------|-----------------|----------------|
| VTV | `vtv.fechaVencimiento` | `documentacion.vtv.fechaVencimiento` |
| Seguro | `seguro.fechaVencimiento` | `documentacion.seguro.fechaVencimiento` |
| Registro | `vencimientoRegistro` | `documentacion.registro.fechaVencimiento` |
| DNI | `vencimientoDNI` | `documentacion.dni.fechaVencimiento` |
| Cedula | — (solo genérico) | `documentacion.cedula.fechaVencimiento` |
| Titulo | — (solo genérico) | `documentacion.titulo.fechaVencimiento` |

- Las celdas **`SIN CARGA`** y **`NO VENCE`** se ignoran (no escriben nada).
- Las patentes que no existen en Firestore (solo tienen PDF en `PATENTE/`) se saltan con `SKIP` (ej: AD718OH, AD957RY, AE192RO, AG889XV).
- Uso: `npm run cargar:vencimientos` (escribe), `--dry-run` (solo muestra), `--patente=AB922TD`, `--archivo=PATENTE/Vtos/otro.xlsx`.
- Detalle técnico: NO incluir claves con valor `undefined` en `update()` de Firestore (lanza error) — solo agregar las claves que tienen fecha.

## Optimizaciones — herramienta de adjuntos (FUERA del repo)

Proyecto aparte en `C:\AI\Antigravity\FALPAT srl\Optimizaciones` (no es parte del repo Herramientas). Convierte PDFs/fotos de `PATENTE/` en un **PDF A4 estandarizado y liviano** con marca de agua en banda diagonal **"Propiedad de Grupo Falpat SRL"**. 100% local (Python + Flask + PyMuPDF + Pillow), **no** toca Firebase ni se despliega en Vercel. Solo escribe archivos en la carpeta `PATENTE/`.

- **Arranque:** `Optimizaciones\iniciar.bat` → `http://localhost:8642`. Menú del sistema: la app se abre a mano con `Optimizaciones\iniciar.bat`. **Ya no hay entrada en el menú** (se quitó en `fec5469`).
- **Batch:** `python cli.py` (en `Optimizaciones`) re-procesa toda `PATENTE/`; mueve los originales a `PATENTE/{patente}/_originales/` (excluido de git en `.gitignore`).
- **Reglas internas:**
  - PDF fuente → se rasteriza ~150 dpi y re-encodea a JPEG (comprime escaneos: ej. AE192RO vtv 3,1 MB → 1,1 MB, -63%).
  - Hoja auto-orientada según contenido (apaisada si es ancha) + dos elementos chicos comparten hoja.
  - Salida siempre `PATENTE/{patente}/{tipo}.pdf` (la app ya prioriza `.pdf`).
  - Luego de optimizar, publicar con `npm run subir:docs`.
- **Config:** `Optimizaciones\config.json` (`patente_dir`, `port`, `jpeg_quality`, `watermark_opacity/fontsize/angle`).

