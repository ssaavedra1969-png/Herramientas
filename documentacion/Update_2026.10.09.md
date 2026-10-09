# Update 2026-10-09 — Documentos de vehículos (solo docs)

Sesión de **documentación de vehículos**: PDF nuevos para la carpeta de
`AH190PG`.

**Ningún cambio de código de la app** ni de datos en Firestore: solo archivos
de `PATENTE/`, que es lo que exige `PATENTE/README.md` (la carpeta queda
versionada en git porque Vercel la despliega).

---

## 1. Vehículo `AH190PG`

| Archivo | Estado | Peso |
|---|---|---|
| `PATENTE/AH190PG/cedula.pdf` | **nuevo** | 298.270 bytes |
| `PATENTE/AH190PG/dni.pdf` | **nuevo** | 241.731 bytes |
| `PATENTE/AH190PG/seguro.pdf` | ya versionado | 1.624.983 bytes |
| `PATENTE/AH190PG/titulo.pdf` | ya versionado | 24.280 bytes |

Los nombres respetan la convención `<tipo>.pdf` (`cedula` / `dni`), que es lo
que matchea `DOC_TIPOS` en `lib/github-docs.js` y `scanDocsCarpeta()` de
`server.js`: con el nombre correcto, Reportes/Documentación los listan como
presentes sin tocar código.

## Verificación

- `git status` → solo los 2 PDF nuevos de `AH190PG` + esta doc.
- Archivos por patente con nombre `<tipo>.pdf` minúscula, sin espacios.