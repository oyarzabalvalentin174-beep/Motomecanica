-- PostgreSQL (schema app). Ejecutar en Supabase SQL editor o psql.

CREATE TABLE IF NOT EXISTS app.presupuesto (
  id SERIAL PRIMARY KEY,
  nombre_persona VARCHAR(200) NOT NULL,
  observaciones TEXT,
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presupuesto_fecha ON app.presupuesto (fecha_actualizacion DESC);

CREATE TABLE IF NOT EXISTS app.presupuesto_linea (
  id SERIAL PRIMARY KEY,
  presupuesto_id INTEGER NOT NULL REFERENCES app.presupuesto (id) ON DELETE CASCADE,
  parametro VARCHAR(100) NOT NULL,
  valor VARCHAR(255),
  notas TEXT
);

CREATE INDEX IF NOT EXISTS idx_presupuesto_linea_pres ON app.presupuesto_linea (presupuesto_id);

-- Cantidad × precio (ejecutar también si la tabla ya existía sin estas columnas)
ALTER TABLE app.presupuesto_linea ADD COLUMN IF NOT EXISTS cantidad NUMERIC(14, 4) NOT NULL DEFAULT 1;
ALTER TABLE app.presupuesto_linea ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(14, 2);

ALTER TABLE app.presupuesto ADD COLUMN IF NOT EXISTS datos_vehiculo TEXT;
ALTER TABLE app.presupuesto ADD COLUMN IF NOT EXISTS km NUMERIC(14, 1);
ALTER TABLE app.presupuesto ADD COLUMN IF NOT EXISTS fecha_entrega_estimada DATE;
ALTER TABLE app.presupuesto ADD COLUMN IF NOT EXISTS fecha_entrega_comprometida DATE;
ALTER TABLE app.presupuesto ADD COLUMN IF NOT EXISTS monto_entrega NUMERIC(14, 2);
ALTER TABLE app.presupuesto ADD COLUMN IF NOT EXISTS fecha_monto_entrega DATE;

-- Entregas / señas acumuladas (una fila por cada entrega; fecha automática en servidor)
CREATE TABLE IF NOT EXISTS app.presupuesto_entrega (
  id SERIAL PRIMARY KEY,
  presupuesto_id INTEGER NOT NULL REFERENCES app.presupuesto (id) ON DELETE CASCADE,
  monto NUMERIC(14, 2) NOT NULL CHECK (monto > 0),
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presupuesto_entrega_pres ON app.presupuesto_entrega (presupuesto_id);

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.spgetpresupuestos ()
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  r json;
BEGIN
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', p.id,
        'nombre_persona', p.nombre_persona,
        'observaciones', p.observaciones,
        'fecha_actualizacion', p.fecha_actualizacion
      )
      ORDER BY p.fecha_actualizacion DESC NULLS LAST, p.id DESC
    ),
    '[]'::json
  )
  INTO r
  FROM app.presupuesto p;

  RETURN json_build_object('status', 'success', 'data', r);
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.spgetpresupuesto (ppresupuesto_id integer)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  r json;
  plines json;
  pent json;
  v_total_ent numeric;
BEGIN
  IF ppresupuesto_id IS NULL OR ppresupuesto_id <= 0 THEN
    RETURN json_build_object('status', 'error', 'message', 'presupuesto_id invalido');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM app.presupuesto WHERE id = ppresupuesto_id) THEN
    RETURN json_build_object('status', 'error', 'message', 'El presupuesto no existe');
  END IF;

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', l.id,
        'parametro', l.parametro,
        'valor', l.valor,
        'notas', l.notas,
        'presupuesto_id', l.presupuesto_id,
        'cantidad', l.cantidad,
        'precio_unitario', l.precio_unitario
      )
      ORDER BY l.id
    ),
    '[]'::json
  )
  INTO plines
  FROM app.presupuesto_linea l
  WHERE l.presupuesto_id = ppresupuesto_id;

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', e.id,
        'monto', e.monto,
        'fecha_registro', e.fecha_registro
      )
      ORDER BY e.fecha_registro ASC, e.id ASC
    ),
    '[]'::json
  )
  INTO pent
  FROM app.presupuesto_entrega e
  WHERE e.presupuesto_id = ppresupuesto_id;

  SELECT COALESCE(SUM(e.monto), 0)
  INTO v_total_ent
  FROM app.presupuesto_entrega e
  WHERE e.presupuesto_id = ppresupuesto_id;

  SELECT json_build_object(
    'id', p.id,
    'nombre_persona', p.nombre_persona,
    'observaciones', p.observaciones,
    'fecha_actualizacion', p.fecha_actualizacion,
    'datos_vehiculo', p.datos_vehiculo,
    'km', p.km,
    'fecha_entrega_estimada', p.fecha_entrega_estimada,
    'fecha_entrega_comprometida', p.fecha_entrega_comprometida,
    'entregas', pent,
    'total_entregas', v_total_ent,
    'lineas', plines
  )
  INTO r
  FROM app.presupuesto p
  WHERE p.id = ppresupuesto_id;

  RETURN json_build_object('status', 'success', 'data', r);
END;
$$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.spupsertpresupuesto (pdata json, pid_usuario integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_id integer;
  v_pid integer;
  v_nom text;
  v_obs text;
  v_elim boolean;
  item json;
  v_lid integer;
  v_param text;
  v_valor text;
  v_notas text;
  v_lelim boolean;
  v_cant numeric;
  v_precio numeric;
  v_datos_veh text;
  v_km numeric;
  v_f_est date;
  v_f_comp date;
  v_nueva_entrega numeric;
BEGIN
  IF pdata IS NULL OR json_typeof(pdata) <> 'object' THEN
    RETURN json_build_object('status', 'error', 'message', 'payload debe ser un objeto JSON');
  END IF;

  v_elim := COALESCE((pdata->>'eliminar')::boolean, false);

  IF (pdata::jsonb) ? 'id' AND pdata->>'id' IS NOT NULL AND btrim(pdata->>'id') <> '' THEN
    v_id := (pdata->>'id')::integer;
  ELSE
    v_id := NULL;
  END IF;

  IF v_elim THEN
    IF v_id IS NULL THEN
      RETURN json_build_object('status', 'error', 'message', 'id requerido para eliminar');
    END IF;
    DELETE FROM app.presupuesto WHERE id = v_id;
    RETURN json_build_object('status', 'success', 'id', NULL::integer);
  END IF;

  v_nom := btrim(COALESCE(pdata->>'nombre_persona', ''));
  IF v_nom = '' THEN
    RETURN json_build_object('status', 'error', 'message', 'El nombre de la persona es obligatorio');
  END IF;

  v_obs := NULL;
  IF (pdata::jsonb) ? 'observaciones' AND pdata->>'observaciones' IS NOT NULL THEN
    v_obs := NULLIF(btrim(pdata->>'observaciones'), '');
  END IF;

  v_datos_veh := NULL;
  IF (pdata::jsonb) ? 'datos_vehiculo' AND pdata->>'datos_vehiculo' IS NOT NULL THEN
    v_datos_veh := NULLIF(btrim(pdata->>'datos_vehiculo'), '');
  END IF;

  v_km := NULL;
  IF (pdata::jsonb) ? 'km' AND pdata->>'km' IS NOT NULL AND btrim(pdata->>'km') <> '' THEN
    BEGIN
      v_km := (pdata->>'km')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_km := NULL;
    END;
  END IF;

  v_f_est := NULL;
  IF (pdata::jsonb) ? 'fecha_entrega_estimada' AND pdata->>'fecha_entrega_estimada' IS NOT NULL AND btrim(pdata->>'fecha_entrega_estimada') <> '' THEN
    BEGIN
      v_f_est := (pdata->>'fecha_entrega_estimada')::date;
    EXCEPTION WHEN OTHERS THEN
      v_f_est := NULL;
    END;
  END IF;

  v_f_comp := NULL;
  IF (pdata::jsonb) ? 'fecha_entrega_comprometida' AND pdata->>'fecha_entrega_comprometida' IS NOT NULL AND btrim(pdata->>'fecha_entrega_comprometida') <> '' THEN
    BEGIN
      v_f_comp := (pdata->>'fecha_entrega_comprometida')::date;
    EXCEPTION WHEN OTHERS THEN
      v_f_comp := NULL;
    END;
  END IF;

  v_nueva_entrega := NULL;
  IF (pdata::jsonb) ? 'nueva_entrega_monto' AND pdata->>'nueva_entrega_monto' IS NOT NULL AND btrim(pdata->>'nueva_entrega_monto') <> '' THEN
    BEGIN
      v_nueva_entrega := (pdata->>'nueva_entrega_monto')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_nueva_entrega := NULL;
    END;
  END IF;

  IF v_nueva_entrega IS NOT NULL AND v_nueva_entrega <= 0 THEN
    v_nueva_entrega := NULL;
  END IF;

  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM app.presupuesto WHERE id = v_id) THEN
    UPDATE app.presupuesto
    SET nombre_persona = v_nom,
        observaciones = v_obs,
        datos_vehiculo = v_datos_veh,
        km = v_km,
        fecha_entrega_estimada = v_f_est,
        fecha_entrega_comprometida = v_f_comp,
        fecha_actualizacion = now()
    WHERE id = v_id;
    v_pid := v_id;
  ELSE
    INSERT INTO app.presupuesto (
      nombre_persona,
      observaciones,
      datos_vehiculo,
      km,
      fecha_entrega_estimada,
      fecha_entrega_comprometida
    )
    VALUES (v_nom, v_obs, v_datos_veh, v_km, v_f_est, v_f_comp)
    RETURNING id INTO v_pid;
  END IF;

  IF v_nueva_entrega IS NOT NULL THEN
    INSERT INTO app.presupuesto_entrega (presupuesto_id, monto)
    VALUES (v_pid, v_nueva_entrega);
  END IF;

  IF pdata->'lineas' IS NULL OR json_typeof(pdata->'lineas') <> 'array' THEN
    RETURN json_build_object('status', 'success', 'id', v_pid);
  END IF;

  FOR item IN SELECT * FROM json_array_elements(pdata->'lineas')
  LOOP
    v_lelim := COALESCE((item->>'eliminar')::boolean, false);

    IF (item::jsonb) ? 'id' AND item->>'id' IS NOT NULL AND btrim(item->>'id') <> '' THEN
      v_lid := (item->>'id')::integer;
    ELSE
      v_lid := NULL;
    END IF;

    IF v_lelim THEN
      IF v_lid IS NOT NULL THEN
        DELETE FROM app.presupuesto_linea WHERE id = v_lid AND presupuesto_id = v_pid;
      END IF;
      CONTINUE;
    END IF;

    v_param := btrim(COALESCE(item->>'parametro', ''));
    IF v_param = '' THEN
      CONTINUE;
    END IF;

    v_cant := COALESCE(NULLIF(btrim(COALESCE(item->>'cantidad', '')), '')::numeric, 1);
    IF v_cant <= 0 THEN
      v_cant := 1;
    END IF;

    v_precio := 0;
    IF (item::jsonb) ? 'precio_unitario' AND item->>'precio_unitario' IS NOT NULL AND btrim(item->>'precio_unitario') <> '' THEN
      BEGIN
        v_precio := (item->>'precio_unitario')::numeric;
      EXCEPTION WHEN OTHERS THEN
        v_precio := 0;
      END;
    END IF;

    v_valor := NULL;
    IF (item::jsonb) ? 'valor' AND item->>'valor' IS NOT NULL THEN
      v_valor := NULLIF(btrim(item->>'valor'), '');
    END IF;

    v_notas := NULL;
    IF (item::jsonb) ? 'notas' AND item->>'notas' IS NOT NULL THEN
      v_notas := NULLIF(btrim(item->>'notas'), '');
    END IF;

    IF v_lid IS NOT NULL AND EXISTS (
      SELECT 1 FROM app.presupuesto_linea pl WHERE pl.id = v_lid AND pl.presupuesto_id = v_pid
    ) THEN
      UPDATE app.presupuesto_linea
      SET parametro = v_param,
          valor = v_valor,
          notas = v_notas,
          cantidad = v_cant,
          precio_unitario = v_precio
      WHERE id = v_lid AND presupuesto_id = v_pid;
    ELSE
      INSERT INTO app.presupuesto_linea (presupuesto_id, parametro, valor, notas, cantidad, precio_unitario)
      VALUES (v_pid, v_param, v_valor, v_notas, v_cant, v_precio);
    END IF;
  END LOOP;

  RETURN json_build_object('status', 'success', 'id', v_pid);
END;
$$;
