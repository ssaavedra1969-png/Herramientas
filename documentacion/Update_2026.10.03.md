# Update 2026-10-03

Sesión de **renovación de seguros**: se publicaron 7 certificados nuevos en
`PATENTE/`, se cargó la fecha de vencimiento **07/10/2026** de esos 7 vehículos en
Firestore, y de paso se encontró un bug de rótulo en `scripts/subir-documentos.js`.

Commits: **`e134709`** (los 7 PDF de `PATENTE/`) + el fix de `subir-documentos.js`
y esta documentación.

---

## 1. Las pólizas de `PATENTE/Seg/`: qué había y qué hay

El usuario dejó 4 PDF en `PATENTE/Seg/` (2 de pólizas + 2 de tarjetas de
circulación) y un material extraído de ~190 PDF. **Después los borró**: la carpeta
quedó vacía. Lo que se pudo leer antes de que los borrara:

| Archivo | Qué es | Póliza | Vigencia | Placas |
|---------|--------|--------|----------|--------|
| `CERTIFICADOS DE COBERTURAS.pdf` | 182 pág, 4 pág por certificado | **13674442** | 07/04/2026 → **07/10/2026** | 60 |
| `CERTIFICADOS DE COBERTURA POLIZA 13673743.pdf` | 90 pág | **13673743** | 24/04/2026 → **24/10/2026** | 23 |
| `TARJETA DE CIRCULACION AH125AG vto 07-10-2026.pdf` | 2 pág | — | — | (no es póliza) |
| `TARJETA DE CIRCULACON ALMAJO VTO 07-10-2026.pdf` | 191 pág | — | — | (no es póliza) |

Cada certificado de 4 páginas trae `Dominio: XXXXXX` arriba, así que la patente se
puede leer del texto: **no hace falta OCR**. Con eso se mapearon **83 dominios**
distintos entre las dos pólizas (67 de ellos no pertenecen a ningún vehículo de la
flota: son remolques/equipos que no están en el sistema).

Apareció además una **póliza 13695272** (la de los 6 certificados nuevos, §2), que
**no estaba en `PATENTE/Seg/`**: ya venían sueltos en las carpetas.

### 1.1 Cómo se buscan (técnica)

`fitz` (PyMuPDF) alcanza para leer el `Dominio`, y normalizar el texto de la página
quitando todo lo que no sea `[A-Z0-9]` evita que un `AG-276BQ` o un `AG276BQ` partido
en dos líneas se escape. Con eso, buscar una patente es una substring match sobre el
texto de la página.

> **Ojo con el texto de las pólizas:** el encabezado de condiciones generales viene
> con la codificación mal y `l` de `Póliza` sale como `P?LIZA`. Buscar `Póliza`
> con acento **falla**; el número se recupera con `/P[OÓ]LIZA\s*:?\s*(\d{6,8})/i`.

---

## 2. Los 7 certificados nuevos y su fecha

Los PDF **ya estaban reemplazados** en `PATENTE/{patente}/seguro.pdf` cuando
arrancó la sesión (los había hecho el usuario con la herramienta de Optimizaciones).
**No hizo falta tocar el código de la app**: la fecha de los seguros ya se resuelve
en `routes/admin.js` → `fechaDocVenc(v, 'seguro')`, que mira el campo legacy
`seguro.fechaVencimiento`. Lo que faltaba era **cargar la fecha**.

| Patente | Interno | Fecha antes | Fecha nueva | Póliza | Cert. |
|---------|---------|-------------|-------------|--------|-------|
| `AE947GS` | V014 | 07/04/2026 | **07/10/2026** | 13695272 | 161 |
| `AG148TK` | V020 | 07/04/2026 | **07/10/2026** | 13695272 | 159 |
| `AF170SV` | V021 | 07/04/2026 | **07/10/2026** | 13674442 | 59 |
| `AF606JL` | V030 | **07/10/2025** | **07/10/2026** | 13695272 | 134 |
| `AG388HP` | V010 | 07/04/2026 | **07/10/2026** | 13695272 | 156 |
| `AG719US` | V036 | 07/04/2026 | **07/10/2026** | 13695272 | 175 |
| `AH125AF` | V009 | 07/10/2026 (solo el campo principal) | **07/10/2026** (se corrigió el genérico) | 13695272 | 179 |

Dos casos que conviene mirar:

- **`AF606JL` estaba un año vencido** (07/10/**2025**). El número de certificado es
  el mismo (134) y el vehículo es el mismo (`SCANIA P 320 B 8X4`): es una renovación
  de la póliza 13358929 → 13695272. Nadie se había acordado de cargarle la fecha.
- **`AF170SV` cambió de aseguradora.** El PDF viejo eran 6 páginas de otra compañía
  (`1744 Moreno`, `Asociado: 6623464`, vigencia 22/01/2026 → 07/04/2026); el nuevo
  es 1 página de la póliza 13674442. Los 7 PDF nuevos son **todos de 1 página**.
- **`AH125AF` ya tenía la fecha nueva a mano** en `seguro.fechaVencimiento`, pero
  `documentacion.seguro.fechaVencimiento` seguía en 07/04/2026. UnReporte que leyera
  el campo genérico lo habría mostrado vencido.

### 2.1 Cómo se cargó (sin código nuevo)

Se reutilizó la herramienta existente armando un Excel a medida, en vez de tocar el
script:

```
PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-03.xlsx   (7 filas: Patente | Tipo documento | Vencimiento | Nota)

node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-03.xlsx --dry-run
node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-03.xlsx
```

El Excel se llama a propósito `SEGUROS_RENOVACION_*` y **no** `CONTROL_VENCIMIENTOS_*`
para que `excelReciente()` (que elige el `CONTROL_VENCIMIENTOS_*.xlsx` más nuevo) no
lo tome por defecto en las corridas siguientes.

> ### ⚠️ NO correr `npm run cargar:vencimientos` a secas
> `PATENTE/Vtos/CONTROL_VENCIMIENTOS_2026-09-07.xlsx` tiene las fechas **viejas**:
> `AE947GS` 07/04/2026, `AF606JL` 07/10/2025, etc. Correrlo **revierte** la
> renovación de los 7 y deja los PDF del disco contradiciendo la base.

---

## 3. Bug encontrado: `subir-documentos.js` nunca contaba el primer vehículo

El commit `e134709` se anunció como **"Docs: 6 vehículos"** y llevaba **7 archivos**.

`scripts/subir-documentos.js:50` hacía:

```js
status = run('git status --porcelain -- ' + PATENTE_DIR).trim();
```

El porcelain de un archivo **modificado** empieza con `" M "` (espacio inicial), y
`.trim()` se come ese espacio de la **primera** línea. El parseo de la línea 63 usa
`/^.. /`, que ya no matchea, así que `partes[0]` queda `"M PATENTE"` en vez de
`PATENTE` y **el primer vehículo de la lista se descarta siempre**.

Peor en el caso borde: con **un solo** archivo modificado el mensaje decía
**"Docs: 0 vehículos"** y el commit salía igual (porque el `git add` es del
directorio completo, no de la lista). Era **solo de rótulo**: los documentos siempre
se commitearon bien, pero el mensaje mentía y en el log de git queda subinformado.

Fix: sacar el `.trim()` (dejar solo `replace(/\s+$/, '')` para no comerse la
última línea vacía) y saltear líneas vacías en el `forEach`.

---

## 4. Census de seguros después de la carga (solo lectura)

Con `seguro.fechaVencimiento` de los 57 vehículos, fecha de corte **2026-10-03**:

- **3 vencidos hace meses**: `GKX407` y `AG276BQ` (**-361 d**), `LEC583` (**-181 d**).
  Los tres **no están en ninguna de las 3 pólizas** vistas (13674442, 13673743,
  13695272): son de otra póliza. Y son los 3 que arrancó la sesión buscando.
- **30 con seguro al 07/10/2026** (dentro de 4-5 días) y **5 al 24/10/2026**
  (`AG190PG`, `AG255NS`, `AG255NT`, `AE597NY`, `AH124ZK` — póliza 13673743).
- **18 sin fecha de seguro cargada**: `AB922TD`, `AD221FP`, `AD718OH`, `AE192RP`,
  `AE355LN`, `AF206GB`, `AF804RU`, `AG269DZ`, `AG851RW`, `AG896XV`, `AG924XW`,
  `AH136TE`, `AH232ME`, `AH919KE`, `AI484IB`, `DML84`, `FDN167`, `LFI597`.

### 4.1 El lote de renovación está incompleto

De los **30** vehículos con seguro al **07/10/2026**, solo **7** tienen el PDF nuevo
en su carpeta. Los otros **23** (más los 5 del 24/10) siguen con el certificado viejo,
que es lo que hoy muestra la app como "documento faltante/vencido". Los certificados
Las renovaciones estaban justamente en los PDF de `PATENTE/Seg/` que después se
borraron, así que **no se pueden extraer** sin volver a conseguirlos.

---

## 5. Verificación

- `npm test` → **105/105** (escrituras 47, negocio 25, numeración 16, import 17).
- `node --check scripts/subir-documentos.js` limpio, y el parseo del rótulo probado
  contra un porcelain sintético con ` M` / `M ` / `??` / `R` (antes: 5 de 6, ahora 6
  de 6; y 1 de 1 en el caso de un solo archivo).
- Los 7 PDF: 1 página cada uno, `Dominio:` igual a la patente de la carpeta, y la
  vigencia impresa (`Desde las 12 hs 07/04/2026 / Hasta las 12 hs 07/10/2026`) igual a
  la fecha cargada en Firestore.
- Re-lectura de Firestore después de escribir: **7/7** con `seguro.fechaVencimiento`
  **y** `documentacion.seguro.fechaVencimiento` en `2026-10-07`.
- `git rev-parse HEAD` == `git rev-parse origin/main` en `e134709`.
- Se borraron 8 scripts `.py` sueltos que había en la raíz del repo
  (`buscar_patentes.py`, `extraer_certificados*.py`, `extraer_primer_*.py`,
  `list_structure.py`, `search_cond6.py`, `ver_paginas.py`): eran de la extracción
  de pólizas y no iban commiteados.

---

## 6. Pendientes

1. **Completar el lote de renovación de seguros.** 23 vehículos con seguro al
   07/10/2026 (y 5 al 24/10) tienen el PDF viejo. Hace falta volver a tener
   `CERTIFICADOS DE COBERTURAS.pdf` (póliza 13674442) y/o el de la 13673743 para
   extraerlos, o pedirlos a la aseguradora.
2. **`GKX407`, `AG276BQ` y `LEC583`:** seguro vencido hace 6 y 12 meses, y no
   aparecen en las 3 pólizas conocidas. Hay que averiguar en cuál están.
3. **18 vehículos sin fecha de seguro** (§4): cargar a mano o con un Excel nuevo.
4. **Cargar los vencimientos con más frecuencia.** `PATENTE/Vtos/` tiene un Excel del
   07/09/2026 y las renovaciones de octubre todavía no llegaron: por eso 7 vehículos
   tenían el PDF nuevo sin fecha y `AF606JL` estaba vencido desde 2025.
5. **Desfase de 1 día entre dashboard y Reportes** (no tocado): el cliente usa
   `daysUntil()` (`Math.ceil` sobre la hora, `public/js/auth-client.js`) y el backend
   `diasHastaYMD()` (normaliza a fecha calendario, `routes/admin.js`). Con 30 seguros
   el mismo día, el dashboard puede mostrar "5 días" donde el Reporte muestra 4.
6. **`PATENTE/Seg/` sin ignorar en git** (decisión del usuario: "por ahora nada").
   Si se vuelven a poner ahí las pólizas, `npm run subir:docs` las commitea: 4,7 MB
   por póliza, y ~190 MB si vuelve también el material extraído.
