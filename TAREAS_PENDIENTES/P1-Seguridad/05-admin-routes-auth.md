# TAREA P1-5: Agregar `requireAdmin` a endpoints admin-only

**Prioridad:** ALTA (Seguridad)
**Archivo:** `routes/admin.js`
**Problema:** Los endpoints `/api/admin/dashboard`, `/api/admin/dashboard/financial`, `/api/admin/report`, `/api/admin/report/export`, y `/api/admin/alerts` solo usan `verifyToken` pero están bajo `/api/admin/`. Cualquier usuario autenticado puede acceder a datos financieros sensibles.

---

## Cambio requerido

### `routes/admin.js` — Agregar `requireAdmin` a los siguientes endpoints:

1. **Línea 39:** `router.get('/dashboard', verifyToken, ...)` → `router.get('/dashboard', verifyToken, requireAdmin, ...)`
2. **Línea 80:** `router.get('/dashboard/financial', verifyToken, ...)` → `router.get('/dashboard/financial', verifyToken, requireAdmin, ...)`
3. **Línea ~216:** `router.get('/report', verifyToken, ...)` → `router.get('/report', verifyToken, requireAdmin, ...)`
4. **Línea ~364:** `router.get('/report/export', verifyToken, ...)` → `router.get('/report/export', verifyToken, requireAdmin, ...)`
5. **Línea ~alertas:** `router.get('/alerts', verifyToken, ...)` → `router.get('/alerts', verifyToken, requireAdmin, ...)`

**NOTA:** Verificar con `grep` las líneas exactas antes de editar, ya que el archivo tiene 709 líneas.

### Also: Actualizar el frontend para que solo Admin vea las páginas de reportes

En `views/reviews.ejs` y `views/dashboard.ejs`, asegurarse de que las llamadas a `/api/admin/*` estén protegidas por `isAdmin()` en el JS del cliente.

---

## Verificación

1. Login como usuario "Usuario" → intentar acceder a `/api/admin/dashboard` → debe retornar 403
2. Login como usuario "Usuario" → intentar acceder a `/api/admin/report` → debe retornar 403
3. Login como Admin → todo debe funcionar normal
4. El dashboard SSR sigue accesible (usa `requireAuth`, no `requireAdmin`)
