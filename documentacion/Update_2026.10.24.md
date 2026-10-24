# Update 2026-10-24 — Publicación manual de documentos de PATENTE

## Qué se revisó

Se siguió el flujo de los archivos locales en `PATENTE/` hasta el repo y la
aplicación en producción: el script `scripts/subir-documentos.js`, el
`.gitignore`, `.vercelignore`, la configuración de Vercel, el static `/documentos`
en `server.js`, las rutas de documentos en `routes/vehicles.js`, la consulta de
documentación del reporte y `lib/github-docs.js`.

## Resultado: los archivos locales no se publican solos

No hay un watcher de `PATENTE/` ni una tarea automática en la PC que detecte
cambios al guardar un PDF. Para publicar manualmente los archivos que se editaron
con el Explorador:

1. Ejecutar con doble clic `PATENTE/Update.bat` o correr `npm run subir:docs`
   desde la raíz del proyecto.
2. `PATENTE/Update.bat` cambia a la raíz con `%~dp0..`, llama al mismo comando de
   npm, muestra el resultado y espera una tecla para cerrar.
3. `scripts/subir-documentos.js` comprueba que la rama sea `main`, ejecuta
   `git pull origin main --ff-only`, detecta cambios versionados y nuevos bajo
   `PATENTE/`, informa las patentes afectadas, hace `git add PATENTE/`, crea un
   commit `Docs: ...` y hace `git push origin main`.
4. El push a `main` inicia el despliegue integrado de Vercel. El script no espera
   ni verifica que el deploy termine; informa el tiempo habitual aproximado de
   1–2 minutos.

El script publica **todos los cambios Git detectados dentro de `PATENTE/`**, no
solo PDFs ni solo los archivos reconocidos por la aplicación. Por eso conviene
revisar los nombres y el contenido de la carpeta antes de correrlo. Los nombres
aceptados para documentos de vehículo son `titulo`, `cedula`, `seguro`,
`registro`, `vtv` y `dni`, con extensión `.pdf`, `.jpg`, `.jpeg` o `.png`. Los
nombres descriptivos o archivos sueltos como `AH124ZK_seg.pdf` no se reconocen
como documento de esa patente. La prioridad de lectura es PDF, JPG, JPEG y PNG.

## Qué queda fuera del flujo

- Los archivos `.xlsx` están ignorados por `.gitignore`; tener un Excel en
  `PATENTE/Vtos/` no hace que `Update.bat` lo publique. El Excel de renovación es
  una fuente para el comando separado `node scripts/cargar-vencimientos.js
  --archivo=...`, que carga las fechas a Firestore (hacer dry-run antes de
  aplicar).
- Subir un PDF **no extrae ni actualiza su fecha de vencimiento**. Las fechas se
  cargan por separado en la ficha web o mediante el script de vencimientos. Los
  reportes consultan los campos de Firestore; la existencia del PDF no equivale a
  tener su fecha cargada.
- `.vercelignore` excluye `PATENTE/` del bundle de Vercel. El `express.static`
  local `/documentos` y la lectura del QR que escanea el disco no pueden asumir
  que esos archivos estén disponibles en el filesystem de producción.
- La ficha autenticada consulta los documentos de GitHub mediante
  `lib/github-docs.js` (`GET /api/vehicles/:id/documentos` y el endpoint del
  adjunto). El reporte de documentación y `/api/admin/report/flota` también leen
  la lista desde GitHub. Sus árboles de `PATENTE/` se cachean hasta 10 minutos;
  un cambio recién publicado puede tardar ese tiempo en reflejarse en esas
  listas. La caché del reporte de documentación dura 60 segundos.

## Carga y borrado desde la web

El botón de carga Admin es un flujo distinto al `Update.bat`: el endpoint
`POST /api/vehicles/:id/documentos/:tipo/upload` usa `GITHUB_TOKEN` para escribir
el PDF directamente en `PATENTE/{patente}/{tipo}.pdf` en GitHub y elimina los
adjuntos antiguos de Firestore cuando corresponde. No necesita ejecutar el BAT
en la PC. El borrado desde la ficha también elimina en GitHub cuando el token
está disponible. Ninguna de estas operaciones lee la fecha de vencimiento del
PDF ni la actualiza.

## `PATENTE/Update.bat`

Se agregó el BAT para facilitar la publicación manual y se documentó en
`PATENTE/README.md`. Este botón no inicia un watcher ni una sincronización al
guardar; solo corre el proceso completo cuando alguien lo ejecuta.

## Estado de la sesión y verificación

- Antes de editar se guardaron temporalmente los cambios locales con stash,
  `git pull origin main` indicó que `main` estaba al día en `71501a7`, y luego se
  restauraron los archivos locales sin conflictos.
- Se agregó `PATENTE/Update.bat` y se actualizó `PATENTE/README.md`.
- Se validó el BAT leyéndolo y se ejecutó `git diff --check`; no hubo errores de
  whitespace.
- El asistente **no ejecutó** `npm run subir:docs` ni `Update.bat`. Mientras se
  preparaba esta documentación, `origin/main` avanzó a
  **`500802c` — `Docs: 13 vehículos`** (commit del 2026-10-24 08:38:44 -0300).
  Un `git pull origin main --ff-only` posterior confirmó que la rama local ya
  estaba en ese commit.
- Ese commit remoto contiene el nuevo `PATENTE/Update.bat`, el cambio inicial de
  `PATENTE/README.md`, seis PDFs reemplazados (`AE597NY/seguro.pdf`,
  `AF606JL/vtv.pdf`, `AG255NS/seguro.pdf`, `AG255NT/seguro.pdf`,
  `AH124ZK/seguro.pdf`, `AH190PG/seguro.pdf`), el nuevo
  `AG924XW/seguro.pdf`, tres archivos auxiliares con sufijo `_seg.pdf` en la
  raíz de `PATENTE/`, y once archivos de origen bajo `PATENTE/Vtos/seguros/`
  (PDF y RAR). Esto demuestra que esos cambios llegaron al remoto; no se verificó
  el resultado ni el estado del despliegue de Vercel.
- El commit no carga por sí mismo fechas de vencimiento en Firestore. No se hizo
  ninguna escritura a Firestore en esta sesión.
- El directorio de trabajo actualmente marca como eliminados
  `PATENTE/AG924XW_seg.pdf`, `PATENTE/AH124ZK_seg.pdf` y
  `PATENTE/AH190PG_seg.pdf`, aunque esos archivos están en el commit remoto. Se
  dejaron tal cual, sin restaurarlos ni volver a publicarlos. El resto de las
  modificaciones documentales de esta sesión no forma parte del commit
  `500802c`; se registra en un commit separado.
- Los nombres auxiliares `*_seg.pdf` no son del patrón de documento reconocido
  (`PATENTE/{patente}/{tipo}.{ext}`); revisar su ubicación/nombre antes de
  depender de ellos en la ficha o reportes. Los `.xlsx` siguen ignorados por
  Git.
