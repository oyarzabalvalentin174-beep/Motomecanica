import { exec, query } from "@/components/db";

const TZ = "America/Argentina/Buenos_Aires";

export function resolveGraficos12Range({
  periodo = "mes",
  fecha_ref,
  fecha_desde,
  fecha_hasta,
}) {
  const p = ["dia", "semana", "mes", "anio"].includes(periodo) ? periodo : "mes";

  if (fecha_desde && fecha_hasta) {
    return { periodo: p, desde: fecha_desde, hasta: fecha_hasta };
  }

  const ref =
    fecha_ref ||
    new Date().toLocaleDateString("en-CA", { timeZone: TZ });

  let desde;
  let hasta = ref;

  if (p === "dia") {
    desde = ref;
    hasta = ref;
  } else if (p === "semana") {
    const d = new Date(`${ref}T12:00:00`);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    desde = d.toISOString().slice(0, 10);
    const end = new Date(`${desde}T12:00:00`);
    end.setDate(end.getDate() + 6);
    hasta = end.toISOString().slice(0, 10);
  } else if (p === "anio") {
    const end = new Date(`${ref}T12:00:00`);
    end.setDate(end.getDate() - 364);
    desde = end.toISOString().slice(0, 10);
    hasta = ref;
  } else {
    const end = new Date(`${ref}T12:00:00`);
    const hastaMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    hasta = hastaMonth.toISOString().slice(0, 10);
    const desdeMonth = new Date(end.getFullYear(), end.getMonth() - 11, 1);
    desde = desdeMonth.toISOString().slice(0, 10);
  }

  return { periodo: p, desde, hasta };
}

/** Marcas: usa p.marca_id (no id_marca). */
export async function fetchMarcasGraficos12() {
  const [prodMas, prodMenos, uniMas, uniMenos] = await Promise.all([
    query(
      `SELECT m.nombre AS nombre_marca, COUNT(p.id_producto)::int AS cantidad_productos
       FROM app.marca m
       LEFT JOIN app.producto p
         ON p.marca_id = m.id_marca AND COALESCE(p.archivado, FALSE) = FALSE
       GROUP BY m.id_marca, m.nombre
       HAVING COUNT(p.id_producto) > 0
       ORDER BY COUNT(p.id_producto) DESC, m.nombre ASC
       LIMIT 8`,
    ),
    query(
      `SELECT m.nombre AS nombre_marca, COUNT(p.id_producto)::int AS cantidad_productos
       FROM app.marca m
       LEFT JOIN app.producto p
         ON p.marca_id = m.id_marca AND COALESCE(p.archivado, FALSE) = FALSE
       GROUP BY m.id_marca, m.nombre
       HAVING COUNT(p.id_producto) > 0
       ORDER BY COUNT(p.id_producto) ASC, m.nombre ASC
       LIMIT 8`,
    ),
    query(
      `SELECT m.nombre AS nombre_marca, COALESCE(SUM(GREATEST(p.stock, 0)), 0)::bigint AS unidades
       FROM app.marca m
       LEFT JOIN app.producto p
         ON p.marca_id = m.id_marca AND COALESCE(p.archivado, FALSE) = FALSE
       GROUP BY m.id_marca, m.nombre
       HAVING COALESCE(SUM(GREATEST(p.stock, 0)), 0) > 0
       ORDER BY COALESCE(SUM(GREATEST(p.stock, 0)), 0) DESC, m.nombre ASC
       LIMIT 8`,
    ),
    query(
      `SELECT m.nombre AS nombre_marca, COALESCE(SUM(GREATEST(p.stock, 0)), 0)::bigint AS unidades
       FROM app.marca m
       LEFT JOIN app.producto p
         ON p.marca_id = m.id_marca AND COALESCE(p.archivado, FALSE) = FALSE
       GROUP BY m.id_marca, m.nombre
       HAVING COALESCE(SUM(GREATEST(p.stock, 0)), 0) > 0
       ORDER BY COALESCE(SUM(GREATEST(p.stock, 0)), 0) ASC, m.nombre ASC
       LIMIT 8`,
    ),
  ]);

  return {
    marcas_productos_mas: prodMas ?? [],
    marcas_productos_menos: prodMenos ?? [],
    marcas_unidades_mas: uniMas ?? [],
    marcas_unidades_menos: uniMenos ?? [],
  };
}

/** Stock y ventas por producto (fallback si el SP falla). */
export async function fetchGraficos12Core(par) {
  const { periodo, desde, hasta } = resolveGraficos12Range(par);

  const [stockMas, stockMenos, ventasMas, ventasMenos] = await Promise.all([
    query(
      `SELECT p.nombre, p.codigo, p.stock::int AS stock
       FROM app.producto p
       WHERE COALESCE(p.archivado, FALSE) = FALSE
       ORDER BY p.stock DESC NULLS LAST, p.nombre ASC
       LIMIT 5`,
    ),
    query(
      `SELECT p.nombre, p.codigo, p.stock::int AS stock
       FROM app.producto p
       WHERE COALESCE(p.archivado, FALSE) = FALSE
       ORDER BY p.stock ASC NULLS LAST, p.nombre ASC
       LIMIT 5`,
    ),
    query(
      `SELECT p.nombre, p.codigo, SUM(dv.cantidad)::bigint AS unidades
       FROM app.detalle_venta dv
       INNER JOIN app.venta v ON v.id_venta = dv.id_venta
       INNER JOIN app.producto p ON p.id_producto = dv.id_producto
       WHERE COALESCE(p.archivado, FALSE) = FALSE
         AND (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY p.id_producto, p.nombre, p.codigo
       HAVING SUM(dv.cantidad) > 0
       ORDER BY SUM(dv.cantidad) DESC
       LIMIT 10`,
      [desde, hasta, TZ],
    ),
    query(
      `SELECT p.nombre, p.codigo, SUM(dv.cantidad)::bigint AS unidades
       FROM app.detalle_venta dv
       INNER JOIN app.venta v ON v.id_venta = dv.id_venta
       INNER JOIN app.producto p ON p.id_producto = dv.id_producto
       WHERE COALESCE(p.archivado, FALSE) = FALSE
         AND (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY p.id_producto, p.nombre, p.codigo
       HAVING SUM(dv.cantidad) > 0
       ORDER BY SUM(dv.cantidad) ASC, p.nombre ASC
       LIMIT 10`,
      [desde, hasta, TZ],
    ),
  ]);

  return {
    status: "ok",
    periodo,
    fecha_desde: desde,
    fecha_hasta: hasta,
    stock_mas: stockMas ?? [],
    stock_menos: stockMenos ?? [],
    ventas_mas: ventasMas ?? [],
    ventas_menos: ventasMenos ?? [],
  };
}

export function isMarcaColumnError(message) {
  const m = String(message ?? "").toLowerCase();
  return m.includes("id_marca") || m.includes("marca_id does not exist");
}

/** Carga stock, ventas y marcas (marcas siempre con marca_id). */
export async function loadGraficos12(par) {
  let raw;
  try {
    raw = await exec("spgetreportegraficos12", par);
  } catch (e) {
    if (!isMarcaColumnError(e?.message)) throw e;
    raw = await fetchGraficos12Core(par);
  }
  if (raw?.status === "error") {
    throw new Error(raw.message || "Error en reporte");
  }
  const marcas = await fetchMarcasGraficos12();
  return { ...(raw ?? {}), ...marcas };
}
