# TAREA P1-1: Eliminar endpoint de debug sin autenticación

**Prioridad:** ALTA (Seguridad)
**Archivo:** `routes/auth.js`
**Problema:** `GET /api/auth/debug` (líneas 54-61) está accesible sin autenticación y expone el estado de variables de entorno (`hasServiceAccount`, `hasServiceAccountPath`, `nodeEnv`, `hasFirebaseAdmin`). Esto permite a un atacante fingerprintear la configuración del servidor.

---

## Cambio requerido

### `routes/auth.js` — Eliminar líneas 54-61

**ANTES:**
```js
router.get('/debug', (req, res) => {
  res.json({
    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    hasServiceAccountPath: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    nodeEnv: process.env.NODE_ENV,
    hasFirebaseAdmin: !!require('../config/firebase').auth
  });
});

module.exports = router;
```

**DESPUÉS:**
```js
module.exports = router;
```

### Alternativa (si se necesita para debugging): Proteger con requireAdmin

Si se quiere mantener el endpoint para debugging interno, agregar auth:

```js
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/debug', verifyToken, requireAdmin, (req, res) => {
  res.json({
    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    hasServiceAccountPath: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    nodeEnv: process.env.NODE_ENV
  });
});
```

**Recomendación:** Eliminarlo completamente.

---

## Verificación

1. Ejecutar `curl http://localhost:3000/api/auth/debug` — debe retornar 404 o error
2. No debe haber forma de acceder a esta info sin autenticación
