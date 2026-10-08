# Update 2026-10-06

Sesión de **renovación de seguros (póliza 30457810)**: se separó el PDF de
`PATENTE/Seg/` una constancia por patente, se respaldó el seguro viejo de cada
vehículo en `PATENTE/{patente}/BACKUP/`, se reemplazó por el nuevo y se cargó la
fecha **07/04/2027** en los **31** vehículos de la flota.

**Ningún cambio de código de la app.** Ver también `Update_2026.10.03.md`
(§1), que hizo la extracción anterior sobre `PATENTE/Seg/`.

---

## 1. El PDF fuente

`PATENTE/Seg/Certificados de cobertura.pdf` — **32 páginas**, 413 KB:

| Campo | Valor |
|-------|-------|
| Título | CONSTANCIA DE COBERTURA |
| Asegurado | GRUPO FALPAT SRL, CUIT 30-71784388-2 |
| Póliza | **Ref 30457810** — AUTOMOTORES |
| Vigencia | **07/10/2026 → 07/04/2027** (las 32, iguales) |
| Estructura | **1 página = 1 vehículo** |

**No es el mismo formato que la extracción anterior** (que eran certificados de
4 páginas con `Dominio: XXXXXX`): acá el dato está en el campo
`PATENTE: AC264CZ` dentro del bloque `DATOS DEL VEHICULO`. Un regex sobre el
texto basta — **sin OCR**.

32 páginas → **32 patentes distintas**, sin repetidas y sin páginas huérfanas.

---

## 2. Extracción → `PATENTE/Seg/{PATENTE}.pdf`

Con `fitz` (PyMuPDF), una página por archivo:

```python
out = fitz.open(); out.insert_pdf(doc, from_page=i, to_page=i)
out.save(f'PATENTE/Seg/{patente}.pdf')
```

Resultado: **32 PDF en `PATENTE/Seg/`** con el nombre de la patente
(`AC264CZ.pdf`, `NYR481.pdf`, ...).

> El **PDF fuente** (`Certificados de cobertura.pdf`, 32 pág) **ya no está en la
> carpeta**: alguien lo retiró a mitad de sesión (los scripts de esta sesión solo
> tocaron `AG469YL_reimpreso.pdf` y `AG469LY.pdf`). No se perdió nada: los 32
> PDFs extraídos están completos y verificados.

Verificación 32/32: 1 página, `PATENTE:` del texto = nombre del archivo,
tipo "CONSTANCIA DE COBERTURA", vigencia 07/10/2026 → 07/04/2027.

> **Peso:** cada constancia sale con **~321 KB** (3 fuentes TTF + 2 logos
> embebidos por página; en el original se comparten entre las 32). `Seg/` hoy:
> **32 PDF, 9,6 MB**. Re-guardar con `garbage=4, deflate=True` no reduce nada.

### 2.1 Cruce con la flota

- **31 de 32** corresponden a carpetas de la flota (60 carpetas en `PATENTE/`).
- **`AH784OY` no está** en la flota ni en Firestore: su PDF quedó igual en `Seg/`
  y el script de carga lo marcó `SKIP`.
- **La 32ª (`AG469LY`) era un error de la aseguradora:** la patente real es
  **`AG469YL`** (V017, mixer Mercedes Benz AXOR 3131B), que **sí** es de la flota
  pero no figuraba en el PDF. El usuario consiguió la constancia corregida y la
  dejó en `PATENTE/Seg/AG469YL_reimpreso.pdf` (misma póliza y vigencia, 1 pág).
  Se renombró al patrón de la sesión (**`AG469YL.pdf`**) y se borró
  `AG469LY.pdf`, que nombraba un vehículo inexistente.

> **`PATENTE/Seg/` quedó con 32 PDF**: 31 de flota + `AH784OY`.

---

## 3. Backup del seguro viejo → `PATENTE/{patente}/BACKUP/`

Por cada uno de los **31** vehículos de la flota:

1. Se creó `PATENTE/{patente}/BACKUP/`.
2. El `seguro.pdf` viejo se **movió** (no copia) a
   **`BACKUP/seguro_al DD.MM.YY.pdf`**, con la **fecha de modificación del
   archivo** (`LastWriteTime`, formato pedido por el usuario: `22.04.26`).
3. Se copió encima el nuevo desde `PATENTE/Seg/{patente}.pdf`.

- **29 respaldados** (mtimes del `29.05.25` al `02.10.26`).
- **2 sin seguro previo**: `AH919KE` y `NYR481` → solo recibieron el nuevo
  (no se les creó `BACKUP/` vacía).
- **31/31** con `seguro.pdf` nuevo verificado (patente y vigencia del PDF = esperadas).

---

## 4. Carga en Firestore → `seguro.fechaVencimiento = 07/04/2027`

Mismo camino que en `Update_2026.10.03.md` §2.1 (**sin código nuevo**):

```
PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-06.xlsx   (32 filas: Patente | Tipo documento | Vencimiento | Nota)

node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-06.xlsx --dry-run
node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_2026-10-06.xlsx
```

- Dry-run: 30 para escribir, 2 `SKIP` (`AG469LY`, que aún no se sabía que era
  un error, y `AH784OY`), 0 errores.
- Ejecución: **Actualizados: 30 | Sin cambios: 0 | No existen: 2 | Errores: 0**.
- **Corrección de `AG469YL`** (§2.1): se sacó del Excel la fila `AG469LY`, se
  agregó `AG469YL`, se deduplicó (quedó **32 filas únicas**) y se corrió de nuevo
  **con `--patente=AG469YL`** para no reescribir los otros 30:
  `Actualizados: 1 | Errores: 0`.
- Re-lectura posterior: **31/31** con **los dos** campos (`seguro.fechaVencimiento`
  **y** `documentacion.seguro.fechaVencimiento`) en **07/04/2027**.
- El Excel se llama `SEGUROS_RENOVACION_*` (no `CONTROL_VENCIMIENTOS_*`) para que
  `excelReciente()` no lo tome por defecto. Está **ignorado por git** (`*.xlsx`).

### 4.1 Censo previo (solo lectura) — no se recortó ninguna fecha

Antes de escribir se leyeron las 32 fechas actuales:

- **24** en 07/10/2026 (vencían **al día siguiente**), **2** en 07/10/2025 (`AG276BQ`,
  `GKX407`, vencidas hace un año), **1** en 06/10/2026 (`NYR481`), **4 sin fecha**
  (`AF804RU`, `AG269DZ`, `AH136TE`, `AH919KE`), **`AG469YL` en 07/10/2026** y
  **`AG976PG` en 28/01/2027**.
- Ninguna superaba **07/04/2027**: `AG976PG` es el único caso que parecía
  "posterior" y en realidad **se extiende** (28/01/2027 → 07/04/2027).
- **No se pisó ninguna fecha con una más temprana.**

---

## 5. Qué queda resuelto de los pendientes del 2026-10-03

| Pendiente (`Update_2026.10.03.md` §6) | Estado hoy |
|---|---|
| 1. Falta el PDF de renovación (23 vehículos con seguro viejo) | **Resuelto para los 31 de esta póliza.** |
| 2. `GKX407`, `AG276BQ` y `LEC583` vencidos hace meses | **2 de 3 resueltos**: `GKX407` y `AG276BQ` sí están en la 30457810. **`LEC583` sigue sin aparecer** en ninguna póliza conocida. |
| 3. 18 vehículos sin fecha de seguro | **4 de ellos** quedaron con fecha (`AF804RU`, `AG269DZ`, `AH136TE`, `AH919KE`). Siguen sin fecha los otros 14. |

---

## 6. Verificación

- `npm test` → **105/105** (escrituras 47, negocio 25, numeración 16, import 17)
  + 26 checks de reports, **0 fallas**.
- 32/32 PDF extraídos correctos · 31/31 `seguro.pdf` de carpeta correctos ·
  29 backups presentes · `AG469YL` leído después de escribir.
- Firestore re-leído después de escribir: **31/31 en 07/04/2027** en los 2 campos.

---

## 7. Pendientes

1. **`LEC583`** sigue sin póliza conocida (y su `seguro.pdf` viejo es de 1 KB,
   09.02.26).
2. **29 carpetas de flota no están en esta póliza** (60 carpetas − 31): siguen
   con su seguro actual (5 en 24/10/2026, resto en 07/04/2026 u otra fecha).
   Hay que ver si entran en otra constancia o si falta material.
3. **14 vehículos siguen sin fecha de seguro** (de los 18 originales).
4. **Commitear**: `PATENTE/Seg/` (32 PDF, 9,6 MB), los 31 `seguro.pdf`
   nuevos, los 29 `BACKUP/` y la doc. `PATENTE/Seg/` **no está en
   `.gitignore`** (decisión del usuario del 03/10), así que `npm run subir:docs`
   los sube. **No se commiteó nada sin confirmar.**
5. El día **07/10/2026** (mañana) los 5 vehículos de la póliza 13673743 que
   vencen **24/10/2026** todavía no tienen renovación cargada.
