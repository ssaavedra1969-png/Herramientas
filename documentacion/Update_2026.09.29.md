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

### El MISMO bug estaba en la numeración de vehículos — CORREGIDO

`getNextVehicleNumber()` en **`public/js/auth-client.js:258`** (ojo: es código
**cliente**, no una ruta) tenía el patrón idéntico, línea 270:

```js
// auth-client.js:270 — ANTES
transaction.set(counterRef, { current: max });      // guarda max
return { number: max + 1, formatted: `V${...}` };    // pero devuelve max+1   <-- mismo bug
```

Efecto: la segunda alta de un vehículo **repetía el `V-XXX`**. Es el mismo bug
del catálogo, y el mismo alcance: **un solo duplicado**, y solo la primera vez
que se crea el doc `counters/vehicles`.

**Corregido** a `transaction.set(counterRef, { current: max + 1 })`, en la misma
línea y con el mismo criterio que `d98d8d8`.

#### Por qué el de vehículos era más urgente que el del catálogo

El del catálogo ya estaba neutralizado en producción (los 4 counters existen, así
que la rama rota no corre). Este **no**: `counters/vehicles` **no existe**, así
que la numeración de vehículos cae *siempre* en la rama de derivar del máximo
real, y esa rama es justo la que estaba rota. El día que se creara el doc —o
sea, en la primera alta — el segundo vehículo habría repetido el `V-XXX`.

#### Cubierto con una suite propia

`tests/vehiculos-numeracion.test.js` (16 checks, `npm run test:numeracion`).
Como es código cliente, no se puede probar por HTTP: la suite **extrae la
función del archivo por texto** con regex y la evalúa con `new Function`
inyectándole el db falso, así que corre el código real tal cual está escrito.

El assert que importa no es el número devuelto (las dos ramas devuelven lo mismo
la primera vez) sino el **valor persistido** y la **segunda** llamada:

```js
const primera  = await next();  // V055
// el counter debe quedar en 55, no en 54
const segunda  = await next();  // V056  <-- con el bug devolvía V055
```

**El test se validó reintroduciendo el bug a propósito:** con `{ current: max }`
falla 5 de 16 checks, entre ellos la secuencia `V011,V011,V012,V013,V014`. Con el
fix, 16/16.

### Los counters de la base: CONFIRMADO contra producción

`scripts/inspeccionar-counters.js` (`npm run inspect:counters`, **solo lectura**).
Resultado:

| Doc | `current` | Estado |
|-----|-----------|--------|
| `counters/herramienta` | 3 | existe |
| `counters/equipo` | 3 | existe |
| `counters/ropa` | 3 | existe |
| `counters/material` | 2 | existe |
| `counters/vehiculo` | — | **no existe** |
| `counters/vehicles` | — | **no existe** |

**La documentación histórica estaba equivocada.** Decía `cat-{prefijo}` y
`vehicles-{tipo}`; **no existe ningún doc con esos nombres**. El código busca
`doc(tipo)` y **acierta** en los 4 tipos del catálogo.

Consecuencias:

1. **El fix `d98d8d8` sí es efectivo** para los 4 tipos del catálogo: los docs
   existen, `doc.exists` da `true` y corre la rama de incremento (la correcta).
   La preocupación de esta sesión era infundada, pero verificarla era necesario.
2. **Nunca hubo duplicados**, ni en el catálogo ni en vehículos: `elementos_catalogo`
   tiene 11 docs (H001-H003, E001-E003, R001-R003, M001-M002) y `vehicles` 54
   (V001-V054), **sin internos repetidos** en ninguna de las dos. No hay nada
   que limpiar.
3. **Los 2 counters de vehículo no existen**, y por eso el bug de
   `auth-client.js:270` llevaba tiempo latente sin consecuencias: la rama rota
   solo se dispara una vez creado el doc. Corregido igualmente, justamente para
   que la primera y la segunda alta den números distintos.

**No se creó ningún doc.** Se dejó la base sin tocar: el script es de solo
lectura y el fix hace que la rama de creación ya guarde el valor correcto
cuando por fin se cree.

---

## 3. Harness de tests — `tests/` (nuevo)

Permite testear escrituras sin tocar producción. Ver `tests/README.md`.

```bash
npm test        # 88 checks, ~4 s
```

- `tests/fake-firestore.js` — Firestore falso en memoria (la API que usa el
  proyecto: `collection`, `collectionGroup`, `batch`, `runTransaction`, `where`,
  `orderBy`, `limit`, `FieldValue`, rutas anidadas, `ref.parent.parent`).
- `tests/helpers.js` — inyecta el fake en `require.cache` **antes** de montar
  `routes/*.js`, y levanta un Express en un puerto efímero.
- `tests/escrituras.test.js` — 47 checks.
- `tests/negocio.test.js` — 25 checks, incluye la regresión del contador.
- `tests/vehiculos-numeracion.test.js` — 16 checks, la regresión de
  `auth-client.js:270` (código cliente, se evalúa sin navegador).

Scripts en `package.json`: `test`, `test:escrituras`, `test:negocio`,
`test:numeracion`, `inspect:counters`.

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
- **Numeración de vehículos:** regresión del off-by-one de `auth-client.js:270`,
  derivación del máximo con internos desordenados, formatos raros
  (`V-01`, `X001`, vacío), counter ya existente, `current` ausente, y secuencia
  de 5 altas sin duplicados.

---

## 4. Deploy

Pusheado a `origin/main` (`d98d8d8`, el fix del catálogo), desplegado por
integración Git a https://falpat-control-de-vehiculos.vercel.app. Verificado:
`/login`, `themes.css`, `auth-client.js`, `fp3d.png` → 200; `/api/vehicles` sin
token → 401.

**Producción nunca se escribió.** El servidor local quedó con
`DEV_READ_ONLY=true` y todo su tráfico registrado como `Blocked`. La única
consulta a la base fue de lectura (`npm run inspect:counters`, §2), y no se
creó ni modificó ningún doc.

---

## 5. Pendientes

Resueltos en esta sesión: §2 (los dos off-by-one) y la confirmación de los
counters. Queda lo siguiente.

| # | Tema | Prioridad |
|---|------|-----------|
| 1 | Revisión visual de los 4 temas (pro/claro/industrial/auto) en desktop y móvil. El contrast checker pasa, pero eso no ve un botón mal alineado. | **Alta** |
| 2 | Probar en la app real la alta de un vehículo, para confirmar que el `V-055` sale bien y que el counter se crea con 55. Con el fix debería ser correcto, pero la primera alta real es la que crea el doc. | **Alta** |
| 3 | Limpiar las referencias residuales a `routes/maintenance.js` y a la colección `maintenance` en `documentacion/README.md` (el módulo no existe: fue fusionado con `services`). | Media |
| 4 | `GET /api/vehicles/services/panel-mock` sin `verifyToken` (solo datos falsos, riesgo bajo). | Baja |
| 5 | `/service` (server.js:132) chequea `currentUser` a mano en vez de usar `requireAuth`. | Baja |
| 6 | Armonización visual pendiente: 118 colores inline, 3.185 clases Tailwind sin override, auditar los CSS legacy (`theme-switcher/modern/premium/sutil`, `styles.css`). | Baja |
