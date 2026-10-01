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
| **`Update_YYYY.MM.DD.md`** | Detalle técnico de una sesión de trabajo: qué se cambió, por qué, cómo se verificó y qué quedó pendiente. Patrón: `Update_YYYY.MM.DD.md` (ej: `Update_2026.09.28.md` = vencimientos del dashboard + Excel de control + editar/eliminar Obras; `Update_2026.09.27.md` = alta de Centros de Trabajo). | Entender el por qué de un cambio antes de tocarlo. |
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
| `routes/admin.js` | Dashboard stats, reportes, export Excel, backup, `latest-services`. |
| `lib/github-docs.js` | Lectura de la carpeta `PATENTE/` vía API de GitHub: `listarPatenteGlobal()` (todo el árbol en 1 request), `cambiosDesde()`, `esDeTipo()`. |
| `scripts/subir-documentos.js` | Sube `PATENTE/` a producción (pull+add+commit+push, solo esa carpeta). → `npm run subir:docs` |
| `scripts/cargar-vencimientos.js` | Carga masiva de vencimientos desde Excel de `PATENTE/Vtos/`. → `npm run cargar:vencimientos` |
| `scripts/generar-control-documentacion.js` | Genera `CONTROL_FALTANTES_*.xlsx` y `CONTROL_VENCIDOS_*.xlsx` en `PATENTE/Reportes/`. → `npm run generar:control` |
| `scripts/generar-control-matafuego.js` | Genera `CONTROL_MATAFUEGO_MIXERS_*.xlsx` y `CONTROL_MATAFUEGO_RESTO_*.xlsx` en `PATENTE/Reportes/`: los vehículos **sin matafuego**, separados en mezcladoras y resto, con patente, interno, estado, vencimiento y qué documentación falta. Opcionales: `--patente=XXX`, `--incluir-baja`. → `npm run generar:matafuego` |

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
| `counters` | `current` para auto-increment de números internos. OJO: hay **varios docs**, no uno solo — el código busca `counters/{tipo}` (`herramienta`, `equipo`, `ropa`, `material`, `vehiculo`) para el catálogo de elementos, con prefijo `V/H/E/R/M`. **Discrepancia sin resolver:** la doc histórica habla de `cat-{prefijo}`; hay que confirmar en la base cuál es el nombre real (ver `Update_2026.09.29.md` §2). |
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
Página `GET /reports` (**solo Admin**, `requireAdminPage`). Son **3 cards apiladas**, no tabs: `Flota`, `Documentación` y `Vencimientos` (`#sec-vencimientos`).

Todo sale de un único endpoint: `GET /api/admin/report/flota` → `routes/admin.js`, que por vehículo devuelve los campos base (`patente`, `interno`, `tipo`, `centroTrabajo`, `chofer`, `empresa`, `estado*`, ...) y, por cada uno de los **8 tipos** (`vtv`, `seguro`, `service`, `matafuego`, `dni`, `registro`, `cedula`, `titulo`), un par `<tipo>Fecha` / `<tipo>Dias` (`dias` negativo = vencido). Para cédula suma `cedulaNoVence`.

| Pieza | Dónde |
|-------|-------|
| Resolver fechas | `routes/admin.js` → `fechaYMD()`, `diasHastaYMD()`, `fechaDocVenc(v, tipo)`, `docNoVence(v, tipo)`, `resumenService(v)`, `CAMPOS_TOP` |
| Filtros + tabla + export | `public/js/reports.js` → `VENC_TIPOS`, `normTxt()`, `valoresUnicosVenc()`, `vencFiltrada()`, `celdaVenc()`, `renderVenc()`, `sortVencBy()`, `filasVencExport()`, `vencColsExport()`, `exportVencExcel()`, `exportVencPDF()`, `printVenc()`, `limpiarFiltrosVenc()` |
| Card + CSS de impresión | `views/reports.ejs` → `#sec-vencimientos`, clase `body.printing-venc` |

**Filtros** (se combinan): ventana (15/30/60/90/180/365 días), documento, estado (`todos` / `vencidos` / `proximos` / `15`), empresa, centro de trabajo, tipo de vehículo y búsqueda de texto.

**Reglas de la tabla (una fila por vehículo, 4 columnas):**
- La tabla muestra solo **Patente, Interno, Tipo** y **Vencimiento**. `Tipo` es el **tipo de vehículo** (`mixer`, `Camion`, ...), no un documento.
- Solo entran vehículos con **al menos un documento dentro de la ventana**; los días negativos (ya vencidos) también entran.
- Un vehículo aparece **una sola vez**, aunque tenga varios documentos en la ventana. No se repite una fila por documento.
- Con un documento seleccionado en el filtro, la celda muestra la fecha de **ese** documento. Con `Todos`, muestra el **más urgente** (menor `dias`) de los 8.
- Dentro de la celda **Vencimiento** se lee, en chico, el nombre del documento y los días; es texto de la misma celda, no una columna aparte.
- Los filtros de **estado** y las **stats** se calculan sobre **la misma fecha mostrada**. Ej.: filtrando `Seguro` + `≤ 15 días`, un vehículo cuyo VTV está vencido pero cuyo seguro vence en 5 días **entra**, porque lo que se mira es el seguro.
- Orden: cualquier columna es clicable. Por defecto **Vencimiento ascendente** (lo más vencido primero), que es lo que se busca al revisar vencimientos.
- Stats: **Vehículos**, **Vencidos**, **≤ 15 días**, **Docs a vencer**. Con el filtro de documento activo, **Docs a vencer** pasa a contar los documentos de ese tipo.
- **Normalización de los filtros de texto:** `empresa`, `centroTrabajo` y `tipo` se comparan con `normTxt()` (minúsculas + `trim`). La flota tiene `"mixer"` (22 vehículos) y `"Mixer"` (1) como valores distintos; sin normalizar el dropdown los separa en dos opciones y elegir una deja fuera a los de la otra.

**Impresión:** `printVenc()` pone `body.printing-venc`, que oculta el resto de la página (sidebar, las otras 2 cards, botones y los filtros) y fuerza `@page { size: portrait; margin: 12mm }` desde adentro de `@media print`; se limpia en `afterprint`. Exporta a **Excel** (XLSX) y **PDF** (jsPDF portrait) con 6 columnas: las 4 de la tabla más **Documento** y **Días**, para que al filtrar por un tipo el archivo siga siendo legible.

> **Ojo:** la página es `requireAdminPage` pero el ítem "Reportes" del menú se muestra a usuarios básicos. O se oculta el ítem o se habilita el acceso; hoy el endpoint responde 403 a un Usuario.

---

## 5. Consejos para la IA / Quirks aprendidos

- **Las fechas de documento viven en 3 esquemas distintos y conviven.** En `vehicles` una misma fecha puede estar en (a) el mapa legacy `vtv.fechaVencimiento` / `seguro.fechaVencimiento` / `matafuego.fechaVto`, (b) un campo plano de vehículo (`proximoServiceFecha`), o (c) el mapa moderno `documentacion.<tipo>.fechaVencimiento`. `routes/admin.js` resuelve con `fechaDocVenc(v, tipo)` y el orden es **legacy -> plano -> moderno**; `docNoVence(v, tipo)` interpreta `documentacion.<tipo>.noVence === true`. **No leer un solo esquema:** hoy hay 54 vehículos y ninguno tiene fecha en los 8 tipos a la vez (VTV 39, Seguro 37, Service 13, Matafuego 2, DNI 5, Registro 3, Cédula 6+Título 0).
- **Service no es un documento, es derivado.** `fechaDocVenc` no lo cubre: el endpoint usa `proximoServiceFecha` (13 vehículos) con fallback al `proximoFecha` más cercano dentro de `serviceSummary` (18 vehículos). Ojo con los `proximoFecha: null` de `serviceSummary`: significan "sin próxima fecha calculada", no "vence hoy".
- **`documentacion.<tipo>.noVence`** marca documentos que no caducan (caso típico: cédulas). Un `noVence: true` con `fechaVencimiento` presente NO cuenta como `noVence`: manda la fecha.
- **Colisión de helpers globales:** `auth-client.js` (cargado en el footer) define helpers globales como `daysUntil()`. Cualquier página JS que cargue antes y defina el mismo nombre es **pisada**. Usar nombres específicos del módulo (ej: `serviceDaysUntil`) para datos serializados del API (`{_seconds}`).
- **Timestamps del API** llegan al cliente como `{"_seconds":..., "_nanoseconds":0}`; los del SDK web tienen `.toDate()`. `toMs()` en service.js maneja ambos.
- **Server local no recarga en caliente** cambios de `server.js`/rutas (solo vistas y estáticos). Tras tocar rutas: matar proceso del puerto 3000 y relanzar.
- **Pre-commit hook** bloquea el commit si `HEAD != origin/main` (también si quedaron commits sin pushear). Solución: hacer `git push` del commit pendiente antes de commitear de nuevo.
- **Backups** van a `backups/` (en `.gitignore`, no se suben).
- **Índices Firestore:** los `collectionGroup` con `orderBy` exigen índice compuesto manual. Preferir traer sin orden y ordenar en memoria.
- **Para probar escrituras:** `npm test` (ver `tests/README.md`). Monta las rutas reales contra un Firestore falso, así que no hay que bajar `DEV_READ_ONLY` ni arriesgar la base de producción.