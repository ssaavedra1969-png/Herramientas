# Update 2026-10-15 — Deshabilitar vehículos: dashboard, Obras, QR y ficha

## Contexto

El campo `deshabilitado` ya existía (commit `ff00ba0`) con su helper central
`esDeshabilitado()` / `sinDeshabilitados()` en `lib/utils.js`, el toggle en la
lista de `/vehicles` y la exclusión de dashboard, reportes, services, fichas
bulk, carpeta docs y scripts de Excel. **Deshabilitar ≠ dar de baja**
(`estadoGeneral: 'Baja'` es otra cosa: el "Baja" es un estado operativo del
vehículo, el `deshabilitado` lo saca de TODOS los informes).

En esta sesión se cerraron los 4 huecos que quedaban (interpretados y
aprobados por el usuario con las 3 opciones recomendadas):

1. El dashboard los **filtraba y no mostraba nada** — el usuario pidió verlos.
2. **Obras** seguía permitiendo asignar un deshabilitado a una obra.
3. El **QR público** del camión deshabilitado mostraba la ficha completa sin
   aviso, y el listado de stickers QR no los excluía.
4. La **ficha del vehículo** no mostraba el estado ni permitía reactivar desde
   ahí (solo desde la lista).

## Cambios

### Dashboard — contador + modal (`views/dashboard.ejs`, `public/js/dashboard.js`)
- La tarjeta "Flota activa" tiene un botón ámbar **"N deshab. ▸"**
  (`#kpi-deshab-btn`, oculto cuando N = 0) junto al hint y al "Ver".
- `allDeshabilitados` se calcula en el mismo `onSnapshot` que arma
  `allVehicles` (se filtra una sola vez el snapshot).
- `showDeshabilitadosModal()` (mismo patrón que `showVehiculosModal`):
  interno/patente/marca + chip con la fecha (`deshabilitadoAt`) y el motivo
  debajo. Click en la fila → ficha del vehículo.

### Obras — selector excluye deshabilitados (`routes/centros.js`)
- `getVehicleList()` (alimenta `GET /api/centros/elementos/disponibles/vehiculo`)
  ahora filtra con `esDeshabilitado()`: un deshabilitado **no se puede asignar**
  a una obra.
- `GET /api/centros/elementos` (vehMap) **no** filtra: las asignaciones viejas
  se siguen mostrando como histórico en la pestaña Elementos.

### QR público + stickers (`server.js`, `views/vehicle-qr-public.ejs`)
- `/vehicle/:id/qr` pasa `deshabilitado` y `deshabilitadoMotivo` a la vista.
- Si está deshabilitado: chip ámbar "Deshabilitado" junto al estado + caja de
  aviso ("No cuenta en ningún informe…"), y **no se listan** vencimientos
  (ni los chips VTV/Seguro), últimos movimientos ni documentos. Queda solo la
  identificación (patente/interno/marca/modelo/datos básicos).
- `GET /vehicles/qr-stickers-bulk` excluye deshabilitados (como ya hacía
  `fichas-taller-bulk`). Los QR ya pegados al camión muestran el aviso en la
  página pública.

### Ficha del vehículo (`views/vehicle-detail.ejs`, `public/js/vehicle-detail.js`)
- Chip **"Deshabilitado"** (`#deshab-badge`) al lado del título cuando el
  vehículo lo está.
- Botón Admin **Deshabilitar / Reativar** (`#btn-deshabilitar`, junto a
  Editar) con `confirm()`; hace el mismo update directo que la lista de
  `/vehicles` (`deshabilitado` + `deshabilitadoAt` + `updatedAt`).
- `renderDeshabilitado()` se llama en `loadVehicle()` (la página no usa
  onSnapshot del doc vehículo, es load único).

### Tests (`tests/deshabilitado-orden.test.js`)
- Sección nueva: monta el harness real (`helpers.js` → Firestore falso) y
  pega `GET /api/centros/elementos/disponibles/vehiculo` con 3 vehículos
  sembrados (activo, `deshabilitado: true`, `deshabilitado: 'true'`): el
  activo aparece, los 2 deshabilitados no. 4 checks nuevos → suite en 30
  checks, 0 fallas.

## Verificación

- `node --check` limpio en `routes/centros.js`, `server.js`,
  `public/js/dashboard.js`, `public/js/vehicle-detail.js`,
  `tests/deshabilitado-orden.test.js`.
- Las 3 vistas EJS modificadas compilan (`ejs.compile`).
- `npm test` completo: todas las suites en 0 fallas.

## Notas para el futuro

- **Todo pasa por `esDeshabilitado()` (`lib/utils.js`)**: si aparece un informe
  nuevo, filtrar con ese helper, no repetir la condición. El campo acepta
  boolean `true` y string `'true'` (defensa contra docs escritos a mano).
- `estadoGeneral === 'Baja'` y `deshabilitado` conviven: los informes filtran
  las dos cosas por separado (Baja por legado operativo, deshabilitado por
  "no cuenta para nada").
- El dashboard es un lugar donde los deshabilitados **se muestran** (con
  contador y modal); **el otro es Carpeta Docs** (ver más abajo). En el resto
  son invisibles por diseño.
- Si se toca el QR público: el server siempre pasa `deshabilitado` (boolean) a
  la vista; la vista lo asume definido.

---

# Sesión tarde — Carpeta Docs (deshabilitados + impresión)

## Deshabilitados ahora sí salen en Carpeta Docs

`cargarVehiculosCarpeta()` (`server.js`) **dejó de filtrar** a los
deshabilitados: sigue excluyendo solo `estadoGeneral === 'Baja'`, y les agrega
`deshabilitadoFlag: esDeshabilitado(v)` en lugar de sacarlos. Es la **única
excepción** a la regla "no cuentan en ningún informe" (el comentario de
`lib/utils.js` quedó actualizado).

- **Índice** (`views/carpeta-docs.ejs`): columna nueva **"Estado"** (20mm, la
  columna Interno era de 18mm y el tag se comía con `text-overflow: ellipsis`:
  el texto existía en el HTML pero no llegaba al papel). Fila teñida de rojo,
  interno rojo y tag `DESHAB.`. Barra de info muestra "N deshabilitados".
- **Carátula**: banner rojo grande **"VEHÍCULO DESHABILITADO · motivo"** +
  marca de agua diagonal de 54pt "DESHABILITADO" (opacidad 10%, z-index 4).
- **PDF descargado** (`/vehicles/carpeta-docs/pdf`): la hoja separadora lleva
  "VEHICULO DESHABILITADO" en rojo (`rgb(0.86,0.15,0.15)`), importado `rgb` de
  `pdf-lib`.
- Hoy el flag está en 5 vehículos: V004, V009, V028, V056, V058 (59 en la
  carpeta, 62 hojas = 3 índice + 59 carátulas).

**Trampa:** `deshabilitadoFlag` lo calcula el **backend**. Si se toca
`server.js` y se prueba en local, hay que **reiniciar** `node server.js` (no
recarga en caliente); sin reiniciar la vista nueva no pinta nada porque
`v.deshabilitadoFlag` es `undefined`.

## Hoja en blanco entre hojas al imprimir (corte de la última fila)

**Causa raíz de todo el percal de impresión**: en `@media print` la hoja tenía
**altura fija** `.page { height: 296mm }`. Si el área imprimible del driver
daba un par de milímetros menos (A4 con margen propio de la impresora: 291-295mm),
el contenido se pasaba un pelo y Chrome **fragmentaba la hoja** → salía una
**página en blanco** después de cada hoja (y antes, con el contenido más
alto, la fragmentación cortaba la última fila — lo de "corta en 20, 44 y 54").

Fix (verificado con Chrome headless + PyMuPDF): `height: auto; min-height:
270mm`. La hoja mide su contenido y solo se le impone un mínimo para que el
pie quede abajo; **270mm entra en cualquier A4 imprimible** (297 sin margen,
277 con 10mm) y si el ancho útil es menor que 210mm Chrome escala, bajando el
alto en la misma proporción. Último bloque medido a **266,5mm** → 30mm de
holgura. 62 páginas, **0 en blanco**, índice 20/24/15 con pie en las 3.

## Pendiente / decisión

- **Índice en 2 hojas vs 3**: pide "todo en 2 hojas A4". Cabe (59 filas ×
  ~6,8mm + intro + leyenda ≈ 540mm disponibles), pero queda ajustado: bajar
  fila de 7,6 a ~6,8mm y achicar la leyenda, con poco margen de seguridad.
  Opción B (3 hojas con holgura) es lo que quedó mientras se decide.
