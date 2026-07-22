# Migracion Firebase -> Supabase - Grupo Falpat SRL
# Guia de equivalencias y estrategia de migracion dual

## Equivalencias Firestore -> PostgreSQL

### Estructura de datos

| Firestore (NoSQL) | PostgreSQL (Relacional) |
|---|---|
| `vehicles` collection | `vehicles` table |
| `vehicles/{id}/combustible` subcollection | `combustible` table (FK `vehicle_id`) |
| `vehicles/{id}/repuestos` subcollection | `repuestos` table (FK `vehicle_id`) |
| `maintenance` collection | `maintenance` table |
| `users` collection | `users` table (FK a `auth.users`) |
| `tools` collection | `tools` table |
| `counters` document | `counters` table + function `get_next_vehicle_number()` |
| `vtv` nested map | Columnas planas `vtv_*` en `vehicles` |
| `seguro` nested map | Columnas planas `seguro_*` en `vehicles` |
| `trompo` nested map | Columnas planas `trompo_*` en `vehicles` |
| `multas[]` array | Columna JSONB `multas` en `vehicles` |
| `documentos[]` array | Columna JSONB `documentos` en `vehicles` |

### Autenticacion

| Firebase Auth | Supabase Auth |
|---|---|
| `firebase.auth().signInWithEmailAndPassword()` | `supabase.auth.signInWithPassword()` |
| `firebase.auth().createUserWithEmailAndPassword()` | `supabase.auth.signUp()` |
| `firebase.auth().signOut()` | `supabase.auth.signOut()` |
| `firebase.auth().signInWithRedirect(googleProvider)` | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| Session cookie (`__session`) | Supabase maneja sesion via PKCE/localStorage |
| `verifyIdToken()` + `verifySessionCookie()` | JWT verificado via `supabase.auth.getUser()` |

### Operaciones CRUD

| Firestore SDK (Client) | Supabase JS Client |
|---|---|
| `db.collection('vehicles').get()` | `supabase.from('vehicles').select('*')` |
| `db.collection('vehicles').doc(id).get()` | `supabase.from('vehicles').select('*').eq('id', id).single()` |
| `db.collection('vehicles').where('patente','==',p).get()` | `supabase.from('vehicles').select('*').eq('patente', p)` |
| `db.collection('vehicles').add(data)` | `supabase.from('vehicles').insert(data).select()` |
| `db.collection('vehicles').doc(id).update(data)` | `supabase.from('vehicles').update(data).eq('id', id)` |
| `db.collection('vehicles').doc(id).delete()` | `supabase.from('vehicles').delete().eq('id', id)` |
| `db.collection('vehicles').orderBy('interno').get()` | `supabase.from('vehicles').select('*').order('interno')` |
| `db.collection('vehicles').doc(id).collection('combustible').add(data)` | `supabase.from('combustible').insert({...data, vehicle_id: id}).select()` |
| Batch write (500 limit) | `supabase.from('table').insert([...manyRows])` (sin limite estricto) |
| Transaction (counters) | `supabase.rpc('get_next_vehicle_number')` |

### Realtime (suscripciones en tiempo real)

| Firestore | Supabase Realtime |
|---|---|
| `db.collection('vehicles').onSnapshot(cb)` | `supabase.channel('vehicles').on('postgres_changes', {event:'*', schema:'public', table:'vehicles'}, cb).subscribe()` |
| `unsub()` para cancelar | `supabase.removeChannel(channel)` |

**IMPORTANTE:** En Supabase, cada suscripcion realtime usa 1 conexion. Con 200 conexiones max en free tier, limitar a:
- Dashboard: suscripcion a `maintenance` (alertas) + `vehicles` (stats)
- Vehicles list: polling cada 30s en vez de realtime
- Vehicle detail: suscripcion a `combustible` + `repuestos` de ese vehiculo
- Maintenance: suscripcion a `maintenance`

### Seguridad (RLS vs Firestore Rules)

| Firestore Rules | Supabase RLS |
|---|---|
| `allow read: if request.auth != null` | `CREATE POLICY "select" ON table FOR SELECT USING (auth.uid() IS NOT NULL)` |
| `allow write: if role == 'Admin'` | `CREATE POLICY "write" ON table FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='Admin'))` |
| `allow update: if owner` | `CREATE POLICY "update_own" ON table FOR UPDATE USING (auth.uid() = user_id)` |

### Funciones de base de datos

| Firestore (client-side logic) | PostgreSQL (server-side) |
|---|---|
| `getNextVehicleNumber()` (transaction) | `SELECT get_next_vehicle_number()` (RPC) |
| N+1 queries en admin.js | `SELECT * FROM vw_dashboard_financial` (vista materializada) |
| Filtros en client-side | `WHERE` clauses en queries SQL |
| Agregacion en JavaScript | `SUM()`, `COUNT()`, `GROUP BY()` en SQL |

---

## Estrategia de migracion dual (2 semanas)

### Fase 1: Preparar Supabase (dia 1-2)
1. Crear proyecto en Supabase
2. Ejecutar `001_schema_inicial.sql`
3. Configurar variables de entorno en Vercel
4. Instalar `@supabase/supabase-js` en el proyecto

### Fase 2: Backend dual (dia 3-5)
1. Crear `config/supabase.js` (ya creado)
2. Crear archivos de rutas paralelos:
   - `routes/supabase/vehicles.js` (mismos endpoints, usando Supabase client)
   - `routes/supabase/maintenance.js`
   - `routes/supabase/admin.js`
   - `routes/supabase/auth.js`
3. Feature flag: `USE_SUPABASE=true` en .env para cambiar entre backends
4. Mantener Firebase como default

### Fase 3: Frontend dual (dia 6-10)
1. Los archivos JS del frontend pueden usar directamente Supabase JS client
2. Crear `public/js/supabase-client.js` como alternativa a `auth-client.js`
3. Usar feature flag para elegir cual SDK usar en cada pagina
4. Probar cada pagina individualmente

### Fase 4: Datos y pruebas (dia 11-14)
1. Migrar datos existentes de Firestore a Supabase
2. Script de migracion: leer de Firebase Admin SDK, escribir en Supabase
3. Pruebas comparativas: medir tiempos de carga, lecturas, costos
4. Verificar que realtime funciona correctamente

---

## Queries de ejemplo (Firebase vs Supabase)

### Listar vehiculos ordenados

```javascript
// FIREBASE (actual)
const snap = await db.collection('vehicles').orderBy('interno', 'asc').get();
const vehicles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

// SUPABASE (nuevo)
const { data: vehicles } = await supabase
  .from('vehicles')
  .select('*')
  .order('interno', { ascending: true });
```

### Dashboard financiero (N+1 -> 1 query)

```javascript
// FIREBASE (actual - N+1 queries)
const vehiclesSnap = await db.collection('vehicles').get();
const results = [];
for (const vDoc of vehiclesSnap.docs) {
  const cSnap = await vDoc.ref.collection('combustible').orderBy('fecha','desc').limit(100).get();
  const rSnap = await vDoc.ref.collection('repuestos').get();
  // ... agregar a results
}

// SUPABASE (1 query con vista)
const { data: results } = await supabase
  .from('vw_dashboard_financial')
  .select('*')
  .order('total_general', { ascending: false });
```

### Reporte con filtros

```javascript
// FIREBASE (actual - filtra en JavaScript)
const allData = await fetchReportData(); // N+1 queries
const filtered = allData.filter(item =>
  item.fecha >= desde && item.fecha <= hasta &&
  (categoria === 'todas' || item.categoria === categoria)
);

// SUPABASE (filtra en SQL)
let query = supabase.from('vw_reporte_gastos').select('*');
if (desde) query = query.gte('fecha', desde);
if (hasta) query = query.lte('fecha', hasta);
if (categoria !== 'todas') query = query.eq('categoria', categoria);
if (vehiculo !== 'todos') query = query.eq('vehiculo_patente', vehiculo);
const { data: filtered } = await query.order('fecha_orden', { ascending: false });
```

### Realtime listener

```javascript
// FIREBASE (actual)
const unsub = db.collection('vehicles').orderBy('interno').onSnapshot(snap => {
  renderVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

// SUPABASE (nuevo)
const channel = supabase
  .channel('vehicles-changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'vehicles' },
    (payload) => {
      // Recargar datos o manejar payload.new / payload.old
      loadVehicles();
    }
  )
  .subscribe();

// Para cancelar:
supabase.removeChannel(channel);
```

### Obtener siguiente numero interno

```javascript
// FIREBASE (actual - transaccion client-side)
const nextNum = await getNextVehicleNumber(); // transaccion en counters

// SUPABASE (nuevo - RPC server-side)
const { data: nextNum } = await supabase.rpc('get_next_vehicle_number');
// Retorna: 'V-00012'
```

### Paginacion (nuevo en Supabase)

```javascript
// No existia en Firebase - se agrega funcionalidad
const PAGE_SIZE = 20;
const { data: vehicles, count } = await supabase
  .from('vehicles')
  .select('*', { count: 'exact' })
  .order('interno')
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
// count = total de registros para paginacion
```

---

## Variables de entorno nuevas para .env

```bash
# Supabase
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_KEY=<service-role-key>

# Feature flag (Firebase por defecto)
USE_SUPABASE=false
```

---

## Medicion de impacto (para las 2 semanas de prueba)

### Metricas a comparar

| Metrica | Firebase | Supabase | Como medir |
|---|---|---|---|
| Lecturas por dia | Firebase Console > Usage | Supabase Dashboard > Metrics | Comparar en horas pico |
| Latencia de carga inicial | Chrome DevTools > Network | Chrome DevTools > Network | Promedio de 10 loads |
| Latencia de realtime update | Cronometro manual | Cronometro manual | Tiempo entre write y UI update |
| Costo mensual estimado | Firebase pricing calculator | Supabase free tier | Proyectar con uso real |
| Errores de quota | Firebase Console alerts | Supabase Dashboard logs | Monitorear ambos |

### Como ejecutar en paralelo

1. **Mantener Firebase como default** (`USE_SUPABASE=false`)
2. **Crear branch/test con Supabase** (`USE_SUPABASE=true`)
3. **Ambos apuntan a la misma DB** (copiar datos iniciales)
4. **Medir durante 2 semanas** usando las metricas arriba
5. **Decidir** basado en datos reales
