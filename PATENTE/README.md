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
```

Formatos aceptados: `.pdf`, `.jpg`, `.jpeg`, `.png`.

**Tipos reconocidos por el sistema (uno por cada):** `titulo`, `cedula`, `seguro`, `registro`.
Si un vehículo tiene varios archivos del mismo tipo, el sistema toma uno solo con esta prioridad: `pdf` > `jpg` > `jpeg` > `png`.

Otros archivos en la carpeta (ej. `VTV.pdf`) se ignoran en este módulo (VTV se maneja por otro campo del vehículo).

**IMPORTANTE (producción/Vercel):** para que los documentos aparezcan desplegados, la carpeta `PATENTE/` (con los archivos) debe quedar **versionada en git** (se sube al repo y Vercel la despliega), igual que se hace con `titulo/`. No se debe agregar a `.gitignore`.
