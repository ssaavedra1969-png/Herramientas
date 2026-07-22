// ============================================================
// Grupo Falpat SRL - Configuracion Supabase
// Archivo de referencia para migracion Firebase -> Supabase
// ============================================================
//
// INSTRUCCIONES:
// 1. Crear cuenta en https://supabase.com (gratis)
// 2. Crear nuevo proyecto (region: South America o US East)
// 3. Copiar las credenciales del proyecto a este archivo
// 4. Ejecutar el SQL de migrations/001_schema_inicial.sql
//    desde el SQL Editor del dashboard de Supabase
// 5. Instalar: npm install @supabase/supabase-js
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// Variables de entorno requeridas (agregar a .env)
// SUPABASE_URL=https://<project-id>.supabase.co
// SUPABASE_ANON_KEY=<anon-key-public>
// SUPABASE_SERVICE_KEY=<service-role-key-secret>

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Cliente para operaciones del servidor (bypass RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Cliente para el frontend (respeta RLS)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabaseAdmin, supabaseClient };
