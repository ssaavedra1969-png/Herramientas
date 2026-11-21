# Actualización 2026-11-21 — Módulo Empleados (choferes por DNI)

Puesta al día para la próxima IA y para la otra PC. Implementa una sección nueva **Empleados** que deja de tratar al chofer como un texto suelto dentro de cada vehículo: agrupa vehículos por chofer + DNI, mantiene un perfil por persona, guarda sus documentos en GitHub, registra el historial de asignaciones y permite trasladar un chofer de una patente a otra con documentos e historial.

Estado: **código y tests listos; commit/push pendiente de autorización explícita**.

---

## 1. Decisión de modelo

- La fuente operativa sigue siendo `vehicles.chofer` (nunca `conductorHabitual` para escribir; ese campo solo se tolera en lectura).
- Un vehículo tiene **un solo chofer**.
- Un chofer puede aparecer en **varias patentes**; el listado los agrupa.
- La identidad del perfil es `clave = nombre normalizado | DNI normalizado`:
  - `normalizarNombre()`: sin tildes, minúsculas, espacios colapsados.
  - `normalizarDni()`: solo alfanuméricos, mayúsculas.
- Dos personas con el mismo nombre pero DNI distinto se mantienen como **perfiles separados** y se marca `conflictos: ['Posible duplicado por DNI distinto']`.
- Los perfiles que vienen solo de vehículos y todavía no están guardados en `employees` se muestran como **virtuales** (`virtual: true`, `id: null`) con acción **Sincronizar**. Esa acción los crea como perfiles reales; no se crean en silencio.
- El chofer reemplazado **nunca se elimina**: se cierra su historial (`hasta = hoy`), queda como `Sin asignar / Disponible` y sus PDFs van a `PATENTE/EMPLEADOS/{id}/`.

### Colección Firestore

`employees/{id}`:

| Campo | Uso |
|-------|-----|
| `nombre`, `nombreNormalizado`, `clave` | Identidad del perfil. |
| `dni`, `registro`, `vencimientoDNI`, `vencimientoRegistro` | Datos del chofer. |
| `activo`, `patenteActual` | Estado y patente principal. `patenteActual: null` = disponible. |
| `documentos.dni`, `documentos.registro` | `{ ruta, presente, adjunto }`; `ruta` apunta a GitHub. |
| `conflictos[]`, `creadoEn`, `actualizadoEn`, `creadoPor`, `actualizadoPor` | Auditoría. |

Subcolección `employees/{id}/historial/{autoId}`: `{ patente, interno, desde, hasta, motivo, creadoPor, actualizadoPor }`. `hasta: null` = asignación vigente; en un traslado se cierra con `hasta = hoy` y se abre una nueva con `motivo: 'Traslado'`.

Los espejos en `vehicles` se escriben siempre en `chofer`, `dni`, `registro`, `vencimientoDNI`, `vencimientoRegistro`, `empleadoId` y `documentacion.dni|registro`.

### `sinChofer`

Los vehículos sin chofer no deben figurar como documentación faltante/pendiente. `camposEspejo(..., { sinChofer:true })` escribe:

- `chofer: ''`, `dni: ''`, `registro: ''`, `vencimientoDNI: ''`, `vencimientoRegistro: ''`, `empleadoId` borrado;
- `documentacion.dni` y `documentacion.registro` con `sinChofer:true`, `noVence:true` y `fechaVencimiento` borrada.

En reportes se devuelven flags `dniSinChofer` / `registroSinChofer` y la UI muestra **No aplica**, no “Faltante”.

---

## 2. GitHub de documentos

`PATENTE/EMPLEADOS/{id}/{tipo}.pdf` es la ubicación canónica de los documentos de un perfil. `lib/github-docs.js` agregó:

- `validarRuta()`, `listarDirectorio()`, `carpetaEmpleado()`, `rutaDocumentoEmpleado()`.
- `listarEmpleadosGlobal()` (árbol de `PATENTE/EMPLEADOS`, con la misma idea de caché que `listarPatenteGlobal()`).
- `leerRuta()`, `escribirRuta()`, `borrarRuta()`, `moverRuta()` para operar archivos vía API de GitHub.
- `listarPatenteGlobal()` y `cambiosDesde()` **excluyen** `PATENTE/EMPLEADOS/`, para no mezclar choferes con patentes.

`lib/empleados.js` mantiene además una caché de 10 min de ambos árboles (`arbolesDocumentos()` / `invalidarCacheArbol()`). Después de cualquier escritura se invalidan también las cachés de `routes/vehicles.js` y `routes/admin.js` (`invalidarCachesDocumentos()`).

### Traslado de chofer (`moverChofer`)

1. Valida perfil y patente destino.
2. Detecta al ocupante actual por `empleadoId`, por `clave` o crea un perfil temporal para él.
3. Si el destino está ocupado y no se pasó `reemplazar:true`, devuelve **409 `CONFLICTO`** (`La patente X ya tiene asignado a ...`).
4. Mueve `dni`/`registro` del ocupante a su carpeta `EMPLEADOS/{id}/`, con backup `_al DD.MM.YY.pdf` si el destino ya tenía archivo.
5. Mueve los documentos del chofer desde la patente origen (o desde `docsadjuntos`) a la patente destino.
6. Actualiza los espejos de Firestore, cierra/abre historial y hace un único `batch.commit()`.
7. Verifica la lectura del destino antes de borrar el origen; si falla la verificación, **no borra** el original.

---

## 3. API

Montada en `server.js` como `app.use('/api/empleados', empleadosRoutes)` y página `GET /empleados` con `requireAuth`.

| Método | Ruta | Guard | Uso |
|--------|------|-------|-----|
| `GET` | `/api/empleados` | `verifyToken` | Lista perfiles reales + virtuales, patentes, documentos y conflictos. |
| `GET` | `/api/empleados/:id` | `verifyToken` | Detalle con historial. |
| `GET` | `/api/empleados/:id/documentos/:tipo` | `verifyToken` | PDF inline (`dni`/`registro`). |
| `POST` | `/api/empleados` | `verifyToken + requireAdmin` | Alta de perfil. |
| `PUT` | `/api/empleados/:id` | `verifyToken + requireAdmin` | Edición + sincronización de espejos. |
| `PATCH` | `/api/empleados/:id/historial/:histId` | `verifyToken + requireAdmin` | Editar `desde`/`hasta`/`patente`/`interno`/`motivo`. |
| `POST` | `/api/empleados/mover` | `verifyToken + requireAdmin` | Traslado con `empleadoId`, `patenteDestino`, `patenteOrigen`, `tipos`, `reemplazar`. |
| `POST` | `/api/empleados/sincronizar` | `verifyToken + requireAdmin` | Crea perfiles virtuales, actualiza espejos y marca `sinChofer`. |

Errores: `NO_ENCONTRADO → 404`, `CONFLICTO → 409`, `VALIDACION → 400`, resto `500`.

---

## 4. UI

- Vista nueva `views/empleados.ejs`, lógica en `public/js/empleados.js`.
- Accesos agregados en `views/partials/sidebar.ejs`, `views/partials/mobile-menu.ejs`, `public/js/command-palette.js` y título en `views/partials/topbar.ejs`.
- La página es de lectura para cualquier usuario logueado; botones de alta, edición, sincronización, traslado y edición de historial están detrás de `isAdmin()`.
- Incluye filtros por texto, DNI, patente y estado; alta/edición; sincronización; modal de traslado con confirmación si hay ocupante; historial; visor de DNI/Registro; exportación Excel y PDF/impresión.
- Los perfiles virtuales muestran el botón **Sincronizar**; no se pueden editar hasta pasar a perfil real.

---

## 5. Guardas de regresión

Se agregaron cheques `sinChofer` para que DNI/Registro no se cuenten como faltantes ni como documentación pendiente:

- `routes/vehicles.js`: `/documentos/reporte` (flags `dniSinChofer`, `registroSinChofer`) y exportación de `invalidarCachesDocumentos`.
- `routes/admin.js`: `/report/flota`, `fechaDocVenc()` y `docNoVence()`; exportación de `invalidarCachesDocumentos = invalidarArbolPatenteR`.
- `scripts/generar-control-documentacion.js`.
- `scripts/generar-control-matafuego.js`.
- `lib/informe-flota.js` (novedades por mail).
- `scripts/copiar-docs-choferes.js` no requirió cambios: ya saltaba vehículos sin chofer.

---

## 6. Verificación

- `npm run test:github` → **9 checks OK**.
- `npm run test:empleados` → **24 checks OK** (fake Firestore + `global.fetch` mockeado para GitHub).
- `npm test` → **285 checks, 0 fallas** (47+39+16+17+30+21+42+40+9+24).
- `node --check` limpio en todos los JS modificados.
- Render EJS: `empleados OK, chars=38778`.
- Smoke local: `GET /empleados → 200 /login`; `GET /api/empleados → 401` (sin sesión).

---

## 7. Cambio aparte en `PATENTE/AG976PG`

El usuario pidió incluir sus cambios propios en esta misma entrega:

- `PATENTE/AG976PG/vtv.pdf` reemplazado.
- Borrados `PATENTE/AG976PG/BACKUP/seguro_al 08.10.26.pdf` y `seguro_al 28.09.26.pdf`.
- VTV cargada en Firestore con:
  ```powershell
  node scripts/cargar-vencimientos.js --patente=AG976PG --archivo=PATENTE/Vtos/VTV_AG976PG_2026-11-21.xlsx
  ```
- Resultado: `1 actualizado`, `0 sin cambios`, `0 no existen`, `0 errores`.
- Verificación: `X8vE0u2bA1JBErFppalW {"vtv":"19/11/2027","doc":"19/11/2027","updatedAt":"21/11/2026"}`.
- Los archivos temporales del repo (`scripts/_tmp-vtv-ag976pg.js`, `scripts/_tmp-verificar-ag976pg.js` y el Excel usado) fueron borrados.

---

## 8. Trampas para la próxima sesión

- No usar `npm start`: `start.js` hace stash/pull/pop automático y existe un `stash@{0}` viejo que **no hay que aplicar**.
- `DEV_READ_ONLY=true` bloquea escrituras en local; para probar, usar `npm test` con el fake. No bajar el flag.
- `actualizarEmpleado()` usa `db.collection('employees').doc(id).update(patch)`; `doc.ref` no existe en el fake Firestore de tests.
- Si un chofer nuevo aparece solo en un vehículo, está bien que no tenga `id` hasta apretar **Sincronizar**.
- Un error `CONFLICTO` en el traslado es una guarda de datos, no un bug: requiere confirmación de reemplazo.
- Al tocar frontend, pedir el JS con `?v=<mtime>` para no leer una versión cacheada.
- Las vistas y `public/` se recargan al refrescar; `server.js` y rutas requieren reiniciar (`npm run dev` o matar puerto 3000).
