# TAREA P3-2: Cambiar texto "Exportar CSV" → "Exportar Excel"

**Prioridad:** BAJA
**Archivo:** `views/reports.ejs`
**Problema:** El botón dice "Exportar CSV" pero la función `exportReporteXLSX()` exporta un archivo `.xlsx`.

---

## Cambio requerido

### `views/reports.ejs` línea 23

**ANTES:**
```html
Exportar CSV
```

**DESPUÉS:**
```html
Exportar Excel
```

### También cambiar el ícono SVG (línea 22) para que represente Excel mejor:

El ícono actual (línea 22) es genérico de "download" — está bien, no necesita cambio.

---

## Verificación

1. Ir a `/reports`
2. El botón debe decir "Exportar Excel"
3. Al hacer click, debe descargar un archivo `.xlsx`
