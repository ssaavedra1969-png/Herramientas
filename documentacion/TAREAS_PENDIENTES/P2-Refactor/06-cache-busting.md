# TAREA P2-6: Reemplazar `Date.now()` por hash en cache busting

**Prioridad:** BAJA
**Archivo:** `views/partials/footer.ejs`
**Problema:** `?v=<%= Date.now() %>` genera un timestamp nuevo en cada carga, impidiendo completamente el cache del navegador para `auth-client.js`.

---

## Cambio requerido

### Opción A: Usar hash del archivo (recomendado)

En `server.js`, agregar un middleware que calcule el hash:

```js
const crypto = require('crypto');
const fs = require('fs');
const authClientPath = path.join(__dirname, 'public', 'js', 'auth-client.js');
const authClientHash = crypto.createHash('md5').update(fs.readFileSync(authClientPath)).digest('hex').slice(0, 8);
app.locals.authClientVersion = authClientHash;
```

En `footer.ejs`:
```html
<script src="/js/auth-client.js?v=<%= authClientVersion %>"></script>
```

### Opción B: Usar versión de package.json

```html
<script src="/js/auth-client.js?v=1.0.0"></script>
```

Cambiar el `?v=` solo cuando se haga un deploy.

---

## Verificación

1. Recargar la página varias veces → `auth-client.js` debe cachearse entre recargas
2. Modificar `auth-client.js` → el `?v=` debe cambiar y el navegador debe descargar la nueva versión
