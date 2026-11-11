# Brevo — Manual operativo (informe de vencimientos)

> Servicio de envío de mails usado por el **informe de vencimientos** del
> sistema (Admin → Correos y cron de los lunes).
> Los valores concretos de la cuenta y las claves están en
> `documentacion/privado/CREDENCIALES-BREVO.local.md` (**local, NO se commitea**).

---

## 1. Qué es y por qué Brevo

- **Brevo** (ex Sendinblue) manda mails transaccionales por **API HTTPS**.
- Se eligió porque el **plan Free** alcanza para el informe semanal:
  **300 mails/día**, sin tarjeta, y no requiere abrir puertos SMTP.
- El sistema **no depende** de Brevo: `lib/mailer.js` intenta primero Brevo y,
  si no hay `BREVO_API_KEY`, cae a SMTP genérico (`SMTP_HOST/PORT/USER/PASS`).
  Si no hay ninguno, genera el PDF y responde `enviado: false` con el motivo.

## 2. Datos de la cuenta

| Dato | Dónde se consulta |
|------|-------------------|
| Email de la cuenta | `documentacion/privado/CREDENCIALES-BREVO.local.md` |
| Plan | Brevo → esquina inferior izquierda → **Configuración** → **Facturación** |
| Remitentes | **Configuración → Remitentes, Dominios, IP → Remitentes** |
| Consumo / logs | **Transaccional → Logs** (y **Estadísticas**) |

Estado verificado el **2026-11-11**: plan **free**, empresa "Grupo Falpat srl",
2 remitentes **verificados** (mismo email, distinto nombre):
`Falpat Informes` y `Grupo Falpat srl`.

## 3. Remitentes (senders)

Un remitente es el par **nombre + email** que ve el destinatario. Brevo exige
que el email esté **verificado** para poder usarlo como `From`.

### Verificar un remitente
1. Abajo a la izquierda: **Configuración**.
2. **Remitentes, Dominios, IP** → pestaña **Remitentes**.
3. **Añadir un remitente**.
4. **Nombre del remitente** + **Dirección de email del remitente**.
5. **Guardar** → llega un **código de 6 dígitos** al email indicado.
6. Pegar el código → **Verificar remitente**. Debe quedar **Verificado**.

> El remitente que usa la app sale de `INFORMES_EMAIL_FROM` (o `SMTP_USER`).
> Hoy apunta al email verificado (ver archivo privado).

### Aviso de DKIM/DMARC (dominio gratuito)
Brevo muestra: *"No se recomienda usar un dominio de email gratuito"* y un
aviso de requisitos de **Google, Yahoo y Microsoft**. Es una advertencia de
**entregabilidad**, no un bloqueo: el envío funciona, pero puede caer en
**Spam** con más facilidad porque el dominio (`gmail.com`) no está autenticado
con DKIM/DMARC propios.

**Solución definitiva (recomendada):** verificar una dirección del dominio
propio (`@falpat.com.ar`) y autenticar el dominio:
1. **Configuración → Remitentes, Dominios, IP → Dominios → Añadir un dominio**.
2. Brevo da registros **DKIM/SPF/DMARC** para cargar en el DNS del dominio.
3. Cuando el dominio quede autenticado, crear/verificar el remitente
   `informes@falpat.com.ar` (o similar) y cambiar `INFORMES_EMAIL_FROM` en Vercel.
4. **Redeploy** para que tome la variable.

## 4. Claves API

### Crear una clave
1. **Configuración → SMTP y API → Claves API y MCP**.
2. **Generar clave API**.
3. Brevo pide un **código de verificación** (email/dispositivo) → **Verificar**.
4. Nombre: `Falpat Informes`.
5. **Permisos**: si pide elegir, usar **Acceso total** (o como mínimo el permiso
   de **Transaccional → Enviar emails**).
6. Expiración: **sin caducidad** (si se pone fecha, hay que renovarla a mano).
7. **Generar** → copiar la clave completa (empieza con `xkeysib-`).
   **Se muestra una sola vez.**

### Dónde vive la clave
| Lugar | Uso | Se commitea |
|-------|-----|-------------|
| **Vercel → Settings → Environment Variables** (`BREVO_API_KEY`, Production, Sensitive) | la usa producción | No (es un secreto de Vercel) |
| `documentacion/privado/CREDENCIALES-BREVO.local.md` | respaldo local en esta PC | **No** (carpeta ignorada por git) |
| `.env` local (opcional) | probar envíos desde scripts locales | No (`.env*` está ignorado) |

**Regla:** la clave **nunca** va en código, en docs versionados, en capturas,
en issues ni en chats. Si se expone, **rotarla** (ver §5).

### Probar la clave (solo lectura)
```powershell
$k = "<BREVO_API_KEY>"
curl.exe -s -H "api-key: $k" -H "accept: application/json" https://api.brevo.com/v3/account
curl.exe -s -H "api-key: $k" -H "accept: application/json" https://api.brevo.com/v3/senders
```
Devuelve el plan y los remitentes con `active: true`.

### Enviar un mail de prueba
```powershell
$body = @{
  sender = @{ name = 'Falpat Informes'; email = '<remitente verificado>' }
  to = @(@{ email = '<destino>' })
  subject = 'Prueba Brevo'
  textContent = 'Mail de prueba.'
} | ConvertTo-Json -Depth 5
curl.exe -s -X POST https://api.brevo.com/v3/smtp/email `
  -H "api-key: $k" -H "Content-Type: application/json" `
  -d $body
```
Respuesta OK: `{"messageId":"<...>"}`.

## 5. Rotar la clave (si se expuso o por rutina)

1. Brevo → **Configuración → SMTP y API → Claves API y MCP** → **Generar clave API**.
2. Copiar la nueva (`xkeysib-...`).
3. Vercel → proyecto `falpat-maintenance-control` → **Settings → Environment Variables**
   → `BREVO_API_KEY` → **Edit** → pegar la nueva → **Save**.
4. **Deployments → último deploy → ⋯ → Redeploy** (las env no se aplican solas).
5. Verificar: Admin → Correos (sin banner rojo) o mandar un mail de prueba.
6. Borrar la clave vieja en Brevo (**⋯ → Eliminar**).
7. Actualizar el archivo privado local.

> Rotar **no** cambia el remitente ni los destinatarios; solo la credencial.

## 6. Variables de entorno del sistema

| Variable | Para qué | Ejemplo |
|----------|----------|---------|
| `BREVO_API_KEY` | credencial de Brevo | `xkeysib-...` |
| `INFORMES_EMAIL_FROM` | remitente (`From`) | email verificado en Brevo |
| `INFORMES_EMAIL_TO` | destinatarios si NO hay config guardada en Firestore | `a@x.com,b@y.com` |
| `INFORME_VENCIMIENTOS_DIAS` | ventana por defecto (1..365) | `90` |
| `CRON_SECRET` | protege `/api/cron/vencimientos` | ver archivo privado |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | alternativa a Brevo | `smtp.gmail.com` / `587` |

- **Prioridad de destinatarios:** config de Admin → Correos (`config/informesMail`)
  → `INFORMES_EMAIL_TO` → defaults del código
  (`grupo@falpat.com.ar`, `administracion_hormigonera@constructoraalmajo.com.ar`).
- **Prioridad de remitente:** `INFORMES_EMAIL_FROM` → `SMTP_USER` → `grupo@falpat.com.ar`.
- Cambiar una variable en Vercel **exige Redeploy**.

## 7. Límites y buenas prácticas

- **300 mails/día** en Free. El informe manda **1 mail con 1 PDF** por corrida
  (los destinatarios van en copia dentro del mismo envío), así que sobra cupo.
- **Adjunto máximo 10 MB**. El PDF del informe ronda **1,1 MB** (32 filas).
- No usar la cuenta para mailing masivo: es una cuenta transaccional.
- Revisar **Transaccional → Logs** si un envío no llega (estado, rebotes, spam).
- Si un destinatario marca el mail como spam, Brevo puede suspender el envío.

## 8. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `Brevo 401` / "Key not found" | clave mal copiada, revocada o vencida | rotar la clave y actualizar Vercel |
| `Brevo 400 ... sender ... invalid` | `From` no verificado | verificar el remitente (§3) |
| El mail no llega y no hay error | cayó en Spam / cuenta en revisión | revisar Spam, **Transaccional → Logs**, esperar aprobación |
| `550 5.7.1 Blacklisted [France, Europe]` (softBounce) | el servidor del destinatario bloquea las IPs de Brevo | usar **Gmail SMTP** (IPs de Google) o pedir al proveedor que whitelistee las IPs de Brevo |
| "No hay destinatarios configurados" | no se guardó la config y no hay `INFORMES_EMAIL_TO` | Guardar en Admin → Correos o cargar la env |
| Banner rojo "sin servicio de mail" | falta `BREVO_API_KEY` en el deploy | cargar la env y **Redeploy** |
| Cron responde 401 | `CRON_SECRET` distinto o ausente | revisar la env y el header/`?token=` |

## 9. Referencias

- Panel: https://app.brevo.com
- Ayuda (ES): https://help.brevo.com/hc/es
- API transaccional: https://developers.brevo.com/reference/sendtransacemail
- Límites del plan: https://www.brevo.com/pricing/
