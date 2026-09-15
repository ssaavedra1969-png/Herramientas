# TAREA P1-4: Unificar auth en POST maintenance con `requireAdmin`

**Prioridad:** ALTA (Seguridad)
**Archivo:** `routes/maintenance.js`
**Problema:** El endpoint POST `/api/maintenance` (líneas 32-64) usa un chequeo manual `if (req.userData?.role !== 'Admin')` en vez del middleware `requireAdmin`. Si `req.userData` es undefined (usuario sin doc en Firestore), el chequeo falla silenciosamente y podría permitir creación a un no-admin.

---

## Cambio requerido

### `routes/admin.js` línea 32

**ANTES:**
```js
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.userData?.role !== 'Admin') {
      return res.status(403).json({ error: 'Solo administradores pueden crear mantenimientos' });
    }
    // ... resto del handler
```

**DESPUÉS:**
```js
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    // ... resto del handler (sin el if manual)
```

---

## Verificación

1. Intentar crear mantenimiento con usuario Admin → debe funcionar
2. Intentar crear mantenimiento con usuario "Usuario" → debe retornar 403
3. Comparar con PUT y DELETE que ya usan `requireAdmin` correctamente
