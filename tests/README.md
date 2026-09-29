# Tests — cómo testear escrituras SIN tocar producción

Estos tests ejercitan las **rutas reales** (`routes/*.js`) contra un Firestore
falso en memoria. Sirven para probar POST/PUT/DELETE, validaciones, batches y
transacciones, que con `DEV_READ_ONLY=true` no se pueden probar de otra forma.

```bash
npm test              # las tres suites (88 checks, ~4 s)
npm run test:escrituras
npm run test:negocio
npm run test:numeracion
```

## Por qué un `db` fake y no la base real

El `.env` local apunta a la **misma base que producción**. Con
`DEV_READ_ONLY=true` toda escritura devuelve 403, así que los forms de guardado
no se pueden ejercitar. La otra opción (bajar el read-only) escribiría en la
base real.

El fake evita las dos cosas: `config/firebase.js` se reemplaza en
`require.cache` **antes** de que lo requiera cualquier ruta, así que
`middleware/auth.js` y `routes/*` usan el `db` falso tal cual están escritos. No
hace falta tocar `DEV_READ_ONLY` ni hacer backup.

> El harness **no** monta `middleware/dev-readonly.js`, a propósito: justamente
> se quiere probar las escrituras. Es seguro porque el `db` es falso.

## Archivos

| Archivo | Qué hace |
|---------|----------|
| `fake-firestore.js` | Emula la API de Firestore que usa el proyecto. |
| `helpers.js` | Inyecta el fake, monta las rutas en un Express de prueba en un puerto efímero, y expone `req()` + un reporter. |
| `escrituras.test.js` | Auth, obras, elementos, vehículos (47 checks). |
| `negocio.test.js` | Contador del catálogo, `recomputeServiceSummary`, `FieldValue.delete()` (25 checks). |
| `vehiculos-numeracion.test.js` | Numeración de vehículos — **código cliente**, se evalúa sin navegador (16 checks). |

## Testear código de `public/js/` (sin navegador)

Las rutas viven en el servidor y se prueban por HTTP. Pero `public/js/*.js` se
cargan por `<script>` (no son ESM), así que no se pueden `require`. La
tecnica es **extraer la función del texto y evaluarla** con el db falso:

```js
const src = fs.readFileSync('public/js/auth-client.js', 'utf8');
const m = src.match(/async function getNextVehicleNumber\(\)\s*\{[\s\S]*?\n\}/);
const fn = new Function('db', m[0] + '\nreturn getNextVehicleNumber;');
const next = fn(fake.db);
```

`db` entra como parámetro, así la función evaluada cierra sobre el fake. Sirve
para cualquier función pura de `public/js/` que solo dependa de `db` y `Date`.

Un `db` limpio se pide con `makeFake()` (no uses el `fake` de `helpers.js`, que
viene sembrado y compartido con las otras suites).

## Un test de regresión tiene que FALLAR con el bug

Trampa fácil: un assert sobre el **valor devuelto** puede pasar con el bug y con
el fix. En el off-by-one del contador, las dos ramas devolvían el mismo número
la primera vez; lo que las delata es:

1. el **valor persistido** (`{current: 54}` vs `{current: 55}`), y
2. que la **segunda** llamada devuelva un número distinto.

Antes de dar por buena una suite, **reintroducí el bug a propósito** y fijate
que falla. Se hace así:

```powershell
Copy-Item public/js/auth-client.js $env:TEMP\ac.bak -Force
# ... revertí la línea a mano ...
node tests/vehiculos-numeracion.test.js   # tiene que fallar
Copy-Item $env:TEMP\ac.bak public/js/auth-client.js -Force
```

## API emulada

`db.collection` · `db.collectionGroup` · `db.batch` · `db.runTransaction` ·
`.where` (`==` `!=` `>` `<` `>=` `<=` `array-contains`) · `.orderBy` · `.limit` ·
`.get` `.add` `.set` `.update` `.delete` `.count` ·
`admin.firestore.FieldValue` (`delete` `serverTimestamp` `increment`) ·
rutas anidadas `"a.b.c"` · `doc.ref.parent.parent` · `Snapshot.forEach/map`.

**No** emula índices compuestos, cursores ni streams. Si una ruta empieza a
usarlos, hay que agregarlos al fake y el test va a avisar.

## Cómo escribir un test nuevo

```js
const { fake, req, makeReporter } = require('./helpers');
const { check, section, done } = makeReporter('mi-suite');

(async () => {
  section('MI SECCION');
  fake.seed('centros', 'obra1', { nombre: 'Obra', estado: 'activa' });   // datos previos
  check('crear -> 201', (await req('POST', '/api/centros', { body: { nombre: 'X' } })).status === 201);
  check('quedo guardado', fake.dump('centros').some((c) => c.nombre === 'X'));
  done();
})();
```

`req(method, ruta, { body, as })` — `as` es `'admin'` (default), `'user'`,
`'invalid'` o `'none'`. Devuelve `{ status, json }`.
`fake.seed(coleccion, id, datos)` siembra; `fake.dump(coleccion)` lee lo escrito.
Las subcolecciones se direccionan con ruta: `fake.dump('centros/ID/elementos')`.

## Trampas del fake (ya se pisaron, no volver a hacerlo)

1. **`clone()` tiene que preservar `Date` y `Timestamp`.** Si los convierte en
   `{}`, `recomputeServiceSummary` revienta con `Cannot read properties of null
   (reading 'getTime')` y parece un bug de la app cuando no lo es.
2. **`docRef.collection(sub)` necesita el subPath.** Sin el argumento devuelve
   el path del doc mismo, y el 409 de borrar obra no dispara nunca.
3. **`db.collection(...)`, no `db.col(...)`.**
4. **`_map()` tiene que crear la colección si no existe**, si no las
   subcolecciones (`elementos`, `combustible`, `services`) dan `undefined`.
5. **Siembrá los usuarios antes de los tests.** `ensureFirstAdmin`
   (`middleware/auth.js:12`) convierte en Admin al primer usuario que se
   autentica, así que sin sembrar los roles quedan invertidos y los tests de
   roles fallan.
