# Migración de Firebase Firestore → Microsoft SQL Server

## Situación actual (Firebase)

- **Firestore** con 4 colecciones principales: `vehicles`, `maintenance`, `users`, `counters`
- **Subcolecciones** anidadas: `vehicles/{id}/combustible`, `vehicles/{id}/repuestos`
- **~7 listeners `onSnapshot()`** en tiempo real en el frontend (dashboard, vehículos, mantenimiento, detalle, admin)
- **~30 consultas server-side** en rutas Express (lecturas completas de colecciones para reportes, exportaciones, dashboard)
- **Email/password Auth** manejado por Firebase Auth
- **Deploy en Vercel** (serverless)
- **Problema:** se agotan créditos de lectura de Firestore por los `onSnapshot()` y las lecturas completas recurrentes

---

## 🟢 Pros de migrar a MSSQL

| Pro | Detalle |
|-----|---------|
| **Sin límite de lecturas** | Costo fijo de hosting SQL Server, sin cobro por operación |
| **JOINs y queries complejas** | Las agregaciones (reportes, dashboard) se resuelven en una query SQL, no en N queries a Firestore |
| **Transacciones ACID reales** | No limitado a 500 operaciones por lote como Firestore |
| **Control total de datos** | La data vive en un servidor propio, sin depender de terceros |
| **Consultas flexibles** | WHERE, GROUP BY, ORDER BY, subqueries sin límites de índices compuestos |
| **Madurez** | Optimizador de queries, stored procedures, vistas, triggers |
| **Costos predecibles** | Hosting fijo mensual ($10-50 USD Azure SQL) vs. pago por lectura Firebase |

## 🔴 Contras de migrar a MSSQL

| Contra | Detalle |
|--------|---------|
| **❌ Adiós tiempo real** | `onSnapshot()` de Firestore no existe en SQL. Habría que implementar polling cada N segundos o Socket.IO/SignalR, agregando latencia y complejidad |
| **❌ Adiós Firebase Auth** | Habría que reimplementar registro, login, sesión, cambio de contraseña con `bcrypt` + JWT o similar |
| **Reescritura masiva de frontend** | Los 7 listeners `onSnapshot()` se reemplazan por `fetch()` + polling. La UI pierde actualización instantánea |
| **Reescritura masiva de backend** | ~30 endpoints cambian de `db.collection('x').get()` a `mssql.query('SELECT ...')` |
| **Esquema rígido** | Firestore es schemaless; MSSQL exige migraciones con `ALTER TABLE` |
| **Subcolecciones complejas** | `combustible` y `repuestos` son subcolecciones anidadas. Habría que normalizarlas como tablas separadas con FK |
| **Hosting adicional** | Necesitás un SQL Server accesible vía internet (Azure SQL, AWS RDS, o VPS). No es "local nomás" si querés que funcione desde Vercel/web |
| **Mantenimiento** | Backups, índices, actualizaciones del motor recaen en vos |
| **Sin snapshots en tiempo real** | Perdés la capacidad de ver cambios de otros usuarios sin recargar |

---

## ⚠️ Consideraciones técnicas: Vercel es serverless

Las funciones serverless de Vercel se ejecutan en contenedores efímeros en AWS (us-east-1) y:

1. **No hay connection pool persistente** — cada request abre y cierra conexión (o usa pool compartido vía `mssql` que se recicla cada ~15 minutos de inactividad)
2. **Latencia de red** — depende de dónde esté tu servidor SQL con IP pública. Si está en Argentina, ~150-250ms de latencia por request
3. **Timeout** — Vercel tiene límite de 10-60s por función (según plan). Queries lentas pueden fallar
4. **IPs dinámicas** — no podés whitelistear por IP fija porque Vercel no tiene IPs salientes fijas (hay rangos AWS us-east-1 que cambian)

✅ **Conclusión: funciona, pero hay que mitigar estos puntos.**

### Soluciones de conectividad para Vercel

| Opción | Descripción | ¿Funciona? |
|--------|-------------|------------|
| **Azure SQL Database** | SQL Server cloud público, accesible desde Vercel vía TCP | ✅ Sí, con `tedious` + connection string |
| **Supabase (PostgreSQL)** | Alternativa serverless que sí funciona en Vercel | ✅ Sí, pero no es MSSQL |
| **VPS + SQL Server Express** | Servidor Windows en la nube con SQL Express (gratis, 10GB) | ✅ Sí, necesita IP pública + firewall |
| **SQL Server empresa con IP pública** | Tu server SQL expuesto a internet con IP pública | ✅ **Sí funciona**, con las mitigaciones adecuadas |
| **SQL Server en red privada (sin IP pública)** | Base en tu red local sin exponer | ❌ **No**, Vercel no llega a tu red |
| **Túnel SSH/Cloudflare Tunnel** | Exponer tu base local vía túnel | ⚠️ Inseguro, latencia alta, no recomendado |

---

## 🏢 Conexión a SQL Server del servidor empresa con IP pública

**Sí es posible.** Si el servidor SQL de la empresa tiene IP pública, Vercel puede conectarse. Acá está todo lo que hay que tener en cuenta y cómo implementarlo.

### Requisitos del servidor empresa

| Requisito | Detalle |
|-----------|---------|
| **IP pública fija** | El servidor debe tener una IP pública estática (no dinámica) |
| **Puerto 1433 abierto** | SQL Server por defecto usa TCP 1433. Abrirlo en el firewall corporativo solo para los rangos de Vercel/AWS |
| **SQL Server con TCP/IP habilitado** | En SQL Server Configuration Manager → Protocols for MSSQLSERVER → TCP/IP habilitado |
| **Autenticación mixta** | El server debe aceptar autenticación SQL Server (usuario/contraseña) además de Windows Auth |
| **TLS forzado** | Idealmente exigir encriptación con certificado SSL para la conexión |
| **Latencia** | Verificar latencia desde AWS us-east-1 (donde corre Vercel) hasta tu servidor |

### 🔒 Seguridad (lo más importante)

Exponer SQL Server a internet es **riesgoso**. Implementá sí o sí:

```powershell
# 1. Firewall de Windows — solo IPs de Vercel/AWS
New-NetFirewallRule -DisplayName "Vercel AWS us-east-1" -Direction Inbound `
  -Protocol TCP -LocalPort 1433 -RemoteAddress `
  "52.0.0.0/8,44.0.0.0/8,54.0.0.0/8,34.0.0.0/8,3.0.0.0/8,15.0.0.0/8,13.0.0.0/8"
# (rangos aproximados de AWS us-east-1 — verificar en docs de AWS)
```

Alternativa más segura: **nginx reverse proxy** en el mismo servidor o un VPS intermedio:

```nginx
# nginx como proxy reverso (más seguro que exponer SQL Server directo)
stream {
  server {
    listen 14333;
    proxy_pass 127.0.0.1:1433;
    proxy_ssl on;
    # Whitelist de IPs
    allow 52.0.0.0/8;
    deny all;
  }
}
```

O mejor aún: **Cloudflare Tunnel** (solo conecta por Cloudflare, sin exponer puertos):

```bash
# En el servidor empresa (Windows con WSL o Linux)
cloudflared tunnel create sql-tunnel
cloudflared tunnel route dns sql-tunnel sql.empresa.com
cloudflared tunnel run sql-tunnel
```

### 🔧 Connection string para Vercel

```
DB_SERVER=190.xxx.xxx.xxx,1433
DB_NAME=herramientas
DB_USER=sa
DB_PASSWORD=xxxxx
DB_ENCRYPT=true
DB_TRUST_CERT=false
```

O si usás DNS:
```
DB_SERVER=tcp:sql.empresa.com,1433
```

### ⚡ Mitigación de latencia (serverless)

Como Vercel es serverless, cada request abre conexión nueva. Para mitigar:

```javascript
// config/database.js — pool reciclable en serverless
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    connectTimeout: 15000,
    requestTimeout: 30000
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 60000,
    evictionRunIntervalMillis: 30000
  }
};

let poolPromise = null;

async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(pool => {
        pool.on('error', err => {
          console.error('SQL Pool error:', err);
          poolPromise = null;
        });
        return pool;
      })
      .catch(err => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

// Helper para queries
async function query(sqlQuery, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  Object.entries(params).forEach(([k, v]) => request.input(k, v));
  const result = await request.query(sqlQuery);
  return result.recordset;
}

module.exports = { query, getPool };
```

### ⏱️ Estrategia para tiempo real sin onSnapshot()

Como SQL Server no tiene `onSnapshot()`, necesitás una alternativa:

**Opción A — Polling simple (recomendado para empezar):**
```javascript
// Reemplazar onSnapshot por fetch cada 30s
async function pollVehicles() {
  const res = await fetch('/api/vehicles');
  const data = await res.json();
  renderVehicles(data);
}
pollVehicles();
setInterval(pollVehicles, 30000);
```

**Opción B — Socket.IO (tiempo real real, más complejo):**
```bash
npm install socket.io socket.io-client
```
```javascript
// server.js
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('join-vehicles', () => socket.join('vehicles'));
});

// En cada ruta POST/PUT/DELETE de vehicles.js:
io.to('vehicles').emit('vehicles:changed');

// En el frontend (public/js/vehicles.js):
const socket = io();
socket.emit('join-vehicles');
socket.on('vehicles:changed', () => {
  fetchVehicles();
});
```

**Opción C — SQL Server Query Notification (solo SQL Server Standard/Enterprise):**
```sql
-- SQL Server puede notificar cambios via Service Broker
-- Requiere SQL Server Standard o Enterprise (no Express)
CREATE QUEUE dbo.VehicleChanges;
CREATE SERVICE VehicleChangeService ON QUEUE dbo.VehicleChanges;
-- Luego desde Node con `mssql` escuchar notificaciones
```
Requiere librería `node-sqlserver-notifier` o implementación manual con Service Broker. Es la solución más elegante pero solo disponible en ediciones pagas de SQL Server.

### 📡 Túnel Cloudflare como alternativa a IP pública

Si no querés exponer el puerto 1433 directamente, Cloudflare Tunnel es la opción más segura:

```bash
# Instalar cloudflared en el servidor Windows (o Linux)
# Descargar: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# Autenticar
cloudflared tunnel login

# Crear túnel
cloudflared tunnel create sql-server-tunnel

# Configurar ~/.cloudflared/config.yml
tunnel: sql-server-tunnel
credentials-file: ~/.cloudflared/sql-server-tunnel.json
ingress:
  - hostname: sql.tuempresa.com
    service: tcp://localhost:1433
  - service: http_status:404

# Routeo DNS
cloudflared tunnel route dns sql-server-tunnel sql.tuempresa.com

# Iniciar
cloudflared tunnel run sql-server-tunnel
```

Luego en Vercel usás `DB_SERVER=tcp:sql.tuempresa.com,443` — la conexión va por Cloudflare sin exponer nada. Totalmente seguro y sin IP visible.

### 🧪 Prueba de conectividad

Antes de escribir código, verificá que Vercel llegue a tu SQL Server con un endpoint de prueba:

```javascript
// routes/test-db.js (solo para desarrollo)
router.get('/api/test-db', async (req, res) => {
  try {
    const result = await db.query('SELECT 1 AS connected');
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
```

También podés probar desde tu PC local con `telnet` o `Test-NetConnection`:

```powershell
Test-NetConnection -ComputerName "190.xxx.xxx.xxx" -Port 1433
```

Antes de encarar MSSQL, considerá estas opciones que resuelven el problema de lecturas sin reescribir todo:

### Opción 1: Auditar y optimizar Firebase (recomendado)

| Acción | Impacto |
|--------|---------|
| **Cachear consultas** con `memcache` en el servidor para reportes/dashboard | Reduce lecturas server-side ~60% |
| **Reemplazar `onSnapshot()` por `get()` + polling manual cada 30s** | Elimina lecturas constantes de Firestore (un `onSnapshot` abierto = ~1 lectura/segundo/doc) |
| **Indexar bien** para evitar lecturas de documentos completos en colecciones grandes | Reduce costo por lectura |
| **Pasar a Firebase Blaze (pay-as-you-go)** | Si el proyecto consume mucho, el plan Blaze suele ser más barato que mantener un SQL Server 24/7 |
| **Limitar exports/reportes a datos cacheados o agregaciones precalculadas** | Evita barrer colecciones enteras |

### Opción 2: Migrar a PostgreSQL (vía Supabase o Neon)

- **Funciona en Vercel** (conexión nativa vía `pg` o `@neondatabase/serverless`)
- **Esquema relacional** con JOINs
- **Políticas RLS** similares a Firestore Security Rules
- **Realtime** vía Supabase Realtime (WebSocket, similar a `onSnapshot`)
- **Auth** propio con JWT
- **Costo:** Plan gratis de Supabase (500MB, 2 usuarios) → escalable
- **Desventaja:** No es MSSQL, reescritura igual es grande

### Opción 3: Azure SQL Database (MSSQL real en la nube)

- **Mismo motor SQL Server**, funciona desde Vercel
- **Pricing:** ~$5-15/mes (DTU Basic) → sin límite de lecturas
- **Requiere reescritura** total de la capa de datos
- **Requiere proxy** para conexiones serverless (`tedious` con connection pooling vía `mssql` pool o Prisma)

---

## 📋 Paso a paso: Migrar a MSSQL en servidor empresa (IP pública)

### Fase 0: Decidir dónde hostear la DB

| Opción | Costo | Mantenimiento | Seguridad | Recomendación |
|--------|-------|---------------|-----------|---------------|
| **Server empresa (IP pública)** | $0 (ya lo tenés) | Vos | Media-Alta (con Cloudflare Tunnel) | ✅ Si tenés SQL Server con licencia |
| **Azure SQL Database** | ~$5/mes | Microsoft maneja backups, updates | Alta (firewall + TLS) | ✅ Si querés cero mantenimiento |
| **VPS + SQL Express** | ~$10-20/mes | Vos (instalación en VPS) | Alta | ⚠️ Solo si no tenés server propio |

### Fase 1: Preparación (1-2 días)

```bash
npm install mssql dotenv
```

**1.1 Esquema de base de datos**

```sql
-- Tabla principal
CREATE TABLE vehicles (
  id VARCHAR(100) PRIMARY KEY,
  patente VARCHAR(20) NOT NULL,
  interno VARCHAR(50),
  tipo VARCHAR(50),
  subtipo VARCHAR(50),
  marca VARCHAR(100),
  modelo VARCHAR(100),
  anio INT,
  chasis VARCHAR(100),
  numeroMotor VARCHAR(100),
  capacidadCarga VARCHAR(50),
  cargaTrompo VARCHAR(10),
  trompo_tipo VARCHAR(50),
  trompo_numeroSerie VARCHAR(100),
  trompo_marca VARCHAR(100),
  trompo_capacidad VARCHAR(50),
  trompo_modelo VARCHAR(100),
  kilometraje DECIMAL(12,2),
  horometro DECIMAL(12,2),
  estadoGeneral VARCHAR(50),
  fechaUltimaRevision DATE,
  vtv_fechaRealizacion DATE,
  vtv_fechaVencimiento DATE,
  vtv_costo DECIMAL(10,2),
  vtv_centroMedicion VARCHAR(200),
  vtv_resultado VARCHAR(20),
  seguro_compania VARCHAR(100),
  seguro_poliza VARCHAR(100),
  seguro_tipo VARCHAR(50),
  seguro_fechaVencimiento DATE,
  seguro_costo DECIMAL(10,2),
  proximoServiceKm INT,
  proximoServiceFecha DATE,
  centroTrabajo VARCHAR(100),
  conductorHabitual VARCHAR(200),
  empresa VARCHAR(200),
  observaciones TEXT,
  fotoURL VARCHAR(500),
  fechaAlta DATETIME DEFAULT GETDATE(),
  createdAt DATETIME DEFAULT GETDATE(),
  updatedAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE combustible (
  id VARCHAR(100) PRIMARY KEY,
  vehicleId VARCHAR(100) NOT NULL FOREIGN KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  litros DECIMAL(10,2),
  importe DECIMAL(10,2),
  tipo VARCHAR(20),
  km INT,
  proveedor VARCHAR(200),
  observaciones TEXT,
  createdAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE repuestos (
  id VARCHAR(100) PRIMARY KEY,
  vehicleId VARCHAR(100) NOT NULL FOREIGN KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  pieza VARCHAR(200),
  costo DECIMAL(10,2),
  proveedor VARCHAR(200),
  tipo VARCHAR(50),
  km INT,
  observaciones TEXT,
  createdAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE maintenance (
  id VARCHAR(100) PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL,
  vehiculoId VARCHAR(100) FOREIGN KEY REFERENCES vehicles(id),
  vehiculoPatente VARCHAR(20),
  vehiculoInterno VARCHAR(50),
  fechaRealizacion DATE,
  proximaFechaVencimiento DATE,
  kilometrajeHoras VARCHAR(50),
  descripcion TEXT,
  costo DECIMAL(10,2),
  responsable VARCHAR(200),
  estado VARCHAR(50),
  comprobanteURL VARCHAR(500),
  createdAt DATETIME DEFAULT GETDATE(),
  updatedAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE users (
  uid VARCHAR(100) PRIMARY KEY,
  role VARCHAR(20) DEFAULT 'Usuario',
  displayName VARCHAR(200),
  email VARCHAR(200) UNIQUE,
  passwordHash VARCHAR(255),
  createdAt DATETIME DEFAULT GETDATE(),
  updatedAt DATETIME DEFAULT GETDATE(),
  lastLoginAt DATETIME
);

CREATE TABLE counters (
  id VARCHAR(50) PRIMARY KEY,
  current INT DEFAULT 0
);
```

### Fase 2: Capa de datos (`config/database.js`)

Crear un adaptador que exponga las mismas funciones que Firestore para minimizar cambios:

```javascript
// config/database.js
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

const db = {
  async query(query, params = {}) {
    await poolConnect;
    const request = pool.request();
    Object.entries(params).forEach(([k, v]) => request.input(k, v));
    const result = await request.query(query);
    return result.recordset;
  },
  async get(collection, id) { /* SELECT ... WHERE id = @id */ },
  async add(collection, data) { /* INSERT INTO ... */ },
  async update(collection, id, data) { /* UPDATE ... SET ... WHERE id = @id */ },
  async delete(collection, id) { /* DELETE FROM ... WHERE id = @id */ },
  async list(collection, filters = {}) { /* SELECT * FROM ... WHERE ... */ }
};

module.exports = db;
```

### Fase 3: Reemplazar Firebase Auth por JWT

- En el servidor: `bcrypt` para hash de contraseñas + `jsonwebtoken` para sesiones
- Login: `POST /api/login` → verifica email+password contra tabla `users` → devuelve JWT
- Middleware: `verifyToken` verifica JWT en vez de `adminAuth.verifyIdToken()`
- Sesión SSR: JWT firmado con cookie httpOnly (mismo patrón que ahora)
- Registro: `POST /api/register` → crea user en tabla `users` con password hasheado
- Reemplazar `onAuthStateChanged()` por lectura de token desde localStorage + verificación

### Fase 4: Reemplazar `onSnapshot()` por polling

En los 7 archivos que usan `onSnapshot()`, reemplazar con:

```javascript
// Antes (Firestore)
unsub = onSnapshot(q, (snapshot) => { ... });

// Después (MSSQL + polling)
async function poll() {
  const res = await fetch('/api/vehicles');
  const data = await res.json();
  renderVehicles(data);
}
poll();
setInterval(poll, 30000); // cada 30 segundos
```

O mejor: implementar **Socket.IO** para notificaciones push:
```javascript
// Servidor
io.on('connection', (socket) => {
  socket.join('vehicles');
});
// Cuando alguien crea/actualiza/elimina un vehículo:
io.to('vehicles').emit('vehicles:updated', newData);

// Cliente
socket.on('vehicles:updated', (data) => { renderVehicles(data); });
```

### Fase 5: Reescribir rutas

Cada `routes/*.js` cambia de Firestore API a SQL queries. Ejemplo:

```javascript
// routes/vehicles.js - ANTES (Firestore)
const snapshot = await db.collection('vehicles').orderBy('interno', 'asc').get();
const vehicles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

// routes/vehicles.js - DESPUÉS (MSSQL)
const vehicles = await db.query('SELECT * FROM vehicles ORDER BY interno ASC');
```

### Fase 6: Reportes y agregaciones (el mayor beneficio)

Las queries que hoy necesitan 5-10 viajes a Firestore se resuelven en **una sola query SQL**:

```sql
-- Reporte financiero completo
SELECT 
  v.patente, v.interno, v.empresa,
  (SELECT SUM(importe) FROM combustible WHERE vehicleId = v.id) AS totalCombustible,
  (SELECT SUM(costo) FROM repuestos WHERE vehicleId = v.id) AS totalRepuestos,
  (SELECT SUM(costo) FROM maintenance WHERE vehiculoId = v.id) AS totalMantenimiento
FROM vehicles v
WHERE v.empresa IN (@empresas)
ORDER BY v.interno;
```

### Fase 7: Deploy y conexión Vercel

Agregar variables de entorno en Vercel (`vercel env add ...` o desde el dashboard):

**Para servidor empresa con IP pública:**
```
DB_SERVER=tcp:190.xxx.xxx.xxx,1433
DB_NAME=herramientas
DB_USER=sistema_web
DB_PASSWORD=xxxxx
DB_ENCRYPT=false
DB_TRUST_CERT=true
JWT_SECRET=xxxxx
```

**Para Azure SQL:**
```
DB_SERVER=tcp:falpat-sql.database.windows.net,1433
DB_NAME=herramientas
DB_USER=admin
DB_PASSWORD=xxxxx
DB_ENCRYPT=true
DB_TRUST_CERT=false
JWT_SECRET=xxxxx
```

**Para Cloudflare Tunnel:**
```
DB_SERVER=tcp:sql.tuempresa.com,443
DB_NAME=herramientas
DB_USER=sistema_web
DB_PASSWORD=xxxxx
DB_ENCRYPT=false
DB_TRUST_CERT=true
JWT_SECRET=xxxxx
```

⚠️ **Importante serverless:** Las conexiones de Vercel son efímeras. El pool de `mssql` se debe reconectar en cada función. Usar el patrón de pool lazy singleton de la sección anterior. Considerar también:
- **Prisma** como ORM (abstrae el pool y tiene adaptador serverless)
- **`@vercel/postgres`** si eventualmente migrás a PostgreSQL (tiene pooling nativo)
- **Caché** con `@vercel/kv` (Redis) para resultados de queries pesadas (dashboard, reportes)

---

## 📊 Comparativa de costos mensuales estimados

| Concepto | Firebase (Spark/Blaze) | Azure SQL Basic | MSSQL VPS propio |
|----------|------------------------|-----------------|------------------|
| Lecturas | $0 (Spark, limitado) / ~$10-30 (Blaze) | Fijo | Fijo |
| Escrituras | $0 (Spark) / ~$5-10 (Blaze) | Fijo | Fijo |
| Servidor | $0 | ~$5/mes | ~$10-20/mes |
| Almacenamiento | $0 (Spark, 1GB) / ~$0.18/GB | 2GB incluidos | 10GB (SQL Express) |
| Auth | $0 (Spark 50k MAU) | $0 (propio JWT) | $0 (propio JWT) |
| **Total** | **~$0-40/mes** | **~$5/mes fijo** | **~$10-20/mes fijo** |

---

## ✅ Recomendación final

Dado que tenés un servidor empresa con IP pública, **MSSQL es viable y tiene sentido**. Acá van las rutas ordenadas por esfuerzo:

### 🥇 Recomendado: Optimizar Firebase YA (días)
Es lo más rápido y te compra tiempo mientras implementás la migración:
1. Reemplazar `onSnapshot()` por `get()` con polling cada 30s — **reducción inmediata de ~90% de lecturas**
2. Cachear consultas repetitivas en `@vercel/kv` o en memoria global (solo si no estás en serverless)
3. Índices compuestos en Firestore para evitar lecturas de colecciones completas
4. Pasar a plan Blaze (pago por uso) — suele salir más barato que mantener SQL Server si optimizás

### 🥈 Migrar a MSSQL en servidor empresa (2-3 semanas)
Con IP pública o Cloudflare Tunnel, **es totalmente factible**:
- Usás SQL Server que ya tenés, sin costo adicional
- Reportes y agregaciones se vuelven triviales con JOINs
- Perdés tiempo real → implementar Socket.IO lo recupera
- Seguridad: Cloudflare Tunnel es la opción más segura, firewall de Windows es aceptable

### 🥉 Implementar Socket.IO + polling como paso intermedio
Podés hacer el cambio gradual:
1. Primero: reemplazar `onSnapshot()` por polling (solo frontend, sin tocar backend)
2. Después: migrar backend de Firestore a MSSQL
3. Finalmente: agregar Socket.IO para recuperar tiempo real

### Si preferís no mantener infraestructura:
**Supabase (PostgreSQL) o Azure SQL Database** son opciones cloud sin mantenimiento de servidores, pero la más económica es usar el server que ya tenés en la empresa.

---

## 📊 Análisis de costos Firebase 24x7 (a escala actual)

### Cálculo de lecturas diarias estimadas

Basado en el uso real del código (7 listeners `onSnapshot()`, ~30 vehículos, ~500 maintenance, ~7 usuarios concurrentes):

| Fuente | Lecturas/día |
|--------|-------------|
| 7 listeners `onSnapshot()` para 7 usuarios | 34,636 |
| API calls server-side (dashboard, reportes, CRUD) | 1,021 |
| **Total estimado por día** | **~35,657** |

### Límites del plan Spark (gratuito)

| Recurso | Límite Spark | Tu uso estimado | ¿Sobra? |
|---------|------------|----------------|---------|
| Lecturas/día | **50,000** | **~35,657** | ✅ **Sobran 14,343** |
| Escrituras/día | **20,000** | **~24** | ✅ **Sobra muchísimo** |
| Almacenamiento | **1 GiB** | **~50 MB** | ✅ **Sobra** |
| Auth (MAU) | **50,000/mes** | **~10 usuarios** | ✅ **Sobra** |

### Costos reales

| Escenario | Costo/mes |
|-----------|-----------|
| **Spark (Free)** — como está ahora | **$0.00** |
| **Blaze (pago por uso)** — misma carga | **$0.00** (todo dentro del free quota) |
| **Blaze** — escalando a 100 vehículos + 15 usuarios | **~$0.21** |
| **MSSQL en servidor empresa** — electricidad + mantenimiento | Costo indirecto |

### ¿Cuándo se acaba el gratis de Firebase?

| Crecimiento | Lecturas/día | ¿Pasa el límite Spark? | Costo Blaze |
|-------------|-------------|----------------------|------------|
| Actual (30 vehículos, 7 usuarios) | ~35,657 | ❌ No | $0.00/mes |
| 50 vehículos, 10 usuarios | ~55,000 | ✅ Sí (5k sobre) | ~$0.05/mes |
| 100 vehículos, 15 usuarios | ~95,000 | ✅ Sí (45k sobre) | ~$0.21/mes |
| 200 vehículos, 20 usuarios | ~180,000 | ✅ Sí | ~$0.47/mes |

Incluso si crecen 10x, **Firebase Blaze cuesta menos de $1.00/mes** con el volumen actual.

### Conclusión

**Con Firebase no tenés problema de costos hoy ni a futuro cercano.** El plan Spark free cubre tu carga actual con margen. Si querés sacarte la preocupación de encima:

1️⃣ **Opción A (nada):** Seguí en Spark — estás 28% por debajo del límite diario de lecturas  
2️⃣ **Opción B (seguro):** Pasá a Blaze — si un día te pasás, pagás centavos, nunca te cortan el servicio  
3️⃣ **Opción C (óptimo):** Pasá los 7 `onSnapshot()` a `get()` con polling cada 30s — las lecturas caen de ~35k/día a ~3k/día, y así tenés margen para crecer 10x sin salir del Spark
