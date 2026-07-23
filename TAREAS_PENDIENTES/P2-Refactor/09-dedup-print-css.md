# TAREA P2-9: Eliminar bloque `@media print` duplicado

**Prioridad:** BAJA
**Archivo:** `public/css/styles.css`
**Problema:** El bloque `@media print` aparece dos veces idéntico (líneas 358-363 y 371-376).

---

## Cambio requerido

### `public/css/styles.css` — Eliminar el segundo bloque duplicado

**Eliminar líneas 371-376:**
```css
@media print {
  body { background: white !important; color: black !important; }
  #sidebar, #menu-toggle, .no-print, .header-glass { display: none !important; }
  .glass-card { background: white !important; border: 1px solid #ddd !important; box-shadow: none !important; }
  .text-gradient-primary { -webkit-text-fill-color: #333; background: none; }
}
```

Mantener solo el primer bloque (líneas 358-363).

---

## Verificación

1. Abrir DevTools → Sources → `styles.css`
2. Buscar `@media print` → debe aparecer solo una vez
3. Imprimir una página → el estilo debe ser correcto (fondo blanco, sidebar oculto)
