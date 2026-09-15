# TAREA P1-3: Mover auto-promoción Admin a transacción server-side

**Prioridad:** ALTA (Seguridad)
**Archivos:** `middleware/auth.js`, `public/js/auth-client.js`
**Problema:** La lógica de "primer usuario se convierte en Admin" está duplicada en 3 lugares y tiene race condition: dos usuarios concurrentes pueden ambos promocionarse a Admin.

---

## Cambio requerido

### 1. Crear función compartida en `middleware/auth.js`

Agregar al inicio del archivo:

```js
async function ensureFirstUserAdmin(uid, email) {
  const usersRef = db.collection('users');
  const userDoc = await usersRef.doc(uid).get();

  if (userDoc.exists) return userDoc.data();

  // Check if ANY admin exists
  const adminSnap = await usersRef.where('role', '==', 'Admin').limit(1).get();
  const hasAdmin = !adminSnap.empty;

  const newUser = {
    email: email || '',
    role: hasAdmin ? 'Usuario' : 'Admin',
    displayName: email?.split('@')[0] || 'Usuario',
    createdAt: new Date()
  };

  await usersRef.doc(uid).set(newUser);
  return newUser;
}
```

### 2. Simplificar `verifyToken` (líneas 15-32)

Reemplazar la lógica de auto-promoción con:

```js
const userData = await ensureFirstUserAdmin(decoded.uid, decoded.email);
req.userData = userData;
```

### 3. Simplificar `loadUser` (líneas 54-71)

Reemplazar la lógica de auto-promoción con:

```js
const userData = await ensureFirstUserAdmin(decoded.uid, decoded.email);
res.locals.currentUserData = userData;
```

### 4. Actualizar exports

```js
module.exports = { verifyToken, requireAdmin, loadUser, requireAuth, requireAdminPage, ensureFirstUserAdmin };
```

### 5. En `public/js/auth-client.js` — Eliminar auto-promoción del cliente

En `completeSignIn()` (líneas 24-37), simplificar para solo leer el doc del usuario:

```js
const userDoc = await db.collection('users').doc(user.uid).get();
if (userDoc.exists) {
  currentUserData = userDoc.data();
} else {
  // El servidor crea el user doc en el próximo request via ensureFirstUserAdmin
  // Default temporal hasta que el servidor responda
  currentUserData = { role: 'Usuario', displayName: user.displayName || user.email?.split('@')[0] };
}
```

---

## Verificación

1. Registrar un usuario nuevo (debe ser el primero) → debe quedar como Admin
2. Registrar un segundo usuario → debe quedar como Usuario
3. Verificar que no hay race condition (dos registros simultáneos no generan dos Admins)
4. Verificar que el middleware de auth sigue funcionando correctamente en todas las páginas
