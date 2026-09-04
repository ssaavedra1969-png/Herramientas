# Sesión 03-sep-2026 — ThemeEngine v3 (3 temas visuales)

## Estado actual
- Working tree limpio
- Origin = HEAD
- Último commit: `d1fd313` "ThemeEngine v3: animated backgrounds, structural differences, conic borders, complete Tailwind overrides"
- Servidor local corriendo en puerto 3000
- Repo: `ssaavedra1969-png/Herramientas` (rama main)

## Archivos modificados en el commit d1fd313
| Archivo | Cambio |
|---------|--------|
| `public/js/theme-engine.js` | NUEVO (794 líneas) — ThemeEngine v3 completo |
| `public/css/theme-sutil.css` | Reducido a 1 línea (variables) |
| `public/css/theme-modern.css` | Reducido a 1 línea (variables) |
| `public/css/theme-premium.css` | Reducido a 1 línea (variables) |
| `views/partials/head.ejs` | Sin cambios funcionales (ya tenía theme-engine.js) |
| `views/partials/footer.ejs` | Sin cambios funcionales (ya tenía integración) |

## Problema que el usuario reportó
Después de 4+ iteraciones del ThemeEngine (v1 → v2 → v3), el usuario sigue diciendo:

> "la verdad se siguen viendo iguales, pero lo dejamos asi hasta mañana"

## Diagnóstico (lo que no funciona)

### Lo que SÍ hicimos
1. **v1**: CSS overrides básicos con selectores escapados Tailwind
2. **v2**: `!important` + MutationObserver + inline style override
3. **v3 (actual)**: 
   - @property declarations para animated gradients
   - 3 fondos animados diferentes (cálido / grid cyan / aurora)
   - Estructura distinta por tema (radius 12→8→20px, blur 10→16→24px)
   - Conic gradient border animado en Moderno+Premium
   - Tailwind overrides expandidos
   - Orb flotante en Premium
   - MutationObserver con `style` + `class` attributes

### Lo que PROBABLEMENTE falla
1. **Tailwind CDN re-genera CSS** después del primer `MutationObserver` de Tailwind. El `<style id="theme-engine-override">` se inyecta, pero Tailwind puede estar sobreescribiéndolo (problema conocido con CDN).
2. **Specificity de `html.theme-X .Y` vs `.Y` de Tailwind**: Tailwind usa selectores simples. Nuestro `html.theme-X` tiene specificity (0,1,1) = ok, pero si Tailwind usa `!important` o tiene más specificity, gana.
3. **Timing del `init()`**: el script corre al `DOMContentLoaded`, pero Tailwind CDN puede que aún no haya inyectado su `<style>`. Si Tailwind inyecta DESPUÉS, gana por orden de aparición.
4. **El usuario compara contra el default**, no necesariamente entre temas. El default Sutil tiene `accent: #D4AF37` = igual al color original hardcoded. Aunque cambié la estructura (radius 12px, blur 10px, etc.), si esos cambios no son DRAMÁTICOS, el usuario no los nota.

## Lo que hay que hacer mañana

### Paso 1: Diagnosticar
Abrir DevTools en el browser y verificar:
- ¿`#theme-engine-override` `<style>` existe en `<head>`?
- ¿Las reglas `html.theme-modern .glass-card { ... }` están ganando en `getComputedStyle`?
- ¿Tailwind CDN está sobreescribiendo después de que inyectamos?
- ¿`body { background: ... !important }` de Tailwind está siendo ignorado por el nuestro?
- Comparar `getComputedStyle(document.body).background` antes y después de `applyTheme('modern')`

### Paso 2: Decidir la solución
Tres caminos posibles:

**A) Reemplazar TODO el `<style>` de Tailwind** después de que inyecta (destruir + recrear):
```js
// Esperar a que Tailwind inyecte, después sobrescribir
const twStyle = document.querySelector('style[data-tailwind]');
if (twStyle) {
  twStyle.textContent = twStyle.textContent.replace(/#d4af37/g, accent);
}
```
Pro: sobrevive a Tailwind re-renders. Con: frágil.

**B) CSS Custom Properties en TODO el HTML** (intrusivo pero definitivo):
- Reemplazar TODAS las clases Tailwind con `bg-[#d4af37]` por `style="--bg-accent: #d4af37"` y luego `bg-[var(--bg-accent)]`
- Tocar todos los `.ejs` y `.js`
- El theme engine solo cambia `--bg-accent: var(--accent)` y se aplica a TODO

**C) Overlay con CSS filter** (sin tocar nada del HTML):
```js
document.body.style.filter = 'hue-rotate(180deg) saturate(1.3)';
```
Cambia TODOS los colores instantáneamente. Diferencias SUSTANTIVAS, sin tocar Tailwind.
- Sutil: filter:none
- Moderno: hue-rotate(180deg) saturate(1.3)
- Premium: hue-rotate(270deg) saturate(1.4)
**Pro**: dramático, instantáneo, sin riesgo de specificity. **Con**: afecta también fotos y logos.

### Paso 3: Recomiendo (en orden)
1. Probar opción C primero (5 min) — si funciona, listo
2. Si no, opción A con `MutationObserver` también en el `<style>` de Tailwind
3. Si no, opción B (intrusivo, último recurso)

## Archivos para retomar mañana

- `public/js/theme-engine.js` (794 líneas, v3)
- `public/css/theme-*.css` (1 línea cada uno)
- `views/partials/head.ejs` (línea 42: `<script src="/js/theme-engine.js?v=...`)
- `views/partials/footer.ejs` (líneas 12-90: theme switcher)
- `public/css/theme-switcher.css` (144 líneas, switcher UI)

## Decisión del usuario
"lo dejamos asi hasta mañana" → usuario frustrado, probar opciones nuevas mañana.
