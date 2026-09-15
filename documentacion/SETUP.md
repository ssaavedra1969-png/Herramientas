# Setup Local — Grupo Falpat SRL

Guía para clonar y ejecutar el sistema en una PC nueva.

## Requisitos previos

- **Node.js 18+** → https://nodejs.org (versión LTS)
- **Git** → https://git-scm.com
- **Cuenta de Firebase** con acceso al proyecto `engaged-card-450213-d7`

## 1. Clonar el repositorio

```bash
git clone https://github.com/ssaavedra1969-png/Herramientas.git
cd Herramientas
```

## 2. Instalar dependencias

```bash
npm install
```

## 3. Configurar credenciales

### Opción A: Archivo .env (recomendado)

Copiar `.env.example` a `.env` y completar con los valores reales:

```bash
copy .env.example .env
```

Abrir `.env` y completar:

```env
# Firebase Admin SDK
# Pegar el JSON de la service account COMPLETO en una sola línea
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"engaged-card-450213-d7",...}

# Firebase Client SDK (valores de Firebase Console → Configuración de la app web)
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=engaged-card-450213-d7.firebaseapp.com
FIREBASE_PROJECT_ID=engaged-card-450213-d7
FIREBASE_STORAGE_BUCKET=engaged-card-450213-d7.appspot.com
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=1:...:web:...

# Server
PORT=3000
SESSION_SECRET=cualquier-texto-secreto-aqui
NODE_ENV=development
```

### Opción B: Archivo JSON de service account

1. Ir a **Firebase Console** → https://console.firebase.google.com
2. Seleccionar proyecto `engaged-card-450213-d7`
3. ⚙️ Configuración del proyecto → Pestaña **Cuentas de servicio**
4. Hacer clic en **"Generar nueva clave privada"**
5. Guardar el archivo JSON descargado en la raíz del proyecto con el nombre:
   ```
   engaged-card-450213-d7-firebase-adminsdk-fbsvc-a956702c95.json
   ```
6. En `.env`, configurar solo las variables del Client SDK (las del Admin se leen del JSON)

### Opción C: Variable de entorno con path al JSON

En `.env`:
```env
FIREBASE_SERVICE_ACCOUNT_PATH=C:\ruta\al\archivo-service-account.json
```

## 4. Obtener las credenciales de Firebase

Si no tenés las credenciales, pedile al administrador del proyecto Firebase o seguí estos pasos:

1. Ir a **Firebase Console** → https://console.firebase.google.com
2. Seleccionar proyecto `engaged-card-450213-d7`
3. ⚙️ Configuración del proyecto → **General**
4. En "Tus apps", buscar la app web (íconito `</>`)
5. Copiar los valores de `firebaseConfig`:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

## 5. Iniciar el servidor

```bash
npm start
```

El servidor arranca en **http://localhost:3000**

### Primer usuario

El primer usuario que se registre se convierte automáticamente en **Admin**.

## 6. Deploy a Vercel (opcional)

```bash
npm i -g vercel
vercel login
vercel --prod
```

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Iniciar servidor |
| `npm run dev` | Iniciar con auto-reload (Node.js --watch) |
| `npm run backup` | Exportar backup JSON de Firestore |
| `npm run restore` | Restaurar backup a Firestore |

## Estructura del proyecto

```
├── server.js                 # Entry point Express
├── config/
│   └── firebase.js           # Admin SDK init
├── middleware/
│   └── auth.js               # verifyToken, requireAdmin, loadUser
├── routes/
│   ├── auth.js               # Login/session
│   ├── vehicles.js           # CRUD vehículos + subcolecciones
│   ├── admin.js              # Dashboard, reportes, backup
│   └── alerts.js             # (eliminado, pendiente reintegro)
├── views/                    # Templates EJS
├── public/js/                # JavaScript del cliente
├── scripts/                  # Utilidades de admin
├── firestore.rules           # Reglas de seguridad
├── firestore.indexes.json    # Índices
└── storage.rules             # Reglas de Storage
```

## Solución de problemas

### "Error parsing JSON" al iniciar
El `FIREBASE_SERVICE_ACCOUNT` en `.env` tiene un JSON malformado. Verificar que esté en una sola línea y sin saltos de carro.

### "Firebase: No service account"
No se encontró la service account. Verificar que:
- El archivo JSON esté en la raíz del proyecto, O
- La variable `FIREBASE_SERVICE_ACCOUNT` o `FIREBASE_SERVICE_ACCOUNT_PATH` esté configurada en `.env`

### "Port 3000 already in use"
Cambiar el puerto en `.env`:
```env
PORT=3001
```
