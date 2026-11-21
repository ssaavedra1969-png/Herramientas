# Actualización 2026-11-21 — Seguros 07/04/2027 + Parámetros de service

Puesta al día para la próxima IA (y para la otra PC). Cubre dos trabajos independientes hechos el mismo día:

1. **Renovación de seguros** con vencimiento `07/04/2027` (32 vehículos) + docs sueltos de `AH657LB`.
2. **Parámetros de service configurables**: configuración editable en Firestore, UI en `/service` y arreglo del cálculo de los ítems "solo por fecha".

Commits relacionados (antes de este commit de documentación):

| Commit | Mensaje | Alcance |
|--------|---------|---------|
| `60ade3a` | `Docs: seguros renovados 07/04/2027 (32 vehiculos)` | PDFs de `PATENTE/` + backups |
| `6e016b7` | `Docs: AH657LB cedula/DNI/registro + vencimientos y fuente de seguros` | PDFs de `AH657LB` + Excel de carga + borrado de `seguros.rar` |
| `d655e92` | `Service: parametros configurables y link en Utilidades` | backend, UI y menú |
| `78e16ff` | `Service: parametros arriba y controles solo por fecha sin km` | fix del cálculo "solo fecha" |

---

## 1. Renovación de seguros — póliza 07/04/2027

### Entrada

- Archivo: `PATENTE\Vtos\seguros\COBERTURA DE SEGUROS 07-04-2027.pdf`.
- **33 páginas**. OCR con **Tesseract en inglés (`eng`) únicamente**; no se instaló paquete `spa`.
- La **página 33 se descartó**: no tenía campo `PATENTE:`. Quedaron **32 constancias**.

### Correcciones manuales de patente

El OCR confundió caracteres en 3 patentes. Corregir siempre antes de instalar:

| OCR | Corrección | Tipo de error |
|-----|------------|---------------|
| `AH7840Y` | `AH784OY` | cero → letra O |
| `AHO52ZE` | `AH052ZE` | letra O → cero |
| `AHO52ZD` | `AH052ZD` | letra O → cero |

### Instalación de PDFs

Para cada una de las 32 patentes:

- staging: `PATENTE/Seg/{PATENTE}.pdf`;
- destino final: `PATENTE/{patente}/seguro.pdf`;
- backup del seguro anterior: `PATENTE/{patente}/BACKUP/seguro_al DD.MM.YY.pdf`, con la **fecha de modificación** del archivo viejo.

Resultado:

- **32 PDFs instalados**.
- **31 backups**: `AH784OY` no tenía seguro viejo, por eso no generó backup.
- Los PDFs de staging en `PATENTE/Seg/` **quedaron** (decisión del usuario: no borrar). Se borró solamente `seguros.rar`.

### Carga de vencimientos

Excel usado: `PATENTE\Vtos\SEGUROS_RENOVACION_2026-11-21.xlsx` (columnas `Patente | Tipo documento | Vencimiento | Nota`).

Comando (dry-run primero, después sin `--dry-run`):

```powershell
node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_2026-11-21.xlsx --dry-run
node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_2026-11-21.xlsx
```

Resultado: **13 actualizados / 19 sin cambios / 0 errores**.

Verificación posterior en Firestore:

- **32/32** vehículos con `seguro.fechaVencimiento = '07/04/2027'`.
- **32/32** con `docsAdjuntos.seguro = 0` (es decir, se lee el PDF de la carpeta `PATENTE/`, no un archivo subido desde la web).

> **No ejecutar `npm run cargar:vencimientos` sin `--archivo=...`.** El script toma por defecto el `CONTROL_VENCIMIENTOS_*.xlsx` más reciente de `PATENTE/Vtos/`, que tiene fechas viejas y **revertiría** esta renovación.

### Documentos sueltos de `AH657LB`

Además de la póliza, se cargaron con `PATENTE\Vtos\DOCUMENTOS_AH657LB_2026-11-21.xlsx`:

| Documento | Vencimiento cargado |
|-----------|---------------------|
| Registro | `04/08/2027` |
| DNI | `29/09/2041` |
| Seguro | `23/10/2027` |

Se agregaron **4 PDFs nuevos** para ese vehículo. Los originales del fuelle quedaron en `_originales`; no se borraron.

---

## 2. Parámetros de service configurables

### Antes y después

Antes los intervalos de service estaban hardcodeados en `public/js/vehicle-detail.js` (`Mixer 30000 km/9 meses`, `Auto/Camioneta 10000 km/6 meses`) y no había forma de editarlos desde la web.

Ahora la fuente es el documento de Firestore **`config/serviceParametros`**:

```js
{
  items: [
    { nombre: 'Cambio de aceite', km: 10000, meses: null, fijo: true },
    // ...
  ],
  actualizadoEn: <Timestamp>,
  actualizadoPor: <uid/email>
}
```

- Implementación: `lib/service-parametros.js` (defaults, `normalizarItems()`, `getParametros()`, `guardarParametros()`).
- Si el documento no existe, se usan los defaults del servidor y el espejo `SERVICE_PARAMS_DEFAULT` del cliente. **El documento guardado gana siempre**.
- El doc ya existe en producción con **21 ítems**, de los cuales **10 son `fijo:true`**.

### Census actual de los 21 ítems

#### 5 fijos por kilómetros (`meses: null`)

| Ítem | `km` | `meses` | `fijo` |
|------|------|---------|--------|
| `Cambio de aceite` | 10000 | `null` | `true` |
| `Cambio de filtro de aceite` | 10000 | `null` | `true` |
| `Cambio de filtro de combustible` | 20000 | `null` | `true` |
| `Cambio de filtro de aire` | 30000 | `null` | `true` |
| `Cambio de filtro de habitáculo` | 15000 | `null` | `true` |

#### 5 fijos **solo por fecha** (`km: null`)

| Ítem | `km` | `meses` | `fijo` |
|------|------|---------|--------|
| `Engrase de Pluma y Chasis` | `null` | 3 | `true` |
| `Engrase de Chasis` | `null` | 3 | `true` |
| `Sopleteado de Filtro de Aire` | `null` | 3 | `true` |
| `Calibrado de ruedas` | `null` | 2 | `true` |
| `Calibrado de Luces` | `null` | 2 | `true` |

#### 11 sugerencias no fijas

Todas con `km: null`, `meses: null`, `fijo: false`. Solo alimentan el `<datalist>` del formulario: **no autocompletan nada** y no disparan reglas. Si el usuario las elige, carga los valores a mano.

### API y permisos

| Método | Ruta | Guarda | Uso |
|--------|------|--------|-----|
| `GET` | `/api/vehicles/services/parametros` | `verifyToken` | cualquier usuario autenticado puede leer los ítems |
| `PUT` | `/api/vehicles/services/parametros` | `verifyToken + requireAdmin` | guardar la configuración; `Usuario` recibe **403** |

### UI

- Card **`#svc-parametros` — "Parámetros de service"**, **arriba de todo** en `/service`, visible solo para Admin.
- Tabla editable con nueva fila (botón "Agregar ídem"), botones de borrado y guardado. El servidor normaliza: recorta nombres, descarta vacíos, limita longitud y deduce `fijo` para los 10 ítems canónicos.
- Link Admin-only **"Parámetros Service"** en **Utilidades** → `/service#svc-parametros`, presente en:
  - `views/partials/sidebar.ejs` (desktop),
  - `views/partials/mobile-menu.ejs` (móvil),
  - `public/js/command-palette.js` → `ADMIN_NAV` (Ctrl+K / Cmd+K).
- Regla del proyecto: el menú móvil debe tener los mismos destinos que el desktop.

### Reglas de cálculo (punto clave)

En `public/js/vehicle-detail.js`:

```js
const soloFecha = item.km == null && item.meses != null;
```

- Si `soloFecha` es `true`:
  - **no** se aplica la regla por tipo de vehículo (`Mixer 30000/9`, `Auto/Camioneta 10000/6`);
  - no se calcula `proximoKm`;
  - el submit usa `conKm = !!(regla && regla.intervalo != null)` para no sumar `km + null`.
- Si el ítem tiene `km` configurado, ese `km` gana al del tipo.
- Si el ítem tiene `meses` configurado, esos `meses` ganan a los del tipo.
- Para los ítems sin configuración se mantiene el comportamiento histórico por tipo de vehículo.

**Bug corregido:** antes, `Calibrado de ruedas` (`km:null`, `meses:2`) caía en la regla por tipo y terminaba con `intervaloKm: 30000` en mixers; además el submit sumaba `km + null` y dejaba `proximoKm` en `null`/`NaN`.

**Verificación en producción:** `AH522SJ` ya tenía, para `Calibrado de ruedas`, `intervaloKm: null`, `proximoKm: null` y `proximoFecha` cargada. Es decir, **no hay datos sucios que limpiar**; el fix evita que se generen a partir de ahora.

### Verificación

- `node --check` limpio en los JS modificados.
- `npm run test:negocio`: **39 checks, 0 fallas** (incluye defaults 21/10, autoría, dedupe, clamp, 403 para `Usuario` y el caso `Calibrado de ruedas` solo-fecha).
- `npm test`: suite completa OK.
- Harness temporal `check-regla-service.js`: 6/6 checks del cálculo de regla.
- Render EJS: Admin ve el card y los links (`cardTop:true`); `Usuario` no (`card:false`).
- Producción: `GET /api/vehicles/services/parametros` responde `401` sin token; el JS servido con cache-bust (`/js/vehicle-detail.js?v=78e16ff`) contiene `soloFecha` y `Calibrado de ruedas`.

---

## 3. Trampas para la próxima IA

1. **`DEV_READ_ONLY=true` en `.env` local.** Las escrituras por API están bloqueadas; no bajar la guarda para "probar" (usa la base real). Para tests de escritura, `npm test` con el Firestore falso. Los scripts con Admin SDK sí escriben directo.
2. **`stash@{0}` viejo sin aplicar.** Contiene borrados de una sesión anterior. Chequear `git stash list` antes de cualquier `git stash pop`/`apply`; usar `git stash show -p stash@{0}` solo si se quiere revisar.
3. **`npm run cargar:vencimientos` sin `--archivo` revierte fechas.** Siempre pasar `--archivo=...` y correr primero con `--dry-run`.
4. **Tesseract sin español.** Para futuras pólizas, el flujo probado usa solo `eng`; revisar patentes manualmente (O vs 0).
5. **`config/serviceParametros` gana a los defaults.** Si se cambia la UI o las reglas, actualizar a la vez `lib/service-parametros.js`, `SERVICE_PARAMS_DEFAULT` en `public/js/vehicle-detail.js` y los tests.
6. **`km:null` + `meses` no es "falta el km".** Es un ítem válido solo por fecha. No inyectar el km por tipo; no calcular `proximoKm`.
7. **Cache del bundle.** Al verificar un fix en producción, pedir el JS con `?v=<hash>` para no leer una versión cacheada.
8. **`vercel --prod --yes` puede fallar con `Not authorized`** aunque `npx vercel whoami` responda `ssaavedra1969-3480`. No es necesario: `git push origin main` dispara el deploy automático. Chequear que `origin/main == HEAD` al cerrar.
9. **`collectionGroup('services')` con `where('tipo','==',...)` pide índice `COLLECTION_GROUP_ASC`.** Para inspecciones point-in-time, iterar `vehicles/{id}/services` en vez de crear el índice.
10. **`PATENTE/` en Vercel se lee desde GitHub** (`lib/github-docs.js`) y el árbol puede quedar cacheado hasta 10 min. Subir un PDF no carga su vencimiento: son dos pasos separados.

---

## 4. Estado final

- Seguros: 32/32 con vencimiento `07/04/2027`; 31 backups; `AH657LB` con Registro/DNI propios.
- Service: 21 parámetros en producción, 10 fijos; card y link de Utilidades visibles solo para Admin; cálculo solo-fecha corregido y verificado.
- Repo: `HEAD == origin/main == 78e16ff23401001d67e58220553cfd95f828a030` antes de este commit de documentación; working tree limpio.
- Documentación relacionada: `AGENTS.md` (puesta al día general), `documentacion/PROCEDIMIENTO-SEGUROS.md` (procedimiento operativo), `documentacion/README.md` (índice).
