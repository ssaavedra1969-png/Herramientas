# Tests — cómo testear escrituras SIN tocar producción

Estos tests ejercitan las **rutas reales** (`routes/*.js`) contra un Firestore
falso en memoria. Sirven para probar POST/PUT/DELETE, validaciones, batches y
transacciones, que con `DEV_READ_ONLY=true` no se pueden probar de otra forma.

```bash
npm test              # las dos suites (72 checks, ~4 s)
npm run test:escrituras
npm run test:negocio
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
