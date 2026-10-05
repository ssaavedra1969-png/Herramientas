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
  reports.ejs                # Reportes: 3 cards plegables (Flota, Documentación, Vencimientos) + CSS de impresión "pizarra"
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
  reports.js                 # Reportes: 3 cards (Flota, Documentación, Vencimientos) + export Excel/PDF/print
  admin.js                   # Roles de usuario
  centros.js                 # Obras: tabla, catálogo, asignar/devolver, editar, eliminar
scripts/
  subir-documentos.js        # Sube la carpeta PATENTE/ a producción (pull+add+commit+push) → npm run subir:docs
  cargar-vencimientos.js     # Vencimientos desde Excel de PATENTE/Vtos/ → npm run cargar:vencimientos
  generar-control-documentacion.js  # Genera CONTROL_FALTANTES / CONTROL_VENCIDOS en PATENTE/Reportes/ → npm run generar:control
  generar-control-matafuego.js      # Genera CONTROL_MATAFUEGO_MIXERS / _RESTO (sin matafuego) + _TODOS (flota entera agrupada por tipo) → npm run generar:matafuego
  marcar-cedulas-no-vence.js        # Marca documentacion.cedula.noVence en los vehículos sin fecha (SIN alias npm) → node scripts/marcar-cedulas-no-vence.js [--apply]
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
  Reportes/                   # Excel de control generados por npm run generar:control y npm run generar:matafuego (ignorados por git)
```

## Firestore Collections

### `vehicles`
Campos clave: patente, interno, tipo, subtipo, marca, modelo, año, chasis, numeroMotor, capacidadCarga, kilometraje, horometro, estadoGeneral, vtv (map), seguro (map), proximoServiceKm, proximoServiceFecha, centroTrabajo, **chofer**, empresa, observaciones, fotoURL, multas[], documentos[]

> **El campo del chofer es `chofer`, NO `conductorHabitual`.** Census del 2026-10-02: `chofer` está en **23 de 57** vehículos, `conductorHabitual` en **1** (resto viejo de una versión anterior). Todo el código lee `v.chofer || v.conductorHabitual || ''` (`routes/admin.js:402,586`, `public/js/dashboard.js:280,328`), así que al escribir usá siempre `chofer`. Si la columna Chofer de un Excel sale vacía, es que el vehículo no tiene el dato cargado: **no es un bug.**
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

Último commit: **`e134709`** ("Docs: 6 vehículos", 2026-10-03) — el rótulo miente, son 7 PDF (§1). Antes de este hubo `b31c2c9`, `7138138`, `bf465f2`, `b38c4b3` y `288cd38`. **El registro de abajo está en orden temático, no cronológico**: arranca por la sesión del 2026-09-29 (numeración + harness de tests) y después sigue con las del 2026-10-01 y 10-02, que fueron todas de **Reportes**. Detalle de las últimas: `documentacion/Update_2026.10.03.md` (renovación de seguros), `Update_2026.10.02.md` (Reportes) y `Update_2026.10.02_tarde.md` (documentación de la flota).

- **Sesión 2026-10-03 tarde (Reportes / Vencimientos, detalle en `documentacion/CHANGELOG.md`)** — dos pedidos del usuario sobre la 3ra card de `/reports`, **todo en `public/js/reports.js` + `views/reports.ejs`**, sin tocar backend ni Firestore:
  - **Los `<select>` de documento y empresa se reemplazaron por checklists multiple (`llenarMultiVenc()`)**, con toggle "Todos". `setVencDoc()`/`setVencEmpresa()` **ya no existen**: no volver a agregarlos.
  - **Con 2+ documentos sale fila por vehículo + documento** (antes 1 fila por vehículo con lo más urgente); con 0 o 1 sigue 1 fila por vehículo. Por eso el PDF suma la columna `Documento` y los Excel tienen 7 columnas fijas. El stat de vehículos cuenta **distinctos**, no filas.
  - **Agrupado por empresa** (toggle, y por defecto prendido): grupos de la más urgente a la menos, y **adentro por patente** (`keyFila` en `datosVenc()`; la flecha de orden se muestra en Patente). `g.minDias` es `Math.min()` de las filas. `filas` sale **aplanada en el orden de los grupos**, que es lo que hacen el Excel y el PDF.
  - **Los 3 PDF (Flota, Documentación, Vencimientos) comparten `PDF_TABLA`**: cuerpo 9pt, header 9.5pt negro, grilla 0.5mm #1F2937, pie con página en todas. **Flota y Documentación venían en 5.5pt sin bordes.** `anchosColumnasPDF()` reparte los 273mm de Flota según el largo del texto (son columnas variables, elige el usuario); Documentación y Vencimientos llevan anchos fijos.
  - **Dos trampas:** (1) para medir un PDF hay que mirar **la fecha de modificación**: el harness escribe en `%TEMP%\reporte-test-*.pdf` y hay `ver-*.pdf` viejos que dan readings que ya no corresponden al código. (2) **jsPDF no está en `package.json`** (la app lo carga por CDN): `npm install --no-save jspdf@2.5.1 jspdf-autotable@3.8.2` para probarlos en Node, y `doc.save()` en Node escribe en la **raíz del repo** si no lo mockeás (contaminó `git status` con un PDF).

- **Sesión 2026-10-03 (renovación de seguros, `documentacion/Update_2026.10.03.md`)** — se publicaron 7 certificados nuevos en `PATENTE/` (`e134709`) y se cargó `seguro.fechaVencimiento = 07/10/2026` en los 7 vehículos, **sin tocar código de app** (la fecha ya la resolvía `fechaDocVenc(v,'seguro')`):
  - **Cómo se cargó, sin código nuevo:** Excel a medida `PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-03.xlsx` + `node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-03.xlsx` (dry-run primero). Se llama `SEGUROS_RENOVACION_*` y **no** `CONTROL_VENCIMIENTOS_*` a propósito, para que `excelReciente()` no lo tome por defecto después.
  - **⚠️ No correr `npm run cargar:vencimientos` sin `--archivo`:** el `CONTROL_VENCIMIENTOS_2026-09-07.xlsx` tiene las fechas viejas (07/04/2026, y `AF606JL` en 07/10/**2025**) y **revierte** la renovación.
  - **Bug de rótulo en `scripts/subir-documentos.js`:** el `.trim()` de la línea 50 se comía el espacio inicial de la primera línea del `git status --porcelain` (`" M "`), el parseo `/^.. /` dejaba de matchear y **el primer vehículo de la lista nunca se contaba**. Solo era de rótulo (los PDF siempre se commitearon bien), pero con un solo archivo decía "Docs: 0 vehículos". Corregido: sin `.trim()` y salteando líneas vacías.
  - **Pólizas de `PATENTE/Seg/`** (el usuario las borró después): **13674442** (07/04→07/10/2026, 60 placas, `CERTIFICADOS DE COBERTURAS.pdf`) y **13673743** (24/04→24/10/2026, 23 placas). 4 páginas por certificado con `Dominio: XXXXXX` arriba → **se mapearon sin OCR** (PyMuPDF + texto normalizado a `[A-Z0-9]`). `AG276BQ`, `GKX407` y `LEC583` **no están en ninguna**.
  - **Census de seguros (2026-10-03):** 3 vencidos (`GKX407`, `AG276BQ` -361 d, `LEC583` -181 d), 30 al 07/10/2026 y 5 al 24/10/2026 (**de los 30 solo 7 tienen el PDF nuevo**), 18 sin fecha.
  - Desfase conocido, **no corregido**: el dashboard usa `daysUntil()` (`Math.ceil` sobre la hora, `public/js/auth-client.js`) y los Reportes `diasHastaYMD()` (fecha calendario, `routes/admin.js`): con 30 seguros el mismo día el dashboard puede decir "5" donde el Reporte dice 4.
  - `PATENTE/Seg/` **no** está en `.gitignore` (decisión del usuario). Si se vuelven a poner las pólizas ahí, `subir:docs` las commitea.

**Los tres bugs de numeración de la sesión (todos el mismo patrón: un off-by-one al inicializar un counter):**

| # | Dónde | Síntoma |
|---|-------|---------|
| 1 | `routes/centros.js` → `getNextCatalogNumber()` | La 2ª alta de un tipo repetía el `interno` del catálogo (`H008, H008, H009...`) |
| 2 | `public/js/auth-client.js:270` → `getNextVehicleNumber()` | La 2ª alta de un vehículo repetía el `V-XXX`. **Más grave:** `counters/vehicles` no existe, así que la numeración cae *siempre* en la rama rota |
| 3 | `public/js/vehicles.js:1160` → `executeCsvImport()` | El import no detectaba internos repetidos **dentro del propio archivo**, y su `catch (_) {}` silencioso dejaba el counter atrás → la próxima alta manual reusaba un número |

- **Counters: CONFIRMADO contra producción** con `npm run inspect:counters` (solo lectura). La doc histórica estaba mal: decía `cat-{prefijo}` y `vehicles-{tipo}`; **no existe ningún doc con esos nombres**. Los reales son `counters/{tipo}` — exactamente lo que busca el código. Los 4 del catálogo existen (current 3/3/3/2) y `counters/vehicles` NO existe. **No hay internos duplicados** en ninguna colección (11 elementos de catálogo, **57 vehículos V001-V057**, re-verificado el 2026-10-02). **No hay nada que limpiar.**

- **Import masivo corregido** (`executeCsvImport`) — ahora aborta si un interno se repite dentro del mismo Excel (mensaje distinto al de "ya existe en la base"), y si falla el `set` del counter avisa con el riesgo en vez de tragárselo. `showToast()` ganó un 3er parámetro opcional de duración (default 4000 → las 108 llamadas existentes no cambian; los avisos con `\n` duran 6 s).

- **Harness de tests (`tests/`, nuevo)** — `npm test` = 105 checks en ~4 s, sin tocar producción. `tests/helpers.js` reemplaza `config/firebase.js` en `require.cache` **antes** de montar `routes/*.js`, así que las rutas se ejercitan tal cual están escritas. **Resuelve el problema de probar escrituras:** el `.env` local apunta a la base real y `DEV_READ_ONLY=true` bloquea todo con 403, así que antes no había forma de testear los forms de guardado sin escribir en producción. El harness **no** monta `middleware/dev-readonly.js` a propósito (queda sin efecto igual, porque el `db` es falso). Las 2 suites de cliente (`test:numeracion`, `test:import`) extraen la función del archivo por texto con regex y la evalúan con `new Function` contra el db falso. **Trampas del fake y del harness en `tests/README.md`** — no repetirlas.

- **Auditoría 2026-09-29 — sin hallazgos** — `node --check` limpio en rutas, middleware, config, 14 JS de `public/js` y 8 scripts. Las 19 vistas EJS compilan: 0 includes rotos, 0 assets rotos, 0 tags desbalanceados. Los 63 archivos de `public/` responden 200. CSS balanceado (`themes.css` 448/448). Logs limpios, sin restos de debug. **49 rutas backend vs 28 llamadas del frontend → 0 llamadas rotas.** Las 4 rutas sin guarda son legítimas: las 3 de login + `vehicles/services/panel-mock` (solo datos falsos).

- **Pendiente abierto:** revisión visual de los 4 temas (el punto más ciego — el contrast checker pasa pero no ve un botón mal alineado); limpiar las referencias a `maintenance` (módulo que ya no existe, ver arriba); `panel-mock` sin auth y `/service` sin `requireAdmin`.

- **Vencimientos del dashboard (commit `0ecb9a8`)** — cada tipo de documento se cuenta dos veces en `public/js/dashboard.js`: `vencidos` (fecha pasada) y `proximos` (1 a 30 días). **El número grande de la tarjeta cuenta solo los que están por vencer** (es la lista de trabajo) y los vencidos van aparte con su cantidad. Estado real de la flota: 28 por vencer / 25 vencidos (VTV 2+6, Seguro 26+10, Cédula 0+6, Registro 0+2, DNI 0+1). La documentación sale de la **carpeta `PATENTE/{patente}/`**, no del mapa `documentacion`; el archivo subido desde la web tiene prioridad. Service sigue por fecha y por km. Detalle: `documentacion/Update_2026.09.28.md`.

- **Nueva sección "Vencimientos" en Reportes (2026-10-01)** - `GET /reports` (solo Admin) suma una 3ra card `#sec-vencimientos` a las 2 que ya había (son **cards apiladas, no tabs**), alimentada por el mismo `GET /api/admin/report/flota`. Cubre los **7 tipos que vencen** (VTV, Seguro, Service, Matafuego, DNI, Registro, Cédula) con **7 filtros** combinables (ventana 15-365 días, documento, estado, empresa, centro, tipo, texto) + export **Excel** (XLSX) y **PDF** (jsPDF portrait) + `printVenc()` que aísla la tabla y fuerza `@page portrait` (se limpia en `afterprint`). **El Título NO está en `VENC_TIPOS`**: no vence nunca (su control es "¿está o no está?"), así que vive solo en la card Documentación. Ojo: `routes/admin.js` **sí** sigue devolviendo `tituloFecha`/`tituloDias`; es la vista la que lo ignora.
- **Vencimientos: una fila por vehículo, 5 columnas (2026-10-02)** - La tabla pasó de 23 columnas a **Patente, Interno, Tipo, Empresa y Vencimiento** (`f04c43e` agregó Empresa; el resto es de `d52ec39`). `Tipo` es el tipo de vehículo. Un vehículo sale **una sola vez**: con un documento elegido en el filtro se muestra esa fecha, con `Todos` la **más urgente**; el nombre del documento y los días van en chico dentro de la celda, no en columnas. Filtros de estado y stats se calculan sobre **la misma fecha mostrada**, así que `Seguro` + `≤15d` ya no incluye vehículos vencidos en VTV. Orden por defecto **Vencimiento ascendente**. Los filtros `empresa`/`centro`/`tipo` comparan con `normTxt()` porque la flota tiene `"mixer"` (22) y `"Mixer"` (1) y el dropdown los separaba en dos opciones. Detalle en `documentacion/README.md` → "Reportes / Vencimientos".
- **Reportes: la documentación salía toda faltante (commit `2da46a4`)** - `GET /api/admin/report/flota` escaneaba `PATENTE/` en el **disco local**, pero `PATENTE/` **no está en el deploy de Vercel** (`.vercelignore` la excluye), así que en producción el scan salía vacío y marcaba "faltan documentos" en los 54 camiones (la flota ya iba por 57; el número no importa, era el total entero). Ahora la fuente real es el **repo**: `lib/github-docs.js` → `listarPatenteGlobal()` (1 request de `git/trees/main?recursive=1` para toda la carpeta) con caché de **10 min** (`arbolPatenteR()` / `invalidarArbolPatenteR()` en `routes/admin.js`). Si el árbol viene `truncated` o falla (sin `GITHUB_TOKEN`), cae al modo de a uno (`gh.listarCarpeta(patente)`). El scan local **se mantiene** y se une con `||` al remoto: en local gana el disco. Además las **3 cards arrancan contraídas** (`.rpt-card.collapsed > .rpt-body { display:none }`), con un **chip de resumen** por sección (`#chip-flota`, `#chip-documentacion`, `#chip-vencimientos`).
- **Reportes: el título del reporte dice QUÉ se imprimió (commit `f04c43e`)** - Un PDF en la pizarra con "Vencimientos" a secas no dice si es el reporte completo o el filtrado por Seguro. `resumenFiltroVenc()` (con `VENC_ESTADOS`) arma una línea tipo `Seguro · Por vencer · hasta 30 días · empresa: X · centro: Y · tipo: mixer · búsqueda: "..."` y se inyecta en dos lugares: `#vc-subtitulo` (bajo el título en pantalla) y el **título del PDF** (con `splitTextToSize`, que corre la línea y recalcula el `startY` de la tabla). Se actualiza en cada `renderVenc()`, así que refleja los filtros en vivo.
- **Impresión de Vencimientos = "pizarra" (commits `0c1c5f0` / `f04c43e`)** - El destino real es una pizarra: los grises claros y las letras chicas no se leen a distancia. El CSS de `body.printing-venc` (en `views/reports.ejs`) pone header de tabla **negro con letras blancas 10pt**, celdas **11pt** con bordes 0.5pt, `white-space: normal`, oculta la descripción web (`.rpt-desc`), saca la flecha de orden, y **anula el recorte de la empresa** (`td.col-empresa`: en pantalla `max-width:200px` + ellipsis con el valor completo en el `title`, al imprimir sin recorte). Las dos líneas chicas de la celda de vencimiento (`.text-[11px]` / `.text-[10px]`) suben a 9.5/9pt.
- **Exports de Reportes (commits `0c1c5f0` / `efd5f71` / `f04c43e`)** - Los 3 PDF (Flota, Documentación, Vencimientos) llevan **logo `fp3d.png` incrustado** (`getLogoBase64()`, cacheado en `_logoB64`) y usan `autoTable`. Vencimientos: **Excel con 7 columnas** (Patente, Interno, Tipo, Empresa, Fecha vencimiento, Documento, Dias; `Empresa` con `wch:24`) y **PDF con 6** (Patente, Interno, Tipo, Empresa, Fecha venc., Dias — **el nombre del documento ya no sale, la celda lo lleva en la web**), con `columnStyles` de anchos fijos y letra 9.5–10pt. Días en el PDF: `N Dias Vencidos` / `N Dias a Vencer`.

  **Lo importante para el próximo que lo toque:** las fechas de documento conviven en **3 esquemas** y `routes/admin.js` las resuelve con `fechaDocVenc(v, tipo)` en orden **legacy (`vtv/seguro/matafuego.fecha*`) → campo plano → `documentacion.<tipo>.fechaVencimiento`**. Verificado contra Firestore: **0 fechas sin detectar** en los 8 tipos. **Census re-verificado contra producción el 2026-10-02 con 57 vehículos** (todos en servicio, `V001`..`V057`, sin internos repetidos): VTV 39, Seguro 37, **Service 13**, Matafuego 2, DNI 6, Registro 3, Cédula 6 (+29 con `noVence`), **Título 0**. O sea: **la columna Título sale vacía siempre** y Matafuego casi, porque así están los datos, no por un bug.

  **Service es el caso especial:** no es un documento, es derivado. `fechaDocVenc` no lo cubre; usa `proximoServiceFecha` (13 vehículos) con fallback al `proximoFecha` más cercano de `serviceSummary`. **Ojo, el fallback hoy no aporta nada:** re-verificado el 2026-10-02, los 13 vehículos con `proximoServiceFecha` son **exactamente los mismos 13** que tienen fecha en `serviceSummary` (V008, V010, V014-V016, V018, V023, V024, V027, V030, V032, V034, V049); el "13 → 18" que se midió el 2026-10-01 era de otra fecha de corte. El código se queda como está (es una red de seguridad gratis), pero **no esperes que hoy agregue vehículos**: si tocás `resumenService()`, el test que importa es que no haga perder fechas, no que las sume.

  Dos bugs detectados **revisando el código, no los tests** (no estaban cubiertos): (1) el orden por columnas de documento estaba roto, porque `orderVal(a.v, "v:vtv")` busca la propiedad `"v:vtv"` en el vehículo y nunca existe, así que todas las filas empataban y no ordenaba nada; ahora `v:` se resuelve contra los `dias` de ese documento. (2) El stat "Sin fecha cargada" era **0 fijo** (la fila se descartaba antes de poder contarse), así que la card se eliminó. Además `getElementById("vc-docs")` quedaba **duplicado** (dos stats con el mismo id) y `vencFiltrada` mezclaba mayúsculas (`Relevant`).

- **Cédulas sin vencimiento (`node scripts/marcar-cedulas-no-vence.js [--apply]`)** - `scripts/marcar-cedulas-no-vence.js` marca `documentacion.cedula = { noVence: true }` en los vehículos **sin fecha de cédula**; **nunca pisa una `fechaVencimiento` existente**. **SIN alias npm:** se corre con `node`. Sin `--apply` es dry-run. Estado: **21 vehículos marcados** el 2026-10-01 (29 en total con `noVence`, 6 con fecha real que se respetaron). Sirve para que los envíos de cédula no se cuelguen en el reporte de vencimientos.

- **Excel de control de documentación (`npm run generar:control`)** — `scripts/generar-control-documentacion.js` genera en `PATENTE/Reportes/`: `CONTROL_FALTANTES_YYYY-MM-DD.xlsx` (un renglón por documento faltante) y `CONTROL_VENCIDOS_YYYY-MM-DD.xlsx` (documentos vencidos). `npm run generar:matafuego` agrega **3** archivos: `CONTROL_MATAFUEGO_MIXERS_*.xlsx` y `CONTROL_MATAFUEGO_RESTO_*.xlsx` (los vehículos **sin** matafuego, separados) y **`CONTROL_MATAFUEGO_TODOS_*.xlsx`** (los 3 anteriores no: **toda la flota, con y sin matafuego, agrupada por tipo**). Se regeneran con esos comandos; **los `.xlsx` NO van a git** (ignorados), así que en otra PC hay que correrlos.

- **Matafuego: informe completo por tipo (2026-10-03, `scripts/generar-control-matafuego.js`)** — 3 pedidos del usuario sobre este Excel: (1) un informe con **todo junto, con y sin matafuego**; (2) los que decían **"Sin dato" ahora dicen "Sin Matafuego"**; (3) **agrupado por tipo**. Las 3 salidas usan las mismas 9 columnas (Patente, Interno, Chofer, Tipo, Centro, Estado matafuego, Vence matafuego, Documentacion faltante, Empresa).
  - `estadoMatafuego()` ya **no distingue** "Sin dato" del "estado Sin Matafuego": en los dos casos devuelve `'Sin Matafuego'` con `sinMatafuego: true`. Para no perder el dato, la fila lleva `sinDato` (flag, **no es columna**) y la consola lo cuenta aparte. `filaDe()` es la **única** constructora de filas de las 3 salidas (antes el `forEach` armaba el objeto inline).
  - `_TODOS_` se arma con `agrupadoPor: 'tipo'`: `escribir()` mete una fila de encabezado **combinada** (`mergeCells` A:I) por tipo, con `N vehiculos · M con matafuego`. **El autofiltro se omite en las salidas agrupadas**: con filas de encabezado en el medio, el filtro las mezcla.
  - **El tipo se agrupa con `normTipo()`** (minúsculas + trim, la misma clave que la app): sin eso "mixer" (22) y "Mixer" (1) salían como dos grupos del mismo tipo. Los grupos van por nombre (`localeCompare` con `sensitivity: 'base'`) y **adentro van por patente**, en orden natural (`cmp` con `{numeric:true}`, para que AH2 vaya antes que AH10). El agrupado lo hace **solo `escribir()`** (es quien mete las filas de encabezado): no agrupar antes en `main()`, porque `escribir()` vuelve a agrupar por su cuenta y descarta el pre-orden. Por eso `cmp` vive a nivel de módulo.
  - **`MIXERS` y `RESTO` no van por patente**: siguen ordenados por cantidad de documentación faltante (primero los que más papeles deben), que para ese control es lo que sirve.
  - **Census 2026-10-03 (57 vehículos): 3 con matafuego, y los 3 son mixers** (`AG148TK` — sin `fechaVto`, sale "SIN CARGAR" —, `AF804RU` 31/03/2027, `AE943EN` 18/12/2026). 54 sin: 24 nunca se cargó el campo, 30 marcados "Sin Matafuego". **Los otros 11 tipos de vehículo (Camion, Camioneta, Grua, Achello, Tolva, Bomba Pluma, Bomba de Arrastre, Acoplado, Auto, Utilitario, Camión volcador) no tienen ni un matafuego cargado**: si deberían, el dato falta en Firestore.

- **Editar y eliminar Obras (commit `0ecb9a8`)** — `PUT /api/centros/:id` ahora acepta `nombre` y valida `estado`; `DELETE /api/centros/:id` (Admin) borra la subcolección `elementos` por lotes de 400 y el doc, pero **se niega con 409 si queda algún elemento sin devolver**. En la UI (`views/centros.ejs` + `public/js/centros.js`): botones editar/eliminar en la tabla y en el detalle, 2 modales nuevos, y **guardas `isAdmin()` que falban** (la página es `requireAuth`, no admin-only, así que antes los botones se le mostraban a cualquiera y fallaban con 403). Al abrir el modal de borrado se pide `GET /api/centros/:id` porque **`asignados`/`totalElementos` solo vienen en el detalle, no en la lista**.

- **Rediseño visual del shell (commit `970afba`)** — 4 temas, topbar con reloj, ranking de empresas y services. Ver detalle abajo en "Sistema de temas y shell".

- **Carpeta de Documentación física (`carpeta-docs.ejs`)** — menú **Utilidades → Carpeta Docs** (admin, `target="_blank"`, ruta `GET /vehicles/carpeta-docs` en server.js): imprime **1 hoja (o varias) de índice maestro** (tabla con N°/interno/patente/marca-modelo/año/empresa/folio de los 57 vehículos de la flota, ordenados por interno, paginada en A4 a 20 filas la 1ra página y 26 el resto, con título en todas las hojas y pie "Página X de Y") + **1 carátula por vehículo** (A4 vertical). Cada carátula muestra: folio, interno + patente en grande, N° BET, tipo/subtipo, grilla de 4 datos (marca/modelo, año, chasis, motor; si el campo está vacío queda en blanco para completar a mano) y checklist de los 7 documentos a archivar en orden fijo (Título, Cédula, Seguro, VTV, Registro, DNI, Service) con fecha de vencimiento automática (desde `seguro.fechaVencimiento`, `vtv.fechaVencimiento`, `vencimientoRegistro`, `vencimientoDNI`, `proximoServiceFecha`), casilla "Adjuntado" y celda de folio interno; el número de página corre globalmente (índice + carátulas). Logo incrustado como data URI (`fp3d.png`, calculado en la ruta) para que figure siempre al imprimir. Uso: imprimir el índice y las carátulas, las carátulas en cartulina para separar cada vehículo en el bibliorato.

  **Modo "Solo Novedades"** (Para imprimir solo lo nuevo al agregar vehículos/documentos): la carpeta recuerda la última impresión en Firestore (`config/carpetaDocs.ultimaGeneracion`, se marca con el botón **"✓ Marcar impresos hoy"** → `POST /vehicles/carpeta-docs/marcar`). En modo novedades:
  - **Índice**: siempre completo (no cambió).
  - **Carátulas**: solo los vehículos nuevos (`createdAt >= desde`) o con documentos tocados desde esa fecha; el **folio es estable** (posición en el índice completo, no la corrida impresa) y el contador de pie de página cuenta solo las hojas impresas.
  - **Documentos** (botón verde `GET /vehicles/carpeta-docs/pdf?solo=novedades&desde=YYYY-MM-DD`): vehículo nuevo → todos sus PDFs; vehículo existente → solo los tipos que cambiaron.
  - La detección de documentos tocados la hace `cambiosDesde(fechaISO)` en `lib/github-docs.js`: lista commits de GitHub que tocaron `PATENTE/` desde la fecha (la API de commits no devuelve `files`, por eso fetchea el detalle por SHA, acotado a 25) y filtra con regex `PATENTE/{patente}/{tipo}.ext`.
  - Toggles en la barra de la herramienta: **Solo Novedades** (usa la fecha guardada) / **Ver Todo** (`?desde=all`). Sin fecha guardada aún, todo se considera novedad.
  - `DEV_READ_ONLY=true` (local) bloquea el botón "Marcar impresos hoy" (solo funciona en producción/Vercel).

- **Herramienta "Optimizaciones" — SACADA DEL MENÚ** (commit `fec5469`, 2026-10-01). Antes había una entrada **Utilidades → Optimizar Adjuntos** (`OPTIMIZADOR_URL`, default `http://localhost:8642`) agregada en `9a623eb`; se quitó porque quedó como app local separada (`Optimizaciones\iniciar.bat`). **Ya no existe ni el link ni la variable `OPTIMIZADOR_URL`** — se abre a mano desde el `.bat`. No reintroducirla sin avisar.
- **Sesión 2026-10-02 tarde (documentación de la flota, `documentacion/Update_2026.10.02_tarde.md`)** — cuatro cosas, **ningún cambio de código de app** (los commits `b38c4b3`, `bf465f2` y `7138138` son solo `PATENTE/`):
  - **Columna `Chofer` en los 4 Excel de control**, con las columnas exactas que pidió el usuario. En `generar-control-documentacion.js` (156 + 25 filas) y `generar-control-matafuego.js` (20 mixers + 34 resto). El campo es `chofer` (ver la nota en la sección de `vehicles`).
  - **Los 4 vencimientos que faltaban, cargados sin pisar nada.** `npm run cargar:vencimientos` **NO es una herramienta de auditoría**: su dry-run reporta como "a cargar" los ítems del Excel que ya son idénticos en Firestore (49 vehículos), porque solo escribe, no compara. Para saber qué falta de verdad hay que diffear con un script aparte de solo lectura. Resultado: 90 campos idénticos / **4 faltantes** / 0 conflictos → cargados con `--patente=` uno por uno (`AD718OH` VTV `21/02/2026`, `AD957RY` Seguro `07/10/2026`, `AE192RO` Seguro `07/10/2026` + VTV `15/04/2027`) → re-verificado **94/94 idénticos, 0 diferencias**. `AG889XV` tiene PDF pero no existe en Firestore.
  - **Auditoría de peso de los PDF: 193 archivos, 16 >3 MB (56,1 de 163,1 MB = 34%).** **El usuario decidió NO optimizar: los PDF quedan como están** y la app de `Optimizaciones/` queda como algo opcional. El Excel con los candidatos está en `PATENTE/Reportes/RESCANEAR_2026-10-02.xlsx` (ignorado por git).
  - La app solo reconoce nombres estrictos `PATENTE/{patente}/{tipo}.{pdf|jpg|jpeg|png}`: un archivo con nombre descriptivo largo **no aparece en ningún reporte**. No renombrar los PDF sin actualizar los readers.

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

