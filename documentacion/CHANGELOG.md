# CHANGELOG — Sistema de Control de Mantenimiento

Cambios registrados por sesión. Última actualización: 2026-10-02.

## 2026-10-02 — Reportes: columna Empresa, título con los filtros e impresión "pizarra"

Detalle completo en **`Update_2026.10.02.md`**. Commit: **`f04c43e`**. En la misma
sesión: 10 PDF nuevos en `PATENTE/` y documentación puesta al día.

### Columna Empresa en Vencimientos
- La tabla de la card **Vencimientos** pasó de 4 a **5 columnas**: `Patente | Interno | Tipo | Empresa | Vencimiento`. `renderVenc()` suma el `<th>` clickeable (orden por `orderVal(a.v,'empresa')`, que funciona porque `empresa` sí es un campo del vehículo) y el `<td class="col-empresa" title="valor completo">`.
- Los nombres de empresa son largos y estiraban la tabla: en pantalla `td.col-empresa` lleva `max-width:200px` + ellipsis, con el valor entero en el `title`.

### El título del reporte dice QUÉ se imprimió
- `resumenFiltroVenc()` + `VENC_ESTADOS` arman una línea con los filtros puestos: `Todos los documentos · Por vencer · hasta 30 días · empresa: X · centro: Y · tipo: mixer · búsqueda: "..."`.
- Se inyecta en dos lugares: `#vc-subtitulo` (nuevo `<p>` bajo el título, con la clase `.rpt-desc` en la descripción vieja para poder esconderla al imprimir) y el **título del PDF**. En el PDF usa `splitTextToSize` para que la línea corra si es larga, y recalcula el `startY` de `autoTable` a partir de las líneas que salió.
- `renderVenc()` la refresca en cada render → refleja los filtros en vivo, no queda desactualizada al cambiar un select.

### Impresión calibrada para pizarra
- El destino real de este reporte es una pizarra: los grises claros y las letras chicas no se leen a distancia. En `body.printing-venc`:
  - header de tabla **negro `#111827` con letras blancas 10pt** y borde 0.7pt (antes era gris claro `#e5e7eb` con texto negro);
  - celdas **11pt**, bordes 0.5pt, `white-space: normal`;
  - `td.col-empresa` **anula el recorte** (`max-width:none`, `overflow:visible`, `text-overflow:clip`): en la pizarra el nombre tiene que leerse entero;
  - las dos líneas chicas de la celda de vencimiento (`.text-[11px]` / `.text-[10px]`) suben a **9.5pt / 9pt** y en negrita;
  - se oculta la descripción web (`.rpt-desc`), la flecha de orden (`.sort-arrow`) y el `hover` de fila;
  - `#vc-subtitulo` (los filtros) queda en 12pt negrita: es la línea que identifica el reporte impreso;
  - los textos grises `#8b9bb4` pasan a negro (antes bajaban a `#666`, que no se leía).

### Exports
- **Excel** con 7 columnas (agrega **Empresa**, con `wch:24`, y `Fecha vencimiento` con `wch:16`); se sigue exportando **Documento** porque en Excel la celda de vencimiento no viaja con formato.
- **PDF** con 6 columnas y `columnStyles` de anchos fijos: Patente 25 (negrita), Interno 19 (centrado), Tipo 28, Empresa 46, Fecha venc. 28, Dias 40 (negrita 10pt). Letra 9.5–10pt y bordes más gruesos.
- El PDF ya **no saca la columna Documento** (`efd5f71`): el nombre del documento lo lleva la celda en la web, y en la pizarra suma una columna que no aporta.

### Documentación nueva en `PATENTE/` (10 PDF)
- Nuevos: `AE344VR/dni.pdf`, `AE344VR/registro.pdf`, `AE449YW/dni.pdf`, `AE449YW/registro.pdf`, `AG148TK/dni.pdf`, `AG148TK/registro.pdf`, `AG719US/dni.pdf`, `AG976PE/dni.pdf`, `AG976PE/registro.pdf`.
- Optimizado: `AG148TK/cedula.pdf` (146 KB, 1 página). Borrado el duplicado `AG148TK/cedula1.pdf`.
- **Validados antes de commitear** con `pdf-lib`: los 10 abren (header `%PDF-`, `%%EOF` presente) y el conteo de páginas es correcto — 1 salvo `AE344VR/dni.pdf`, `AE344VR/registro.pdf`, `AE449YW/dni.pdf`, `AE449YW/registro.pdf`, `AG148TK/dni.pdf` y `AG976PE/dni.pdf`, que son de 2 páginas (DNI y Registro suelen traer anverso y reverso).
- Efecto en el control: Registro con archivo **11 → 13**, DNI **10 → 12**, faltantes totales **160 → 156**.

### La flota son 57 vehículos (no 54) — census re-verificado
- Re-verificado contra producción (**solo lectura**, sin escrituras): **57 vehículos, todos en servicio**, internos `V001`..`V057` **sin repetidos**.
- Census de fechas de documento: VTV 39, Seguro 37, Service 13, Matafuego 2, **DNI 6** (antes figuraba 5), Registro 3, Cédula 6 (+29 con `noVence`), Título 0.
- **Corrección importante sobre Service:** el fallback de `resumenService()` **hoy no aporta ningún vehículo**. Los 13 con `proximoServiceFecha` son **exactamente los mismos 13** con fecha en `serviceSummary` (V008, V010, V014-V016, V018, V023, V024, V027, V030, V032, V034, V049). El "13 → 18 vehículos" que se midió el 2026-10-01 era de otra fecha de corte. El código queda como está (es una red de seguridad gratis) pero **no esperes que hoy sume vehículos**: si se toca `resumenService()`, lo que hay que probar es que no haga perder fechas.
- Se actualizaron las referencias a "54 vehículos" en `AGENTS.md`, `documentacion/README.md` y `TAREAS_PENDIENTES/00-INDICE.md`. Las entradas históricas del CHANGELOG se dejan con el número que tenían al momento.

### Excel de control regenerado
- `npm run generar:control` → `CONTROL_FALTANTES_2026-10-02.xlsx` (**156 documentos faltantes**) y `CONTROL_VENCIDOS_2026-10-02.xlsx` (**25 vencidos**: Cédula 6, VTV 6, Seguro 10, Registro 2, DNI 1).
- `npm run generar:matafuego` → `CONTROL_MATAFUEGO_MIXERS_2026-10-02.xlsx` (**21 filas**) y `CONTROL_MATAFUEGO_RESTO_2026-10-02.xlsx` (**34 filas**). Solo 2 de 57 tienen matafuego cargado (31 sin dato, 24 marcados "Sin Matafuego").
- Con archivo en disco: Título 43, Seguro 43, Cédula 35, VTV 40, Registro 13, DNI 12. Quedan **4 carpetas vacías** (`AD221FP`, `AH232ME`, `DML84`, `LFI597`): no se versionan porque git ignora las carpetas vacías.
- Los `.xlsx` **no van a git** (`.gitignore:5`), como siempre: en otra PC hay que correr los dos comandos.

## 2026-10-01 — Reportes: Vencimientos, fix de documentación y exportación

Commits: **`d52ec39`**, **`a80a6fc`**, **`10cc58a`**, **`7ed4240`**, **`2da46a4`**, **`0c1c5f0`**, **`efd5f71`**.

### Nueva sección "Vencimientos" (`d52ec39`)
- `GET /reports` (solo Admin) suma una 3ra card `#sec-vencimientos` a las 2 que ya había. Son **3 cards apiladas, no tabs**, alimentadas por el mismo `GET /api/admin/report/flota`.
- 7 filtros combinables (ventana 15-365 días, documento, estado, empresa, centro, tipo, texto), export Excel/PDF e impresión con `printVenc()`.
- Backend: `fechaDocVenc()` / `docNoVence()` resuelven las fechas que conviven en **3 esquemas** (legacy anidado → campo plano → `documentacion.<tipo>`). Contra Firestore real (54 vehículos): **0 fechas sin detectar** en los 8 tipos.
- **Service no aparecía nunca:** es derivado, no un documento, así que `fechaDocVenc` no lo cubre. Usa `proximoServiceFecha` con fallback al `proximoFecha` más cercano de `serviceSummary` (13 → **18 vehículos** con fecha).
- Tres bugs más de paso: el orden por columnas de documento no ordenaba nada (`orderVal` buscaba la propiedad `"v:vtv"`, que no existe, así que todas las filas empataban); el stat "Sin fecha cargada" era **0 fijo** (la fila se descartaba antes de poder contarse) → se eliminó la card; y `id="vc-docs"` estaba duplicado en dos stats.
- Verificado: 105/105 tests, `reports.ejs` renderiza, el server arranca.

### Fix: la documentación salía toda faltante (`2da46a4`)
- `GET /api/admin/report/flota` escaneaba `PATENTE/` en el **disco local**, pero `PATENTE/` **no está en el deploy de Vercel** (`.vercelignore` la excluye; pesa 160 MB), así que en producción el scan salía vacío y la card marcaba "faltan documentos" en los **54 camiones**.
- Ahora la fuente real es el **repo**: `lib/github-docs.js` → `listarPatenteGlobal()` (1 request de `git/trees/main?recursive=1` para toda la carpeta) con caché de **10 minutos** (`arbolPatenteR()` / `invalidarArbolPatenteR()`). Si el árbol viene `truncated` o falla (falta `GITHUB_TOKEN`), cae al modo de a uno (`gh.listarCarpeta`). El scan local **se mantiene** y se une con `||`: en local gana el disco.
- Además: las **3 cards arrancan contraídas** y cada encabezado lleva un **chip de resumen** (`#chip-flota`, `#chip-documentacion`, `#chip-vencimientos`).
- El **Título sale de `VENC_TIPOS`**: no vence nunca ("da cuenta de la situación registral a la fecha de su último asiento"), así que su control es "¿está o no está?" y vive en la card Documentación.

### Exportadores PDF (`0c1c5f0`, `efd5f71`)
- Los 3 PDF llevan el **logo `fp3d.png` incrustado** (`getLogoBase64()`, cacheado en `_logoB64`) y usan `autoTable`.
- Días formateados como `N Dias Vencidos` / `N Dias a Vencer` en vez del número pelado; letra más grande.

### Cédulas que no vencen (`a80a6fc`)
- `scripts/marcar-cedulas-no-vence.js` marca `documentacion.cedula = { noVence: true }` en los vehículos con cédula en `PATENTE/` y **sin** fecha. **Nunca pisa una `fechaVencimiento` existente**; el update va por ruta punteada, así que no toca seguro ni VTV.
- Dry-run por default, `--apply` para escribir. **Sin alias npm** (se corre con `node`). Aplicado a **21 vehículos** (29 marcados en total); las 6 con fecha real quedaron como estaban.

### Menú móvil y Cmd+K (`10cc58a`)
- `mobile-menu.ejs`: agrega `/centros` y **Carpeta Docs**, que faltaban. Queda con los mismos destinos que el desktop (10 para Admin, 6 para Usuario). El grupo Utilidades también se abre en `/carpeta`.
- `sidebar.ejs`: saca `utilOpen` y `toggleNavGroup`, sin uso desde que Utilidades dejó de ser desplegable en desktop (`970afba`).
- `command-palette.js`: agrega `ADMIN_NAV` (Stickers QR, Fichas Taller, Carpeta Docs, Usuarios), resuelto **al renderizar** porque el script carga con `defer` antes del script inline del footer que define `__SERVER_USER_DATA`.
- Nuevo `scripts/generar-control-matafuego.js` → `npm run generar:matafuego`: `CONTROL_MATAFUEGO_MIXERS_*.xlsx` y `CONTROL_MATAFUEGO_RESTO_*.xlsx` en `PATENTE/Reportes/` (los vehículos **sin** matafuego, separados en mezcladoras y resto).

### Documentos (`7ed4240`)
- Optimizadas `AF804RU/cedula.pdf` y `AG276BQ/cedula.pdf`; nuevos adjuntos: `AF804RU/dni.pdf`, `AF804RU/registro.pdf`, `AG719US/registro.pdf`, `AH052ZE/dni.pdf` (2 páginas: el DNI venía escaneado en dos imágenes y se unificó) y `AH052ZE/registro.pdf`. Borrado el duplicado `AF804RU/cedula1.pdf`.
- Todos los archivos quedaron como `<tipo>.pdf`, que es lo que matchea `DOC_TIPOS` en `lib/github-docs.js` y en `scanDocsCarpeta()` de `server.js`.

## 2026-09-29 — Auditoría del proyecto, fix del contador del catálogo y harness de tests

Detalle completo en **`Update_2026.09.29.md`**.

### Fix: el contador del catálogo generaba un `interno` duplicado (commit `d98d8d8`)
- `getNextCatalogNumber()` (`routes/centros.js`): la rama que **inicializa** el counter guardaba `{current: max}` pero devolvía `max+1`, mientras que la rama que **incrementa** guarda y devuelve el mismo valor. La segunda alta de un tipo repetía el número del primer elemento (`H008, H008, H009...`).
- El `interno` es la identidad del elemento: es el `value` del select de asignación y la clave de `catMap[c.interno]`. Con duplicado, dos elementos eran indistinguibles y el segundo pisaba al primero en la resolución de nombre/marca/modelo.
- Fix de una línea: guardar `max + 1`.
- Alcance: solo `POST /api/centros/elementos/disponibles`. En producción la rama corregida ni se ejecuta (el counter ya existe), así que no hay riesgo de regresión.

### Fix: el mismo off-by-one en la numeración de vehículos
- `getNextVehicleNumber()` (`public/js/auth-client.js:270`, código **cliente**, no una ruta) tenía el bug idéntico: guardaba `{current: max}` y devolvía `max+1`, así que la segunda alta repetía el `V-XXX`. Corregido a `{current: max + 1}`.
- **Este era más urgente que el del catálogo:** `counters/vehicles` no existe en la base, así que la numeración de vehículos cae *siempre* en la rama de derivar del máximo real — que es justo la que estaba rota. El primer día que se creara el doc, el segundo vehículo habría repetido el número.
- Cubierto con `tests/vehiculos-numeracion.test.js` (16 checks). Al ser código cliente no se prueba por HTTP: la suite extrae la función del archivo por texto y la evalúa con `new Function` contra el db falso. **El test se validó reintroduciendo el bug a propósito** (falla 5 de 16, con la secuencia `V011,V011,V012,...`).

### Confirmado contra producción: cómo se llaman los counters (solo lectura)
- `npm run inspect:counters` (`scripts/inspeccionar-counters.js`, **no escribe nada**).
- La doc histórica estaba mal: decía `cat-{prefijo}` y `vehicles-{tipo}`. **No existe ningún doc con esos nombres.** Existen `counters/{herramienta,equipo,ropa,material}` (current 3/3/3/2), que es exactamente lo que busca el código (`doc(tipo)`). **El fix del catálogo sí es efectivo.**
- **No existen** `counters/vehicles` ni `counters/vehiculo`.
- **No hay internos duplicados**: `elementos_catalogo` 11 docs (H001-H003, E001-E003, R001-R003, M001-M002) y `vehicles` 54 (V001-V054), sin repeticiones. Nada que limpiar.

### Fix: el import masivo podía duplicar internos y perder el counter
- `executeCsvImport()` (`public/js/vehicles.js:1160`) tiene **su propia numeración**, separada del alta manual, así que no hereda las protecciones de `getNextVehicleNumber()`. Dos huecos corregidos:
  - **Duplicados dentro del propio lote:** el chequeo de conflictos solo consultaba Firestore con `where('interno','in',chunk)`. Un Excel con dos filas que ya traen `V055` no colisionaba con nadie (todavía no existía) y **las dos se guardaban con el mismo interno**. Ahora se aborta la importación, con un mensaje distinto al de "ya existe en la base".
  - **El `catch (_) {}` silencioso:** los vehículos ya se habían importado, pero el counter quedaba atrás y la próxima alta manual derivaba del máximo real → **reusaba un número ya asignado**. Ahora avisa y explica el riesgo.
- `showToast()` acepta una duración opcional (default 4000, así que las 108 llamadas existentes no cambian) y da 6 s a los avisos con salto de línea, que a 4 s no se leen.
- Cubierto con `tests/import-vehiculos.test.js` (17 checks). **Ambos fixes validados revirtiéndolos**: sin el chequeo de lote fallan 7 de 17, con el `catch` silencioso fallan 2.
- El fake necesitaba el operador `in` y `collection().doc().set()` anidado. Documentado en `tests/README.md`.

### Harness de tests contra un Firestore falso (nuevo)
- `tests/fake-firestore.js` emula la API de Firestore que usa el proyecto; `tests/helpers.js` la inyecta en `require.cache` antes de montar `routes/*.js` y levanta un Express en un puerto efímero.
- Permite testear **escrituras** sin tocar producción, esquivando el `DEV_READ_ONLY=true` (el `.env` local apunta a la misma base). No hay que bajar el read-only ni hacer backup.
- 4 suites, 105 checks: `npm test`. Cubren auth/roles, alta y edición de obras, el **409 de borrar obra** (incluido el caso legacy sin `fechaDevolucion`), borrado en cascada por batches, `recomputeServiceSummary` (y su recálculo al borrar), `FieldValue.delete()` sobre `docsAdjuntos`, y las regresiones de los dos contadores.
- Detalle y trampas del fake: `tests/README.md`.

### Auditoría general — sin hallazgos
- `node --check` limpio en rutas, middleware, config, 14 JS de `public/js` y 8 scripts. Las 19 vistas EJS compilan sin includes ni assets rotos. Los 63 archivos de `public/` responden 200. CSS balanceado. Logs limpios.
- 49 rutas backend vs 28 llamadas del frontend: **0 llamadas rotas**. Las 4 rutas sin guarda son legítimas (las 3 de login + `panel-mock`, que solo devuelve datos falsos).

### Commits
- `b95bf61` fix(vehicles): el import masivo podia duplicar internos y perder el counter
- `855aa7c` chore(scripts): simulacion de la proxima alta
- `4d2bf14` fix(auth-client): mismo off-by-one en la numeracion de vehiculos
- `a007c7e` tests: harness contra un Firestore falso + documentacion
- `d98d8d8` fix(centros): contador del catalogo generaba un interno duplicado

### Deploys (Vercel, producción)
- `b95bf61`, `855aa7c`, `4d2bf14` → deploy automático por push a `main`.
- Verificado: `/login`, `themes.css`, `vehicles.js`, `auth-client.js`, `fp3d.png` → 200; `/api/vehicles` sin token → 401. Los 3 fixes confirmados **en el JS que sirve producción**, no solo en git.
- **Producción nunca se escribió.** Lo único que se tocó la base fue una consulta de lectura (`npm run inspect:counters`). El servidor local quedó con `DEV_READ_ONLY=true` y todo su tráfico registrado como `Blocked`.
- Alias: https://falpat-control-de-vehiculos.vercel.app

### Resguardo
- **Producción nunca se escribió.** Toda la verificación de escrituras corrió contra el Firestore falso. El servidor local quedó con `DEV_READ_ONLY=true` y todo su tráfico registrado como `Blocked`. No se requirió backup de datos.

## 2026-09-28 — Vencimientos del dashboard, Excel de control de documentación y editar/eliminar Obras

Detalle completo en **`Update_2026.09.28.md`**.

### Dashboard: vencidos separados de los que vencen (commit `0ecb9a8`)
- Cada tipo de documento se cuenta dos veces en `public/js/dashboard.js`: `vencidos` (fecha pasada) y `proximos` (1 a 30 días). **El número grande de la tarjeta cuenta solo los que están por vencer**; los vencidos van aparte con su cantidad.
- Estado real de la flota: **28 por vencer / 25 vencidos** (VTV 2+6, Seguro 26+10, Cédula 0+6, Registro 0+2, DNI 0+1). Service sigue por fecha y por km.
- La documentación ahora se lee de la **carpeta `PATENTE/{patente}/`** (no del mapa `documentacion`); el archivo subido desde la web tiene prioridad.
- `lib/github-docs.js` → `listarPatenteGlobal()` trae todo el árbol `PATENTE/` en **un solo request** a la API de GitHub; `GET /api/vehicles/documentos/reporte` lo mezcla con los adjuntos de Firestore, con caché y fallback al disco. Verificado: 54 filas (VTV 38, Seguro 41, Cédula 34, Registro 6, DNI 5, Título 42).

### Excel de control de documentación (commit `0ecb9a8`)
- Nuevo `npm run generar:control` → `scripts/generar-control-documentacion.js` genera en `PATENTE/Reportes/`:
  - `CONTROL_FALTANTES_2026-09-28.xlsx`: **158** documentos faltantes.
  - `CONTROL_VENCIDOS_2026-09-28.xlsx`: **25** documentos vencidos.
- Los `.xlsx` están en `.gitignore` (se regeneran con el comando en cada PC).

### Centros de Trabajo: editar y eliminar obras (commit `0ecb9a8`)
- `PUT /api/centros/:id` acepta **nombre** y valida `estado` (`activa`/`pausada`/`cerrada`); recorta los textos igual que el POST.
- **`DELETE /api/centros/:id`** (Admin) nuevo: borra la subcolección `elementos` por lotes de 400 y el doc, y **se niega con 409 si queda algún elemento sin devolver** (chequeo en memoria, no con `where`, para no dejar pasar los elementos viejos que no tienen `fechaDevolucion`).
- UI: botones editar/eliminar en la tabla y en el detalle + 2 modales nuevos, con **guardas `isAdmin()` que faltaban** (la página es `requireAuth`, no admin-only).
- Verificado con un `db` fake (29/29 checks: vacía, solo devueltos, con pendientes, legacy, inexistente, 900 elementos en 3 batches, y todas las validaciones del PUT). **Pendiente: probar un borrado real en producción** con una obra de prueba.

### Commits
- `0ecb9a8` dashboard: separa vencidos de los proximos, docs desde PATENTE/ y Excel de control; centros: editar/eliminar

### Deploys (Vercel, producción)
- `0ecb9a8` → deploy automático por push a `main`
- Alias de producción: https://falpat-control-de-vehiculos.vercel.app

### Resguardo
- Sin cambios de escritura en Firestore (todo verificado con `db` fake; `DEV_READ_ONLY` bloqueó las pruebas reales). No se requirió backup de datos.

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
