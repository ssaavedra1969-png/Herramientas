-- ============================================================
-- Grupo Falpat SRL - Sistema de Control de Mantenimiento
-- Migracion Firebase Firestore -> Supabase PostgreSQL
-- Fecha: 2026-07-15
-- ============================================================

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: users
-- Integrada con Supabase Auth (auth.users)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'Usuario' CHECK (role IN ('Admin', 'Usuario')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- RLS: Los usuarios solo ven su propio perfil. Admin ve todos.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "users_insert_self" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

-- ============================================================
-- TABLA: counters
-- Auto-increment para internos de vehiculos
-- ============================================================
CREATE TABLE counters (
  key TEXT PRIMARY KEY,
  current_value INTEGER NOT NULL DEFAULT 0
);

INSERT INTO counters (key, current_value) VALUES ('vehicles', 0);

ALTER TABLE counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "counters_read_auth" ON counters
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "counters_write_admin" ON counters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

-- ============================================================
-- FUNCION: Obtener siguiente numero interno de vehiculo
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_vehicle_number()
RETURNS TEXT AS $$
DECLARE
  next_val INTEGER;
  result TEXT;
BEGIN
  UPDATE counters SET current_value = current_value + 1 WHERE key = 'vehicles'
  RETURNING current_value INTO next_val;

  IF next_val IS NULL THEN
    INSERT INTO counters (key, current_value) VALUES ('vehicles', 1)
    RETURNING current_value INTO next_val;
  END IF;

  result := 'V-' || LPAD(next_val::TEXT, 5, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TABLA: vehicles
-- ============================================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interno TEXT UNIQUE NOT NULL,
  patente TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  ano INTEGER NOT NULL,
  chasis TEXT NOT NULL,
  tipo TEXT NOT NULL,
  subtipo TEXT DEFAULT '',
  numero_motor TEXT DEFAULT '',
  capacidad_carga NUMERIC,
  kilometraje INTEGER DEFAULT 0,
  horometro INTEGER DEFAULT 0,
  estado_general TEXT DEFAULT 'Bueno',
  fecha_ultima_revision TIMESTAMPTZ,
  proximo_service_km INTEGER,
  proximo_service_fecha TIMESTAMPTZ,
  centro_trabajo TEXT DEFAULT '',
  conductor_habitual TEXT DEFAULT '',
  empresa TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  foto_url TEXT DEFAULT '',
  carga_trompo TEXT DEFAULT '',

  -- VTV (nested map en Firestore)
  vtv_fecha_realizacion TIMESTAMPTZ,
  vtv_fecha_vencimiento TIMESTAMPTZ,
  vtv_costo NUMERIC,
  vtv_centro_medicion TEXT DEFAULT '',
  vtv_resultado TEXT DEFAULT 'Pendiente',

  -- Seguro (nested map en Firestore)
  seguro_compania TEXT DEFAULT '',
  seguro_poliza TEXT DEFAULT '',
  seguro_tipo TEXT DEFAULT '',
  seguro_fecha_vencimiento TIMESTAMPTZ,
  seguro_costo NUMERIC,

  -- Trompo (nested map en Firestore)
  trompo_tipo TEXT DEFAULT '',
  trompo_numero_serie TEXT DEFAULT '',
  trompo_marca TEXT DEFAULT '',
  trompo_capacidad TEXT DEFAULT '',
  trompo_modelo TEXT DEFAULT '',
  trompo_otro TEXT DEFAULT '',

  -- Multas y Documentos (arrays en Firestore, JSONB en Postgres)
  multas JSONB DEFAULT '[]'::jsonb,
  documentos JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_alta TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Indices para buses frecuentes
CREATE INDEX idx_vehicles_patente ON vehicles (patente);
CREATE INDEX idx_vehicles_interno ON vehicles (interno);
CREATE INDEX idx_vehicles_tipo ON vehicles (tipo);
CREATE INDEX idx_vehicles_empresa ON vehicles (empresa);
CREATE INDEX idx_vehicles_centro_trabajo ON vehicles (centro_trabajo);
CREATE INDEX idx_vehicles_estado ON vehicles (estado_general);

-- RLS: Lectura para todos los autenticados, escritura solo Admin
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select_auth" ON vehicles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "vehicles_insert_admin" ON vehicles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "vehicles_update_admin" ON vehicles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "vehicles_delete_admin" ON vehicles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

-- ============================================================
-- TABLA: combustible
-- Equivalente a subcollection vehicles/{id}/combustible
-- ============================================================
CREATE TABLE combustible (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  fecha TIMESTAMPTZ DEFAULT now(),
  litros NUMERIC NOT NULL,
  importe NUMERIC NOT NULL,
  tipo TEXT DEFAULT 'Gasoil',
  km INTEGER,
  proveedor TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_combustible_vehicle ON combustible (vehicle_id);
CREATE INDEX idx_combustible_fecha ON combustible (fecha DESC);

ALTER TABLE combustible ENABLE ROW LEVEL SECURITY;

CREATE POLICY "combustible_select_auth" ON combustible
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "combustible_insert_admin" ON combustible
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "combustible_delete_admin" ON combustible
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

-- ============================================================
-- TABLA: repuestos
-- Equivalente a subcollection vehicles/{id}/repuestos
-- ============================================================
CREATE TABLE repuestos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  fecha TIMESTAMPTZ DEFAULT now(),
  pieza TEXT NOT NULL,
  costo NUMERIC NOT NULL,
  proveedor TEXT DEFAULT '',
  tipo TEXT DEFAULT 'Mantenimiento',
  km INTEGER,
  observaciones TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repuestos_vehicle ON repuestos (vehicle_id);
CREATE INDEX idx_repuestos_fecha ON repuestos (fecha DESC);

ALTER TABLE repuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repuestos_select_auth" ON repuestos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "repuestos_insert_admin" ON repuestos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "repuestos_delete_admin" ON repuestos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

-- ============================================================
-- TABLA: maintenance
-- ============================================================
CREATE TABLE maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL CHECK (tipo IN ('Mecanico', 'Legal')),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vehiculo_patente TEXT,
  vehiculo_interno TEXT,
  fecha_realizacion TIMESTAMPTZ,
  proxima_fecha_vencimiento TIMESTAMPTZ,
  kilometraje_horas INTEGER,
  descripcion TEXT NOT NULL,
  costo NUMERIC,
  responsable TEXT NOT NULL,
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En curso', 'Realizado', 'Vencido')),
  comprobante_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_maintenance_fecha ON maintenance (fecha_realizacion DESC);
CREATE INDEX idx_maintenance_estado ON maintenance (estado);
CREATE INDEX idx_maintenance_tipo ON maintenance (tipo);
CREATE INDEX idx_maintenance_vehicle ON maintenance (vehicle_id);
CREATE INDEX idx_maintenance_vencimiento ON maintenance (proxima_fecha_vencimiento);

ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede crear (como en Firebase)
CREATE POLICY "maintenance_select_auth" ON maintenance
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "maintenance_insert_auth" ON maintenance
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "maintenance_update_admin" ON maintenance
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "maintenance_delete_admin" ON maintenance
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

-- ============================================================
-- TABLA: tools
-- Herramientas (existe en backups pero sin UI actualmente)
-- ============================================================
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_interno TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  tipo_herramienta TEXT NOT NULL,
  categoria TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  numero_serie TEXT NOT NULL,
  valor_compra NUMERIC NOT NULL,
  fecha_compra TIMESTAMPTZ NOT NULL,
  proveedor TEXT NOT NULL,
  garantia_vence TIMESTAMPTZ NOT NULL,
  estado_general TEXT NOT NULL DEFAULT 'Bueno',
  ubicacion_actual TEXT NOT NULL,
  responsable_actual TEXT NOT NULL,
  fecha_ultimo_control TIMESTAMPTZ NOT NULL,
  proximo_control TIMESTAMPTZ NOT NULL,
  tiempo_uso_acumulado INTEGER DEFAULT 0,
  observaciones TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_tools_codigo ON tools (codigo_interno);
CREATE INDEX idx_tools_tipo ON tools (tipo_herramienta);

ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tools_select_auth" ON tools
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tools_insert_admin" ON tools
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "tools_update_admin" ON tools
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "tools_delete_admin" ON tools
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'Admin')
  );

-- ============================================================
-- FUNCION: Auto-crear usuario en users cuando se registra
-- Trigger sobre auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM users LIMIT 1) INTO is_first;

  INSERT INTO users (id, email, display_name, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    CASE WHEN is_first THEN 'Admin' ELSE 'Usuario' END,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: cuando se crea un usuario en auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNCION: Actualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_maintenance_updated_at
  BEFORE UPDATE ON maintenance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VISTA: Dashboard financiero
-- Reemplaza el patron N+1 de Firebase con JOINs
-- ============================================================
CREATE OR REPLACE VIEW vw_dashboard_financial AS
SELECT
  v.id AS vehicle_id,
  v.patente,
  v.interno,
  v.marca,
  v.modelo,
  v.tipo,
  v.empresa,

  -- Totales combustible por vehiculo
  COALESCE(SUM(c.importe), 0) AS total_combustible,
  COALESCE(SUM(c.litros), 0) AS total_litros,

  -- Total repuestos por vehiculo
  COALESCE(SUM(r.costo), 0) AS total_repuestos,

  -- Costos VTV y Seguro
  COALESCE(v.vtv_costo, 0) AS vtv_costo,
  COALESCE(v.seguro_costo, 0) AS seguro_costo,

  -- Total general por vehiculo
  COALESCE(SUM(c.importe), 0) +
  COALESCE(SUM(r.costo), 0) +
  COALESCE(v.vtv_costo, 0) +
  COALESCE(v.seguro_costo, 0) AS total_general

FROM vehicles v
LEFT JOIN combustible c ON c.vehicle_id = v.id
LEFT JOIN repuestos r ON r.vehicle_id = v.id
GROUP BY v.id, v.patente, v.interno, v.marca, v.modelo, v.tipo, v.empresa,
         v.vtv_costo, v.seguro_costo;

-- ============================================================
-- VISTA: Reporte de gastos por categoria y fecha
-- Reemplaza el endpoint /api/admin/report
-- ============================================================
CREATE OR REPLACE VIEW vw_reporte_gastos AS
SELECT
  'Combustible' AS categoria,
  c.fecha,
  c.fecha AS fecha_orden,
  v.patente AS vehiculo_patente,
  v.interno AS vehiculo_interno,
  v.marca || ' ' || v.modelo AS vehiculo_descripcion,
  c.tipo || ' - ' || c.proveedor AS detalle,
  c.importe AS monto,
  v.empresa
FROM combustible c
JOIN vehicles v ON v.id = c.vehicle_id

UNION ALL

SELECT
  'Repuestos' AS categoria,
  r.fecha,
  r.fecha AS fecha_orden,
  v.patente AS vehiculo_patente,
  v.interno AS vehiculo_interno,
  v.marca || ' ' || v.modelo AS vehiculo_descripcion,
  r.pieza || ' - ' || r.proveedor AS detalle,
  r.costo AS monto,
  v.empresa
FROM repuestos r
JOIN vehicles v ON v.id = r.vehicle_id

UNION ALL

SELECT
  'Mantenimiento' AS categoria,
  m.fecha_realizacion AS fecha,
  m.fecha_realizacion AS fecha_orden,
  m.vehiculo_patente,
  m.vehiculo_interno,
  '' AS vehiculo_descripcion,
  m.descripcion AS detalle,
  COALESCE(m.costo, 0) AS monto,
  '' AS empresa
FROM maintenance m

UNION ALL

SELECT
  'VTV' AS categoria,
  v.vtv_fecha_vencimiento AS fecha,
  v.vtv_fecha_realizacion AS fecha_orden,
  v.patente AS vehiculo_patente,
  v.interno AS vehiculo_interno,
  v.marca || ' ' || v.modelo AS vehiculo_descripcion,
  'VTV - ' || v.vtv_centro_medicion AS detalle,
  COALESCE(v.vtv_costo, 0) AS monto,
  v.empresa
FROM vehicles v
WHERE v.vtv_costo IS NOT NULL AND v.vtv_costo > 0

UNION ALL

SELECT
  'Seguro' AS categoria,
  v.seguro_fecha_vencimiento AS fecha,
  v.seguro_fecha_vencimiento AS fecha_orden,
  v.patente AS vehiculo_patente,
  v.interno AS vehiculo_interno,
  v.marca || ' ' || v.modelo AS vehiculo_descripcion,
  v.seguro_compania || ' - ' || v.seguro_poliza AS detalle,
  COALESCE(v.seguro_costo, 0) AS monto,
  v.empresa
FROM vehicles v
WHERE v.seguro_costo IS NOT NULL AND v.seguro_costo > 0;

-- ============================================================
-- VISTA: Alertas de mantenimiento vencidos/proximos
-- ============================================================
CREATE OR REPLACE VIEW vw_alertas_mantenimiento AS
SELECT
  m.id,
  m.tipo,
  m.descripcion,
  m.estado,
  m.fecha_realizacion,
  m.proxima_fecha_vencimiento,
  m.vehiculo_patente,
  m.vehiculo_interno,
  m.responsable,
  EXTRACT(DAY FROM m.proxima_fecha_vencimiento - now()) AS dias_restantes,
  CASE
    WHEN m.proxima_fecha_vencimiento <= now() THEN 'critical'
    WHEN m.proxima_fecha_vencimiento <= now() + INTERVAL '7 days' THEN 'warning'
    WHEN m.proxima_fecha_vencimiento <= now() + INTERVAL '15 days' THEN 'info'
    ELSE 'none'
  END AS alert_level
FROM maintenance m
WHERE m.estado != 'Realizado'
  AND m.proxima_fecha_vencimiento IS NOT NULL
ORDER BY m.proxima_fecha_vencimiento ASC
LIMIT 50;

-- ============================================================
-- VISTA: Alertas VTV de vehiculos
-- ============================================================
CREATE OR REPLACE VIEW vw_alertas_vtv AS
SELECT
  v.id,
  v.patente,
  v.interno,
  v.marca,
  v.modelo,
  v.vtv_fecha_vencimiento,
  v.vtv_resultado,
  EXTRACT(DAY FROM v.vtv_fecha_vencimiento - now()) AS dias_restantes,
  CASE
    WHEN v.vtv_fecha_vencimiento <= now() THEN 'critical'
    WHEN v.vtv_fecha_vencimiento <= now() + INTERVAL '7 days' THEN 'warning'
    WHEN v.vtv_fecha_vencimiento <= now() + INTERVAL '30 days' THEN 'info'
    ELSE 'none'
  END AS alert_level
FROM vehicles v
WHERE v.vtv_fecha_vencimiento IS NOT NULL
  AND v.estado_general != 'Baja'
ORDER BY v.vtv_fecha_vencimiento ASC;

-- ============================================================
-- REALTIME: Habilitar suscripciones en tiempo real
-- Solo las tablas necesarias para reducir conexiones
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE combustible;
ALTER PUBLICATION supabase_realtime ADD TABLE repuestos;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
