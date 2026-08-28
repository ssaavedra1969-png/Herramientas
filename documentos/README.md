# Documentos de vehículos

Cada vehículo tiene una carpeta con el **número de patente** como nombre. Dentro, los archivos se nombran por tipo de documento (minúsculas, sin espacios):

```
documentos/
  ABC123/
    titulo.pdf      <- Título del camión
    cedula.pdf      <- Cédula del camión
    seguro.pdf      <- Seguro del camión
    registro.pdf    <- Registro del chofer
```

Formatos aceptados: `.pdf`, `.jpg`, `.jpeg`, `.png`.

**IMPORTANTE:** para que los documentos aparezcan en producción (Vercel), los archivos deben quedar versionados en git (se suben al repo y Vercel los despliega). No se deben agregar a `.gitignore`.
