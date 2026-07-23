# TAREA P0-1: Fix campo `numeroInterno` → `interno` en mantenimiento

**Prioridad:** CRITICO
**Archivo:** `public/js/maintenance.js`
**Problema:** El select de vehículos muestra "Int: undefined" porque usa el campo incorrecto `numeroInterno` en vez de `interno`.

---

## Cambios requeridos

### 1. `public/js/maintenance.js` línea 42

**ANTES:**
```js
select.innerHTML = '<option value="">Seleccionar vehículo...</option>' +
  vehiclesCache.map(v => `<option value="${v.id}">${v.patente} - ${v.marca} ${v.modelo} (Int: ${v.numeroInterno})</option>`).join('');
```

**DESPUÉS:**
```js
select.innerHTML = '<option value="">Seleccionar vehículo...</option>' +
  vehiclesCache.map(v => `<option value="${v.id}">${v.patente} - ${v.marca} ${v.modelo} (Int: ${v.interno || ''})</option>`).join('');
```

### 2. `public/js/maintenance.js` línea 175

**ANTES:**
```js
vehiculoInterno: vehiculo?.numeroInterno || null,
```

**DESPUÉS:**
```js
vehiculoInterno: vehiculo?.interno || null,
```

---

## Verificación

1. Ir a la página `/maintenance`
2. Abrir modal "Nuevo Mantenimiento"
3. El select de vehículos debe mostrar: `ABC123 - Mercedes Benz Atego (Int: V-00001)`
4. No debe mostrar: `(Int: undefined)` ni `(Int: )`
5. Al guardar, el campo `vehiculoInterno` en Firestore debe tener el valor correcto del interno
