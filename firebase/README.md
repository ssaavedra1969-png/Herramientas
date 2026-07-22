# Firebase — Grupo Falpat SRL

## Proyecto
- **Nombre:** engaged-card-450213-d7
- **Consola:** https://console.firebase.google.com/u/0/project/engaged-card-450213-d7/overview

## Servicios utilizados

### Firestore Database
- **URL:** https://console.firebase.google.com/u/0/project/engaged-card-450213-d7/firestore
- **Colecciones:**
  - `vehicles` — Vehiculos (33 registros)
    - Subcolecciones: `combustible`, `repuestos`
  - `maintenance` — Mantenimientos
  - `users` — Usuarios (roles Admin/Usuario)
  - `counters` — Contadores auto-increment

### Authentication
- **URL:** https://console.firebase.google.com/u/0/project/engaged-card-450213-d7/authentication
- **Metodos habilitados:** Email/Password, Google

### Storage (opcional)
- **URL:** https://console.firebase.google.com/u/0/project/engaged-card-450213-d7/storage
- **Uso:** Comprobantes, fotos de vehiculos

## Archivos de configuracion en el proyecto
```
config/firebase.js              # Admin SDK init (server-side)
.env                            # Variables de entorno (NO subir a git)
.env.example                    # Template de .env
public/index.html               # Firebase SDK client-side
public/js/auth-client.js        # Auth helpers
```

## Variables de entorno requeridas (.env)
```env
# Firebase Admin SDK (server-side)
FIREBASE_SERVICE_ACCOUNT_PATH=./engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json

# Firebase Client SDK
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=engaged-card-450213-d7.firebaseapp.com
FIREBASE_PROJECT_ID=engaged-card-450213-d7
FIREBASE_STORAGE_BUCKET=engaged-card-450213-d7.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=462425012623
FIREBASE_APP_ID=1:462425012623:web:xxxxxxxxxxxxxx
```

## Seguridad
- El archivo `engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json` NO debe subirse a git
- Esta en `.gitignore`
- En Vercel, usar `FIREBASE_SERVICE_ACCOUNT` como environment variable (JSON stringificado)
