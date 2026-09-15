# Sesión 15-sep-2026 — Service: fix "Vencimiento" en "—" (colisión de `daysUntil`)

## Estado actual
- Working tree limpio
- Origin = HEAD
- Último commit: `2d6d665` "Fix service: renombra daysUntil a serviceDaysUntil para evitar colision con auth-client.js (days pendian NaN -> Vencimiento mostraba dash)"
- Servidor local en puerto 3000
- Repo: `ssaavedra1969-png/Herramientas` (rama main)

## Problema reportado
En la página Service, la columna **Próx. fecha** mostraba la fecha correcta (ej: 20/11/2026) pero la columna **Vencimiento** mostraba **"—"** en vez de "en 65 días", en todas las filas con estado PRÓXIMO. Pasaba **igual en producción y en local**, incluso con el JS nuevo desplegado.

## Síntoma clave (debug en consola)
```
[debug] AF606JL -> minFecha={"_seconds":1795143600,"_nanoseconds":0} | toMs=1795143600000 | days=NaN | infoDays=NaN | estado=proximo
```
`toMs` OK (da valor) pero `days` era `NaN`. La fecha se formateaba bien pero la resta de días daba `NaN`.

## Causa raíz (quirk importante)
`public/js/auth-client.js` (cargado vía `partials/footer.ejs` DESPUÉS de `service.js`) define su **propio** `function daysUntil(date)` (línea 120), que **pisa** la versión de `service.js`. El de auth-client hace `new Date({_seconds:...})` → Invalid Date → `NaN` (está pensado para timestamps del SDK web, no serializados por el API).

No había conflicto en otras páginas porque `dashboard.js` y demás usan datos del SDK web (con `.toDate()`).

## Fix
- `public/js/service.js`: `daysUntil` → **`serviceDaysUntil`** (nombre único que no colisiona con auth-client.js). Misma lógica robusta (usa `toMs` con soporte `_seconds` + guard `Number.isFinite`).
- Se actualizaron las 2 llamadas internas (en `computeEstado` y `buildMainRow`).
- Se quitó el log de debug temporal.

### Lección aprendida (NO repetir)
**Los nombres globales de helpers se pisan según el orden de carga de scripts en el footer.** Si un helper va a recibir datos serializados por el API (`{_seconds, _nanoseconds}`), o le llegan Timestamps del SDK, darle un nombre específico del módulo (ej: `serviceDaysUntil`) para no colisionar con el helper genérico de `auth-client.js`.

## Otros cambios en la sesión (confundidos con cache antes de encontrar el bug)
- `server.js`: middleware `Cache-Control: no-store` ahora corre **siempre** (antes solo en dev con `NODE_ENV !== 'production'`). Evita que el navegador/edge conserve HTML+JS viejos. (commit `602edd2`)
- `views/service.ejs` + `public/js/service.js`: flag de build visible `#svc-build-flag` y `console.log('[service.js] build:', SVC_BUILD)`. (commit `602edd2`)
- `routes/vehicles.js`: panel `/services/panel` sin `orderBy` del collectionGroup (evita índice manual) + orden en memoria; soporte modo mock (`panel-mock`). (commit anteriores de la sesión)

## Deploys
- `602edd2` y `2d6d665` pusheados a GitHub → Vercel desplegó automáticamente.

## Verificación del fix
- Local: con el log de debug se confirmó `days` pasaba de `NaN` → valor numérico tras el rename. Usuario confirmó "ahora siiii".
- Se replicó el pipeline del panel en Node contra Firestore real: AF606JL → `days: 65` → `estado: proximo`.