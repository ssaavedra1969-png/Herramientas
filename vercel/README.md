# Vercel — Grupo Falpat SRL

## Proyecto
- **URL produccion:** https://herramientas-five.vercel.app
- **Consola:** https://vercel.com/dashboard

## Configuracion

### Archivos del proyecto
```
vercel.json                     # Configuracion de build/rutas
.vercelignore                   # Archivos excluidos del deploy
.env.vercel                     # Variables de entorno (NO subir a git)
```

### Variables de entorno (en la consola de Vercel)
| Variable | Descripcion |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | JSON stringificado de la service account |
| `FIREBASE_API_KEY` | API Key del client SDK |
| `FIREBASE_AUTH_DOMAIN` | `engaged-card-450213-d7.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `engaged-card-450213-d7` |
| `FIREBASE_STORAGE_BUCKET` | `engaged-card-450213-d7.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | `462425012623` |
| `FIREBASE_APP_ID` | App ID del client SDK |
| `FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `SESSION_SECRET` | Secreto para cookies de sesion |

### Build Settings
- **Framework:** None (Express.js)
- **Build Command:** (vacio o `npm install`)
- **Output Directory:** (vacio)
- **Install Command:** `npm install`
- **Node.js Version:** 22.x

## Deploy

### Automatico (via GitHub)
```bash
git push origin main    # Deploy a produccion
git push origin develop # Deploy a preview
```

### Manual
```bash
vercel --prod           # Deploy a produccion
vercel                  # Deploy a preview
```

## Comandos utiles
```bash
vercel ls               # Listar deploys recientes
vercel logs             # Ver logs del ultimo deploy
vercel env ls           # Listar variables de entorno
```

## Dominio personalizado
- Configurar en: Settings > Domains
- Actualmente en: `herramientas-five.vercel.app`
