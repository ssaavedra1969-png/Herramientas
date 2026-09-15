# TAREA P2-8: Limpiar console.log de producción

**Prioridad:** BAJA
**Archivos:** Múltiples
**Problema:** Hay `console.log` de debug que no deberían estar en producción.

---

## Cambios requeridos

### `routes/auth.js` — Líneas 27-29, 41, 44

**Eliminar o reemplazar con `if (process.env.NODE_ENV !== 'production')`:**

```js
// Línea 27-29 — ELIMINAR:
console.log('Session creation requested, NODE_ENV:', process.env.NODE_ENV);
console.log('FIREBASE_SERVICE_ACCOUNT set:', !!process.env.FIREBASE_SERVICE_ACCOUNT);
console.log('FIREBASE_SERVICE_ACCOUNT_PATH set:', !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

// Línea 41 — ELIMINAR:
console.log('Session cookie created successfully');
```

Mantener solo el `console.error` de la línea 44.

### `public/js/auth-client.js` — Líneas 9, 52

**Eliminar:**
```js
console.log('completeSignIn called, uid:', user.uid, 'email:', user.email);  // línea 9
console.log('onAuthStateChanged:', user ? 'user:' + user.uid : 'null', ...);  // línea 52
```

---

## Verificación

1. Abrir consola del navegador
2. Login/logout → no debe haber mensajes de debug
3. En el servidor, no debe haber logs de session creation en cada request
