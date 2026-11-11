# Update 2026-11-11 — Admin → Correos + Brevo en producción

> Sesión: **2026-11-11** (hora local -03).
> Alcance: sección **Admin → Correos** para el informe de vencimientos,
> activación de **Brevo** en producción, deploy y pruebas end-to-end.
> Manual del servicio: `documentacion/BREVO-MANUAL.md`.
> Credenciales reales: `documentacion/privado/CREDENCIALES-BREVO.local.md`
> (**local, ignorado por git**).

---

## 1. Resumen

- Se agregó la página **Admin → Correos** (`/informes`) con destinatarios,
  asunto, cuerpo, ventana de días, toggle de envío automático, vista previa,
  descarga del PDF y **Enviar ahora**.
- Se agregó el **cron de los lunes 08:00 (ART)** que usa esa configuración:
  `GET /api/cron/vencimientos` (`vercel.json` → `0 11 * * 1`).
- Se activó **Brevo** en producción: cuenta **free** (300 mails/día),
  remitente verificado, `BREVO_API_KEY` cargada en Vercel y redeploy.
- Se probó el circuito completo: **PDF real (32 filas, 54 vehículos) enviado
  por Brevo con adjunto**.

## 2. Código agregado

| Archivo | Qué hace |
|---------|----------|
| `lib/informe-config.js` | Config en `config/informesMail` + defaults, normalización de destinatarios/días, `resolverEnvio()`, plantillas (`{{fecha}} {{dias}} {{total}} {{hoy}} {{flota}} {{hoy_linea}}`). |
| `lib/mailer.js` | `enviarInforme()`: Brevo (API HTTPS) → SMTP → `{enviado:false,motivo}`. Remitente `INFORMES_EMAIL_FROM` → `SMTP_USER` → `grupo@falpat.com.ar`. |
| `routes/informes.js` | `GET/PUT /api/informes/config`, `GET /api/informes/vista-previa`, `POST /api/informes/enviar` (todo `verifyToken` + `requireAdmin`). |
| `routes/cron.js` | `GET /api/cron/vencimientos` con `CRON_SECRET` (`Bearer` o `?token=`), `?forzar=1`, `?mail=0`, `?dias=N`. No escribe en Firestore. |
| `views/informes.ejs` + `public/js/informes.js` | UI de Correos: chips de destinatarios, asunto/cuerpo, días, toggle, vista previa, Descargar PDF, Guardar, Enviar ahora, banner de servicio (`#aviso-mail`), remitente visible (`#remitente-info`). |
| `views/partials/sidebar.ejs`, `views/partials/mobile-menu.ejs` | Entrada **Correos** (solo Admin). |
| `server.js` | Monta `/api/informes` y `GET /informes`. |
| `vercel.json` | Cron `0 11 * * 1`. |
| `tests/informes-config.test.js` | 41 checks de config, plantillas, envío manual y cron. |
| `package.json` | `test:informes` dentro de `npm test`. |
| `.env.example` | Variables del informe documentadas. |

### Commits (rama `main`, ya en `origin`)

| Commit | Mensaje |
|--------|---------|
| `789b1e5` | Correos: sección admin del informe de vencimientos + cron de los lunes |
| `12ea3ad` | Correos: destinatarios por defecto y Enviar ahora usa el formulario sin guardar |
| `bf1c407` | Correos: remitente por defecto `grupo@falpat.com.ar` y muestra el remitente |
| `94f3c90` | Correos: pista accionable cuando Brevo rechaza el remitente |

### Configuración en Firestore

- Doc: **`config/informesMail`** (si no existe, se usan defaults).
- Campos: `destinatarios[]`, `asunto`, `cuerpo`, `dias`, `activo`,
  `actualizadoEl`, `actualizadoPor`.
- Límites: 20 destinatarios, asunto ≤ 200, cuerpo ≤ 5000, días 1..365.
- Defaults: `dias = 90`, `activo = true`, asunto/cuerpo con placeholders.
- **Estado al 2026-11-11: el doc NO existe en producción** → corren los defaults
  (destinatarios `grupo@falpat.com.ar` y
  `administracion_hormigonera@constructoraalmajo.com.ar`).

### Variables de entorno en Vercel (Production)

Cargadas el **2026-11-11** (tipo *Sensitive*, valor oculto):

| Variable | Valor (resumen) |
|----------|-----------------|
| `BREVO_API_KEY` | clave `xkeysib-...` (ver archivo privado) |
| `INFORMES_EMAIL_FROM` | remitente verificado en Brevo (ver archivo privado) |
| `CRON_SECRET` | secreto del cron (ver archivo privado) |

> Cambiar una env **exige Redeploy**. No alcanza con guardarla.

## 3. Evidencia de la sesión

### 3.1 Tests (local, 2026-11-11)

```
npm test
  escrituras               -> OK: 47   FAIL: 0
  negocio                  -> OK: 25   FAIL: 0
  numeracion de vehiculos  -> OK: 16   FAIL: 0
  import de vehiculos      -> OK: 17   FAIL: 0
  deshabilitado-orden      -> 30 checks, 0 fallas
  inventario-casares       -> OK: 21   FAIL: 0
  informes config + cron   -> OK: 41   FAIL: 0
```

**Total: 197 checks, 0 fallas.**

### 3.2 Deploy (2026-11-11)

```
vercel --prod --yes
  Build Completed in /vercel/output [10s]
  Production  https://falpat-maintenance-control-ld4vza5i9-sandro1969.vercel.app
  Aliased     https://falpat-control-de-vehiculos.vercel.app
  Ready in 23s
```

### 3.3 Verificación en producción

| Chequeo | Resultado |
|---------|-----------|
| `GET /informes` sin sesión | `302` → `/login` |
| `GET /api/informes/config` sin token | `401` |
| `GET /api/cron/vencimientos` sin token | `401` |
| `GET /api/cron/vencimientos?mail=0&forzar=1&token=<CRON_SECRET>` | `200` → `dias=90`, `total=32`, `flota=54`, `mail=omitido (?mail=0)` |

### 3.4 Brevo (verificado por API)

| Chequeo | Resultado |
|---------|-----------|
| `GET /v3/account` | plan **free**, empresa "Grupo Falpat srl" |
| `GET /v3/senders` | 2 remitentes **active=true** |
| Mail de prueba directo | `{"messageId":"<202611111550.50436767620@smtp-relay.mailin.fr>"}` |
| Informe real con PDF (a un solo destino) | `{"enviado":true,"via":"brevo"}` · PDF **1.134.535 bytes** · **32 filas** · flota **54** |

> El envío real de prueba se mandó **solo a la casilla del usuario** para no
> molestar a la empresa. El informe completo a los destinatarios corporativos
> queda para el **Enviar ahora** desde la web o para el cron del lunes.

### 3.5 Envío manual del usuario (13:03 ART) — incidente de entrega

Envío real desde Admin → Correos con **3 destinatarios** (el usuario + los 2
defaults). Log de Brevo (`GET /v3/smtp/statistics/events`):

| Destinatario | Resultado | Detalle |
|--------------|-----------|---------|
| `ssaavedra1969@gmail.com` | **delivered** 13:03:22 | entregado (revisar Spam/Promociones) |
| `grupo@falpat.com.ar` | **softBounce** 13:03:21 | `550 5.7.1 Blacklisted [France, Europe]` |
| `administracion_hormigonera@constructoraalmajo.com.ar` | **softBounce** 13:03:23 | `550 5.7.1 Blacklisted [France, Europe]` |

- Brevo entrega a Gmail; los **servidores corporativos bloquean las IPs de
  Brevo** (`77.32.148.27` / `.28`, rango Francia). Los envíos de 12:57 y 13:02
  rebotaron igual.
- **Consecuencia:** el cron del lunes va a fallar a esos dos destinos mientras
  siga usando Brevo.
- **Acción:** pasar el envío a **Gmail SMTP** (contraseña de aplicación; las IPs
  de Google no están en esa blacklist) o pedir al proveedor de correo
  corporativo que **whitelistee** las IPs de Brevo.

### 3.6 Repositorio

```
git status --porcelain   -> (vacío)
HEAD=94f3c90  ORIGIN=94f3c90
```

## 4. Próximas acciones (checklist)

### P0 — inmediatas
- [ ] **Rotar `BREVO_API_KEY`**: la clave actual se compartió en un chat.
      Crear una nueva en Brevo, actualizar Vercel y **Redeploy**
      (paso a paso: `BREVO-MANUAL.md` §5).
- [ ] **Confirmar recepción** del mail de prueba (bandeja y **Spam**).
- [ ] **Guardar la configuración** en Admin → Correos (destinatarios reales,
      asunto y cuerpo) para que el cron no dependa de los defaults.

### P0 bis — bloqueante detectado el 2026-11-11
- [ ] **Resolver el rebote corporativo**: `550 5.7.1 Blacklisted [France, Europe]`
      en `grupo@falpat.com.ar` y `administracion_hormigonera@constructoraalmajo.com.ar`.
      Opción A (recomendada): **Gmail SMTP** con contraseña de aplicación
      (`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS`) y
      **quitar** `BREVO_API_KEY` para que `lib/mailer.js` use SMTP. Opción B:
      pedir al proveedor de correo que whitelistee las IPs de Brevo.
- [ ] **Confirmar que el mail a Gmail llegó**: Brevo lo marca `delivered`
      13:03:22; si no está en Recibidos, buscar en **Spam/Promociones/Todos**.

### P1 — esta semana
- [ ] **Verificar el cron del lunes 2026-11-16 08:00 ART**:
      revisar Vercel → Deployments → Functions → Logs y la bandeja de los
      destinatarios. Alternativa manual:
      `GET /api/cron/vencimientos?forzar=1&token=<CRON_SECRET>` (envía).
- [ ] Revisar **Transaccional → Logs** en Brevo (entregado / rebotado / spam).
- [ ] Decidir si se autentica el **dominio propio** (`@falpat.com.ar`) para
      sacar el aviso de DKIM/DMARC y mejorar entregabilidad (`BREVO-MANUAL.md` §3).

### P2 — cuando se pueda
- [ ] Monitorear el cupo free (300/día) — hoy sobra: 1 mail por corrida.
- [ ] Documentar en `AGENTS.md` la nueva sección (hecho en esta sesión).
- [ ] Evaluar alternativa **Gmail SMTP** (contraseña de aplicación) como
      respaldo si Brevo bloquea la cuenta por rebotes.

## 5. Riesgos y limitaciones

1. **Remitente `@gmail.com`**: Brevo advierte que no cumple los requisitos
   DKIM/DMARC de Google/Yahoo/Microsoft. El envío funciona, pero puede caer en
   Spam. Mitigación: dominio propio autenticado.
2. **Cuenta Brevo en revisión**: si Brevo marca la cuenta como "pendiente de
   aprobación", los envíos fallan hasta que la habilite (minutos a horas).
3. **Config no guardada**: si nadie guarda en Admin → Correos, el cron usa los
   defaults del código (dos direcciones corporativas).
4. **Envs requieren redeploy**: cargar `BREVO_API_KEY` sin redeploy no tiene
   efecto.
5. **`DEV_READ_ONLY=true` local**: bloquea Guardar/Enviar en local; el envío
   real solo se prueba en producción o con un script que use `lib/mailer.js`.
6. **La clave expuesta en chat debe rotarse** (P0).
7. **Plan free sin SLA**: si Brevo cambia límites o suspende la cuenta, hay que
   pasar a SMTP (Gmail) o a un plan pago.

## 6. Cómo revertir

- **Desactivar el envío automático** sin tocar código: Admin → Correos →
  apagar el toggle (**Guardar**), o `PUT /api/informes/config` con `activo:false`.
- **Cortar el envío por completo**: borrar `BREVO_API_KEY` en Vercel + Redeploy
  (la app sigue generando el PDF y responde `enviado:false`).
- **Revertir código**: `git revert 94f3c90 bf1c407 12ea3ad 789b1e5` (en ese
  orden) y push. El cron deja de existir al quitar `vercel.json`/`routes/cron.js`.

## 7. Referencias

- `documentacion/BREVO-MANUAL.md` — operación de Brevo (remitentes, claves, rotación).
- `documentacion/privado/CREDENCIALES-BREVO.local.md` — credenciales (local).
- `documentacion/Update_2026.10.19.md` — informe semanal original (PDF y tarea de los viernes).
- `AGENTS.md` — reglas del proyecto y registro de cambios.
- `tests/informes-config.test.js` — suite de la sección.
