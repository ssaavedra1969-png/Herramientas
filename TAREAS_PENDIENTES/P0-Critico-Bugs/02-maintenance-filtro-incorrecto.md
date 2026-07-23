# TAREA P0-2: Fix filtro `.where('estado')` en loadSelectData

**Prioridad:** CRITICO
**Archivo:** `public/js/maintenance.js`
**Problema:** El listener de vehículos en mantenimiento usa `.where('estado', '!=', 'Dado de baja')` pero el campo real en Firestore es `estadoGeneral`. Esto causa un error de Firestore porque no existe índice para ese campo, y el filtro no funciona.

---

## Cambio requerido

### `public/js/maintenance.js` línea 32

**ANTES:**
```js
db.collection('vehicles').where('estado', '!=', 'Dado de baja').onSnapshot((snapshot) => {
```

**DESPUÉS:**
Opción A (sin filtro Firestore, filtrar en cliente — más compatible):
```js
db.collection('vehicles').onSnapshot((snapshot) => {
  vehiclesCache = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(v => v.estadoGeneral !== 'Baja');
  populateVehicleSelect();
```

Opción B (con filtro Firestore — requiere índice compuesto):
```js
db.collection('vehicles').where('estadoGeneral', '!=', 'Baja').onSnapshot((snapshot) => {
  vehiclesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  populateVehicleSelect();
```

**Recomendación:** Usar Opción A para evitar necesidad de crear índice nuevo.

### Ajustar el callback completo:

**ANTES (líneas 31-35):**
```js
function loadSelectData() {
  db.collection('vehicles').where('estado', '!=', 'Dado de baja').onSnapshot((snapshot) => {
    vehiclesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    populateVehicleSelect();
  });
}
```

**DESPUÉS:**
```js
function loadSelectData() {
  db.collection('vehicles').onSnapshot((snapshot) => {
    vehiclesCache = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.estadoGeneral !== 'Baja');
    populateVehicleSelect();
  });
}
```

---

## Verificación

1. Abrir consola del navegador en `/maintenance`
2. No debe haber errores de Firestore sobre índice faltante
3. Los vehículos con `estadoGeneral: 'Baja'` no deben aparecer en el select
4. Los vehículos activos sí deben aparecer
