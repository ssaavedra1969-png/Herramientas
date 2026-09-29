# Update 2026-09-29

Sesión de **auditoría y testing**. Se revisó el proyecto entero, se construyó un
harness de tests contra un Firestore falso, se encontró y corrigió un bug real,
y se dejó el harness en el repo.

Commits: **`d98d8d8`** (fix) + `tests/` + documentación.

---

## 1. Auditoría del proyecto — sin hallazgos

| Chequeo | Resultado |
|---------|-----------|
| `node --check` en rutas, middleware, config, 14 JS de `public/js`, 8 scripts | 0 errores |
| Las 19 vistas EJS compilan | 0 errores de sintaxis, 0 includes rotos, 0 assets rotos, 0 tags desbalanceados |
| Los 63 archivos de `public/` | todos 200 |
| Rutas backend vs llamadas del frontend | 49 rutas, 28 llamadas, **0 llamadas rotas** |
| Auth sin token | 401 en todos los endpoints |
| Guardas de escritura | 403 (read-only) en los 8 endpoints probados |
| CSS | `themes.css` 448/448 llaves, `styles.css` 186/186 |
| Logs del servidor | stderr vacío |
| Consola del backend | sin restos de debug (solo arranque, aviso read-only y debug de auth con flag) |

Las rutas sin guarda son 4, todas legítimas: `auth/verify`, `auth/session`,
`auth/logout` (login) y `vehicles/services/panel-mock` (solo datos falsos
hardcodeados, no expone datos reales).

---

## 2. Bug encontrado y corregido — commit `d98d8d8`

### El contador del catálogo generaba un `interno` duplicado

`getNextCatalogNumber()` en `routes/centros.js` tenía dos ramas que no se
coordinaban:

```js
// rama que INICIALIZA el counter (cuando el doc no existe)
transaction.set(counterRef, { current: max });      // guarda max
return { number: max + 1, ... };                    // pero devuelve max+1   <-- bug

// rama que INCREMENTA (cuando el doc ya existe)
const next = (doc.data().current || 0) + 1;
transaction.update(counterRef, { current: next });  // guarda next
return { number: next, ... };                       // devuelve next         <-- ok
```

Como la inicialización deja el counter en `max` pero entrega `max+1`, la
**siguiente** alta volvía a sacar el mismo número. Reproducción (catálogo con
`H007` previo, sin counter):

```
alta   | asignado | counter
Uno    | H008     | 7
Dos    | H008     | 8      <-- DUPLICADO
Tres   | H009     | 9
Cuatro | H010     | 10
Cinco  | H011     | 11
```

Después del fix: `H008, H009, H010, H011, H012`, sin repetidos. Exactamente un
duplicado, y solo en la segunda alta; después la numeración se estabiliza.

### Por qué importa

El `interno` **es la identidad** del elemento del catálogo, no un adorno. Se usa
en tres lugares:

- `public/js/centros.js:398` — es el `value` de cada `<option>` del select de
  asignación (con duplicado, dos elementos indistinguibles al asignar).
- `routes/centros.js:252` — `catMap[c.interno]`, la clave con la que se resuelve
  nombre/marca/modelo (con duplicado, el segundo pisa al primero: asignás "el
  martillo" y el sistema muestra "la tenaza").
- `routes/centros.js:377` — es lo que se guarda en el registro de asignación.

### El fix

Una línea, `routes/centros.js:91`:

```diff
-      transaction.set(counterRef, { current: max });
+      transaction.set(counterRef, { current: max + 1 });
```

**Alcance:** solo afecta `POST /api/centros/elementos/disponibles` (alta de
elemento nuevo del catálogo). No toca vehículos, obras, documentos ni reportes.
Y como la rama corregida solo corre cuando el counter **no existe**, en
producción (donde ya existe) ni se ejecuta: riesgo cero de regresión.

### ⚠️ El MISMO bug existe en la numeración de vehículos — NO corregido

`getNextVehicleNumber()` en **`public/js/auth-client.js:258`** (ojo: es código
**cliente**, no una ruta) tiene el patrón idéntico, línea 270:

```js
// auth-client.js:270
transaction.set(counterRef, { current: max });      // guarda max
return { number: max + 1, formatted: `V${...}` };    // pero devuelve max+1   <-- mismo bug
```

Efecto: la segunda alta de un vehículo **repite el `V-XXX`** si el doc
`counters/vehicles` no existe. Mismo alcance del error: un solo duplicado, y
solo la primera vez que se crea el counter.

**No se corrigió** en esta sesión: está fuera del alcance que se pidió y es
código cliente, que el harness de tests no cubre (las rutas se ejercitan en el
servidor). El fix es la misma línea: guardar `max + 1`.

De paso, este snippet **confirma que el counter de vehículos se llama
`counters/vehicles`** (no `vehicles-{tipo}` como decía la doc histórica), lo
que refuerza que hay que ir a revisar los nombres reales en Firestore.

### ⚠️ Pendiente que puede dejar el fix sin efecto

La documentación dice que los counters del catálogo se llaman **`cat-{prefijo}`**,
pero el código busca `db.collection('counters').doc(tipo)` → `counters/herramienta`.
Si en la base están con el nombre viejo, `doc.exists` siempre da `false`, el
counter nunca se crea, la rama corregida nunca corre — y tampoco había
duplicado, porque siempre derivaba del máximo real de los datos.

**Hay que confirmar cómo se llaman los docs en producción.** Si hay discrepancia,
o se renombran los docs o se corrige el `doc(tipo)`.

---

## 3. Harness de tests — `tests/` (nuevo)

Permite testear escrituras sin tocar producción. Ver `tests/README.md`.

```bash
npm test        # 72 checks, ~4 s
```

- `tests/fake-firestore.js` — Firestore falso en memoria (la API que usa el
  proyecto: `collection`, `collectionGroup`, `batch`, `runTransaction`, `where`,
  `orderBy`, `limit`, `FieldValue`, rutas anidadas, `ref.parent.parent`).
- `tests/helpers.js` — inyecta el fake en `require.cache` **antes** de montar
  `routes/*.js`, y levanta un Express en un puerto efímero.
- `tests/escrituras.test.js` — 47 checks.
- `tests/negocio.test.js` — 25 checks, incluye la regresión del contador.

Se suman scripts `test`, `test:escrituras`, `test:negocio` al `package.json`.

### Qué quedó cubierto

- **Auth:** 401 sin token / inválido, 403 no-Admin, 404 inexistente.
- **Obras:** crear y editar recortan `nombre`/`ubicacion`/`observaciones`;
  validaciones de nombre vacío y `estado` inválido.
- **El 409 de borrar obra:** dispara con pendiente, y **también** con un
  elemento legacy sin el campo `fechaDevolucion` (el riesgo del fix `0ecb9a8`).
- **Borrado en cascada:** la subcolección se vacía por batches y
  `elementosBorrados` cuadra.
- **`recomputeServiceSummary`:** `proximoServiceKm` toma el mínimo y
  **recalcula bien al borrar** un service.
- **`FieldValue.delete()`:** borra `docsAdjuntos.seguro` sin tocar
  `docsAdjuntos.vtv` (valida la nota de no pasar `undefined` en `update()`).
- **Roles:** Usuario no crea ni borra nada.

---

## 4. Deploy

Pusheado a `origin/main` (`d98d8d8`), desplegado por integración Git a
https://falpat-control-de-vehiculos.vercel.app. Verificado: `/login`,
`themes.css`, `auth-client.js`, `fp3d.png` → 200; `/api/vehicles` sin token → 401.

**Producción nunca se escribió.** El servidor local quedó con
`DEV_READ_ONLY=true` y todo su tráfico registrado como `Blocked`.

---

## 5. Pendientes

| # | Tema | Prioridad |
|---|------|-----------|
| 1 | Confirmar el nombre real de los docs de `counters` (§2). Si no coinciden, el fix no llega a ejecutarse. | **Alta** |
| 2 | Corregir el mismo off-by-one en `getNextVehicleNumber()` (`public/js/auth-client.js:270`) — repite el `V-XXX` de vehículos. Mismo fix de una línea. | **Alta** |
| 3 | Revisión visual de los 4 temas (pro/claro/industrial/auto) en desktop y móvil. El contrast checker pasa, pero eso no ve un botón mal alineado. | **Alta** |
| 4 | Limpiar `AGENTS.md` y `documentacion/README.md`: documentan `routes/maintenance.js`, `views/maintenance.ejs`, `public/js/maintenance.js` y la colección `maintenance`, que **no existen** (fueron reemplazados por "services" dentro de vehículos). | Media |
| 5 | `GET /api/vehicles/services/panel-mock` sin `verifyToken` (solo datos falsos, riesgo bajo). | Baja |
| 6 | `/service` (server.js:132) chequea `currentUser` a mano en vez de usar `requireAuth`. | Baja |
| 7 | Armonización visual pendiente: 118 colores inline, 3.185 clases Tailwind sin override, auditar los CSS legacy (`theme-switcher/modern/premium/sutil`, `styles.css`). | Baja |
