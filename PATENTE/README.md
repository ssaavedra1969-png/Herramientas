# Documentos de vehículos (PATENTE)

Cada vehículo tiene una carpeta con el **número de patente** como nombre (sin el sufijo " - Int.").

Dentro, los archivos se nombran por tipo de documento (minúsculas, sin espacios):

```
PATENTE/
  AG719TT/
    titulo.pdf      <- Título del camión
    cedula.pdf      <- Cédula del camión
    seguro.pdf      <- Seguro del camión
    registro.pdf    <- Registro del chofer
    dni.pdf         <- DNI del chofer
    vtv.pdf         <- VTV (certificado)
  AG719TT/BACKUP/
    seguro_al 02.10.26.pdf   <- seguro anterior (de la última renovación)
  Seg/                       <- área de trabajo de renovación de seguros (ver abajo)
  Vtos/                      <- Excel de carga masiva de vencimientos
  Reportes/                  <- Excel de control (ignorados por git)
```

Formatos aceptados: `.pdf`, `.jpg`, `.jpeg`, `.png`.

**Tipos reconocidos por el sistema (uno por cada):** `titulo`, `cedula`, `seguro`, `registro`, `dni`, `vtv`.
Si un vehículo tiene varios archivos del mismo tipo, el sistema toma uno solo con esta prioridad: `pdf` > `jpg` > `jpeg` > `png`.

**El nombre tiene que ser exactamente `<tipo>.<ext>`.** Un archivo con nombre descriptivo (ej. `REGISTRO MOLINA JUAN VTO 07-11-26.jpeg`) **no lo ve ningún reporte**: el matcher es un regex cerrado sobre `PATENTE/{patente}/{tipo}.{pdf|jpg|jpeg|png}` (`lib/github-docs.js`). Para que sirvan hay que pasarlos por la herramienta de Optimizaciones, que junta frente/dorso en una hoja y devuelve `<tipo>.pdf`.

Los documentos se pueden eliminar desde la ficha del vehículo (botón "Eliminar", solo Admin; descarga una copia de respaldo antes de borrar). En producción (Vercel) el borrado se hace desde la PC local + `npm run subir:docs` (git también sube las eliminaciones).

## BACKUP/ — seguros viejos

Con cada renovación de seguro, el `seguro.pdf` viejo se **mueve** (no se copia) a
`PATENTE/{patente}/BACKUP/seguro_al DD.MM.YY.pdf`, donde la fecha es la **fecha de
modificación** del archivo (no la del vencimiento). Procedimiento completo en
`documentacion/PROCEDIMIENTO-SEGUROS.md`.

**`BACKUP/` no rompe nada:** los lectores (`routes/vehicles.js`, `routes/admin.js`,
`server.js`) hacen `readdirSync` **no recursivo** y filtran por nombre exacto de
tipo; `esDeTipo()` descarta `seguro_al 22.04.26.pdf` porque después de "seguro"
vienen letras.

## Vencimientos — la fecha NO sale del PDF

La fecha de vencimiento **no se lee del PDF**. Se carga **manualmente** en la ficha
del vehículo, o de forma masiva con un Excel en `PATENTE/Vtos/` + `npm run
cargar:vencimientos` (ver `AGENTS.md`). El reporte la resuelve desde
`documentacion.<tipo>.fechaVencimiento` (más el campo legacy `seguro`/`vtv` y los
planos `vencimientoRegistro`/`vencimientoDNI`). Un `documentacion.cedula.noVence =
true` marca una cédula que no caduca (`node scripts/marcar-cedulas-no-vence.js`).

> Tener el archivo en la carpeta **no** carga la fecha: son dos cosas distintas.

**Nota:** la fecha de vencimiento que muestra la fila VTV se toma del campo VTV del vehículo (ficha → sección VTV).

## Producción (Vercel)

**IMPORTANTE:** para que los documentos aparezcan desplegados, la carpeta `PATENTE/`
(con los archivos) debe quedar **versionada en git** (se sube al repo y Vercel la
despliega), igual que se hacía con `titulo/`. No se debe agregar a `.gitignore`.
La carga masiva a producción es `npm run subir:docs` (`scripts/subir-documentos.js`,
solo toca `PATENTE/`).
