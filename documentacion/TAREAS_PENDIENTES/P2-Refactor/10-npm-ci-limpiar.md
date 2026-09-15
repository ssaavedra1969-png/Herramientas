# TAREA P2-10: Limpiar node_modules con `npm ci`

**Prioridad:** BAJA
**Problema:** Hay 24 paquetes extraneos en `node_modules` que no están declarados en `package.json`. También hay 11 vulnerabilidades.

---

## Cambio requerido

### 1. Limpiar node_modules

```bash
# Eliminar node_modules y package-lock.json
rm -rf node_modules package-lock.json

# Reinstalar limpiamente
npm install

# Verificar que no hay paquetes extraneos
npm ls --depth=0 2>&1
```

### 2. Audit de seguridad

```bash
npm audit

# Intentar fix automático
npm audit fix

# Si quedan vulnerabilidades, evaluar:
npm audit fix --force  # Solo si es seguro (puede romper compatibilidad)
```

### 3. Vulnerabilidad conocida: `xlsx`

`xlsx` 0.18.5 tiene Prototype Pollution y ReDoS. SheetJS no tiene versión parcheada. Opciones:
- Mantener xlsx y documentar el riesgo (el input viene del usuario interno, no público)
- Reemplazar por una alternativa como `exceljs` (ya está como dependencia) para lectura de Excel
- **Recomendación:** Por ahora mantener, pero agregar comentario en `package.json`:

```json
"xlsx": "0.18.5  // WARNING: known vulnerabilities (Prototype Pollution, ReDoS). Internal use only."
```

---

## Verificación

1. `npm ls --depth=0` no muestra paquetes extraneos
2. `npm audit` muestra menos vulnerabilidades
3. El servidor inicia correctamente: `npm start`
4. Import CSV/Excel funciona correctamente
