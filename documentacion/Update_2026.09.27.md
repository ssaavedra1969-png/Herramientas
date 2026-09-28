# Update 2026.09.27 — Centros de Trabajo / Obras

## Objetivo
Agregar un sistema de Centros de Trabajo/Obras que permite asignar elementos (vehículos, herramientas, ropa, equipos, materiales) a centros temporales como "Carlos Casares", sin modificar la colección `vehicles` existente.

## Contexto
- Los vehículos ya tienen `centroTrabajo` (Luján, Campana, etc.)
- Se necesitan centros/obras con elementos sin patente (herramientas, ropa)
- Al cerrar la obra, se debe poder ver qué elementos hubo
- Firebase Spark (plan gratuito) — minimizar lecturas/escrituras
- Compromiso: **0 modificaciones a `vehicles`**

## Estructura Firestore Nueva

```
centros/{centroId}                          → doc de catálogo
centros/{centroId}/elementos/{docId}      → asignación de elemento
```

### `centros/{centroId}`
```js
{ nombre: "Carlos Casares", estado: "activa"|"pausada"|"cerrada", ubicacion: "...", observaciones: "...", createdAt, updatedAt }
```

### `centros/{centroId}/elementos/{docId}`
```js
{ elementoId, elementoTipo: "vehiculo"|"herramienta"|"equipo"|"ropa"|"material", fechaAsignacion, fechaDevolucion: ""|"timestamp", origenCentro, observaciones }
```
- `fechaDevolucion: ""` → asignado (sin devolver)
- `fechaDevolucion: Timestamp` → devuelto
- **Query eficiente**: `where("fechaDevolucion", "==", "")` para ver asignados (índice automático single-field)

## API Endpoints Implementados

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/centros` | verifyToken | Listar centros (con TTL 60s cache) |
| POST | `/api/centros` | Admin | Crear centro/obra |
| GET | `/api/centros/:id` | verifyToken | Detalle centro + elementos (con cache) |
| PUT | `/api/centros/:id` | Admin | Actualizar (estado, ubicación, observaciones) |
| POST | `/api/centros/:id/elementos` | Admin | Asignar elemento |
| DELETE | `/api/centros/:id/elementos/:elemId` | Admin | Devolver elemento (setea fechaDevolucion) |

## Archivos Creados (5 archivos nuevos)

### `routes/centros.js`
- Backend CRUD completo + asignaciones
- 6 endpoints implementados
- Patrón: `verifyToken` / `requireAdmin` igual que `routes/vehicles.js`
- Cache TTL 60s con Map en memoria para listado y detalle
- Invalida cache al crear/actualizar/devolver

### `views/centros.ejs`
- Vista completa: lista de centros, tabla, modales
- **Modales implementados:**
  - `modal-nuevo-centro` — Crear nueva obra
  - `modal-detalle-centro` — Ver detalle de centro + elementos asignados
  - `modal-asignar` — Asignar elemento a centro
  - `modal-cerrar` — Confirmar cierre de obra
- Layout estándar: `partials/head` + `partials/sidebar` + `partials/footer`
- **Incluye `<script src="/js/centros.js"></script>`**

### `public/js/centros.js`
- Funciones principales:
  - `loadCentros()` — GET /api/centros → render tabla
  - `renderCentros()` — render con filtros de búsqueda y estado
  - `openNewCentroModal()` / `createCentro()` — nueva obra
  - `openDetalleCentro(id)` — detalle con lista de elementos
  - `openAsignarModal(id)` / `assignElement()` — asignar elemento
  - `returnElement(centroId, elemId)` — devolver elemento
  - `openCerrarModal(id)` / `confirmCloseCentro()` — cerrar obra
  - `filterByEstado()` — filtro por estado
  - `filterSearch` — búsqueda por texto
- Usa `getAuthHeaders()` global de `auth-client.js`
- `esc()`, `formatDate()` helpers internos
- Query eficiente: `where("fechaDevolucion", "==", "")` para ver asignados

## Archivos Modificados (4 archivos existentes)

### `server.js` (2 líneas agregadas)
```js
const centrosRoutes = require('./routes/centros');  // línea 15
// ...
app.use('/api/centros', centrosRoutes);              // después de /api/vehicles
```

### `views/partials/sidebar.ejs` (agregado link)
- Link "Centros de Trabajo" dentro de nav-group "Utilidades" (solo Admin)
- `<%= currentPage === 'centros' ? 'active' : '' %>` para highlight
- Icono: `M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4`

### `firestore.rules` (sección `centros` agregada)
```javascript
match /centros/{centroId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Admin';
  match /elementos/{docId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Admin';
  }
}
```

### `firestore.indexes.json` (3 índices agregados)
```json
[
  { "collectionGroup": "centros", "queryScope": "COLLECTION", "fields": [{ "fieldPath": "estado", "order": "ASCENDING" }] },
  { "collectionGroup": "centros", "queryScope": "COLLECTION", "fields": [{ "fieldPath": "nombre", "order": "ASCENDING" }] },
  { "collectionGroup": "centros", "queryScope": "COLLECTION", "fields": [{ "fieldPath": "estado", "order": "ASCENDING" }, { "fieldPath": "updatedAt", "order": "DESCENDING" }] }
]
```

## Cambios NO realizados (compromiso cumplido)
- ✅ `vehicles` collection: **0 modificaciones**
- ✅ `routes/vehicles.js`: **0 modificaciones**
- ✅ `routes/admin.js`: **0 modificaciones**
- ✅ `routes/auth.js`: **0 modificaciones**
- ✅ `public/js/vehicles.js`, `service.js`, `dashboard.js`, `reports.js`, `admin.js`, `vehicle-detail.js`, `scanner.js`: **0 modificaciones**
- ✅ `views/vehicles.ejs`, `service.ejs`, `dashboard.ejs`, `reports.ejs`, `admin.ejs`, etc.: **0 modificaciones**
- ✅ `views/partials/head.ejs`, `footer.ejs`: **0 modificaciones**
- ✅ `middleware/auth.js`: **0 modificaciones**
- ✅ `config/firebase.js`: **0 modificaciones**
- ✅ `lib/github-docs.js`, `lib/utils.js`: **0 modificaciones**
- ✅ `scripts/`: **0 modificaciones**

## Consumo Firebase (estimado por día)
- ~5-10 writes (asignaciones/devoluciones/creación de centros)
- ~10-20 queries (lecturas de centros y elementos)
- Muy bajo para plan Spark (50K reads + 20K writes/day gratis)

## Verificación Local
- ✅ `node --check server.js` → OK
- ✅ `node --check routes/centros.js` → OK
- ✅ `node --check public/js/centros.js` → OK
- ✅ `require('./server')` → "Server loaded OK"
- ✅ `require('./routes/centros')` → "centros route loaded OK"

## Rollback
- HEAD actual: `db363ce` (producción)
- Si hay problema: `git checkout db363ce -- .` y `vercel --prod`
- Los archivos nuevos se eliminan con `git rm`
- No hay datos de Firestore que modificar (colecciones nuevas, no tocan las existentes)

## Pendiente
- [x] Probar en localhost ✅ (mock mode verificado)
- [ ] Crear índices en Firebase Console (si firestore.indexes.json no aplica automáticamente)
- [x] Deploy a Vercel ✅ (`https://falpat-control-de-vehiculos.vercel.app`)
- [ ] Test de rollback
- [ ] Crear centro de prueba ("Carlos Casares")
- [ ] Asignar elementos de prueba
- [ ] Test de devolución y cierre de obra

---
Fecha: 2026-09-27
Estado: Implementación completa, deploy exitoso
Sesión: Implementación completa
Commits: `d72ec34`, `f40620e`, `01858eb`, `b84e5ef`, `01963aa`
Deploy: https://falpat-control-de-vehiculos.vercel.app
Notas: PATENTE excluido de deploy Vercel (.vercelignore) por limite 100MB
