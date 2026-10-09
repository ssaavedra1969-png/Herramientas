# CHANGELOG — Sistema de Control de Mantenimiento

Cambios registrados por sesión. Última actualización: 2026-10-09.

## 2026-10-09 — Documentos de vehículos (solo docs, sin código)

Detalle completo en **`Update_2026.10.09.md`**. **Ningún cambio de código ni de
Firestore.**

### Vehículo `AH190PG` — 2 PDF nuevos
- `PATENTE/AH190PG/cedula.pdf` y `PATENTE/AH190PG/dni.pdf` (`seguro.pdf` y
  `titulo.pdf` ya estaban versionados).

## 2026-10-08 — Reportes (modelo) + Solapa Obra con PDF + encabezado en cada hoja de los PDF

Detalle completo en **`Update_2026.10.08.md`**.

### Reporte de Flota: afuera Subtipo, Nº BET, Trompo y Año
- `FIELDS` −4, `DEFAULT_COLS` 12 → **8** (Patente, Interno, Tipo, Marca, Modelo, Chofer, Empresa, Centro de trabajo), sin buscador/orden/celda/export para esos campos; stats 4 → 2 (afuera Trompo y Con Nº BET). Siguen `cargaM3Trompo` y los demas `*Trompo`.

### Solapa Obra (módulo Centros)
- Tabla `min-w-[900px] border-collapse` con grilla por celda, 13 columnas, sin `truncate`: Nombre y Observaciones envuelven y se leen completas. Refactor `filtrarElementos` / `agruparPorObra` / `renderElementos` / `filaElemento` (mismo origen para pantalla y PDF).
- **PDF "Elementos por Obra"** (jsPDF apaisado): logo, filtros en el subtítulo, cabecera de obra en verde, 12 columnas escaladas a 273 mm, pie con página.
- Fix del join de `GET /api/centros/elementos`: `vehMap` indexado por **patente e interno** en mayúsculas (el alta guarda la patente en `interno`, el mapa sólo tenía `V-XXX` → salía sin nombre/marca/modelo) + respuesta con **`tipoVehiculo`** y **`chofer`**.
- `tests/fake-firestore.js`: `DocRef.parent` = colección y `CollectionRef.parent` = doc padre (antes `d.ref.parent.parent.id` daba `'centros'`).

### Los 4 PDF repiten el encabezado completo de la 1ª hoja
- `encabezadoEnTodas()` en `reports.js` (Flota, Documentación, Vencimientos) y `encabezadoObra()` en `centros.js`: la hoja 1 dibuja antes de autoTable, su Y queda como `margin.top` y `didDrawPage` redibuja el encabezado desde la hoja 2 + el pie en todas. El texto (incluida la fecha "Generado") se calcula una sola vez → idéntico hoja por hoja.

### Centro de trabajo: "Obra Ibicuy" → "Lujan" en los 2 camiones (datos)
- **Ibicuy es la obra que se carga en el popup "Centro de trabajo + Carga M3 Trompo"** del editar vehículo: no hay campo Obra/Destino aparte, es `centroTrabajo`, y por eso Reportes lo listaba. `AF804RU` y `PCS413` pasaron a **`centroTrabajo = "Lujan"`** (su base); `cargaM3Trompo` 8 M3 / 4 M3 intactos.
- Censo final (58 vehículos): **Lujan 41, `""` 16, Campana 1** — sin "Obra Ibicuy".
- Se creó y **borró** (revertido) la obra "Obra Ibicuy" del módulo Centros con esos 2 camiones como elementos: el usuario aclaró que **Ibicuy no es una obra de Centros**. `centros` queda con 2 obras (Cordoba, Carlos Casares) y 4 elementos, igual que antes.
- Selectores de la ficha: **+ "Carlos Casares"** y **+ "Obra Ibicuy"** como opciones de `centroTrabajo` (`vehicles.ejs`, `vehicle-detail.ejs`).

### Documentación `PATENTE/`
- `AE335KK/cedula.pdf` reemplazada (1,29 MB → 181 KB); nuevos `AE335KK/dni.pdf`, `AE335KK/registro.pdf`, `AH784OY/dni.pdf`, `AH784OY/registro.pdf`.

### Verificación
- `npm test` → **131 checks, 0 fallas**. Harnesses de sesión: modelo de Flota 12/12, páginas de PDF 36/36, PDF Obra 17/17, sort 7/7, render 13/15 (2 aserciones propias inválidas).
- API real contra el server local: `/api/centros` 2 obras / 4 elementos; `/api/admin/report/flota` con `centroTrabajo` Lujan 41 / `""` 16 / Campana 1.

### Commits y deploy
- Commit **`46d10bb`** — "feat: Reportes sin Subtipo/BET/Trompo/Anio, solapa Obra con PDF y encabezado en todas las hojas" (15 archivos: 6 JS, 4 vistas, 2 docs, 5 PDF de `PATENTE/`). Pusheado a `origin/main`.
- Deploy `vercel --prod --yes` → **Ready**, alias https://falpat-control-de-vehiculos.vercel.app (build 11s). Verificado en producción: `/login` 200, `reports.js` con `encabezadoEnTodas` y `DEFAULT_COLS` de 8, `centros.js` con `encabezadoObra`.

## 2026-10-06 — Renovación de seguros (póliza 30457810): 32 constancias separadas + BACKUP del seguro viejo + fecha 07/04/2027

Detalle completo en **`Update_2026.10.06.md`**. **Ningún cambio de código de la app.**

### Separación del PDF (`PATENTE/Seg/`)
- `PATENTE/Seg/Certificados de cobertura.pdf` (32 págs, póliza **Ref 30457810**, vigencia **07/10/2026 → 07/04/2027**) → **32 PDF en `PATENTE/Seg/` nombrados con la patente** (`AC264CZ.pdf`, ...).
- Distinto al formato del 03/10: acá es **1 página = 1 vehículo** con campo `PATENTE:` (no `Dominio:` de 4 páginas), así que un regex alcanza, **sin OCR**.
- Verificado 32/32: 1 pág, patente del texto = nombre del archivo, vigencia correcta.
- **31 de 32 son de la flota**; `AH784OY` no existe en Firestore. **`AG469LY` era un error de la aseguradora**: la patente real es **`AG469YL`** (V017), que no figuraba en el PDF; el usuario consiguió la constancia corregida (`AG469YL_reimpreso.pdf` → renombrada a `AG469YL.pdf`) y se borró `AG469LY.pdf`. **`PATENTE/Seg/` quedó con 32 PDF (9,6 MB)**; el PDF fuente se retiró de la carpeta a mitad de sesión.

### Backup y reemplazo del seguro viejo
- `PATENTE/{patente}/BACKUP/seguro_al DD.MM.YY.pdf` = el viejo **movido** ahí, con la **fecha de modificación del archivo** (pedido del usuario; ej. `seguro_al 22.04.26.pdf`).
- **29 respaldados**; `AH919KE` y `NYR481` no tenían seguro previo (solo recibieron el nuevo). **31/31** con `seguro.pdf` nuevo verificado.

### Fecha en Firestore
- `PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-06.xlsx` (32 filas únicas) + `node scripts/cargar-vencimientos.js --archivo=...` (dry-run primero): **30 actualizados, 2 SKIP, 0 errores**; después **`--patente=AG469YL`** para la corrección → **1 más, total 31**.
- Re-leído: **31/31** con `seguro.fechaVencimiento` **y** `documentacion.seguro.fechaVencimiento` en **07/04/2027**.
- **Censo previo de solo lectura: no se recortó ninguna fecha.** 24 en 07/10/2026 (vencían al día siguiente), 2 en 07/10/2025, 1 en 06/10/2026, 4 sin fecha, `AG469YL` en 07/10/2026 y `AG976PG` en 28/01/2027 (se **extiende**).
- ⚠️ Recordatorio: **no correr `npm run cargar:vencimientos` a secas** (el `CONTROL_VENCIMIENTOS_2026-09-07.xlsx` revierte fechas).

### Pendientes que quedaron
- **`LEC583` sigue sin póliza** (los otros 2 vencidos, `GKX407` y `AG276BQ`, sí entraron).
- **29 carpetas de flota no están en esta póliza**; **14 vehículos siguen sin fecha de seguro**.
- **Nada commiteado sin confirmar**: `PATENTE/Seg/` (32 PDF, 9,6 MB, no ignorado), los 31 `seguro.pdf`, los 29 `BACKUP/` y esta doc.
- `npm test` → **105/105 + 26 checks, 0 fallas**.

## 2026-10-03 (tarde) — Reportes / Vencimientos: checklists múltiples + informe agrupado por empresa + PDF con estilo pizarra

`public/js/reports.js` + `views/reports.ejs`. Sin cambios en backend ni en la base.
`npm test` → **105/105**.

### Los 2 filtros múltiples
- **`Documento` y `Empresa` pasaron de `<select>` a checklists desplegables**: se pueden elegir **varios a la vez**. `vencFilters.doc`/`vencFilters.empresa` (strings) son ahora **`vencFilters.docs`/`vencFilters.empresas` (arrays)**, con array vacío = "Todos"/"Todas".
- Botón `.vc-multi-btn` que muestra "Todos" / lo único elegido / "N documentos" ("N empresas"), y panel `.vc-multi-panel` con un checkbox por opción.
- El valor viaja en **`data-opt`**, nunca interpolado en un `onclick`: una empresa con comilla o `&` rompería el HTML. `llenarMultiVenc()` asigna `panel.onchange` y **no** `addEventListener`, porque se vuelve a llamar al limpiar filtros y asignar reemplaza el handler en vez de acumularlo (con `addEventListener` cada cambio renderizaba dos veces).

### Una fila por vehículo Y documento (solo con 2+ documentos)
- Con **0 o 1** documento elegido sigue siendo **una fila por vehículo** con lo más urgente: es la lista de trabajo, no cambia.
- Con **2 o más**, **una fila por vehículo y documento**: el mismo camión sale una vez por cada documento en ventana, cada uno con su fecha, su estado y su color.
- El stat **Vehículos** pasó a contar los vehículos **distintos** (`grupos.reduce(s => s + g.vehiculos)`), no las filas, para que no crezca con los repetidos.

### El informe agrupado por empresa
- `datosVenc()` es el nuevo que arma el resultado y devuelve `{grupos, filas}`; `vencFiltrada()` quedó solo con el filtrado (sin el `sort`).
- Un grupo por empresa con clave de `normTxt(v.empresa)`: **`" obra  norte "` cae en el mismo grupo que `"Obra Norte"`** (la flota tiene `mixer` y `Mixer`). Sin empresa → `"Sin empresa"`.
- **Dentro de cada grupo, de la fecha más próxima a la más lejana; las empresas también de la más urgente a la menos urgente** (por su `minDias`). Si se clickea otra columna, el orden de grupos pasa a ser el de esa columna.
- Encabezado de grupo `<tr class="vc-grp">` (`colspan=5`) con `N vehículos · N documentos · N vencidos`. Toggle **"Agrupar por empresa"** (prendido por defecto) para volver a la lista plana.
- Al imprimir sale en **13pt negro sobre gris**: en la pizarra es lo que ordena el trabajo.

### Exports
- **Excel y PDF salen en el mismo orden que la pantalla** (los dos usaban `vencFiltrada()` plano; ahora usan `datosVenc()`).
- El PDF **suma la columna `Documento` cuando hay 2+ documentos elegidos** (6 → 7 columnas, anchos recalculados a 186 mm): sin ella el mismo camión sale dos veces y no se dice qué hay que renovar.
- Con agrupación, cada grupo se imprime como **fila combinada** (`colSpan`) con fondo gris y la empresa en mayúsculas.
- El subtítulo del PDF ahora dice `Seguro + VTV · … · 2 empresas · agrupado por empresa` (`resumenFiltroVenc()`).

### Matafuego: informe de toda la flota agrupado por tipo (`scripts/generar-control-matafuego.js`)
- 3 pedidos del usuario: (1) un Excel con **todo junto, con y sin matafuego**; (2) los que decían **"Sin dato"** ahora dicen **"Sin Matafuego"**; (3) **agrupado por tipo**.
- Nuevo `CONTROL_MATAFUEGO_TODOS_<fecha>.xlsx` (57 vehículos en 12 tipos). Los otros dos (`_MIXERS_`, `_RESTO_`) no cambian: siguen siendo los que **no** tienen matafuego. Se llegó a este archivo por un pedido intermedio de "solo los mixers que sí tienen", que quedó como subconjunto del nuevo.
- `estadoMatafuego()` ya no distingue las dos situaciones: sin campo y con estado "Sin Matafuego" devuelven ambos `'Sin Matafuego'`. Para no perder el dato, la fila lleva `sinDato` (**flag, no columna**) y la consola lo cuenta aparte.
- `filaDe()` es la única constructora de filas de las 3 salidas. `escribir()` acepta `agrupadoPor`: mete una fila de encabezado **combinada** (`mergeCells` A:I) por tipo con `N vehiculos · M con matafuego`, y **omite el autofiltro** en las salidas agrupadas (con filas de encabezado en el medio, el filtro las mezcla). Las 2 salidas planas lo conservan.
- **Trampa evitada:** el tipo se agrupa con `normTipo()` (trim + minúsculas, la misma clave que la app). Sin eso "mixer" (22) y "Mixer" (1) salían como **dos grupos del mismo tipo**.
- **Adentro de cada tipo va por patente** (orden natural: AH2 antes que AH10). Los 2 archivos planos (`_MIXERS_`, `_RESTO_`) **no** cambian: siguen por cantidad de documentación faltante, que para ese control es lo que sirve.
- **Bug del agrupado:** el orden por patente no alcanzaba con agrupar en `main()`, porque **`escribir()` vuelve a agrupar por su cuenta** (es el que mete las filas de encabezado) y descartaba el pre-orden: el archivo salía con el orden viejo sin avisar. Por eso el `sort(cmp)` va **adentro de `escribir()`**, y `cmp` subió a **nivel de módulo** para que las dos puntas lo usen. Verificado releyendo el `.xlsx`: 12 grupos, 57 vehículos, 0 fuera de orden.
- Census 2026-10-03: **3 con matafuego y los 3 son mixers** (`AG148TK` sin `fechaVto` → "SIN CARGAR", `AF804RU` 31/03/2027, `AE943EN` 18/12/2026). 54 sin: 24 nunca cargado + 30 marcados. **Los otros 11 tipos de vehículo no tienen ni un matafuego cargado**: si deberían, el dato falta en Firestore.
- Verificado en el XML del `.xlsx`: 13 merges (1 título + 12 grupos) y 71 filas (1+1+57+12).

### Columna Tipo en la card Documentación
- El usuario pidió "una columna más, la de tipo, junto a marca/modelo": la única card con **Marca/Modelo** es Documentación (Vencimientos ya tenía Tipo). Quedan **12 columnas** en pantalla, Excel y PDF: Patente · Marca/Modelo · **Tipo** · Centro · Empresa · 6 documentos · Faltan.
- 4 lugares, todos en `public/js/reports.js`: `baseCols` en `renderDoc()` (el `<td>` va en el template de la fila), el objeto de `filasDocExport()` (el Excel toma el orden de las claves), el `head`/`body` de `exportDocPDF()` y `anchos`. Los anchos del PDF se repartieron para que sigan entrando en los 273 mm: Patente 26, Marca/Modelo 44, Tipo 24, Centro 30, Empresa 40, 6×13, Faltan 16 = **258**.
- De yapa el buscador de texto de la card ahora incluye `tipo` y `subtipo` (antes solo buscaba patente/interno/marca/modelo/empresa/centro).
- Verificado inflando los streams del PDF de prueba: el header repite `Patente, Marca/Modelo, Tipo, Centro, Empresa, Faltan` en las 5 páginas y las celdas pasan de 693 (11 col) a 756 (12 col).

### Orden dentro de cada empresa: por patente
- **Adentro de cada empresa los camiones van ordenados por patente** (se lee como una lista de vehículos), no por fecha. Las **empresas** siguen ordenadas por su vencimiento más próximo: la más urgente arriba.
- Se implementó con `keyFila` en `datosVenc()`: si el agrupado está prendido y la columna activa es `fecha`, las filas se ordenan por `patente` (y **la flecha de orden se muestra en Patente**, no en Vencimiento, que ordena las empresas). Clickear cualquier columna manda esa columna adentro del grupo. `g.minDias` pasó a ser `Math.min()` de las filas del grupo: antes tomaba la primera fila, que con el orden por patente ya no era la más urgente.
- **`filas` sale aplanada en el orden final**, no en el sort global: el Excel no lleva fila de encabezado de empresa, así que antes el `.xlsx` salía ordenado por patente con las empresas intercaladas mientras la pantalla y el PDF salían agrupados. Ahora los tres coinciden (cubierto por `check-venc.js`).

### Los 3 PDF con el mismo estilo "pizarra"
- El de **Flota** y el de **Documentación**aban en **5.5pt sin bordes**, ilegibles de lejos (el de Vencimientos ya estaba bien). Ahora los 3 usan el mismo `PDF_TABLA`: cuerpo **9pt**, header **9.5pt** negro con letras blancas, **grilla de 0.5mm en #1F2937**, filas alternadas y `cellPadding: 2`.
- `encabezadoInforme()` arma logo + título + subtítulo multilínea + fecha y devuelve el `startY`; los 3 PDF lo usan (Flota y Documentación tenían su propio encabezado con `y0 = 36` fijo).
- `pieEnCadaPagina()` como `didDrawPage`: el pie **con número de página aparece en todas las páginas** (antes solo al final de la última). Requiere `margin.bottom: 16`.
- **Anchos por columna:** Flota es de ancho variable (el usuario elige columnas con checkbox), así que `anchosColumnasPDF()` reparte los 273 mm según el largo del contenido (`PDF_ANCHO_COL`: empresa/chofer/centro se llevan más mm). Documentación tiene anchos fijos (Patente 26, Marca/Modelo 52, Centro 32, Empresa 44, 6×13 a los documentos, Faltan 16).
- Vercimientos mantiene su portrait de 6 columnas (7 con multi-documento) con anchos fijos que suman 186 mm.

### Trampa
Los `<select>` de documento y empresa se reemplazaron por completo: `setVencDoc()` y `setVencEmpresa()` **ya no existen**. Si se agrega un filtro nuevo al mismo patrón, usar `llenarMultiVenc()` y **no** un `<select>`.
- **Para probar los PDF hay que instalar jsPDF**: la app los carga por CDN, así que `node_modules` no lo tiene. `npm install --no-save jspdf@2.5.1 jspdf-autotable@3.8.2`, generar con `doc.output('arraybuffer')` y **descomprimir los streams con `zlib.inflateSync`**: ahí se ven los operadores de tamaño de letra (`/F1 9 Tf`) y los bordes de la grilla (`0.5 w` + `0.12 0.16 0.22 RG`, uno por celda). Es la única forma de confirmar que el estilo entró en el archivo y no solo en el código. Verificar con `git status` que no se tocaron `package.json`/`package-lock.json`.
- **Ojo con el nombre del archivo**: el harness escribe en `%TEMP%\reporte-test-*.pdf`. Medir un `ver-*.pdf` viejo da resultados que ya no corresponden al código (con un archivo de 09:04 se veía el cuerpo de Vencimientos en 9,5 pt "cuando" ya estaba en 9). Si el PDF no coincide con el código, primero mirá la **fecha de modificación**.
- **No usar `Get-Content -Raw` + `Set-Content` para tocar archivos con acentos** en PowerShell 5.1: se comió los caracteres no ASCII del harness y dejó `U+FFFD` en los datos (`label: 'Cédula'` → `'C?dula'`), que rompe los asserts sin dar ningún error de sintaxis. Usar las herramientas de archivo, o `[System.IO.File]::ReadAllText/WriteAllText` con UTF-8 explícito.

## 2026-10-03 — Renovación de seguros: 7 certificados + fecha 07/10/2026 + fix del rótulo de `subir:docs`

Detalle completo en **`Update_2026.10.03.md`**. Commits: **`e134709`** (los 7 PDF de
`PATENTE/`), más el fix de `scripts/subir-documentos.js` y la doc.

### Los 7 certificados y su fecha
- Los PDF **ya estaban** reemplazados en `PATENTE/{patente}/seguro.pdf` (los hizo el usuario con la app de Optimizaciones). **No hizo falta tocar la app**: `routes/admin.js` → `fechaDocVenc(v,'seguro')` ya resuelve el campo. Lo que faltaba era la fecha.
- 6 de las pólizas **13695272** (certificados 134, 156, 159, 161, 175, 179) y `AF170SV` de la **13674442** (cert. 59). Todas con vigencia 07/04/2026 → **07/10/2026**.
- `AF606JL` estaba **vencido desde 07/10/2025** (un año) y `AF170SV` **cambió de aseguradora** (el PDF viejo eran 6 páginas de otra compañía).
- `AH125AF` ya tenía `seguro.fechaVencimiento` en 07/10/2026 pero `documentacion.seguro.fechaVencimiento` en 07/04/2026: un Reporte que leyera el genérico lo mostraba vencido.
- Cargado con `node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-03.xlsx` (dry-run primero). **Sin código nuevo**: se armó un Excel a medida que se llama `SEGUROS_RENOVACION_*` y no `CONTROL_VENCIMIENTOS_*` para no secuestrar el default de `excelReciente()`.
- Re-verificado: **7/7** con los dos campos en `2026-10-07`.

### ⚠️ No correr `cargar:vencimientos` a secas
`PATENTE/Vtos/CONTROL_VENCIMIENTOS_2026-09-07.xlsx` tiene las fechas **viejas** (07/04/2026, 07/10/2025): correrlo **revierte** la renovación de los 7 y deja los PDF del disco contradiciendo la base.

### Las pólizas de `PATENTE/Seg/` (el usuario después las borró)
| Póliza | Vigencia | Placas |
|---|---|---|
| **13674442** (`CERTIFICADOS DE COBERTURAS.pdf`, 182 pág) | 07/04/2026 → 07/10/2026 | 60 |
| **13673743** (`...POLIZA 13673743.pdf`, 90 pág) | 24/04/2026 → 24/10/2026 | 23 |
- **83 dominios distintos**; 4 páginas por certificado con `Dominio: XXXXXX` arriba → **no hace falta OCR** para mapear.
- `AG276BQ`, `GKX407` y `LEC583` **no están en ninguna** de las dos (ni por coincidencia parcial).

### Bug: `subir-documentos.js` nunca contaba el primer vehículo
- El commit `e134709` se anunció como **"Docs: 6 vehículos"** y llevaba **7 archivos**. Con **un solo** archivo, el mensaje decía **"Docs: 0 vehículos"**.
- Causa: `git status --porcelain` de un archivo modificado empieza con `" M "`, y el `.trim()` de la línea 50 se come ese espacio de la **primera** línea; el parseo `/^.. /` deja de matchear y `partes[0]` queda `"M PATENTE"`.
- **Solo era de rótulo**: los documentos siempre se commitearon bien (el `git add` es del directorio, no de la lista), pero el log de git queda subinformado. Fix: sacar el `.trim()` y saltear líneas vacías.

### Census de seguros (corte 2026-10-03, solo lectura)
- **3 vencidos hace meses**: `GKX407` y `AG276BQ` (-361 d), `LEC583` (-181 d) — de una póliza que no está en `Seg/`.
- **30 con seguro al 07/10/2026** y **5 al 24/10/2026**: de los 30, solo **7** tienen el PDF nuevo. Los otros **23** (más los 5) siguen con el certificado viejo.
- **18 sin fecha de seguro cargada**.

### Limpieza
- Borrados 8 scripts `.py` sueltos de la raíz del repo (`buscar_patentes.py`, `extraer_certificados*.py`, `extraer_primer_*.py`, `list_structure.py`, `search_cond6.py`, `ver_paginas.py`).
- `PATENTE/Seg/` quedó vacía (la borró el usuario). **No está en `.gitignore`** por decisión suya: si se vuelven a poner las pólizas ahí, `subir:docs` las commitea (4,7 MB por póliza, ~190 MB con el material extraído).
- `npm test` → **105/105**.

## 2026-10-02 (tarde) — Columna Chofer en los Excel de control + vencimientos faltantes + auditoría de PDF

Detalle completo en **`Update_2026.10.02_tarde.md`**. Commits: **`288cd38`**
(generadores + doc), **`b38c4b3`**, **`bf465f2`**, **`7138138`** (los 3 últimos
son solo `PATENTE/`). **Ningún cambio de código de la app.**

### Columna Chofer en los 4 Excel de control
- El usuario editó a mano sus Excel de referencia: se usan **exactamente esas columnas, más `Chofer`**.
- El campo es **`chofer`**, no `conductorHabitual`: census contra Firestore da `chofer` en **23 de 57** vehículos y `conductorHabitual` en **1** (resto viejo, no usar). Por eso la columna sale vacía en muchos renglones: el dato no está cargado, **no es un bug**.
- `scripts/generar-control-documentacion.js`: `chofer: v.chofer || ''` + `<th>` en las hojas de faltantes (156 filas) y vencidos (25 filas).
- `scripts/generar-control-matafuego.js`: idem en `CONTROL_MATAFUEGO_MIXERS_` (20 filas) y `_RESTO` (34 filas).

### Vencimientos que faltaban en Firestore
- Auditoría de `PATENTE/Vtos/CONTROL_VENCIMIENTOS_2026-09-07.xlsx` contra Firestore con un **diff de solo lectura**: 90 campos idénticos, **4 faltantes**, 0 diferentes, 0 conflictos. `AG889XV` no existe en Firestore (solo tiene PDF).
- Los 4 se cargaron con `npm run cargar:vencimientos --patente=…` uno por uno, **sin overwrite**:
  - `AD718OH` VTV `21/02/2026`
  - `AD957RY` Seguro `07/10/2026`
  - `AE192RO` Seguro `07/10/2026`
  - `AE192RO` VTV `15/04/2027`
- Re-verificado: **94/94 campos idénticos, 0 faltantes, 0 diferencias, 0 conflictos.** Ninguna fecha previa se pisó.

### PDF: auditoría de peso, sin tocar nada
- 193 PDF en `PATENTE/`. Los >3 MB son **16** y ocupan **56,1 MB de 163,1 MB** (34%).
- **Decisión del usuario: los PDF quedan como están.** Solo se reporta lo que pesa mucho, para que la app de Optimizaciones sea opcional y no obligatoria.
- `PATENTE/Reportes/RESCANEAR_2026-10-02.xlsx` generado (ignorado por git). **`AH052ZE` (tapa 39 KB) queda accepted tal cual.**

### Truco aprendido
- `npm run cargar:vencimientos` sin `--patente` reporta como "a cargar" **todos** los ítems del Excel, incluso los que ya están idénticos (49 vehículos), porque el script no compara contra Firestore: solo escribe. **Para auditar hay que hacer el diff con un script aparte**, no confiar en el dry-run.

## 2026-10-02 — Reportes: columna Empresa, título con los filtros e impresión "pizarra"

Detalle completo en **`Update_2026.10.02.md`**. Commit: **`f04c43e`**. En la misma
sesión: 10 PDF nuevos en `PATENTE/` y documentación puesta al día.

### Columna Empresa en Vencimientos
- La tabla de la card **Vencimientos** pasó de 4 a **5 columnas**: `Patente | Interno | Tipo | Empresa | Vencimiento`. `renderVenc()` suma el `<th>` clickeable (orden por `orderVal(a.v,'empresa')`, que funciona porque `empresa` sí es un campo del vehículo) y el `<td class="col-empresa" title="valor completo">`.
- Los nombres de empresa son largos y estiraban la tabla: en pantalla `td.col-empresa` lleva `max-width:200px` + ellipsis, con el valor entero en el `title`.

### El título del reporte dice QUÉ se imprimió
- `resumenFiltroVenc()` + `VENC_ESTADOS` arman una línea con los filtros puestos: `Todos los documentos · Por vencer · hasta 30 días · empresa: X · centro: Y · tipo: mixer · búsqueda: "..."`.
- Se inyecta en dos lugares: `#vc-subtitulo` (nuevo `<p>` bajo el título, con la clase `.rpt-desc` en la descripción vieja para poder esconderla al imprimir) y el **título del PDF**. En el PDF usa `splitTextToSize` para que la línea corra si es larga, y recalcula el `startY` de `autoTable` a partir de las líneas que salió.
- `renderVenc()` la refresca en cada render → refleja los filtros en vivo, no queda desactualizada al cambiar un select.

### Impresión calibrada para pizarra
- El destino real de este reporte es una pizarra: los grises claros y las letras chicas no se leen a distancia. En `body.printing-venc`:
  - header de tabla **negro `#111827` con letras blancas 10pt** y borde 0.7pt (antes era gris claro `#e5e7eb` con texto negro);
  - celdas **11pt**, bordes 0.5pt, `white-space: normal`;
  - `td.col-empresa` **anula el recorte** (`max-width:none`, `overflow:visible`, `text-overflow:clip`): en la pizarra el nombre tiene que leerse entero;
  - las dos líneas chicas de la celda de vencimiento (`.text-[11px]` / `.text-[10px]`) suben a **9.5pt / 9pt** y en negrita;
  - se oculta la descripción web (`.rpt-desc`), la flecha de orden (`.sort-arrow`) y el `hover` de fila;
  - `#vc-subtitulo` (los filtros) queda en 12pt negrita: es la línea que identifica el reporte impreso;
  - los textos grises `#8b9bb4` pasan a negro (antes bajaban a `#666`, que no se leía).

### Exports
- **Excel** con 7 columnas (agrega **Empresa**, con `wch:24`, y `Fecha vencimiento` con `wch:16`); se sigue exportando **Documento** porque en Excel la celda de vencimiento no viaja con formato.
- **PDF** con 6 columnas y `columnStyles` de anchos fijos: Patente 25 (negrita), Interno 19 (centrado), Tipo 28, Empresa 46, Fecha venc. 28, Dias 40 (negrita 10pt). Letra 9.5–10pt y bordes más gruesos.
- El PDF ya **no saca la columna Documento** (`efd5f71`): el nombre del documento lo lleva la celda en la web, y en la pizarra suma una columna que no aporta.

### Documentación nueva en `PATENTE/` (10 PDF)
- Nuevos: `AE344VR/dni.pdf`, `AE344VR/registro.pdf`, `AE449YW/dni.pdf`, `AE449YW/registro.pdf`, `AG148TK/dni.pdf`, `AG148TK/registro.pdf`, `AG719US/dni.pdf`, `AG976PE/dni.pdf`, `AG976PE/registro.pdf`.
- Optimizado: `AG148TK/cedula.pdf` (146 KB, 1 página). Borrado el duplicado `AG148TK/cedula1.pdf`.
- **Validados antes de commitear** con `pdf-lib`: los 10 abren (header `%PDF-`, `%%EOF` presente) y el conteo de páginas es correcto — 1 salvo `AE344VR/dni.pdf`, `AE344VR/registro.pdf`, `AE449YW/dni.pdf`, `AE449YW/registro.pdf`, `AG148TK/dni.pdf` y `AG976PE/dni.pdf`, que son de 2 páginas (DNI y Registro suelen traer anverso y reverso).
- Efecto en el control: Registro con archivo **11 → 13**, DNI **10 → 12**, faltantes totales **160 → 156**.

### La flota son 57 vehículos (no 54) — census re-verificado
- Re-verificado contra producción (**solo lectura**, sin escrituras): **57 vehículos, todos en servicio**, internos `V001`..`V057` **sin repetidos**.
- Census de fechas de documento: VTV 39, Seguro 37, Service 13, Matafuego 2, **DNI 6** (antes figuraba 5), Registro 3, Cédula 6 (+29 con `noVence`), Título 0.
- **Corrección importante sobre Service:** el fallback de `resumenService()` **hoy no aporta ningún vehículo**. Los 13 con `proximoServiceFecha` son **exactamente los mismos 13** con fecha en `serviceSummary` (V008, V010, V014-V016, V018, V023, V024, V027, V030, V032, V034, V049). El "13 → 18 vehículos" que se midió el 2026-10-01 era de otra fecha de corte. El código queda como está (es una red de seguridad gratis) pero **no esperes que hoy sume vehículos**: si se toca `resumenService()`, lo que hay que probar es que no haga perder fechas.
- Se actualizaron las referencias a "54 vehículos" en `AGENTS.md`, `documentacion/README.md` y `TAREAS_PENDIENTES/00-INDICE.md`. Las entradas históricas del CHANGELOG se dejan con el número que tenían al momento.

### Excel de control regenerado
- `npm run generar:control` → `CONTROL_FALTANTES_2026-10-02.xlsx` (**156 documentos faltantes**) y `CONTROL_VENCIDOS_2026-10-02.xlsx` (**25 vencidos**: Cédula 6, VTV 6, Seguro 10, Registro 2, DNI 1).
- `npm run generar:matafuego` → `CONTROL_MATAFUEGO_MIXERS_2026-10-02.xlsx` (**21 filas**) y `CONTROL_MATAFUEGO_RESTO_2026-10-02.xlsx` (**34 filas**). Solo 2 de 57 tienen matafuego cargado (31 sin dato, 24 marcados "Sin Matafuego").
- Con archivo en disco: Título 43, Seguro 43, Cédula 35, VTV 40, Registro 13, DNI 12. Quedan **4 carpetas vacías** (`AD221FP`, `AH232ME`, `DML84`, `LFI597`): no se versionan porque git ignora las carpetas vacías.
- Los `.xlsx` **no van a git** (`.gitignore:5`), como siempre: en otra PC hay que correr los dos comandos.

## 2026-10-01 — Reportes: Vencimientos, fix de documentación y exportación

Commits: **`d52ec39`**, **`a80a6fc`**, **`10cc58a`**, **`7ed4240`**, **`2da46a4`**, **`0c1c5f0`**, **`efd5f71`**.

### Nueva sección "Vencimientos" (`d52ec39`)
- `GET /reports` (solo Admin) suma una 3ra card `#sec-vencimientos` a las 2 que ya había. Son **3 cards apiladas, no tabs**, alimentadas por el mismo `GET /api/admin/report/flota`.
- 7 filtros combinables (ventana 15-365 días, documento, estado, empresa, centro, tipo, texto), export Excel/PDF e impresión con `printVenc()`.
- Backend: `fechaDocVenc()` / `docNoVence()` resuelven las fechas que conviven en **3 esquemas** (legacy anidado → campo plano → `documentacion.<tipo>`). Contra Firestore real (54 vehículos): **0 fechas sin detectar** en los 8 tipos.
- **Service no aparecía nunca:** es derivado, no un documento, así que `fechaDocVenc` no lo cubre. Usa `proximoServiceFecha` con fallback al `proximoFecha` más cercano de `serviceSummary` (13 → **18 vehículos** con fecha).
- Tres bugs más de paso: el orden por columnas de documento no ordenaba nada (`orderVal` buscaba la propiedad `"v:vtv"`, que no existe, así que todas las filas empataban); el stat "Sin fecha cargada" era **0 fijo** (la fila se descartaba antes de poder contarse) → se eliminó la card; y `id="vc-docs"` estaba duplicado en dos stats.
- Verificado: 105/105 tests, `reports.ejs` renderiza, el server arranca.

### Fix: la documentación salía toda faltante (`2da46a4`)
- `GET /api/admin/report/flota` escaneaba `PATENTE/` en el **disco local**, pero `PATENTE/` **no está en el deploy de Vercel** (`.vercelignore` la excluye; pesa 160 MB), así que en producción el scan salía vacío y la card marcaba "faltan documentos" en los **54 camiones**.
- Ahora la fuente real es el **repo**: `lib/github-docs.js` → `listarPatenteGlobal()` (1 request de `git/trees/main?recursive=1` para toda la carpeta) con caché de **10 minutos** (`arbolPatenteR()` / `invalidarArbolPatenteR()`). Si el árbol viene `truncated` o falla (falta `GITHUB_TOKEN`), cae al modo de a uno (`gh.listarCarpeta`). El scan local **se mantiene** y se une con `||`: en local gana el disco.
- Además: las **3 cards arrancan contraídas** y cada encabezado lleva un **chip de resumen** (`#chip-flota`, `#chip-documentacion`, `#chip-vencimientos`).
- El **Título sale de `VENC_TIPOS`**: no vence nunca ("da cuenta de la situación registral a la fecha de su último asiento"), así que su control es "¿está o no está?" y vive en la card Documentación.

### Exportadores PDF (`0c1c5f0`, `efd5f71`)
- Los 3 PDF llevan el **logo `fp3d.png` incrustado** (`getLogoBase64()`, cacheado en `_logoB64`) y usan `autoTable`.
- Días formateados como `N Dias Vencidos` / `N Dias a Vencer` en vez del número pelado; letra más grande.

### Cédulas que no vencen (`a80a6fc`)
- `scripts/marcar-cedulas-no-vence.js` marca `documentacion.cedula = { noVence: true }` en los vehículos con cédula en `PATENTE/` y **sin** fecha. **Nunca pisa una `fechaVencimiento` existente**; el update va por ruta punteada, así que no toca seguro ni VTV.
- Dry-run por default, `--apply` para escribir. **Sin alias npm** (se corre con `node`). Aplicado a **21 vehículos** (29 marcados en total); las 6 con fecha real quedaron como estaban.

### Menú móvil y Cmd+K (`10cc58a`)
- `mobile-menu.ejs`: agrega `/centros` y **Carpeta Docs**, que faltaban. Queda con los mismos destinos que el desktop (10 para Admin, 6 para Usuario). El grupo Utilidades también se abre en `/carpeta`.
- `sidebar.ejs`: saca `utilOpen` y `toggleNavGroup`, sin uso desde que Utilidades dejó de ser desplegable en desktop (`970afba`).
- `command-palette.js`: agrega `ADMIN_NAV` (Stickers QR, Fichas Taller, Carpeta Docs, Usuarios), resuelto **al renderizar** porque el script carga con `defer` antes del script inline del footer que define `__SERVER_USER_DATA`.
- Nuevo `scripts/generar-control-matafuego.js` → `npm run generar:matafuego`: `CONTROL_MATAFUEGO_MIXERS_*.xlsx` y `CONTROL_MATAFUEGO_RESTO_*.xlsx` en `PATENTE/Reportes/` (los vehículos **sin** matafuego, separados en mezcladoras y resto).

### Documentos (`7ed4240`)
- Optimizadas `AF804RU/cedula.pdf` y `AG276BQ/cedula.pdf`; nuevos adjuntos: `AF804RU/dni.pdf`, `AF804RU/registro.pdf`, `AG719US/registro.pdf`, `AH052ZE/dni.pdf` (2 páginas: el DNI venía escaneado en dos imágenes y se unificó) y `AH052ZE/registro.pdf`. Borrado el duplicado `AF804RU/cedula1.pdf`.
- Todos los archivos quedaron como `<tipo>.pdf`, que es lo que matchea `DOC_TIPOS` en `lib/github-docs.js` y en `scanDocsCarpeta()` de `server.js`.

## 2026-09-29 — Auditoría del proyecto, fix del contador del catálogo y harness de tests

Detalle completo en **`Update_2026.09.29.md`**.

### Fix: el contador del catálogo generaba un `interno` duplicado (commit `d98d8d8`)
- `getNextCatalogNumber()` (`routes/centros.js`): la rama que **inicializa** el counter guardaba `{current: max}` pero devolvía `max+1`, mientras que la rama que **incrementa** guarda y devuelve el mismo valor. La segunda alta de un tipo repetía el número del primer elemento (`H008, H008, H009...`).
- El `interno` es la identidad del elemento: es el `value` del select de asignación y la clave de `catMap[c.interno]`. Con duplicado, dos elementos eran indistinguibles y el segundo pisaba al primero en la resolución de nombre/marca/modelo.
- Fix de una línea: guardar `max + 1`.
- Alcance: solo `POST /api/centros/elementos/disponibles`. En producción la rama corregida ni se ejecuta (el counter ya existe), así que no hay riesgo de regresión.

### Fix: el mismo off-by-one en la numeración de vehículos
- `getNextVehicleNumber()` (`public/js/auth-client.js:270`, código **cliente**, no una ruta) tenía el bug idéntico: guardaba `{current: max}` y devolvía `max+1`, así que la segunda alta repetía el `V-XXX`. Corregido a `{current: max + 1}`.
- **Este era más urgente que el del catálogo:** `counters/vehicles` no existe en la base, así que la numeración de vehículos cae *siempre* en la rama de derivar del máximo real — que es justo la que estaba rota. El primer día que se creara el doc, el segundo vehículo habría repetido el número.
- Cubierto con `tests/vehiculos-numeracion.test.js` (16 checks). Al ser código cliente no se prueba por HTTP: la suite extrae la función del archivo por texto y la evalúa con `new Function` contra el db falso. **El test se validó reintroduciendo el bug a propósito** (falla 5 de 16, con la secuencia `V011,V011,V012,...`).

### Confirmado contra producción: cómo se llaman los counters (solo lectura)
- `npm run inspect:counters` (`scripts/inspeccionar-counters.js`, **no escribe nada**).
- La doc histórica estaba mal: decía `cat-{prefijo}` y `vehicles-{tipo}`. **No existe ningún doc con esos nombres.** Existen `counters/{herramienta,equipo,ropa,material}` (current 3/3/3/2), que es exactamente lo que busca el código (`doc(tipo)`). **El fix del catálogo sí es efectivo.**
- **No existen** `counters/vehicles` ni `counters/vehiculo`.
- **No hay internos duplicados**: `elementos_catalogo` 11 docs (H001-H003, E001-E003, R001-R003, M001-M002) y `vehicles` 54 (V001-V054), sin repeticiones. Nada que limpiar.

### Fix: el import masivo podía duplicar internos y perder el counter
- `executeCsvImport()` (`public/js/vehicles.js:1160`) tiene **su propia numeración**, separada del alta manual, así que no hereda las protecciones de `getNextVehicleNumber()`. Dos huecos corregidos:
  - **Duplicados dentro del propio lote:** el chequeo de conflictos solo consultaba Firestore con `where('interno','in',chunk)`. Un Excel con dos filas que ya traen `V055` no colisionaba con nadie (todavía no existía) y **las dos se guardaban con el mismo interno**. Ahora se aborta la importación, con un mensaje distinto al de "ya existe en la base".
  - **El `catch (_) {}` silencioso:** los vehículos ya se habían importado, pero el counter quedaba atrás y la próxima alta manual derivaba del máximo real → **reusaba un número ya asignado**. Ahora avisa y explica el riesgo.
- `showToast()` acepta una duración opcional (default 4000, así que las 108 llamadas existentes no cambian) y da 6 s a los avisos con salto de línea, que a 4 s no se leen.
- Cubierto con `tests/import-vehiculos.test.js` (17 checks). **Ambos fixes validados revirtiéndolos**: sin el chequeo de lote fallan 7 de 17, con el `catch` silencioso fallan 2.
- El fake necesitaba el operador `in` y `collection().doc().set()` anidado. Documentado en `tests/README.md`.

### Harness de tests contra un Firestore falso (nuevo)
- `tests/fake-firestore.js` emula la API de Firestore que usa el proyecto; `tests/helpers.js` la inyecta en `require.cache` antes de montar `routes/*.js` y levanta un Express en un puerto efímero.
- Permite testear **escrituras** sin tocar producción, esquivando el `DEV_READ_ONLY=true` (el `.env` local apunta a la misma base). No hay que bajar el read-only ni hacer backup.
- 4 suites, 105 checks: `npm test`. Cubren auth/roles, alta y edición de obras, el **409 de borrar obra** (incluido el caso legacy sin `fechaDevolucion`), borrado en cascada por batches, `recomputeServiceSummary` (y su recálculo al borrar), `FieldValue.delete()` sobre `docsAdjuntos`, y las regresiones de los dos contadores.
- Detalle y trampas del fake: `tests/README.md`.

### Auditoría general — sin hallazgos
- `node --check` limpio en rutas, middleware, config, 14 JS de `public/js` y 8 scripts. Las 19 vistas EJS compilan sin includes ni assets rotos. Los 63 archivos de `public/` responden 200. CSS balanceado. Logs limpios.
- 49 rutas backend vs 28 llamadas del frontend: **0 llamadas rotas**. Las 4 rutas sin guarda son legítimas (las 3 de login + `panel-mock`, que solo devuelve datos falsos).

### Commits
- `b95bf61` fix(vehicles): el import masivo podia duplicar internos y perder el counter
- `855aa7c` chore(scripts): simulacion de la proxima alta
- `4d2bf14` fix(auth-client): mismo off-by-one en la numeracion de vehiculos
- `a007c7e` tests: harness contra un Firestore falso + documentacion
- `d98d8d8` fix(centros): contador del catalogo generaba un interno duplicado

### Deploys (Vercel, producción)
- `b95bf61`, `855aa7c`, `4d2bf14` → deploy automático por push a `main`.
- Verificado: `/login`, `themes.css`, `vehicles.js`, `auth-client.js`, `fp3d.png` → 200; `/api/vehicles` sin token → 401. Los 3 fixes confirmados **en el JS que sirve producción**, no solo en git.
- **Producción nunca se escribió.** Lo único que se tocó la base fue una consulta de lectura (`npm run inspect:counters`). El servidor local quedó con `DEV_READ_ONLY=true` y todo su tráfico registrado como `Blocked`.
- Alias: https://falpat-control-de-vehiculos.vercel.app

### Resguardo
- **Producción nunca se escribió.** Toda la verificación de escrituras corrió contra el Firestore falso. El servidor local quedó con `DEV_READ_ONLY=true` y todo su tráfico registrado como `Blocked`. No se requirió backup de datos.

## 2026-09-28 — Vencimientos del dashboard, Excel de control de documentación y editar/eliminar Obras

Detalle completo en **`Update_2026.09.28.md`**.

### Dashboard: vencidos separados de los que vencen (commit `0ecb9a8`)
- Cada tipo de documento se cuenta dos veces en `public/js/dashboard.js`: `vencidos` (fecha pasada) y `proximos` (1 a 30 días). **El número grande de la tarjeta cuenta solo los que están por vencer**; los vencidos van aparte con su cantidad.
- Estado real de la flota: **28 por vencer / 25 vencidos** (VTV 2+6, Seguro 26+10, Cédula 0+6, Registro 0+2, DNI 0+1). Service sigue por fecha y por km.
- La documentación ahora se lee de la **carpeta `PATENTE/{patente}/`** (no del mapa `documentacion`); el archivo subido desde la web tiene prioridad.
- `lib/github-docs.js` → `listarPatenteGlobal()` trae todo el árbol `PATENTE/` en **un solo request** a la API de GitHub; `GET /api/vehicles/documentos/reporte` lo mezcla con los adjuntos de Firestore, con caché y fallback al disco. Verificado: 54 filas (VTV 38, Seguro 41, Cédula 34, Registro 6, DNI 5, Título 42).

### Excel de control de documentación (commit `0ecb9a8`)
- Nuevo `npm run generar:control` → `scripts/generar-control-documentacion.js` genera en `PATENTE/Reportes/`:
  - `CONTROL_FALTANTES_2026-09-28.xlsx`: **158** documentos faltantes.
  - `CONTROL_VENCIDOS_2026-09-28.xlsx`: **25** documentos vencidos.
- Los `.xlsx` están en `.gitignore` (se regeneran con el comando en cada PC).

### Centros de Trabajo: editar y eliminar obras (commit `0ecb9a8`)
- `PUT /api/centros/:id` acepta **nombre** y valida `estado` (`activa`/`pausada`/`cerrada`); recorta los textos igual que el POST.
- **`DELETE /api/centros/:id`** (Admin) nuevo: borra la subcolección `elementos` por lotes de 400 y el doc, y **se niega con 409 si queda algún elemento sin devolver** (chequeo en memoria, no con `where`, para no dejar pasar los elementos viejos que no tienen `fechaDevolucion`).
- UI: botones editar/eliminar en la tabla y en el detalle + 2 modales nuevos, con **guardas `isAdmin()` que faltaban** (la página es `requireAuth`, no admin-only).
- Verificado con un `db` fake (29/29 checks: vacía, solo devueltos, con pendientes, legacy, inexistente, 900 elementos en 3 batches, y todas las validaciones del PUT). **Pendiente: probar un borrado real en producción** con una obra de prueba.

### Commits
- `0ecb9a8` dashboard: separa vencidos de los proximos, docs desde PATENTE/ y Excel de control; centros: editar/eliminar

### Deploys (Vercel, producción)
- `0ecb9a8` → deploy automático por push a `main`
- Alias de producción: https://falpat-control-de-vehiculos.vercel.app

### Resguardo
- Sin cambios de escritura en Firestore (todo verificado con `db` fake; `DEV_READ_ONLY` bloqueó las pruebas reales). No se requirió backup de datos.

## 2026-08-06 — Ficha de Service para el Taller + P3 Cosmético (branding y logo)

### Ficha de Service imprimible (commit `88a32b1`)
- Nueva vista `views/fichas-taller-bulk.ejs` + ruta `GET /vehicles/fichas-taller-bulk` (`server.js`) + acceso **"Fichas Taller"** en el sidebar (solo Admin).
- Ficha A4 para imprimir/llenar a mano: header degradado con logo, patente manual, checklist de 16 services + "Otro/Reparación", VTV con 2 fechas, observaciones y firmas.
- Logo `public/images/fp.png`.

### P3 Cosmético (commit `002db52`)
- **P3-1**: copyright 2024 → 2026 (`views/login.ejs`).
- **P3-3**: branding unificado **"Grupo Falpat SRL"** en sidebar y menú móvil.
- **P3-4**: `logo.svg` con colores del tema (`#6C3CE1` → `#00D4FF`).
- **Logo 3D transparente**: `public/images/fp3d.png` generado desde `fp1.png` (fondo blanco recortado, relieve emboss, acabado perla metálico + sombra suave), aplicado en login, sidebar y menú móvil. Favicon `favicon.png` (64 px) desde el mismo logo.

### Commits
- `88a32b1` Feat: ficha de service imprimible para el taller (Fichas Taller)
- `002db52` Feat(P3): branding unificado Grupo Falpat SRL, copyright 2026, logo 3D transparente y favicon

### Deploys (Vercel, producción)
- `88a32b1` → deploy `HvTJWudSEXe2ZTic4f7wyhzdcV4y` (Ready)
- `002db52` → deploy `cinR94g1cPtwfxm9K8cUqBcmrf5e` (Ready)
- Alias de producción: https://falpat-control-de-vehiculos.vercel.app

### Resguardo
- Sin cambios de datos en Firestore (solo vistas y assets). No se requirió backup.

## 2026-08-05 — Fix rendimiento: se eliminó el polling de "Últimos Services"

- **Problema**: la sección "Últimos Services" recargaba con `setInterval` cada 30 s, disparando ~300 lecturas de Firestore por fetch (~36.000 lecturas/hora con el dashboard abierto).
- **Solución** (`public/js/dashboard.js`, `routes/admin.js`):
  - Se eliminó el `setInterval` de 30 s. Ahora la sección se refresca **solo cuando cambian los datos**: el snapshot real-time de vehículos dispara la recarga con un debounce de 800 ms (cubre edición/alta de services en cualquier pestaña).
  - **Caché en servidor** con TTL de 30 s (`LATEST_SERVICES_TTL`) en `GET /api/admin/latest-services`: si ya se respondió hace <30 s, no vuelve a golpear Firestore.
  - Sin cambios en los datos = 0 lecturas por parte de esta sección.

### Commits
- `b81f89b` Fix rendimiento: eliminar polling en ultimos services, usar snapshot + cache TTL 30s en servidor
- `06fd16b` Remover contador temporal de medicion en latest-services

### Deploys (Vercel, producción)
- `b81f89b` → deploy `3k8eg2xq2` (Ready)

### Resguardo
- Backup local en `backups/backup-2026-08-05T21-17-24.json` (vehicles: 47, maintenance: 0, users: 5). Nota: `backups/` está en `.gitignore`, no se sube a git.

### Resguardo
- Mismo backup del cierre de día: `backups/backup-2026-08-05T17-29-12-051Z`.

## 2026-08-05 — Sección "Últimos Services" en Dashboard

- **Nueva sección** en `views/dashboard.ejs` + `public/js/dashboard.js` + `routes/admin.js` + `public/css/styles.css`:
  - Muestra los vehículos con actividad de service más reciente (**un vehículo por fila**, ordenados por fecha del último service).
  - Diseño tipo timeline con línea gradiente, puntos brillantes, animación escalonada de entrada y hover glow.
  - Al hacer clic se despliega un **acordeón** (uno a la vez) con la **lista de services realizados** de ese vehículo (tipo, fecha, km, proveedor, letra chica).
  - Botón **"Ver vehículo completo →"** dentro del panel (opcional, no navega directo).
  - Badge contador de vehículos y tiempo relativo ("hace 2 d", "ayer").
- **Endpoint nuevo** `GET /api/admin/latest-services` (`routes/admin.js`): agrega los últimos 5 services de cada vehículo activo (no Baja) y devuelve los 10 vehículos con actividad más reciente.

### Commits
- `950866f` Feat sección Últimos Services en dashboard con acordeón por vehículo

### Resguardo
- Backup local en `backups/backup-2026-08-05T17-29-12-051Z` (vehicles: 47, maintenance: 0, users: 5). Nota: `backups/` está en `.gitignore`, no se sube a git.

## 2026-08-05 — Versión móvil + vista pública QR

- **Vista pública QR** (`views/vehicle-qr-public.ejs`, `server.js`):
  - Se eliminó la sección "Estado Operativo" (kilometraje, horómetro, VTV, seguro, trompo).
  - Se agregó la sección **Chofer** (chofer, DNI, registro, centro de trabajo). Empresa se mantiene en la ficha del vehículo.
  - Se agregó **"Próximos Services"** con desglose por tipo de service (desde `serviceSummary`, ordenado por `proximoKm`).
  - Se agregó **"Últimos movimientos"** con los últimos 5 services y 5 repuestos (fecha, km, badge Service/Repuesto).
  - `server.js` ahora carga subcolecciones services/repuestos al renderizar la vista.
- **Responsividad móvil**:
  - `vehicle-qr-public.ejs`: viewport sin `user-scalable=no` (zoom por pellizco habilitado); inputs de 15px → 16px (evita auto-zoom iOS).
  - `vehicle-detail.ejs`: botón "Título" pasa de `hidden` a `hidden sm:inline-flex` (visible desde 640px).
  - `public/css/styles.css`: `#qrcode canvas/img` y `#barcode-svg` con `max-width:100%; height:auto`.
- **Fix buscador de vehículos** (`public/js/vehicles.js`): cada snapshot de Firestore re-renderizaba todos los vehículos ignorando el filtro activo; ahora usa `applyFilters()`.
- **Vistas del historial** (`public/js/vehicle-detail.js`, `vehicle-detail.ejs`): línea de tiempo, sección, mes y proveedor.
- **Fix crash** en `editService` cuando el tipo de service no tiene fluido asociado.

### Commits
- `73773a5` Fix crash en editService
- `6e547d0` Feat vistas del historial
- `b13c10d` Fix filtro/búsqueda de vehículos
- `d0d42e6` Feat versión móvil + vista QR con próximos services y últimos movimientos
- `ce0a8dc` Fix vista QR: quitar Estado Operativo, agregar sección Chofer

### Deploys (Vercel, producción)
- `d0d42e6` → deploy `c5k5sauh4` (Ready)
- `ce0a8dc` → deploy automático (Ready)
- Alias de producción: https://falpat-control-de-vehiculos.vercel.app

### Resguardo
- Backup local en `backups/backup-2026-08-05T14-41-00-710Z` (vehicles: 47, maintenance: 0, users: 5). Nota: `backups/` está en `.gitignore`, no se sube a git.
