# TAREA P3-3: Unificar branding "Falpat SRL" vs "Grupo Falpat SRL"

**Prioridad:** BAJA
**Archivos:** Múltiples
**Problema:** El sidebar dice "Falpat SRL" pero el login y mobile header dicen "Grupo Falpat SRL".

---

## Cambios requeridos

### Buscar todas las instancias y unificar a "Grupo Falpat SRL"

Archivos a revisar:
1. `views/partials/sidebar.ejs` — buscar "Falpat SRL" → cambiar a "Grupo Falpat SRL"
2. `views/partials/mobile-menu.ejs` — verificar que dice "Grupo Falpat SRL"
3. `views/login.ejs` — ya dice "Grupo Falpat SRL" (OK)
4. `views/dashboard.ejs` — verificar
5. `public/js/vehicle-detail.js` — línea 89: fallback `'Grupo Falpat SRL'` (OK)

### Uso de grep para encontrar todas las instancias:

```bash
grep -rn "Falpat SRL" views/ public/js/ --include="*.ejs" --include="*.js"
```

---

## Verificación

1. Navegar por todas las páginas
2. El nombre de la empresa debe ser consistente: "Grupo Falpat SRL" en todos lados
