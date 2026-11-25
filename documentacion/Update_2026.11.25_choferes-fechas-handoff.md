# Actualización 2026-11-25 — Choferes, vencimientos `dd/mm/aaaa` y handoff 2026-11-26

Puesta al día para retomar mañana el trabajo de choferes/empleados y el incidente visual de fechas en la ficha de vehículo.

Estado: **causa confirmada: Vercel está sirviendo un build viejo**. Cambios en local, sin commit, sin push y sin deploy. Datos de producción verificados en Firestore. `npm test`: **296 OK, 0 FAIL**. Queda pendiente desplegar y verificar en pantalla.

---

## 1. Decisión de modelo (no cambiar)

- `employees/{id}` es la **fuente de verdad** del chofer.
- `vehicles/{id}` es un **espejo operativo** con `empleadoId`, `chofer`, `dni`, `registro`, `vencimientoDNI`, `vencimientoRegistro` y `documentacion.dni|registro`.
- Un vehículo tiene un solo chofer; un chofer puede estar en varias patentes.
- Los vencimientos se guardan como **string `dd/mm/aaaa`**, no como `Timestamp`.
- `tests/empleados.test.js:187` espera strings; no cambiar `camposEspejo()` en `lib/empleados.js:104-119` para escribir `Timestamp`.
- No usar `POST /api/empleados/sincronizar`: `routes/empleados.js:102-104` copia `vehicles → employees` y puede reintroducir datos corruptos. El flujo correcto es editar en `/empleados` (`PUT /api/empleados/:id`) y propagar con `actualizarEmpleado()` / `sincronizarEspejos()` (`lib/empleados.js:264-298`).
- Formato exacto pedido por el usuario: `dd/mm/aaaa`, donde `dd` es día, `mm` mes y `aaaa` año. Ejemplos válidos: `25/08/2032`, `03/01/2038`, `12/09/2039`.

---

## 2. Causa raíz de las fechas

- `new Date('25/08/2032')` da `Invalid Date`.
- `new Date('03/01/2038')` se interpreta como `1/3/2038` (mes/día en USA).
- `new Date('12/09/2039')` se interpreta como `9 de diciembre de 2039`, que explica el `09/12/2039` reportado.
- `new Date('30/04/2027')` da `Invalid Date`.

Regla para el próximo trabajo: **nunca pasar un string `dd/mm/aaaa` directamente a `new Date()`**. Usar siempre un parser explícito (`parseFecha`, `fechaDesdeValor`, `fechaParaInput`) o formatear con `toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })`.

---

## 3. Trabajo ya aplicado

### 3.1 Carga maestra desde Excel

Fuente: `C:\AI\Antigravity\FALPAT srl\Herramientas\PATENTE\Vtos\REVISAR_VENCIMIENTOS_CHOFERES_2026-11-24.xlsx`, hoja `Revision choferes`.

- 31 filas, 28 choferes únicos.
- `AG255NT` quedó con Registro `15/11/2028` (antes `15/08/2028`).
- Vacíos detectados: 7 celdas en 4 perfiles: `Arballo Ricardo`, `Carrizo Gustavo`, `Saccone Benjamin` y el DNI de `Moreyra Walter`.
- Script: `C:\AI\Antigravity\FALPAT srl\Herramientas\scripts\cargar-maestro-desde-excel.js`.
- Backup: `C:\AI\Antigravity\FALPAT srl\Herramientas\PATENTE\Vtos\BACKUP\maestro-choferes_2026-11-25.json`.
- Dry-run: `FILAS=31 PERFILES=28 VEHICULOS=31 VACIOS=4 ALTAS=0`.
- Verificación: `PERFILES_OK=28/28 VEHICULOS_OK=31/31 INVALIDOS=0`, `EMPLEADOS=28 VEHICULOS=62`.
- `CAMBIOS_FUERA_ALCANCE_VEHICULOS=[]`, `CAMBIOS_FUERA_ALCANCE_EMPLEADOS=[]`, `FALLOS=[]`.
- El script fue ajustado para **no reintroducir** el perfil borrado `Paz Emmanuel`.

### 3.2 Piloto `AG269DZ`

- Backup: `C:\AI\Antigravity\FALPAT srl\Herramientas\PATENTE\Vtos\BACKUP\AG269DZ_vehiculo_2026-11-25.json`.
- Script: `C:\AI\Antigravity\FALPAT srl\Herramientas\scripts\pilot-chofer.js`.
- Resultado: `vencimientoDNI = 25/08/2032`, `vencimientoRegistro = 21/11/2026`.
- `CAMBIOS_REALES_FUERA_DEL_PATCH=[]`.

### 3.3 Duplicado de Paz

- Backup: `C:\AI\Antigravity\FALPAT srl\Herramientas\PATENTE\Vtos\BACKUP\paz-duplicado_2026-11-25.json`.
- Perfil canónico: `5xs6kTtuc3ov7GYsX8Xp`, `Paz Emanuel`, DNI `33331683`.
- Perfil eliminado: `X1CVzzhm7m7h3AKWB7Wg`, `Paz Emmanuel`.
- `AF170SV` (V021) y `AH522SJ` (V052) apuntan al mismo `empleadoId`.
- Verificación: `OCURRENCIAS_PAZ_EMMANUEL=[]`, `EMPLEADOS=28 PAZ_PERFILES=1`, `VEHICULOS_CON_ID_BORRADO=0`.

### 3.4 Multi-patente confirmada

- `Paz Emanuel`: `AF170SV`, `AH522SJ`.
- `Quiroz Julian` / DNI `41991111`: `AE947GR`, `AG719US`.
- `Vivas Leonel`: `AE335KK`, `AI417ZZ`.

---

## 4. Cambios de código

### Parsers

- `public/js/auth-client.js`: `parseFecha(valor)` en `:114`; `formatDate()` en `:131` y `daysUntil()` en `:137` lo usan.
- `public/js/dashboard.js:313` y `:361`: DNI/Registro renderizados con `formatDate`.
- `public/js/vehicles.js:746`: `fechaParaInput(val)` acepta `Timestamp`, `{seconds}`, ISO y `dd/mm/aaaa`.
- `public/js/vehicle-detail.js:362-380`: `fechaParaInput()` y `formatDate()` locales para la ficha; ya no dependen de `auth-client.js` para este bloque.
- `lib/utils.js`: `fechaDesdeValor()`, `toDate()`, `parseFecha()`, `toTimestamp()`.
- `routes/admin.js:490`: `fechaYMD(val)` usa `toDate(val)`.
- `views/carpeta-docs.ejs:2`: `toDate(v)` parsea explícitamente `dd/mm/aaaa`.
- `views/vehicle-qr-public.ejs:152`: `fmtDate(d)` parsea `dd/mm/aaaa`.

### Modal Editar de vehículos

- `views/vehicles.ejs:474` y `:482`, y `views/vehicle-detail.ejs:910` y `:918`: `v-vencimientoDNI` y `v-vencimientoRegistro` pasaron de `type="date"` a `type="text"` con `placeholder="dd/mm/aaaa"`.
- `public/js/vehicles.js` y `public/js/vehicle-detail.js` tienen `fmtDDMMYYYY(d)`, `inputFechaTexto(el)`, `setDateField(id,val)` y `getDateValue(id)`.
- `inputFechaTexto()` convierte en runtime un input viejo `type="date"` a texto.
- `setDateField()` escribe literalmente `dd/mm/aaaa`; `getDateValue()` usa `fechaParaInput()`.
- `routes/vehicles.js` usa `parseFecha(...)` para `fechaUltimaRevision`, `vtv.*`, `seguro.*`, `vencimientoDNI` y `vencimientoRegistro`.

### Visualización y exportación

- `public/js/vehicles.js`: `fmtDate()`, `_d()` y el badge de VTV ya no hacen `new Date('dd/mm/aaaa')`.
- `public/js/reports.js`: `fechaADDMMYYYY(ymd)` y `fechaCol()` para Excel/PDF de vencimientos con ceros.
- `views/carpeta-docs.ejs` y `views/vehicle-qr-public.ejs`: fechas con `day: '2-digit'`, `month: '2-digit'`, `year: 'numeric'`.

---

## 5. Caso Leonardo Valentini — abierto

Datos verificados:

- Excel `REVISAR_VENCIMIENTOS_CHOFERES_2026-11-24.xlsx`, hoja `Revision choferes`:
  - `Vto DNI`: serial `51025` → `2039-09-12T03:00:48.000Z` → `12/09/2039`.
  - `Vto Registro`: serial `46507` → `2027-04-30T03:00:48.000Z` → `30/04/2027`.
- Firestore `employees/YSJXchJgQBasI2iLO93U`: `vencimientoDNI = "12/09/2039"`, `vencimientoRegistro = "30/04/2027"`.
- Firestore `vehicles/72ajeLLsbHdTqCXerG38` (`AF606JL`): mismos valores correctos.
- El usuario sigue viendo en la ficha `/vehicle/:id`, bloque Chofer:
  - `Vto. DNI: 09/12/2039`
  - `Vto. Registro: Invalid Date`

Causa confirmada el 2026-11-25 contra la URL exacta del usuario: https://falpat-control-de-vehiculos.vercel.app/vehicle/72ajeLLsbHdTqCXerG38

- `https://falpat-control-de-vehiculos.vercel.app/js/auth-client.js` todavía sirve el `formatDate(timestamp)` viejo:
  - `else date = new Date(timestamp);`
  - `return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });`
  - Con `'12/09/2039'` eso da `09/12/2039`; con `'30/04/2027'` da `Invalid Date`.
- `https://falpat-control-de-vehiculos.vercel.app/js/vehicle-detail.js` todavía llama `setText('vg-vencimientoDNI', formatDate(vehicleData.vencimientoDNI))` y `setText('vg-vencimientoRegistro', formatDate(vehicleData.vencimientoRegistro))`.
- Ese JS servido **no contiene** el `formatDate()` local nuevo, ni `parseFecha`, ni `inputFechaTexto()`. Su `setDateField()` sigue siendo el viejo: `const d = val.toDate ? val.toDate() : new Date(val); el.value = d.toISOString().split('T')[0];`.
- La página sin sesión redirige a `/login`, pero el HTML/JS estático alcanza para confirmar que el deploy es viejo. Firestore no es el problema.

No se pudo reproducir localmente: `Invoke-WebRequest http://localhost:3000/js/vehicles.js` devolvió `ERROR=No es posible conectar con el servidor remoto`.

---

## 6. Verificaciones ya hechas

- `setDateField()` simulado con un input viejo `type="date"`:
  - `DNI=text 12/09/2039`
  - `REG=text 30/04/2027`
- `formatDate()` local de `vehicle-detail.js`:
  - `12/09/2039`
  - `30/04/2027`
  - `2039-09-12 → 12/09/2039`
  - `Invalid Date → -`
- `fmtDate('03/01/2038') → 03/01/2038`.
- `fechaADDMMYYYY('2038-01-03') → 03/01/2038`.
- `node --check` OK en los JS modificados.
- `ejs.compile` OK en los EJS modificados.
- `npm test`: 296 checks OK, 0 FAIL.

No hay lint ni typecheck configurados. La validación disponible es `npm test`.

---

## 7. Pendiente para mañana

1. **Pedir confirmación explícita** para hacer commit/push de los cambios locales. No aplicar `stash@{0}`.
2. Después del push, esperar el deploy automático de Vercel (o ejecutar deploy si el usuario lo autoriza) y volver a consultar:
   - `/js/auth-client.js` debe tener `parseFecha(valor)` usado por `formatDate()`.
   - `/js/vehicle-detail.js` debe incluir `function formatDate(val)` local y `inputFechaTexto()`.
3. Recargar https://falpat-control-de-vehiculos.vercel.app/vehicle/72ajeLLsbHdTqCXerG38 con hard refresh y verificar que el bloque Chofer muestre `12/09/2039` y `30/04/2027`.
4. Si después del deploy sigue mal, recién ahí revisar en DevTools el payload de Firestore/`GET /api/vehicles/:id` y buscar otro punto de formateo.
5. No asumir que `localhost` está corriendo: el problema confirmado está en el build servido por Vercel.

---

## 8. Reglas y trampas

- No `git pull`, no `stash pop/apply`, no commit, no push y no deploy sin confirmación del usuario.
- `AGENTS.md:15` advierte: existe `stash@{0}` viejo (`WIP on main: 7d89f46 Correos: novedades por patente + documentacion pendiente online`). **No aplicar** sin `git stash show -p stash@{0}` y revisión explícita.
- No ejecutar `npm start` en esta sesión; no hay servidor local levantado.
- `PATENTE/Vtos/CONTROL_VENCIMIENTOS_2026-09-07.xlsx` es viejo; no usarlo para cargar vencimientos de choferes.
- `scripts/completar-vencimientos-empleados.js` y `scripts/cargar-vencimientos.js` son flujos viejos/peligrosos si se ejecutan sin control; no usarlos como camino principal.
- El helper de fechas sigue duplicado en `public/js/vehicles.js` y `public/js/vehicle-detail.js`. La tarea P2 `documentacion/TAREAS_PENDIENTES/00-INDICE.md` de unificar `setDateField()` / `getDateValue()` sigue vigente; no fue resuelta en esta sesión para no ampliar el alcance.

---

## 9. Archivos relevantes

- `AGENTS.md`: reglas críticas de sincronización/producción.
- `scripts/cargar-maestro-desde-excel.js`: carga maestra desde Excel y propagación.
- `scripts/pilot-chofer.js`: piloto `AG269DZ`.
- `lib/empleados.js`: `camposEspejo()`, `sincronizarEspejos()`, `actualizarEmpleado()`.
- `routes/empleados.js`: API de empleados; `/sincronizar` es el sentido inverso y no se usa.
- `public/js/empleados.js`, `views/empleados.ejs`: UI de edición de choferes.
- `public/js/auth-client.js`: helpers globales de fecha.
- `public/js/dashboard.js`: alertas de choferes en dashboard.
- `public/js/vehicles.js`, `views/vehicles.ejs`: listado y modal de vehículos.
- `public/js/vehicle-detail.js`, `views/vehicle-detail.ejs`: ficha y bloque Chofer.
- `public/js/reports.js`, `views/reports.ejs`: exportación de vencimientos.
- `lib/utils.js`, `routes/vehicles.js`, `routes/admin.js`: parseo y escritura en backend.
- `views/carpeta-docs.ejs`, `views/vehicle-qr-public.ejs`: fechas visibles en otras pantallas.
- `tests/empleados.test.js`: contrato de vencimientos como string.
- `documentacion/Update_2026.11.21_empleados.md`: diseño original de Empleados.
- `documentacion/Update_2026.11.21_service-y-seguros.md`: contexto de seguros/service.
