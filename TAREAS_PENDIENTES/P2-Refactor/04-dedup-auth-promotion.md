# TAREA P2-4: Extraer lógica de promoción Admin a función compartida

**Prioridad:** MEDIA
**Archivo:** `middleware/auth.js`
**Problema:** La lógica de "primer usuario → Admin" está duplicada casi idénticamente en `verifyToken` (líneas 18-31) y `loadUser` (líneas 54-71).

---

## Cambio requerido

**NOTA:** Esta tarea está relacionada con P1-3. Si se implementa P1-3 primero, esta tarea ya queda resuelta.

Ver `TAREAS_PENDIENTES/P1-Seguridad/03-admin-promotion-transaccion.md` para la solución completa.

Si P1-3 no se implementa, al menos extraer la lógica duplicada a una función:

```js
async function _ensureUserRecord(decoded) {
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  if (userDoc.exists) {
    const data = userDoc.data();
    if (!data.role || data.role === 'Usuario') {
      const adminSnap = await db.collection('users').where('role', '==', 'Admin').limit(1).get();
      if (adminSnap.empty) {
        await db.collection('users').doc(decoded.uid).update({ role: 'Admin' });
        data.role = 'Admin';
      }
    }
    return data;
  } else {
    const allSnap = await db.collection('users').limit(1).get();
    const isFirst = allSnap.empty;
    const newUser = { role: isFirst ? 'Admin' : 'Usuario', displayName: decoded.email?.split('@')[0] };
    if (isFirst) await db.collection('users').doc(decoded.uid).set(newUser);
    return newUser;
  }
}
```

Luego usar en ambos middlewares:
```js
req.userData = await _ensureUserRecord(decoded);  // en verifyToken
res.locals.currentUserData = await _ensureUserRecord(decoded);  // en loadUser
```

---

## Verificación

1. El comportamiento de auto-promoción debe ser idéntico al anterior
2. No se debe crear Admin duplicado
3. Ambos middleware (API y SSR) deben funcionar correctamente
