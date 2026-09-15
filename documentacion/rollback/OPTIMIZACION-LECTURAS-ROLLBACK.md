# OPTIMIZACIÓN DE LECTURAS FIRESTORE — Guía de rollback

> **Objetivo:** reducir el consumo de créditos de lectura (plan Spark ~50K/día) sin romper funcionalidad y SIN regresiones.
> **Para quién:** cualquier AI o persona que deba **revertir solo este lote de cambios** y conservar trabajo posterior.

---

## 1. Baseline (estado EXACTO antes de los cambios)

| | |
|---|---|
| **Commit HEAD** | `2d6d665afafb897bd6fe6b7e3a164f8d47b83319` |
| **Tag git** | `pre-optimizacion-lecturas-2026-09-15` |
| **Fecha** | 2026-09-15 |
| **Working tree** | limpio (docs de sesión movidos a `documentacion/` en commit separado, ver §6) |

El tag se creó ANTES de cualquier commit `[opt-lecturas]`.
Estado de producción en esa fecha: todo pusheado, `origin/main == HEAD`.

---

## 2. Consumo detectado (14% = 6.7K de 50K lecturas/día)

| # | Origen | Cómo consume | Estimate/día | Fix propuesto |
|---|--------|--------------|--------------|---------------|
| 1 | Polling ciego de la página Service | `service.js:344` `setInterval(..., 300000)` relee **TODOS los vehículos** + `collectionGroup('services')` sin filtro ni cache cada 5 min | ~19-24K si la pestaña queda visible | Eliminar polling; auto-refresh con `visibilitychange` (>60s) |
| 2 | Dashboard | `dashboard.js:702` llama `loadCedulaPresentes()` **dentro** del callback de `onSnapshot` → re-fetch de TODOS los vehículos en cada evento | ~56 reads por evento | Cache TTL 60s en `/documentos/reporte` |
| 3 | Reportes | `/api/admin/report` y `/report/export` releen todos los vehicles + collectionGroup combustible/repuestos | Alto por uso | Filtros de fecha en Firestore + caches |
| 4 | Doble lectura de `users/{uid}` | `middleware/auth.js`: `loadUser`/`verifyToken` (read 1) + `ensureFirstAdmin` (read 2) | 1 extra por request | Pasar el doc ya leído |
| 5 | Cliente relee `users/{uid}` | `auth-client.js` `completeSignIn` en cada carga pese a `window.__SERVER_USER_DATA` | 1 por carga | Usar los datos del server |

---

## 3. Decisiones técnicas (NO cambiar sin avisar)

- **NO se toca `firestore.rules`.** Un `collectionGroup('services').onSnapshot` del lado cliente **no está garantizado** que pase (catch-all `allow read, write: if false` bloquea) → riesgo de "Error al cargar". Por eso la página Service usa **refresh por `visibilitychange`** en vez de un listener en vivo.
- Los fixes se aplican como **commits separados y etiquetados** `[opt-lecturas]` — uno por archivo — para poder revertir **de a uno** sin perder trabajo futuro.
- Timeline de datos serializados por API = `{"_seconds":...}`; por SDK web = `.toDate()`. `toMs()` en service.js maneja ambos.

---

## 4. Cómo revertir

### Opción A — Revertir TODO el lote (conserva trabajo posterior)

Requiere los SHAs de los commits `[opt-lecturas]`. Para revertirlos TODOS a la vez (en orden inverso):

```bash
# 1. Asegurar que HEAD = origin/main
git pull origin main

# 2. Revertir (no resetear) los commits, del más nuevo al más viejo:
git revert <SHA-mas-nuevo> <SHA-mas-viejo> --no-commit

# 3. Revisar el diff resultante, luego commitear y pushear
git commit -m "Revert: optimizacion de lecturas firestore"
git push origin main
```

> `git revert` conserva el historial y NO toca los commits de trabajo posterior que no son del lote.

### Opción B — Revertir UN solo fix

Identificá el commit `[opt-lecturas]` del archivo que te interesa y:

```bash
git revert <SHA>
```

| Fix | Archivo | Tag del commit |
|-----|---------|----------------|
| Service sin polling + visibilitychange | `public/js/service.js` | `[opt-lecturas] service polling` |
| Cache panel services | `routes/vehicles.js` | `[opt-lecturas] cache panel services` |
| Cache reporte documentos | `routes/vehicles.js` | `[opt-lecturas] cache reporte docs` |
| Eliminar doble lectura user | `middleware/auth.js` | `[opt-lecturas] dedup user read` |
| Usar datos de server en cliente | `public/js/auth-client.js` | `[opt-lecturas] usar server user data` |

### Opción C — Reset duro al estado exacto del tag

> ⚠️ Destructivo: descarta CUALQUIER commit posterior al tag (no solo el lote).
> Usar SOLO si se decidió abandonar todo el trabajo posterior a esa fecha.

```bash
git reset --hard pre-optimizacion-lecturas-2026-09-15
git push origin main --force-with-lease
```

---

## 5. Verificación post-revert (sanity check)

1. `npm start` local levanta sin errores.
2. Página **Service**: se carga al entrar, botón "Actualizar" funciona, no hay polling continuo → abrir DevTools → pestaña Network → no debe ver requests a `/services/panel` repetidos cada 5 min con la pestaña inactiva.
3. **Dashboard**: editar un vehículo → solo 1 request a `/documentos/reporte` (cacheado TTL 60s), no uno por evento de snapshot.
4. Login funciona (no se rompió `completeSignIn`).
5. `git pull origin main` no muestra conflictos y `origin/main == HEAD`.

---

## 6. Qué se conserva y qué NO es del lote

**NO es parte de `[opt-lecturas]`** (cambios previos/independientes que NO desaparecen al revertir):
- Reorganización de documentación → commit dedicado de docs (carpeta `documentacion/`, tag `pre-optimizacion-lecturas-2026-09-15`).
- Fixes previos: `2d6d665` (rename `daysUntil`→`serviceDaysUntil`), `602edd2` (no-store global + build marker), `e3bc230` (panel sin orderBy), `0ab3f5e` (mockMode).
- Todo el backlog de `documentacion/TAREAS_PENDIENTES/`.

**Si aparece un conflicto al revertir** (porque un commit posterior tocó el mismo archivo), NO lo fuerces: resolvé mergeando manualmente y manteniendo la intención del lote de optimización salvo que el trabajo posterior lo requiera.