# Update 2026.09.28 — Vencimientos del dashboard, control de documentación en Excel y edición/baja de Obras

## Objetivo
Tres cosas en una sesión:

1. Separar en el dashboard los vencimientos **ya vencidos** de los que **están por vencer**, y que la documentación se lea de la carpeta real `PATENTE/`.
2. Poder bajar el estado de la documentación de toda la flota a dos Excel de trabajo.
3. Poder **editar y eliminar** una obra (Centros de Trabajo), que hasta ahora solo se podía crear, asignar elementos y cerrar.

**Commit único:** `0ecb9a8` (10 archivos, +640/−56) — pusheado a `origin/main`, deploy automático en Vercel.

---

## 1. Dashboard: vencidos vs. por vencer

### El problema
Las tarjetas de alertas mezclaban vencidos y próximos en un mismo número, y al separar "en 30 días" de "ya venció" los números grandes mezclaban un documento que venció ayer con uno que vence en tres semanas: no había forma de saber cuántos eran urgencia real.

### Qué se cambió (`public/js/dashboard.js`, `views/dashboard.ejs`, `public/css/themes.css`)
- Cada tipo de documento se separa en dos contadores: `vencidos` (fecha pasada) y `proximos` (dentro de 1 a 30 días).
- **El número grande de cada tarjeta cuenta solo los que están por vencer**; los vencidos van en una línea aparte, con cantidad explícita ("3 vencidos"). Así el número grande es la lista de trabajo.
- La tarjeta de Service sigue por fecha y por km (usa `proximoServiceFecha` / `proximoServiceKm`).
- El modal de alertas se titula distinto según el caso y muestra la fecha concreta del documento.
- `themes.css`: `.alert-card__sub` se oculta si viene vacío (si no, dejaba un hueco).

### Resultado con los datos reales de la flota (54 vehículos)
| Documento | Por vencer | Vencidos | Con documento |
|---|---|---|---|
| VTV | 2 | 6 | 38/54 |
| Seguro | 26 | 10 | 41/54 |
| Cédula | 0 | 6 | 34/54 |
| Matafuego | 0 | 0 | — |
| Registro | 0 | 2 | 6/54 |
| DNI | 0 | 1 | 5/54 |
| Service | 0 | 0 | 13/54 (por fecha) |
| **Total** | **28** | **25** | |

### De dónde salen los documentos
Antes se leía solo el mapa `documentacion` del vehículo (carga manual) y los `docsAdjuntos` subidos desde la web. **Ahora la fuente principal es la carpeta `PATENTE/{patente}/`**, que es donde están los PDF de verdad:

- VTV → `vtv.fechaVencimiento` · Seguro → `seguro.fechaVencimiento` · Registro → `vencimientoRegistro` · DNI → `vencimientoDNI`
- Los demás (título, cédula) salen del mapa `documentacion`.
- **Prioridad**: el archivo subido desde la web le gana al de la carpeta.
- Matafuego y Service no tienen archivo, siguen usando las fechas cargadas en la web.

### Endpoint corregido (`routes/vehicles.js`)
`GET /api/vehicles/documentos/reporte` en producción solo encontraba los documentos de los vehículos de la sesión del usuario:
- `lib/github-docs.js` ahora trae **todo el árbol `PATENTE/` con una sola petición** a la API de GitHub (`listarPatenteGlobal()`), en vez de una consulta por patente. Exporta también `esDeTipo()`.
- El reporte **mezcla** esa lista con los `docsAdjuntos` de Firestore, con caché en memoria y **fallback al disco local** si GitHub no responde.
- **Verificado con la base real: HTTP 200, 54 filas** — VTV 38, Seguro 41, Cédula 34, Registro 6, DNI 5, Título 42; 4 vehículos sin ningún documento, 2 sin carpeta y 2 con carpeta vacía.

---

## 2. Excel de control (`npm run generar:control`)

`scripts/generar-control-documentacion.js` arma dos planillas en `PATENTE/Reportes/`:

| Archivo | Contenido |
|---|---|
| `CONTROL_FALTANTES_2026-09-28.xlsx` | **158 filas**: un renglón por documento que falta (patente × tipo). |
| `CONTROL_VENCIDOS_2026-09-28.xlsx` | **25 filas**: documentos con fecha vencida (patente × tipo × fecha). |

- Se regeneran con `npm run generar:control` (lee la misma base que el dashboard, así que no hay que exportar nada a mano).
- **No van a git**: `*.xlsx` está en `.gitignore`. En otra PC hay que correr el comando.
- Es la herramienta para llevar el faltante de documentación a terreno y después cargar los vencimientos con `npm run cargar:vencimientos`.

---

## 3. Centros de Trabajo: editar y eliminar obras

### Backend (`routes/centros.js`)
**`PUT /api/centros/:id`** (Admin) — antes solo aceptaba `estado`, `ubicacion` y `observaciones`:
- Ahora acepta **`nombre`** (obligatorio, no puede quedar en blanco, se recorta).
- Valida `estado` contra `activa` / `pausada` / `cerrada`.
- Recorta `ubicacion` y `observaciones`, igual que el `POST`.

**`DELETE /api/centros/:id`** (Admin) — **endpoint nuevo**:
1. 404 si la obra no existe.
2. **Se niega con 409 si queda algún elemento sin devolver**, diciendo cuántos. Hay que devolverlos primero: así no se pierde el registro de qué elemento estuvo en qué obra.
3. Si no hay pendientes, borra la subcolección `elementos` **por lotes de 400** (límite de Firestore) y después el doc de la obra, e invalida la caché.
4. Responde `{ ok: true, elementosBorrados: n }`.

> **Trampa evitada:** el chequeo de pendientes se hace leyendo la subcolección y filtrando en memoria, **no** con `where('fechaDevolucion', '==', '')`. Los elementos cargados antes de que existiera ese campo **no tienen la clave**, no aparecen en ese query y la obra se dejaría borrar con un elemento sin devolver adentro.

### Frontend (`views/centros.ejs`, `public/js/centros.js`)
- Botón de **editar** (lápiz) y de **eliminar** (papelera) en la fila de la tabla y en el modal de detalle.
- Modal de edición (nombre, ubicación, estado, observaciones) y modal de confirmación de borrado (rojo, con el nombre de la obra y qué se va a perder).
- **Guardas `isAdmin()`**: antes esos botones se le mostraban a cualquier usuario que entrara a `/centros` y fallaban con 403 (la página usa `requireAuth`, no `requireAdminPage`).
- Al abrir el modal de borrado pide el detalle de la obra (`GET /api/centros/:id`) porque **los conteos `asignados`/`totalElementos` solo vienen en el detalle, no en la lista**. Sin eso el botón aparecería habilitado en una obra con elementos pendientes. Si hay pendientes, el botón "Eliminar" queda deshabilitado y el modal lo explica.

### Cómo se verificó
Como `DEV_READ_ONLY=true` bloquea toda escritura en local, el camino de escritura se probó con un **`db` fake** (Express + `routes/centros.js` reales, Firestore simulado): **29/29 checks**.
- Vacía → 200, borra doc, 0 elementos.
- Solo devueltos → 200, borra los 2 + doc.
- Con 1 sin devolver → 409, **no borra nada** (0 batches).
- Elemento legacy sin `fechaDevolucion` → 409 (el caso de la trampa de arriba).
- Doc inexistente → 404.
- **900 elementos → 3 batches (400+400+100)**, borra los 900 y el doc.
- PUT: nombre en blanco → 400, estado inválido → 400, nombre ausente → 200 sin tocar `nombre`, edición completa → recorta los 4 textos y sella `updatedAt`.

Además: `node --check` en ambos JS, render EJS con los 10 ids nuevos, server local reiniciado y `/js/centros.js` sirviendo el código nuevo.

> ⚠️ **Pendiente de probar en producción:** un borrado real de una obra de prueba. El 409 (que es la parte que protege los datos) ya está verificado, pero la escritura contra Firestore real no se ejecutó nunca.

---

## Estado final
- `HEAD` = `origin/main` = `0ecb9a8`, working tree limpio.
- Deploy: https://falpat-control-de-vehiculos.vercel.app (automático por push a `main`).
- **Los Excel no están en git** (ignorados a propósito).
- 3 correcciones que salieron probando y quedaron en el código: el trim de `ubicacion`/`observaciones` en el PUT (el `POST` ya lo hacía), el chequeo de pendientes en memoria, y las guardas `isAdmin()` que faltaban en la tabla de centros.
