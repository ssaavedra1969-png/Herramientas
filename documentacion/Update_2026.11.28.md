# Update 2026-11-28 — Equipos e Instrumentos: demo, tolerancias, manual e integración en la app

## Resumen

Sesión completa dedicada a la nueva sección **Equipos e Instrumentos**. Se creó/iteró un demo funcional para **Mantenimiento** y **Pruebas/Ensayos**, se agregó el flujo de **Cocina = Humedad**, se incorporaron **tolerancia por equipo**, cálculo de **desviación**, estado **Apto / No apto** y **Acción tomada** obligatoria cuando corresponde. Se generó un **manual de usuario PDF** con identidad visual de Grupo Falpat SRL. Luego se publicó en Vercel y, tras detectar que el demo standalone cambiaba de menú y no respetaba la navegación de la app, se integró como **sección real autenticada** en `/equipos-instrumentos`, con sidebar/topbar reales y enlace estable en **Utilidades**.

## Estado de git/deploy

- **Inicio**: `HEAD == origin/main == cb07aea` (seguros 07/04/2027).
- **Sincronización**: `git pull origin main` → working tree limpio.
- **Commits de la sesión**:
  - `ca27da3` — "Equipos e Instrumentos: demo, tolerancias y manual de usuario". Incluyó la carpeta `Equipos e Instrumentos/` y cambios de `PATENTE/` que el usuario pidió incluir explícitamente ("pasa todo").
  - `22b0a46` — "Servir Equipos e Instrumentos en Vercel y agregar acceso en menú".
  - `2b5952c` — "Equipos e Instrumentos: integrar como sección de la app en Utilidades".
  - `2719547` — "Fix: quitar handlers huérfanos en Equipos e Instrumentos integrado".
- **Push final**: `origin/main == HEAD == 2719547`. Deploy automático por push a `main` → https://falpat-control-de-vehiculos.vercel.app
- El hook pre-commit no bloqueó porque cada commit se pusheó antes del siguiente.

## Qué se construyó

### 1. Demo funcional de Equipos e Instrumentos

Archivo base: `Equipos e Instrumentos/demo-equipos-instrumentos.html`.

- Página standalone con diseño similar al shell de la app (topbar, sidebar, reloj, tema, command palette, tarjetas y tablas).
- `index.html` redirige al demo.
- Logo local: `Equipos e Instrumentos/fp3d.png`.
- 12 registros de muestra (`M-001`..`M-003`, `P-001`..`P-009`).
- Asistente en 3 pasos: **Mantenimiento de Instrumentos** y **Pruebas/Ensayos**.
- Filtros por parte, planta, sector, equipo, tipo, prueba, categoría y estado.
- Modales de alta/edición, detalle, certificado y configuración de tolerancias.
- La UI guarda los cambios en memoria/local de la pestaña ("Demo local").

### 2. Reglas de negocio implementadas

#### Ubicación y sectores

- Plantas: **Luján** y **Campana**.
- Sectores: **Laboratorio** y **Balanza**.

#### Pruebas por equipo

| Equipo | Prueba | Categoría |
|---|---|---|
| Balanza Moretti | Peso | — |
| Balanza Distribal | Peso | — |
| Balanza UTEST | Presión | — |
| Prensa Cosacob | Presión | — |
| Cocina | Humedad | Áridos (todos) |

- `Cocina` fuerza categoría **Áridos** y deshabilita **Probetas**.
- `Pruebas/Ensayos` solo era válido en `Laboratorio`; con `Balanza` se mostraba aviso y se deshabilitaba el guardado.
- Periodicidades: `1 día · Diaria`, `7 días · Semanal`, `30 días · Mensual`, `90 días · Trimestral`, `180 días · Semestral`, `365 días · Anual`.

#### Tolerancia / Apto - No apto

- `TOLERANCIAS` por equipo (editables desde el catálogo de la sección, "se carga una vez al dar de alta el equipo"):
  - Balanza Moretti: `0.1`
  - Balanza Distribal: `0.1`
  - Balanza UTEST: `0.1`
  - Prensa Cosacob: `0.5`
  - Cocina: `0.5`
  - Balanza Casilda: `0.1`
- Fórmula:
  - `Desviación obtenida (%) = |Resultado − Referencia| / |Referencia| × 100`
  - `Apto` si `desviacion <= tolerancia`
  - `No apto` si `desviacion > tolerancia`
- `Referencia != 0` obligatoria.
- `Acción tomada` obligatoria solo con `Estado = No apto`; se limpia automáticamente al pasar a `Apto`.
- `ACCIONES`: `Recalibración`, `Ajuste`, `Reparación`, `Reposición`, `Observación / seguimiento`, `Otro`.
- `fmtPct` normaliza a 2 decimales y usa coma decimal.

### 3. Manual de usuario

- Generado con ReportLab/Python: `Equipos e Instrumentos/Manual del Usuario.pdf`.
- 11 páginas, branding **GRUPO FALPAT SRL** en portada, encabezado y pie.
- Explica alta de equipos, mantenimiento, pruebas, humedad, tolerancias, Apto/No apto, filtros, exportación y uso local.
- No se inventaron CUIT, domicilio ni teléfono.

## Publicación en Vercel

### Problema 1: la carpeta no se servía

`vercel.json` redirige todo a `server.js`, y `server.js` solo servía `public/`, `/titulos` y `/documentos`. La carpeta `Equipos e Instrumentos/` existía en git pero no tenía ruta.

Fix en `server.js`:

```js
app.use('/equipos-instrumentos', express.static(path.join(__dirname, 'Equipos e Instrumentos'), { index: false }));
```

### Problema 2: `.vercelignore` excluía los PDF

`.vercelignore` tiene `*.pdf`, por lo que el manual y la definición de campos no se desplegaban. Se agregó excepción:

```gitignore
*.pdf
!Equipos e Instrumentos/*.pdf
```

### Problema 3: el demo standalone cambiaba de lugar en el menú

El HTML demo tenía su propio sidebar con "Equipos e Instrumentos" dentro de **Operación**, mientras que en la app real se había agregado en **Utilidades**. El usuario pidió que estuviera "en el mismo lugar siempre" y que "no haya inconveniente con la nueva sección".

Solución: integrarlo como **sección real**:

- `server.js` agregó ruta autenticada:

```js
app.get('/equipos-instrumentos', requireAuth, (req, res) => {
  res.render('equipos-instrumentos', {
    title: 'Equipos e Instrumentos',
    page: 'equipos-instrumentos',
    clientConfig: res.locals.clientConfig,
    currentUser: res.locals.currentUser,
    currentUserData: res.locals.currentUserData
  });
});
```

- Nueva vista: `views/equipos-instrumentos.ejs`.
  - Usa `partials/head`, `partials/sidebar`, `partials/topbar` y `partials/footer` reales.
  - Envuelve el demo en `.ei-demo` para aislar estilos.
  - Mantiene la lógica JS del demo (filtros, formularios, modales, tolerancias).
  - Se eliminaron handlers huérfanos del demo standalone que rompían la ejecución: `tick()`, `setInterval(tick,1000)`, `cmdk`, navegación móvil propia y theme-select duplicado.
- `views/partials/sidebar.ejs`: enlace en Utilidades → `/equipos-instrumentos`, con `active` cuando `page === 'equipos-instrumentos'`.
- `views/partials/mobile-menu.ejs`: mismo enlace y estado activo; `qrGroupOpen` incluye `equipos-instrumentos` para que Utilidades quede abierta en móvil.
- El acceso ya no abre pestaña nueva: vive dentro del shell real de la app.

### Problema 4: la sección integrada no respondía

Después de `2b5952c` los botones/filtros no funcionaban. Causa: quedó un bloque JS huérfano al final de `views/equipos-instrumentos.ejs`:

```js
document.querySelectorAll('.modal-backdrop').forEach(...);
tick();setInterval(tick,1000);
});
```

Como `tick()` ya no existía, se lanzaba un error y se cortaba la ejecución del script del demo. Fix en `2719547`: se quitó ese bloque y el DOM residual de `cmdk`.

## Verificación

- `node --check server.js`: OK tras corregir un `});` duplicado introducido al insertar la ruta.
- `node --check` del script extraído de `views/equipos-instrumentos.ejs`: OK.
- Script de validación del demo standalone:
  - `C:\Users\EFECTI~1\AppData\Local\Temp\opencode\verify-demo-final.js` → `ALL OK`, incluye Cocina/Humedad y rechazo de Probetas.
  - `C:\Users\EFECTI~1\AppData\Local\Temp\opencode\verify-tolerancia.js` → `ALL OK`, incluye Apto guardado, No apto sin acción bloqueado y No apto con acción guardado.
- Verificación de IDs referenciados en la vista integrada: ningún `$('id')` apunta a un elemento inexistente.
- Producción: el usuario confirmó que el enlace aparece en `/dashboard` → Utilidades y que, tras `2719547`, se espera hard refresh para cargar la versión corregida.

## Decisiones importantes / trampas para la próxima IA

1. **No volver a servir el demo standalone como destino del menú.** El destino canónico es `/equipos-instrumentos`, autenticado y con shell real.
2. **Ruta y carpeta son diferentes:** la ruta pública es `/equipos-instrumentos`; la carpeta física tiene espacio y acento (`Equipos e Instrumentos/`). No cambiar el nombre sin actualizar `server.js`, `.vercelignore` y la vista.
3. **`index:false` en el static:** evita que `/equipos-instrumentos/` sirva directamente `index.html` y termine otra vez en el demo standalone. La ruta `app.get('/equipos-instrumentos')` debe ir antes/ganar sobre el static para `index:false`.
4. **PDFs en Vercel:** la excepción `!Equipos e Instrumentos/*.pdf` es necesaria por el `*.pdf` global de `.vercelignore`. Si se mueven los PDF, actualizar la excepción.
5. **CSS aislado:** las reglas del demo llevan prefijo `.ei-demo` para no pisar `themes.css`/Tailwind. Al agregar estilos nuevos al demo, ponerlos dentro de ese scope.
6. **JS del demo:** no reintroducir reloj, selector de tema, command palette ni menú móvil propios: la app real ya los provee. Solo la lógica funcional de Equipos e Instrumentos debe vivir en `views/equipos-instrumentos.ejs`.
7. **Cocina/Humedad:** no volver a habilitar Probetas ni categorías distintas de Áridos para Cocina.
8. **Tolerancia:** la referencia es un valor configurado por equipo; no calcular Apto si la referencia es 0. La acción tomada solo es obligatoria en No apto.
9. **Hard refresh:** por cache-busting de `themes.css`/JS y service worker del navegador, probar con Ctrl+F5 tras cada deploy de cambios en esta sección.
10. **No se corrió `npm test` en esta sesión** porque los cambios son de HTML/PDF/rutas de página y no tocaron lógica de Firestore ni APIs. La verificación fue sintáctica y funcional sobre el demo con harness temporales.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `Equipos e Instrumentos/demo-equipos-instrumentos.html` | Demo base: 3 pasos, Cocina/Humedad, tolerancias, Apto/No apto, acción tomada, 12 registros. |
| `Equipos e Instrumentos/index.html` | Redirect al demo standalone (quedó como acceso histórico/local). |
| `Equipos e Instrumentos/fp3d.png` | Logo local. |
| `Equipos e Instrumentos/Manual del Usuario.pdf` | Manual de usuario generado. |
| `Equipos e Instrumentos/Definicion_Campos_Equipos_Instrumentos.pdf` | Especificación original incluida. |
| `server.js` | Static `/equipos-instrumentos`, ruta autenticada `/equipos-instrumentos`. |
| `.vercelignore` | Excepción para PDFs de Equipos e Instrumentos. |
| `views/equipos-instrumentos.ejs` | Vista integrada con shell real y lógica del demo. |
| `views/partials/sidebar.ejs` | Enlace en Utilidades con estado activo. |
| `views/partials/mobile-menu.ejs` | Enlace en Utilidades, estado activo y grupo abierto. |
| `documentacion/Update_2026.11.28.md` | Este documento. |

## Estado final

- Working tree limpio antes de este documento.
- `origin/main == HEAD == 2719547`.
- Sección pública en producción: `/equipos-instrumentos` (dentro del shell real, "Utilidades" → "Equipos e Instrumentos").
- Pendiente manual: prueba visual autenticada en Vercel con hard refresh, confirmando filtros, alta de registros, modales y configuración de tolerancias.
