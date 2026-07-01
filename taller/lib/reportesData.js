import { exec, query } from "@/components/db";
import { normalizeSpList, unwrapSpEntity } from "@/lib/execHelpers";

const TZ = "America/Argentina/Buenos_Aires";

export function resolveRange({ desde, hasta, periodo = "mes", fecha_ref }) {
  if (desde && hasta) return { desde, hasta };
  const ref = fecha_ref || new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  if (periodo === "dia") return { desde: ref, hasta: ref };
  if (periodo === "anio") {
    const d = new Date(`${ref}T12:00:00`);
    d.setDate(d.getDate() - 364);
    return { desde: d.toISOString().slice(0, 10), hasta: ref };
  }
  if (periodo === "semana") {
    const d = new Date(`${ref}T12:00:00`);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    const desdeW = d.toISOString().slice(0, 10);
    const end = new Date(`${desdeW}T12:00:00`);
    end.setDate(end.getDate() + 6);
    return { desde: desdeW, hasta: end.toISOString().slice(0, 10) };
  }
  const end = new Date(`${ref}T12:00:00`);
  const hastaM = new Date(end.getFullYear(), end.getMonth() + 1, 0);
  const desdeM = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  return {
    desde: desdeM.toISOString().slice(0, 10),
    hasta: hastaM.toISOString().slice(0, 10),
  };
}

function mapPresupuestoListaItem(p) {
  const id = Number(p?.id ?? p?.id_presupuesto ?? 0);
  const nombre = String(p?.nombre_persona ?? p?.nombre ?? "").trim();
  return {
    id,
    nombre_persona: nombre || "Sin nombre",
    observaciones: p?.observaciones ?? null,
    fecha_actualizacion: p?.fecha_actualizacion ?? null,
  };
}

export async function fetchPresupuestosLista() {
  try {
    const raw = await exec("spgetpresupuestos", {});
    if (raw?.status === "error") throw new Error(raw.message || "Error al listar presupuestos");
    const list = normalizeSpList(raw).map(mapPresupuestoListaItem).filter((p) => p.id > 0);
    if (list.length > 0) return list;
  } catch (e) {
    if (!String(e?.message ?? "").includes("spgetpresupuestos")) throw e;
  }
  const rows = await query(
    `SELECT id, nombre_persona, observaciones, fecha_actualizacion
     FROM app.presupuesto
     ORDER BY fecha_actualizacion DESC NULLS LAST, id DESC`,
  );
  return rows.map(mapPresupuestoListaItem);
}

export async function fetchPresupuestoDetalle(id) {
  try {
    const raw = await exec("spgetpresupuesto", { presupuesto_id: id });
    const entity = unwrapSpEntity(raw, ["id", "nombre_persona", "lineas"]);
    if (entity) return entity;
  } catch (e) {
    if (!String(e?.message ?? "").includes("spgetpresupuesto")) throw e;
  }
  const [row] = await query(
    `SELECT p.id, p.nombre_persona, p.observaciones, p.fecha_actualizacion, p.fecha_elaboracion,
            p.datos_vehiculo, p.km, p.fecha_entrega_estimada, p.fecha_entrega_comprometida
     FROM app.presupuesto p WHERE p.id = $1`,
    [id],
  );
  if (!row) return null;
  const lineas = await query(
    `SELECT id, parametro, valor, notas, cantidad, precio_unitario, presupuesto_id
     FROM app.presupuesto_linea WHERE presupuesto_id = $1 ORDER BY id`,
    [id],
  );
  const entregas = await query(
    `SELECT id, monto, fecha_registro FROM app.presupuesto_entrega
     WHERE presupuesto_id = $1 ORDER BY fecha_registro`,
    [id],
  );
  const totalEntregas = entregas.reduce((s, e) => s + Number(e.monto ?? 0), 0);
  return { ...row, lineas, entregas, total_entregas: totalEntregas };
}

export async function fetchVentasAgrupadas(agrupacion, range) {
  const { desde, hasta } = range;
  if (agrupacion === "semana") {
    return query(
      `SELECT
         CASE EXTRACT(DOW FROM (v.fecha AT TIME ZONE $3)::date)
           WHEN 0 THEN 'Domingo'
           WHEN 1 THEN 'Lunes'
           WHEN 2 THEN 'Martes'
           WHEN 3 THEN 'Miércoles'
           WHEN 4 THEN 'Jueves'
           WHEN 5 THEN 'Viernes'
           WHEN 6 THEN 'Sábado'
         END AS periodo,
         EXTRACT(DOW FROM (v.fecha AT TIME ZONE $3)::date)::int AS orden,
         COUNT(*)::int AS cantidad_ventas,
         SUM(COALESCE(v.total, 0))::numeric(14,2) AS total_facturado,
         SUM(COALESCE(v.subtotal, 0))::numeric(14,2) AS subtotal
       FROM app.venta v
       WHERE (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY 2, 1
       ORDER BY orden`,
      [desde, hasta, TZ],
    );
  }
  return query(
    `SELECT
       to_char(date_trunc('month', (v.fecha AT TIME ZONE $3)::date), 'YYYY-MM') AS periodo,
       date_trunc('month', (v.fecha AT TIME ZONE $3)::date)::date AS orden,
       COUNT(*)::int AS cantidad_ventas,
       SUM(COALESCE(v.total, 0))::numeric(14,2) AS total_facturado,
       SUM(COALESCE(v.subtotal, 0))::numeric(14,2) AS subtotal
     FROM app.venta v
     WHERE (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
     GROUP BY 1, 2
     ORDER BY orden`,
    [desde, hasta, TZ],
  );
}

export async function fetchMarcasResumen(range) {
  const { desde, hasta } = range;
  return query(
    `SELECT
       m.nombre AS marca,
       COUNT(DISTINCT p.id_producto)::int AS productos_activos,
       COALESCE(SUM(GREATEST(p.stock, 0)), 0)::bigint AS unidades_stock,
       COALESCE(SUM(dv.cantidad), 0)::bigint AS unidades_vendidas,
       COALESCE(SUM(dv.cantidad * dv.precio_unitario), 0)::numeric(14,2) AS total_venta,
       COALESCE(SUM(dv.cantidad * COALESCE(p.precio_compra, 0)), 0)::numeric(14,2) AS costo,
       COALESCE(SUM(dv.cantidad * (dv.precio_unitario - COALESCE(p.precio_compra, 0))), 0)::numeric(14,2) AS ganancia
     FROM app.marca m
     LEFT JOIN app.producto p
       ON p.marca_id = m.id_marca AND COALESCE(p.archivado, FALSE) = FALSE
     LEFT JOIN app.detalle_venta dv ON dv.id_producto = p.id_producto
     LEFT JOIN app.venta v ON v.id_venta = dv.id_venta
       AND (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
     GROUP BY m.id_marca, m.nombre
     ORDER BY total_venta DESC NULLS LAST, m.nombre ASC`,
    [desde, hasta, TZ],
  );
}

export async function fetchProductoResumen(range) {
  const { desde, hasta } = range;
  return query(
    `SELECT
       p.codigo,
       p.nombre AS producto,
       m.nombre AS marca,
       COUNT(DISTINCT v.id_venta)::int AS veces_vendido,
       COALESCE(SUM(dv.cantidad), 0)::bigint AS unidades,
       COALESCE(SUM(dv.cantidad * dv.precio_unitario), 0)::numeric(14,2) AS total_venta,
       COALESCE(SUM(dv.cantidad * COALESCE(p.precio_compra, 0)), 0)::numeric(14,2) AS costo,
       COALESCE(SUM(dv.cantidad * (dv.precio_unitario - COALESCE(p.precio_compra, 0))), 0)::numeric(14,2) AS ganancia,
       COALESCE(AVG(dv.precio_unitario), 0)::numeric(14,2) AS precio_promedio
     FROM app.producto p
     LEFT JOIN app.marca m ON m.id_marca = p.marca_id
     LEFT JOIN app.detalle_venta dv ON dv.id_producto = p.id_producto
     LEFT JOIN app.venta v ON v.id_venta = dv.id_venta
       AND (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
     WHERE COALESCE(p.archivado, FALSE) = FALSE
     GROUP BY p.id_producto, p.codigo, p.nombre, m.nombre
     HAVING COALESCE(SUM(dv.cantidad), 0) > 0
     ORDER BY unidades DESC, p.nombre ASC`,
    [desde, hasta, TZ],
  );
}

export async function fetchMarcaDetalle(range) {
  const rows = await fetchMarcasResumen(range);
  return rows.filter((r) => Number(r.unidades_vendidas ?? 0) > 0 || Number(r.productos_activos ?? 0) > 0);
}
