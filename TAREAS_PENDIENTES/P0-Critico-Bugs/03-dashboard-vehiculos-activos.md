# TAREA P0-3: Fix filtro de vehículos activos en dashboard

**Prioridad:** CRITICO
**Archivo:** `routes/admin.js`
**Problema:** El endpoint `/api/admin/dashboard` (línea 48) cuenta vehículos activos con `d.data().estado === 'Activo'` pero el campo real en el modelo de datos es `estadoGeneral`. La tarjeta de "Vehículos Activos" del dashboard siempre muestra 0 o un número incorrecto.

---

## Cambio requerido

### `routes/admin.js` línea 48

**ANTES:**
```js
const vehiculosActivos = vehiclesSnap.docs.filter(d => d.data().estado === 'Activo').length;
```

**DESPUÉS:**
```js
const vehiculosActivos = vehiclesSnap.docs.filter(d => d.data().estadoGeneral !== 'Baja').length;
```

---

## Verificación

1. Ir al `/dashboard`
2. La tarjeta "Vehículos Activos" debe mostrar el número correcto de vehículos que NO tienen `estadoGeneral: 'Baja'`
3. Si no hay vehículos dados de baja, debe mostrar el total de vehículos

---

## PUNTO DE RESTAURA (creado el 2026-08-06, ANTES de ejecutar esta tarea)

Para volver atrás si esta tarea rompe algo:

- **Código (git):** tag `pre-p0` = commit `90c33e2` → `git checkout pre-p0` (o `git reset --hard pre-p0`)
- **Datos (Firestore):** backup `backups/backup-2026-08-06T19-14-58-661Z` (47 vehicles, 0 maintenance, 5 users)
- **Restaurar datos:**
  ```bash
  node scripts/restore-firebase.js backups/backup-2026-08-06T19-14-58-661Z
  ```
- **Nota:** `backups/latest` apunta a este mismo backup.
