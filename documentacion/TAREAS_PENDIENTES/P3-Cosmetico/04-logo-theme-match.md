# TAREA P3-4: Revisar consistencia de colores del logo

**Prioridad:** BAJA (cosmético)
**Problema:** El logo usa gradientes `#FF6B35` / `#FF3366` (naranja-rosa) pero la UI usa `#6C3CE1` / `#00D4FF` (púrpura-cyan).

---

## Cambio requerido

### 1. Localizar el archivo del logo

Buscar el logo:
```bash
find . -name "logo*" -not -path "./node_modules/*" -not -path "./.git/*"
```

### 2. Actualizar colores

Si el logo es SVG, cambiar los colores:
- `#FF6B35` → `#6C3CE1` (primary purple)
- `#FF3366` → `#00D4FF` (accent cyan)

Si es imagen rasterizada, regenerar o reemplazar.

### 3. Verificar también el favicon

```bash
find . -name "favicon*" -not -path "./node_modules/*" -not -path "./.git/*"
```

---

## Verificación

1. El logo en el sidebar debe usar los mismos colores púrpura/cyan de la UI
2. El favicon debe ser consistente
