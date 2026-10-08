# Procedimiento — Renovación de seguros: de la póliza al `seguro.pdf` por patente

> **Se repite con cada renovación.** Documentado el 2026-10-06 para poder
> rehacerlo sin reinventar nada. Sesiones que lo aplicaron:
> `Update_2026.10.03.md` (póliza 13695272 / 13674442, 7 vehículos) y
> `Update_2026.10.06.md` (póliza 30457810, **31 vehículos**).

**Qué hay que lograr:** la aseguradora manda un PDF con todas las constancias
juntas. Hay que (1) separarlas una por patente, (2) respaldar el seguro viejo de
cada vehículo, (3) poner el nuevo en `PATENTE/{patente}/seguro.pdf` y (4) cargar
la fecha de vencimiento en Firestore.

---

## 0. Reglas de oro (antes de empezar)

1. **Sincronizar**: `git stash && git pull origin main && git stash pop`.
2. **Nunca** correr `npm run cargar:vencimientos` a secas: agarra el
   `CONTROL_VENCIMIENTOS_*.xlsx` más viejo del repo y **revierte** fechas ya
   cargadas. Siempre con `--archivo=...`.
3. El Excel de esta tarea se llama **`SEGUROS_RENOVACION_<AAAA-MM-DD>.xlsx`**
   (a propósito **no** `CONTROL_VENCIMIENTOS_*`, para que `excelReciente()` no lo
   secuestre).
4. **Censo previo, solo lectura**, antes de escribir cualquier fecha: nunca
   reemplazar una fecha por una más temprana.
5. Nada se commitea sin confirmar del usuario. Al cierre: `git add -A`,
   commit y `git push origin main` (el push dispara el deploy en Vercel).

---

## 1. Dejar el PDF fuente en `PATENTE/Seg/`

`PATENTE/Seg/` es el **área de trabajo** de esta tarea (decisión del usuario:
**no está en `.gitignore`**). Sirve para:

- recibir el PDF de la aseguradora,
- dejar los PDFs separados: **`PATENTE/Seg/{PATENTE}.pdf`** (el nombre del
  archivo **es la patente**, siempre).

> Al terminar conviene **borrar la carpeta** (los separados ya cumplieron su
> función) o decirle al usuario si quiere commitearla: con 30 y pico de
> constancias son **~10 MB** que van al repo y a producción. Si se borran, se
> recuperan con `git checkout -- PATENTE/Seg`.

---

## 2. Detectar el formato del PDF (hay 2, verificados)

**Siempre inspeccionar antes de extraer**: abrirlo con PyMuPDF, contar páginas y
listar el dato de cada una. Los dos formatos vistos:

| | Formato A (2026-10-03) | Formato B (2026-10-06) |
|---|---|---|
| Título | `CERTIFICADOS DE COBERTURA(S)` | `CONSTANCIA DE COBERTURA` |
| Páginas por certificado | **4** | **1** |
| Dato de patente | `Dominio: XXXXXX` | `PATENTE: XXXXXX` (bloque `DATOS DEL VEHICULO`) |
| Póliza | `/P[OÓ]LIZA\s*:?\s*(\d{6,8})/i` | `Póliza en emisi�n Ref <n>` |
| Ejemplo | 182 pág → 60 placas | 32 pág → 32 vehículos |

**Técnica común: hace falta OCR? NO.** El texto está seleccionable. Dos trampas:

- **Normalizar antes de buscar**: `re.sub(r'[^A-Za-z0-9]', '', texto).upper()`.
  Un `AG-276BQ` partido en dos líneas, o un `AG276BQ` con guion, se escapa si se
  busca crudo.
- **Codificación rota en las pólizas**: `Póliza` sale como `P?LIZA`. Buscar con
  acento **falla**; usar `/P[OÓ]LIZA\s*:?\s*(\d{6,8})/i`.

Chequeos obligatorios antes de extraer: **patentes distintas = páginas**, sin
repetidas y sin páginas sin patente.

---

## 3. Extraer un PDF por patente

`fitz` (PyMuPDF) ya está instalado en las PC del proyecto (`import fitz`).

```python
# correr desde la raíz del repo
import fitz, re, os

SRC = os.path.join('PATENTE', 'Seg', 'EL_ARCHIVO_DE_LA_ASEGURADORA.pdf')
DST = os.path.join('PATENTE', 'Seg')

doc = fitz.open(SRC)
salidas, errores = [], []

for i, page in enumerate(doc):
    txt = page.get_text().upper()
    # Formato B (1 pág). Para el Formato A usar: DOMINIO([A-Z0-9]{5,8})
    m = re.search(r'PATENTE\s*:\s*([A-Z0-9\-]{4,10})', txt)
    if not m:
        errores.append(i + 1)
        continue
    patente = m.group(1).strip()
    out = fitz.open()
    out.insert_pdf(doc, from_page=i, to_page=i)   # copia la página
    out.save(os.path.join(DST, patente + '.pdf'))
    out.close()
    salidas.append(patente)

print('extraidos:', len(salidas), '| paginas sin patente:', errores)
```

Verificación 32/32-style: por cada `PATENTE/Seg/*.pdf` comprobar **1 página**,
que el `PATENTE:` del texto sea **igual al nombre del archivo**, que el tipo sea
el esperado y que la **vigencia** sea la de la renovación.

> **Peso:** cada constancia sale de ~321 KB (3 fuentes TTF + 2 logos embebidos
> por página; en el original se comparten). Re-guardar con
> `garbage=4, deflate=True` **no** reduce nada.

---

## 4. Cruce con la flota

```python
fleet = set(x for x in os.listdir('PATENTE')
            if os.path.isdir(os.path.join('PATENTE', x)) and not x.startswith('_'))
en_flota, fuera = separadas & fleet, separadas - fleet
```

- Hay **~60 carpetas** en `PATENTE/` (la flota son 57 vehículos).
- **Las que no están pueden ser** remolques/equipos que no se dan de alta, **o un
  error de la aseguradora**. Caso real: la póliza 30457810 traía **`AG469LY`**,
  que **no existe**; la patente real es **`AG469YL`** (V017) y **sí** es de la
  flota. El usuario consiguió la constancia corregida
  (`AG469YL_reimpreso.pdf`) → se **renombró** a `Seg/AG469YL.pdf` y se **borró**
  la errónea.
- **Preguntar siempre** al usuario por las patentes fuera de la flota antes de
  darlas por descartadas.

---

## 5. Backup del seguro viejo + reemplazo

**Convención de nombres del backup:** `PATENTE/{patente}/BACKUP/seguro_al DD.MM.YY.pdf`,
donde la fecha es la **fecha de modificación del archivo** (`LastWriteTime`),
no la del vencimiento. Se **mueve**, no se copia.

```python
import os, shutil, datetime

SEG = 'PATENTE'
for f in sorted(glob.glob(os.path.join(SEG, 'Seg', '*.pdf'))):
    pat = os.path.splitext(os.path.basename(f))[0]
    folder = os.path.join(SEG, pat)
    if not os.path.isdir(folder):            # no es de la flota
        continue
    old = os.path.join(folder, 'seguro.pdf')
    if os.path.exists(old):
        m = datetime.datetime.fromtimestamp(os.path.getmtime(old))
        bk = os.path.join(folder, 'BACKUP')
        os.makedirs(bk, exist_ok=True)
        shutil.move(old, os.path.join(bk, 'seguro_al %s.pdf' % m.strftime('%d.%m.%y')))
    shutil.copyfile(f, os.path.join(folder, 'seguro.pdf'))
```

- Si el vehículo **no tenía** `seguro.pdf`, no se crea una `BACKUP/` vacía.
- Verificar después: **patente del PDF = nombre de la carpeta** y **vigencia =
  la de la renovación**, en todos.

> **`BACKUP/` no rompe nada.** Los lectores de documentos (`routes/vehicles.js`,
> `routes/admin.js`, `server.js`) hacen `readdirSync` **no recursivo** y filtran
> por nombre exacto de tipo; `esDeTipo()` (`lib/github-docs.js:44`) descarta
> `seguro_al 22.04.26.pdf` porque tras "seguro" vienen letras. Verificado.

---

## 6. Cargar la fecha en Firestore

### 6.1 Censo previo (solo lectura) — obligatorio

Antes de escribir, imprimir la fecha actual de **cada** vehículo del lote. Si
alguna es **posterior** a la nueva, no cargarla (o preguntar). El script vive
fuera del repo (temp) porque `DEV_READ_ONLY=true` **no** bloquea a los scripts,
que escriben directo con el Admin SDK:

```js
// %TEMP%\opencode\census.js — requiere los módulos por ruta ABSOLUTA,
// porque Node resuelve node_modules desde la carpeta del script
const BASE = 'C:/AI/Antigravity/FALPAT srl/Herramientas';
require(BASE + '/node_modules/dotenv').config({ path: BASE + '/.env' });
const { db } = require(BASE + '/config/firebase');
const fs = require('fs'), path = require('path');
const pats = fs.readdirSync(BASE + '/PATENTE/Seg')
  .filter(f => f !== 'EL_ARCHIVO_DE_LA_ASEGURADORA.pdf')
  .map(f => path.parse(f).name);
const f = ts => !ts ? '(sin fecha)' : (d => String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear())(ts.toDate ? ts.toDate() : new Date(ts));
(async () => {
  const snap = await db.collection('vehicles').get();
  const all = {}; snap.forEach(d => all[d.data().patente] = d.data());
  for (const p of pats) {
    const v = all[p];
    if (!v) { console.log(p, 'NO EXISTE'); continue; }
    console.log(p.padEnd(9), 'principal:', f(v.seguro && v.seguro.fechaVencimiento),
                '| generico:', f(v.documentacion && v.documentacion.seguro && v.documentacion.seguro.fechaVencimiento));
  }
  process.exit(0);
})();
```

### 6.2 El Excel

Columnas **exactas** (las que lee `scripts/cargar-vencimientos.js`):

| Patente | Tipo documento | Vencimiento | Nota |
|---|---|---|---|
| `AC264CZ` | `Seguro` | `07/04/2027` | Constancia póliza 30457810 |

- `Vencimiento` como **texto `dd/mm/yyyy`** (también acepta `yyyy-mm-dd`).
- Armado con el `xlsx` del `node_modules` del repo
  (`XLSX.utils.json_to_sheet` + `XLSX.writeFile`); el archivo queda **ignorado
  por git** (`*.xlsx` en `.gitignore`).
- Si a mitad de tarea hay una corrección: editar filas, **deduplicar por
  `Patente`** y correr solo esa con `--patente=XXX` para no reescribir el resto.

### 6.3 Carga

```bash
node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_<fecha>.xlsx --dry-run
node scripts/cargar-vencimientos.js --archivo=PATENTE/Vtos/SEGUROS_RENOVACION_<fecha>.xlsx
```

Escribe **los dos** campos: `seguro.fechaVencimiento` **y**
`documentacion.seguro.fechaVencimiento`. Las patentes que no existen salen como
`SKIP` (no son error).

### 6.4 Verificación

Re-leer con el mismo script del §6.1 y confirmar **N/N** con los **dos** campos
en la fecha nueva. Salida esperada: `Actualizados: N | Errores: 0`.

---

## 7. Cierre

1. `npm test` → debe dar **105/105 + 26 checks, 0 fallas** (esta tarea no toca
   código, pero es la red de seguridad barata).
2. Commitear **todo lo pendiente** (confirmar antes) y `git push origin main`.
   Chequear `git rev-parse HEAD` == `git rev-parse origin/main`.
3. **Documentar la sesión**: `documentacion/Update_YYYY.MM.DD.md` + entrada en
   `CHANGELOG.md` + fila en el índice de `documentacion/README.md`.
4. Si se borró `PATENTE/Seg/`, el borrado también va en el commit.

---

## 8. Errores ya vistos (no repetir)

| Error | Dónde |
|---|---|
| `npm run cargar:vencimientos` a secas **revierte** fechas | elige el `CONTROL_VENCIMIENTOS_*.xlsx` más nuevo, que quedó desactualizado |
| El Excel llamado `CONTROL_VENCIMIENTOS_*` secuestra el default | por eso el de renovación se llama `SEGUROS_RENOVACION_*` |
| Off-by-one al inicializar un counter | `Update_2026.09.29.md` (no relacionado con seguros, mismo patrón) |
| `.trim()` del `git status --porcelain` se come el primer vehículo | fix ya aplicado en `scripts/subir-documentos.js` |
| Escribir en producción "probando" | `DEV_READ_ONLY` no cubre a los `scripts/`: para probar usá `npm test`, y para este caso **siempre dry-run** |
| Poner nombres descriptivos largos en `PATENTE/` | la app solo reconoce `PATENTE/{patente}/{tipo}.{pdf\|jpg\|jpeg\|png}` estricto: un `AG469YL_reimpreso.pdf` **no aparece en ningún reporte** |

---

## 9. Estado al 2026-10-06 (para no rehacer lo hecho)

- **Póliza 30457810**, vigencia **07/10/2026 → 07/04/2027**: **31 vehículos**
  con `seguro.pdf` nuevo y fecha cargada (los dos campos).
- **`PATENTE/Seg/` está vacía** (se borraron los separados y el fuente).
- **Quedan sin renovar:** 29 carpetas de flota fuera de esa póliza, **14
  vehículos sin fecha de seguro** y **`LEC583`** (no aparece en ninguna póliza
  conocida; su `seguro.pdf` viejo es de 1 KB). Detalle en
  `Update_2026.10.06.md` §7.
