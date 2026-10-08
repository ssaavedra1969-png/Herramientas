# 📚 DOCUMENTACIÓN DEL PROYECTO — Mapa de información

> Índice central: dónde está cada cosa del **Sistema de Control de Mantenimiento** (Grupo Falpat SRL).

**Repo:** `https://github.com/ssaavedra1969-png/Herramientas` · **Rama:** `main`
**Producción:** https://falpat-control-de-vehiculos.vercel.app
**Firebase:** proyecto `engaged-card-450213-d7` (Firestore, plan Spark gratuito — SIN Storage)

---

## 1. Esta carpeta (`documentacion/`)

| Archivo | Qué contiene | Cuándo consultarlo |
|---------|--------------|--------------------|
| **`README.md`** | Este índice maestro. Mapa de TODA la información del proyecto. | SIEMPRE, antes de cualquier tarea. |
| **`GUIA-INSTALACION.txt`** | Guía completa para instalar en PC nueva (dependencias, Firebase service account, `vercel`, `.env`). Sección **"ANEXO — REGLAS PARA IA"** con las mismas reglas críticas. | Setear una PC nueva / reconfigurar entorno. |
| **`SETUP.md`** | Resumen corto de `GUIA-INSTALACION.txt` para clonar y correr el proyecto en una PC nueva. | Primeros pasos en máquina nueva. |
| **`CHANGELOG.md`** | Historial de cambios por sesión (features, fixes, commits, deploys, rescates). | Revisar qué se hizo en el pasado. |
| **`MS_BASE.md`** | Análisis de una **posible migración de Firestore → Microsoft SQL Server** (pros/contras). Es un documento de decisión, NO está implementado. | Evaluar futuro de la infraestructura. |
| **`RESUMEN-SESION-*.md`** | Resúmenes detallados de sesiones puntuales (diagnósticos, bugs, decisiones). Patrón: `RESUMEN-SESION-YYYY-MM-DD.md`. | Puesta al día de qué pasó en una sesión concreta. |
| **`Update_YYYY.MM.DD.md`** | Detalle técnico de una sesión de trabajo: qué se cambió, por qué, cómo se verificó y qué quedó pendiente. Patrón: `Update_YYYY.MM.DD.md` (ej: `Update_2026.09.28.md` = vencimientos del dashboard + Excel de control + editar/eliminar Obras; `Update_2026.09.27.md` = alta de Centros de Trabajo; `Update_2026.10.02.md` = columna Empresa + título con los filtros + impresión "pizarra" en Reportes; `Update_2026.10.02_tarde.md` = columna Chofer en los 4 Excel de control + carga de los 4 vencimientos que faltaban + auditoría de peso de los PDF; `Update_2026.10.03.md` = renovación de seguros: 7 certificados nuevos, `seguro.fechaVencimiento = 07/10/2026` en los 7 + fix del rótulo de `subir:docs`; `Update_2026.10.06.md` = póliza 30457810: 32 constancias separadas de `PATENTE/Seg/` por patente (incluye la corrección `AG469LY` → `AG469YL`), `BACKUP/seguro_al DD.MM.YY.pdf` del seguro viejo y fecha 07/04/2027 en los 31). | Entender el por qué de un cambio antes de tocarlo. |
| **`TAREAS_PENDIENTES/`** | Backlog priorizado de tareas en archivos `.md` independientes. Índice: `00-INDICE.md` (P0 bugs → P1 seguridad → P2 refactor → P3 cosmético). | Saber qué tareas quedaron pendientes. |
| **`rollback/`** | Guías de rollback de optimizaciones (ej: `OPTIMIZACION-LECTURAS-ROLLBACK.md`). | Revertir un lote de cambios sin perder trabajo posterior. |

## 2. Fuera de esta carpeta — archivos clave del proyecto

### Referencia para la IA
| Ruta | Contenido |
|------|-----------|
| `AGENTS.md` (raíz) | **LA referencia para la IA.** Reglas críticas (sincronización git, no commitear sin confirmar, no tocar producción), stack, estructura, colecciones Firestore, auth/permisos, patrones, sistema `PATENTE/`, registro de cambios y quirks. Este índice se actualiza desde AGENTS.md. |
| `PATENTE/README.md` | Documentación del sistema de documentos por vehículo (vive en la carpeta que documenta). |

### Backend (Node + Express)
| Ruta | Contenido |
|------|-----------|
| `server.js` | Entry point: Express, CORS, rate limit, static, rutas de páginas SSR, `devReadOnly`. |
| `config/firebase.js` | Init Admin SDK (con `projectId: sa.project_id` explícito — requisito local). |
| `middleware/auth.js` | `verifyToken`, `requireAdmin`, `loadUser` (define `res.locals.*` y `res.locals.mockMode`), `requireAuth`, `requireAdminPage`, `_baseVars`. |
| `routes/auth.js` | Login/sesión Firebase Auth + cookies. |
| `routes/vehicles.js` | CRUD vehículos, subcolecciones combustible/repuestos, **panel services** (`/services/panel`, `/services/panel-mock`), documentos (`/documentos/*`), **reporte global de documentación** (`/api/vehicles/documentos/reporte`, lee todo `PATENTE/`), import/export. |
| `routes/centros.js` | Centros de Trabajo / Obras: catálogo de elementos + contadores, crear, **editar (PUT: nombre/ubicación/estado/observaciones)**, **eliminar (DELETE: borra subcolección `elementos` + doc, con 409 si quedan elementos sin devolver)**, asignar/devolver elementos, `collectionGroup('elementos')` para la pestaña Elementos. |
| `routes/admin.js` | Dashboard stats, reportes, export Excel, backup, `latest-services`. `GET /report/flota` alimenta las 3 cards de `/reports`: resuelve las fechas de documento (`fechaDocVenc`, legacy → plano → `documentacion.<tipo>`) y lee la lista de PDFs de `PATENTE/` **desde GitHub** (`arbolPatenteR()` con caché de 10 min), porque la carpeta no está en el deploy de Vercel. |
| `lib/github-docs.js` | Lectura de la carpeta `PATENTE/` vía API de GitHub: `listarPatenteGlobal()` (todo el árbol en 1 request), `cambiosDesde()`, `esDeTipo()`. |
| `scripts/subir-documentos.js` | Sube `PATENTE/` a producción (pull+add+commit+push, solo esa carpeta). → `npm run subir:docs` |
| `scripts/cargar-vencimientos.js` | Carga masiva de vencimientos desde Excel de `PATENTE/Vtos/`. → `npm run cargar:vencimientos` |
| `scripts/generar-control-documentacion.js` | Genera `CONTROL_FALTANTES_*.xlsx` y `CONTROL_VENCIDOS_*.xlsx` en `PATENTE/Reportes/`. Columnas: **Faltantes** = Patente, Interno, **Chofer**, Tipo documento, Vencimiento, Nota · **Vencidos** = Patente, Interno, **Chofer**, Tipo documento, Vencimiento, Dias vencida, Empresa, Nota. → `npm run generar:control` |
| `scripts/generar-control-matafuego.js` | Genera **3** `.xlsx` en `PATENTE/Reportes/` con las mismas 9 columnas: Patente, Interno, **Chofer**, Tipo, Centro, Estado matafuego, Vence matafuego, Documentacion faltante, Empresa (se sacaron Subtipo, Control matafuego, el contador "Faltantes" y Nota). **`CONTROL_MATAFUEGO_TODOS_*`** = **toda la flota, con y sin matafuego, agrupada por tipo** (fila de encabezado combinada por tipo con `N vehiculos · M con matafuego`; **adentro de cada tipo, por patente**, en orden natural). `CONTROL_MATAFUEGO_MIXERS_*` y `_RESTO_*` = solo los que **no** tienen, separados en mezcladoras y resto, ordenados por cuántos papeles faltan. **Los que nunca se cargó el campo y los marcados "Sin Matafuego" ahora salen igual** (la diferencia queda solo en la consola). El tipo se agrupa sin distinguir mayúsculas (`normTipo`), si no "mixer" y "Mixer" son dos grupos. Opcionales: `--patente=XXX`, `--incluir-baja`. → `npm run generar:matafuego` |
| `scripts/marcar-cedulas-no-vence.js` | Marca `documentacion.cedula.noVence = true` en los vehículos con cédula en `PATENTE/` y **sin** fecha de vencimiento (nunca pisa una fecha existente). **Sin alias npm:** `node scripts/marcar-cedulas-no-vence.js [--apply]` (sin `--apply` es dry-run). |
| `scripts/inspeccionar-counters.js` | **Solo lectura.** Cómo se llaman los docs de `counters` y si hay internos duplicados. → `npm run inspect:counters` |

### Frontend (EJS + JS cliente)
| Archivo | Contenido |
|---------|-----------|
| `views/*.ejs` | Páginas: `dashboard`, `vehicles`, `vehicle-detail`, `reports`, `admin`, `centros`, `service`, `login`, `scanner`, `vehicle-qr-public`, `carpeta-docs`, `qr-sticker`, `qr-stickers-bulk`, `fichas-taller-bulk`. **No existe `maintenance.ejs`** (ver nota abajo). |
| `views/partials/head.ejs` | `<head>` con SDKs CDN (Tailwind, Firebase, Chart.js, SweetAlert2, PapaParse, XLSX). |
| `views/partials/sidebar.ejs` | Menú lateral de desktop (rail colapsable, secciones `Operación`/`Análisis`/`Utilidades`/`Administración`). |
| `views/partials/mobile-menu.ejs` | Menú móvil (drawer). Debe tener **los mismos destinos que el desktop**: `/centros` y `Carpeta Docs` se agregaron el 2026-10-01, faltaban. |
| `views/partials/topbar.ejs` | Barra superior: migas, buscador global, acciones y reloj. **Solo en dashboard y vehículos**; el resto de las páginas usa `.clock-float`. |
| `views/partials/footer.ejs` | Firebase init + carga de `auth-client.js` y demás scripts del footer. |
| `public/js/auth-client.js` | Helpers globales: `isAdmin()`, `getAuthHeaders()`, `deleteWithBackup()`, **`daysUntil()`** (genérico), `showToast()`, `showModal()`, etc. |
| `public/js/dashboard.js` | Dashboard: clock, search, modales alertas, fleet health, empresas, alertas VTV/choferes, últimos services. |
| `public/js/vehicles.js` | CRUD vehículos, bulk delete, filtros, import CSV/Excel. |
| `public/js/vehicle-detail.js` | Combustible + repuestos CRUD. |
| `public/js/service.js` | Página Service: tabla sortable, filtros, vencimientos. **Usa `serviceDaysUntil()`** (no colisiona con auth-client). |
| `public/js/reports.js` | Página Reportes: **3 cards apiladas** - `Flota` (tabla de la flota con columnas visibles), `Documentacion` (checklist por vehículo) y `Vencimientos` (nuevo). Ver "Reportes / Vencimientos" más abajo. |
| `public/js/admin.js` | Roles de usuario. |
| `public/js/centros.js` | Obras: tabla con filtros, pestaña Catálogo, asignar/devolver, editar y eliminar. |
| `public/js/theme.js` | Selector de tema persistente (**4 temas**: `pro`, `claro`, `industrial`, `auto`). El color de la barra del navegador se lee del CSS, no hardcodeado. |
| `public/js/clock.js` | Reloj global: monta en `.topbar-clock` si hay topbar, o en `.clock-float` si la página no tiene barra. |
| `public/js/command-palette.js` | Paleta de navegación con `Cmd+K` / `Ctrl+K`. Registra `NAV` (todos) y `ADMIN_NAV` (solo Admin, se resuelve leyendo `window.__SERVER_USER_DATA` **al renderizar**, porque el script carga con `defer` antes del footer). |
| `public/css/themes.css` | **El sistema de diseño actual** (~1.950 líneas): tokens, 4 temas, y remapeo de ~73 clases Tailwind. Se carga como último stylesheet para pisar a `styles.css`. Cache-busting con `?v=<mtime>` vía `app.locals.assetV`. |
| `public/js/theme-engine.js` | ⚠️ **Legacy, NO se carga.** themes v1/v2. Reemplazado por `theme.js` + `themes.css`. |
| `public/css/theme-*.css` | ⚠️ **Legacy, NO se cargan** (`theme-switcher`, `theme-modern`, `theme-premium`, `theme-sutil`). Nada los incluye; `head.ejs` solo carga `styles.css` + `themes.css`. |

### Tests
| Ruta | Contenido |
|------|-----------|
| `tests/fake-firestore.js` | Firestore falso en memoria (la API que usa el proyecto). Permite testear escrituras sin tocar producción. |
| `tests/helpers.js` | Inyecta el fake en `require.cache` antes de montar `routes/*.js` + reporter. |
| `tests/escrituras.test.js` | Auth, roles, obras, elementos, vehículos (47 checks). → `npm run test:escrituras` |
| `tests/negocio.test.js` | Contador del catálogo, `recomputeServiceSummary`, `FieldValue.delete()` (25 checks). → `npm run test:negocio` |
| `tests/README.md` | Cómo escribir tests nuevos + **las trampas del fake ya pisadas**. |

> **Nota — el módulo `maintenance` ya no existe.** Se documentaba
> `routes/maintenance.js`, `views/maintenance.ejs`, `public/js/maintenance.js` y
> la colección Firestore `maintenance`, pero **ninguno está en el repo**: los
> mantenimientos se fusionaron con los services y viven en
> `vehicles/{id}/services`. Las referencias quedaron en `AGENTS.md` y en las
> tablas de arriba (se marked ✗ donde se pudo); pendiente terminar la limpieza.

### Documentación vehicular
| Ruta | Contenido |
|------|-----------|
| `PATENTE/{patente}/{tipo}.ext` | Documentos obligatorios versionados en git (título, cédula, seguro, vtv, registro, dni). Prioridad `pdf > jpg > jpeg > png`. Llegan a Vercel por integración Git. |
| `PATENTE/Vtos/` | Excel `CONTROL_VENCIMIENTOS_*.xlsx` (fuente de carga masiva de vencimientos). |
| `PATENTE/Reportes/` | `CONTROL_FALTANTES_*.xlsx` y `CONTROL_VENCIDOS_*.xlsx` generados por `npm run generar:control` (ignorados por git: se regeneran con ese comando). |
| `titulo/` | Patrón previo de versionado (41 PDFs), reemplazado por `PATENTE/`. |
| `docsadjuntos/{id}/{tipo}` | (Firestore subcolección) archivos subidos manualmente desde la web (límite 700KB). |

---

## 3. Base de datos — Firestore

### Colecciones principales
| Colección | Contenido |
|-----------|-----------|
| `vehicles` | Vehículos (patente, interno, marca, vtv, seguro, documentacion, docsAdjuntos, ...). |
| `vehicles/{id}/combustible` | Cargas de combustible. |
| `vehicles/{id}/repuestos` | Repuestos usados. |
| `vehicles/{id}/services` | **Services / mantenimientos** (fecha, tipo, km, intervaloKm, proximoKm, proximoFecha, costo, proveedor). Reemplaza a la vieja colección `maintenance`. |
| `users` | Usuarios (role Admin/Usuario, displayName, email). |
| `counters` | `current` para auto-increment de números internos. OJO: hay **varios docs**, no uno solo — el código busca `counters/{tipo}` (`herramienta`, `equipo`, `ropa`, `material`, `vehiculo`) para el catálogo de elementos, con prefijo `V/H/E/R/M`, y `counters/vehicles` para la numeración de vehículos. **Resuelto el 2026-09-29 contra producción** con `npm run inspect:counters`: existen los 4 del catálogo (current 3/3/3/2) y **NO existen** `counters/vehicles` ni `counters/vehiculo` (por eso la numeración de vehículos siempre deriva del máximo real). **No hay internos duplicados** (11 elementos de catálogo, **57 vehículos V001-V057**, census re-verificado el 2026-10-02). Ver `Update_2026.09.29.md` §2. |
| `centros` | Obras del Centro de Trabajo + subcolección `elementos/` (asignaciones, con `fechaDevolucion` "" = pendiente). |
| `elementos_catalogo` | Catálogo de elementos no-vehículo (herramientas, ropa, equipos, materiales) que se asignan a las obras. |
| `config` | Config global: `carpetaDocs.ultimaGeneracion`, etc. |

### Notas clave
- **Plan Spark = gratis, SIN Storage.** No intentar migrar adjuntos a Firebase Storage (bucket no existe, da 404).
- **Créditos de lectura limitados** (~50K/día). Evitar lecturas innecesarias; el panel de services ya usa collectionGroup (2 queries en vez de 53). Ver `rollback/OPTIMIZACION-LECTURAS-ROLLBACK.md` para el detalle del trabajo de optimización.
- **`DEV_READ_ONLY=true` en `.env` local**: bloquea TODAS las escrituras a Firestore.
- Los docs de la carpeta `PATENTE/` son públicos; los subidos manualmente requieren auth.

---

## 4. Flujo de trabajo (día a día)

### Sincronización (SIEMPRE antes de editar)
```bash
git stash && git pull origin main && git stash pop
```

### Inicio de sesión
```bash
git pull origin main
npm start
```

### Cierre de sesión
```bash
git add .
git commit -m "descripcion"
git push origin main
```
Si el push falla: `git pull origin main` y repetir.

### Deploy
- `vercel --prod` (o integración Git: push a `main` despliega solo).
- ⚠️ `vercel --prod --yes` NO equivale a pushear git. Chequear que `origin/main == HEAD` al cerrar.
- ⚠️ Si Vercel pide login y falla con "Not authorized": el push a GitHub igual dispara el deploy automático.

### Herramientas externas
| Herramienta | Cómo se abre |
|-------------|--------------|
| Optimizador de adjuntos | Proyecto aparte `C:\AI\Antigravity\FALPAT srl\Optimizaciones` → `iniciar.bat` → http://localhost:8642. No toca Firebase, solo `PATENTE/`. |

### Reportes / Vencimientos
Página `GET /reports` (**solo Admin**, `requireAdminPage`). Son **3 cards apiladas**, no tabs: `Flota`, `Documentación` y `Vencimientos` (`#sec-vencimientos`). Las 3 **arrancan contraídas** (`.rpt-card.collapsed > .rpt-body { display:none }`) y cada encabezado lleva un **chip de resumen** (`#chip-flota`, `#chip-documentacion`, `#chip-vencimientos`) con el conteo, para ver la página de un vistazo.

Todo sale de un único endpoint: `GET /api/admin/report/flota` → `routes/admin.js`, que por vehículo devuelve los campos base (`patente`, `interno`, `tipo`, `centroTrabajo`, `chofer`, `empresa`, `estado*`, ...) y, por cada uno de los **8 tipos** (`vtv`, `seguro`, `service`, `matafuego`, `dni`, `registro`, `cedula`, `titulo`), un par `<tipo>Fecha` / `<tipo>Dias` (`dias` negativo = vencido). Para cédula suma `cedulaNoVence`.

> **Ojo:** el backend sigue devolviendo `tituloFecha`/`tituloDias`, pero **`VENC_TIPOS` (la vista) tiene 7 y NO el Título**: el título no vence nunca (el PDF dice que "da cuenta de la situación registral a la fecha de su último asiento"), así que su control es "¿está o no está?" y vive en la card Documentación (`DOC_TIPOS`).

**De dónde salen los documentos (fix `2da46a4`):** la card Documentación **NO puede** escanear `PATENTE/` en el disco porque esa carpeta **no está en el deploy de Vercel** (`.vercelignore` la excluye): el scan local salía vacío y marcaba "faltan documentos" en los 54 camiones (la flota ya iba por 57). La fuente real es el repo vía `lib/github-docs.js` → `listarPatenteGlobal()` (1 request `git/trees/main?recursive=1`), cacheado **10 minutos** en `routes/admin.js` (`arbolPatenteR()` / `invalidarArbolPatenteR()`). Si el árbol viene `truncated` o el fetch falla (falta `GITHUB_TOKEN`), cae al modo de a uno (`gh.listarCarpeta(patente)`). El scan local **se mantiene** y se une con `||`: en local gana el disco.

| Pieza | Dónde |
|-------|-------|
| Resolver fechas | `routes/admin.js` → `fechaYMD()`, `diasHastaYMD()`, `fechaDocVenc(v, tipo)`, `docNoVence(v, tipo)`, `resumenService(v)`, `CAMPOS_TOP`, `arbolPatenteR()`, `docsDePatenteR()` |
| Filtros + tabla + export | `public/js/reports.js` → `VENC_TIPOS`, `normTxt()`, `valoresUnicosVenc()`, `llenarMultiVenc()`, `itemMultiHtml()`, `setMultiVenc()`, `actualizarLabelsMulti()`, `toggleMultiVenc()`, `setVencAgrupar()`, `vencFiltrada()`, `pasaEstadoVenc()`, `valorVenc()`, `datosVenc()`, `celdaVenc()`, `filaGrupoVenc()`, `filaVenc()`, `renderVenc()`, `sortVencBy()`, `resumenFiltroVenc()`, `filasVencExport()`, `vencColsExport()`, `exportVencExcel()`, `exportVencPDF()`, `printVenc()`, `limpiarFiltrosVenc()` |
| Estilo común de los 3 PDF | `public/js/reports.js` → `PDF_TABLA`, `encabezadoInforme()`, `pieEnCadaPagina()`, `PDF_ANCHO_COL`, `anchosColumnasPDF()` |
| Card Documentación (columnas) | `public/js/reports.js` → `renderDoc()` (el `baseCols` de la tabla), `docFiltrada()`, `docCell()`, `filasDocExport()`, `exportDocExcel()`, `exportDocPDF()` |
| Card + CSS de impresión | `views/reports.ejs` → `#sec-vencimientos`, `#vc-doc-panel`, `#vc-empresa-panel`, `#vc-agrupar`, `.vc-multi*`, `.vc-grp*`, `#vc-subtitulo`, `td.col-empresa`, clase `body.printing-venc` |

**Columnas de la card Documentación** (12, en este orden, iguales en pantalla, Excel y PDF): Patente · Marca/Modelo · **Tipo** · Centro · Empresa · los 6 documentos (Sí/Falta) · Faltan. El campo del vehículo es `tipo` (el subtipo no entra). Todas son ordenables: la columna Tipo usa `orderVal(v,'tipo')`. El buscador de texto cubre también `tipo` y `subtipo`. **Ojo:** la card **Vencimientos ya tenía columna Tipo** (Patente · Interno · Tipo · Empresa · Vencimiento); la de Documentación era la que no la tenía.

**Filtros** (se combinan): ventana (7/15/30/60/90/180/365 días o sin límite), **documento** y **empresa** (los dos son **checklists desplegables**, se pueden elegir varios a la vez), estado (`todos` / `vencidos` / `proximos` / `15`), centro de trabajo, tipo de vehículo, búsqueda de texto y el toggle **Agrupar por empresa** (prendido por defecto).

**Los 2 filtros múltiples (documento y empresa):** `vencFilters.docs` y `vencFilters.empresas` son **arrays** (array vacío = "Todos"/"Todas"), no strings. El `<select>` se reemplazó por un botón (`.vc-multi-btn`) que muestra "Todos" / lo único elegido / "N documentos", y un panel (`.vc-multi-panel`) con un `<input type="checkbox" data-opt="...">` por opción (`itemMultiHtml()`). El valor viaja en **`data-opt`**, nunca interpolado en un `onclick`: una empresa con comilla o `&` rompería el HTML. `llenarMultiVenc()` asigna `panel.onchange` (**no** `addEventListener`) porque se vuelve a llamar al limpiar filtros y asignar reemplaza el handler en vez de acumularlo. Click fuera cierra los paneles (`document.addEventListener('click')`: si el click no es dentro de `.vc-multi`, se cierran).

**Un solo informe agrupado por empresa:** `datosVenc()` es el que arma el resultado y devuelve `{grupos, filas}`:
- `grupos === null` → vista plana (toggle apagado); `filas` es la lista ordenada.
- `grupos` → un grupo por empresa, con la clave de `normTxt(v.empresa)` (así `" obra  norte "` cae en el mismo grupo que `"Obra Norte"`), sin empresa → `"Sin empresa"`. Cada grupo trae `nombre`, `filas`, `minDias`, `vehiculos` (distintos, por patente) y `vencidos`.
- **Orden**: las **empresas** de la más urgente a la menos urgente (por su `minDias`) y, **dentro de cada empresa, los camiones por patente** (se lee como una lista de vehículos). Se implementa con `keyFila` en `datosVenc()`: si el agrupado está prendido y la columna activa es `fecha`, las filas se ordenan por `patente` y **la flecha de orden se muestra en Patente** (Vencimiento ordena las empresas). Clickear cualquier columna manda esa columna adentro del grupo. Sin agrupar manda la columna activa, como siempre.
- El encabezado de grupo (`filaGrupoVenc()`) es un `<tr class="vc-grp">` con `colspan="5"`: nombre de la empresa + "N vehículos · N documentos · N vencidos".

**Reglas de la tabla (5 columnas):**
- La tabla muestra solo **Patente, Interno, Tipo, Empresa y Vencimiento**. `Tipo` es el **tipo de vehículo** (`mixer`, `Camion`, ...), no un documento.
- Solo entran vehículos con **al menos un documento dentro de la ventana**; los días negativos (ya vencidos) también entran.
- **Una fila por vehículo con 0 o 1 documento elegido** (lista de trabajo): con uno elegido muestra la fecha de **ese** documento; con `Todos`, la **más urgente** (menor `dias`) de los 7. Sin repetidos.
- **Una fila por vehículo Y documento con 2 o más documentos elegidos**: el mismo camión aparece una vez por cada documento en ventana, cada uno con su fecha, su estado y su color. El stat **Vehículos** cuenta los vehículos **distintos** (`grupos.reduce(s => s + g.vehiculos)`), no las filas.
- Dentro de la celda **Vencimiento** se lee, en chico, el nombre del documento y los días; es texto de la misma celda, no una columna aparte.
- **Empresa** con `max-width:200px` + ellipsis en pantalla (el valor completo va en el `title`), **sin recorte al imprimir** (en la pizarra tiene que leerse entero).
- Los filtros de **estado** y las **stats** se calculan sobre **la misma fecha mostrada**. Ej.: filtrando `Seguro` + `≤ 15 días`, un vehículo cuyo VTV está vencido pero cuyo seguro vence en 5 días **entra**, porque lo que se mira es el seguro.
- Orden: cualquier columna es clicable. Por defecto **Vencimiento ascendente** (lo más vencido primero), que es lo que se busca al revisar vencimientos.
- Stats: **Vehículos**, **Vencidos**, **≤ 15 días**, **Docs a vencer**. Con el filtro de documento activo, **Docs a vencer** pasa a contar los documentos de ese tipo.
- **Normalización de los filtros de texto:** `empresa`, `centroTrabajo` y `tipo` se comparan con `normTxt()` (minúsculas + `trim`). La flota tiene `"mixer"` (22 vehículos) y `"Mixer"` (1) como valores distintos; sin normalizar el dropdown los separa en dos opciones y elegir una deja fuera a los de la otra.

**El título dice QUÉ se está imprimiendo (fix `f04c43e`):** `resumenFiltroVenc()` arma una línea con `VENC_ESTADOS` tipo `Seguro + VTV · Por vencer · hasta 30 días · 2 empresas · agrupado por empresa · tipo: mixer · búsqueda: "..."` y se inyecta en dos lugares: `#vc-subtitulo` (bajo el título en pantalla) y el **título del PDF** (con `splitTextToSize`, que corre la línea y recalcula el `startY` de la tabla). `renderVenc()` la refresca en cada render, así que siempre refleja los filtros vivos. Sin esto, un PDF colgado en la pizarra con "Vencimientos" a secas no dice si es el reporte completo o el filtrado por Seguro.

**Impresión:** `printVenc()` pone `body.printing-venc`, que oculta el resto de la página (sidebar, las otras 2 cards, botones y los filtros) y fuerza `@page { size: portrait; margin: 12mm }` desde adentro de `@media print`; se limpia en `afterprint`. El CSS está calibrado para **pizarra**: header de tabla negro con letras blancas 10pt, celdas 11pt con bordes 0.5pt, `white-space: normal`, oculta la descripción web (`.rpt-desc`), saca la flecha de orden y sube las dos líneas chicas de la celda de vencimiento a 9.5/9pt. El **encabezado de empresa** se imprime en 13pt negro sobre gris (`tr.vc-grp td`), que es lo que ordena el trabajo en la pizarra.

**Exports:** los 3 PDF (Flota, Documentación, Vencimientos) llevan el logo `fp3d.png` incrustado (`getLogoBase64()`, cacheado en `_logoB64`) y usan `autoTable`. **Los 3 comparten el mismo estilo "pizarra"** (`PDF_TABLA`): cuerpo **9pt**, header **9.5pt** negro con letras blancas, **grilla de 0.5mm en #1F2937**, filas alternadas, `cellPadding: 2`, y pie con número de página **en todas las páginas** (`pieEnCadaPagina()` como `didDrawPage`, con `margin.bottom: 16`). El encabezado lo arma `encabezadoInforme()` en los tres (Flota y Documentación tenían el suyo con `y0 = 36` fijo).

> **Antes el de Flota y el de Documentación iban en 5.5pt sin bordes**, ilegibles de lejos. Si se agrega un PDF nuevo, usar `PDF_TABLA` + `encabezadoInforme()` + `pieEnCadaPagina()`.

- **Anchos:** Flota es de ancho variable (el usuario elige columnas), así que `anchosColumnasPDF()` reparte los 273 mm según `PDF_ANCHO_COL` (empresa 30, chofer 26, centroTrabajo 28, chasis/numeroMotor 24... el resto 14). Documentación tiene anchos fijos que suman 258 de los 273 disponibles: Patente 26, Marca/Modelo 44, **Tipo 24**, Centro 30, Empresa 40, 6 columnas de documento 13, Faltan 16.
- **Vencimientos** mantiene su **portrait de 6 columnas** (7 con multi-documento) con anchos fijos que suman 186 mm; los días salen como `N Dias Vencidos` / `N Dias a Vencer`.
- Los dos exports de Vencimientos salen en **el mismo orden que la pantalla** (`filasVencExport()` y `exportVencPDF()` usan `datosVenc()`). El **Excel** siempre tiene **7 columnas** (Patente, Interno, Tipo, Empresa, Fecha vencimiento, Documento, Dias — `Empresa` con `wch:24`). El PDF suma la columna `Documento` cuando hay 2+ documentos elegidos: sin ella el mismo camión sale dos veces y no se dice qué hay que renovar. Con agrupación, cada grupo se imprime como **fila combinada** (`colSpan`) con fondo gris y la empresa en mayúsculas.
- **Para probarlos en Node hay que instalar jsPDF** (la app los carga por CDN): `npm install --no-save jspdf@2.5.1 jspdf-autotable@3.8.2`, generar con `doc.output('arraybuffer')` e **inflar los streams con `zlib.inflateSync`**: ahí aparecen los `/F1 9 Tf` (tamaño de letra) y los bordes `0.5 w` + `0.12 0.16 0.22 RG`, uno por celda. Es la única forma de confirmar que el estilo entró en el archivo y no solo en el código. **Cuidado con medir un PDF viejo**: el harness escribe en `%TEMP%\reporte-test-*.pdf`, así que hay que mirar la fecha de modificación del archivo.

> **Ojo:** la página es `requireAdminPage` pero el ítem "Reportes" del menú se muestra a usuarios básicos. O se oculta el ítem o se habilita el acceso; hoy el endpoint responde 403 a un Usuario.

---

## 5. Consejos para la IA / Quirks aprendidos

- **Las fechas de documento viven en 3 esquemas distintos y conviven.** En `vehicles` una misma fecha puede estar en (a) el mapa legacy `vtv.fechaVencimiento` / `seguro.fechaVencimiento` / `matafuego.fechaVto`, (b) un campo plano de vehículo (`proximoServiceFecha`), o (c) el mapa moderno `documentacion.<tipo>.fechaVencimiento`. `routes/admin.js` resuelve con `fechaDocVenc(v, tipo)` y el orden es **legacy -> plano -> moderno**; `docNoVence(v, tipo)` interpreta `documentacion.<tipo>.noVence === true`. **No leer un solo esquema:** hoy hay **57 vehículos** y ninguno tiene fecha en los 8 tipos a la vez (VTV 39, Seguro 37, Service 13, Matafuego 2, **DNI 6**, Registro 3, Cédula 6+Título 0). Census re-verificado contra producción el 2026-10-02.
- **Service no es un documento, es derivado.** `fechaDocVenc` no lo cubre: el endpoint usa `proximoServiceFecha` (13 vehículos) con fallback al `proximoFecha` más cercano dentro de `serviceSummary`. **Hoy el fallback no aporta ningún vehículo**: los 13 de `proximoServiceFecha` son exactamente los mismos 13 de `serviceSummary` (V008, V010, V014-V016, V018, V023, V024, V027, V030, V032, V034, V049), re-verificado el 2026-10-02. El código se queda (es una red de seguridad gratis) pero no esperes que sume vehículos. Ojo con los `proximoFecha: null` de `serviceSummary`: significan "sin próxima fecha calculada", no "vence hoy".
- **`documentacion.<tipo>.noVence`** marca documentos que no caducan (caso típico: cédulas). Un `noVence: true` con `fechaVencimiento` presente NO cuenta como `noVence`: manda la fecha.
- **Colisión de helpers globales:** `auth-client.js` (cargado en el footer) define helpers globales como `daysUntil()`. Cualquier página JS que cargue antes y defina el mismo nombre es **pisada**. Usar nombres específicos del módulo (ej: `serviceDaysUntil`) para datos serializados del API (`{_seconds}`).
- **Timestamps del API** llegan al cliente como `{"_seconds":..., "_nanoseconds":0}`; los del SDK web tienen `.toDate()`. `toMs()` en service.js maneja ambos.
- **Server local no recarga en caliente** cambios de `server.js`/rutas (solo vistas y estáticos). Tras tocar rutas: matar proceso del puerto 3000 y relanzar.
- **Pre-commit hook** bloquea el commit si `HEAD != origin/main` (también si quedaron commits sin pushear). Solución: hacer `git push` del commit pendiente antes de commitear de nuevo.
- **Backups** van a `backups/` (en `.gitignore`, no se suben).
- **Índices Firestore:** los `collectionGroup` con `orderBy` exigen índice compuesto manual. Preferir traer sin orden y ordenar en memoria.
- **Para probar escrituras:** `npm test` (ver `tests/README.md`). Monta las rutas reales contra un Firestore falso, así que no hay que bajar `DEV_READ_ONLY` ni arriesgar la base de producción.