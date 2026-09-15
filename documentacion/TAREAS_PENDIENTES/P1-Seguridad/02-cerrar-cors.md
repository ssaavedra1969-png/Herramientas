# TAREA P1-2: Restringir CORS al dominio de Vercel

**Prioridad:** ALTA (Seguridad)
**Archivo:** `server.js`
**Problema:** `cors()` sin opciones (línea 22) permite requests desde cualquier dominio. Aunque se requiere auth token, es mejor práctica restringir origin.

---

## Cambio requerido

### `server.js` línea 22

**ANTES:**
```js
app.use(cors());
```

**DESPUÉS:**
```js
const allowedOrigins = [
  'https://herramientas-five.vercel.app',
  process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : null
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true
}));
```

**NOTA:** El `origin: null` permite requests desde herramientas de testing (Postman, etc.) cuando no hay `Origin` header.

---

## Verificación

1. Desde el navegador en `https://herramientas-five.vercel.app` — debe funcionar normal
2. Desde `http://localhost:3000` en desarrollo — debe funcionar
3. Desde un dominio arbitrario — el request debe ser bloqueado
4. Verificar que las cookies de sesión (`__session`) siguen funcionando (requiere `credentials: true`)
