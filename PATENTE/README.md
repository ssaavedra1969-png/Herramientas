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
    vtv.pdf         <- VTV (certificado)
```

Formatos aceptados: `.pdf`, `.jpg`, `.jpeg`, `.png`.

**Tipos reconocidos por el sistema (uno por cada):** `titulo`, `cedula`, `seguro`, `registro`, `vtv`.
Si un vehículo tiene varios archivos del mismo tipo, el sistema toma uno solo con esta prioridad: `pdf` > `jpg` > `jpeg` > `png`.

Los documentos se pueden eliminar desde la ficha del vehículo (botón "Eliminar", solo Admin; descarga una copia de respaldo antes de borrar). En producción (Vercel) el borrado se hace desde la PC local + `npm run subir:docs` (git también sube las eliminaciones).

**Nota:** la fecha de vencimiento que muestra la fila VTV se toma del campo VTV del vehículo (ficha → sección VTV).

**IMPORTANTE (producción/Vercel):** para que los documentos aparezcan desplegados, la carpeta `PATENTE/` (con los archivos) debe quedar **versionada en git** (se sube al repo y Vercel la despliega), igual que se hace con `titulo/`. No se debe agregar a `.gitignore`.
