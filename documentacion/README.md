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
| `routes/vehicles.js` | CRUD vehículos, subcolecciones combustible/repuestos, **panel services** (`/services/panel`, `/services/panel-mock`), documentos (`/documentos/*`), import/export. |
| `routes/maintenance.js` | CRUD mantenimientos. |
| `routes/admin.js` | Dashboard stats, reportes, export Excel, backup, `latest-services`. |
| `scripts/subir-documentos.js` | Sube `PATENTE/` a producción (pull+add+commit+push, solo esa carpeta). → `npm run subir:docs` |
| `scripts/cargar-vencimientos.js` | Carga masiva de vencimientos desde Excel de `PATENTE/Vtos/`. → `npm run cargar:vencimientos` |

### Frontend (EJS + JS cliente)
| Archivo | Contenido |
|---------|-----------|
| `views/*.ejs` | Páginas: `dashboard`, `vehicles`, `vehicle-detail`, `maintenance`, `reports`, `admin`, `service`, `login`, `vehicle-qr-public`, `carpeta-docs`, `fichas-taller-bulk`. |
| `views/partials/head.ejs` | `<head>` con SDKs CDN (Tailwind, Firebase, Chart.js, SweetAlert2, PapaParse, XLSX). |
| `views/partials/sidebar.ejs` | Menú lateral + menú móvil + `mobile-menu.ejs`. |
| `views/partials/footer.ejs` | Firebase init + carga de `auth-client.js` y demás scripts del footer. |
| `public/js/auth-client.js` | Helpers globales: `isAdmin()`, `getAuthHeaders()`, `deleteWithBackup()`, **`daysUntil()`** (genérico), `showToast()`, `showModal()`, etc. |
| `public/js/dashboard.js` | Dashboard: clock, search, modales alertas, fleet health, empresas, alertas VTV/choferes, últimos services. |
| `public/js/vehicles.js` | CRUD vehículos, bulk delete, filtros, import CSV/Excel. |
| `public/js/vehicle-detail.js` | Combustible + repuestos CRUD. |
| `public/js/maintenance.js` | CRUD mantenimientos. |
| `public/js/service.js` | Página Service: tabla sortable, filtros, vencimientos. **Usa `serviceDaysUntil()`** (no colisiona con auth-client). |
| `public/js/reports.js` | Reportes financieros. |
| `public/js/admin.js` | Roles de usuario. |
| `public/js/theme-engine.js` | ThemeEngine v3 (3 temas visuales animados). |
| `public/css/theme-*.css` | Variables de temas del ThemeEngine. |

### Documentación vehicular
| Ruta | Contenido |
|------|-----------|
| `PATENTE/{patente}/{tipo}.ext` | Documentos obligatorios versionados en git (título, cédula, seguro, vtv, registro, dni). Prioridad `pdf > jpg > jpeg > png`. Llegan a Vercel por integración Git. |
| `PATENTE/Vtos/` | Excel `CONTROL_VENCIMIENTOS_*.xlsx` (fuente de carga masiva de vencimientos). |
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
| `vehicles/{id}/services` | **Services realizados** (fecha, tipo, km, intervaloKm, proximoKm, proximoFecha, costo, proveedor). |
| `maintenance` | Mantenimientos (Mecánico/Legal). |
| `users` | Usuarios (role Admin/Usuario, displayName, email). |
| `counters` | `current` para auto-increment de números internos (`V-XXXXX`). |
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

---

## 5. Consejos para la IA / Quirks aprendidos

- **Colisión de helpers globales:** `auth-client.js` (cargado en el footer) define helpers globales como `daysUntil()`. Cualquier página JS que cargue antes y defina el mismo nombre es **pisada**. Usar nombres específicos del módulo (ej: `serviceDaysUntil`) para datos serializados del API (`{_seconds}`).
- **Timestamps del API** llegan al cliente como `{"_seconds":..., "_nanoseconds":0}`; los del SDK web tienen `.toDate()`. `toMs()` en service.js maneja ambos.
- **Server local no recarga en caliente** cambios de `server.js`/rutas (solo vistas y estáticos). Tras tocar rutas: matar proceso del puerto 3000 y relanzar.
- **Pre-commit hook** bloquea el commit si `HEAD != origin/main` (también si quedaron commits sin pushear). Solución: hacer `git push` del commit pendiente antes de commitear de nuevo.
- **Backups** van a `backups/` (en `.gitignore`, no se suben).
- **Índices Firestore:** los `collectionGroup` con `orderBy` exigen índice compuesto manual. Preferir traer sin orden y ordenar en memoria.