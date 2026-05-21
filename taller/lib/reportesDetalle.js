import { query } from "@/components/db";

const TZ = "America/Argentina/Buenos_Aires";

export async function buscarProductos(q) {
  const term = String(q ?? "").trim();
  if (term.length < 1) return [];
  const like = `%${term.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  return query(
    `SELECT p.id_producto, p.codigo, p.nombre, p.stock, p.precio_compra, p.precio_venta, m.nombre AS marca
     FROM app.producto p
     LEFT JOIN app.marca m ON m.id_marca = p.marca_id
     WHERE COALESCE(p.archivado, FALSE) = FALSE
       AND (p.codigo ILIKE $2 OR p.nombre ILIKE $2 OR p.codigo_barra = $1)
     ORDER BY CASE WHEN p.codigo ILIKE $1 THEN 0 ELSE 1 END, p.nombre ASC
     LIMIT 20`,
    [term, like],
  );
}

export async function buscarMarcas(q) {
  const term = String(q ?? "").trim();
  if (term.length < 1) return [];
  const like = `%${term.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  return query(
    `SELECT m.id_marca, m.nombre
     FROM app.marca m
     WHERE m.nombre ILIKE $1
     ORDER BY m.nombre ASC
     LIMIT 20`,
    [like],
  );
}

export async function fetchReporteProducto(idProducto, range) {
  const { desde, hasta } = range;
  const [producto] = await query(
    `SELECT p.id_producto, p.codigo, p.codigo_barra, p.nombre, p.stock, p.stock_minimo,
            p.precio_compra, p.precio_venta, m.nombre AS marca, m.id_marca
     FROM app.producto p
     LEFT JOIN app.marca m ON m.id_marca = p.marca_id
     WHERE p.id_producto = $1`,
    [idProducto],
  );
  if (!producto) return null;

  const ventas = await query(
    `SELECT
       v.id_venta,
       v.fecha,
       v.metodo_pago,
       dv.cantidad,
       dv.precio_unitario,
       (dv.cantidad * dv.precio_unitario)::numeric(14,2) AS subtotal_linea,
       (dv.cantidad * (dv.precio_unitario - COALESCE(p.precio_compra, 0)))::numeric(14,2) AS ganancia_linea
     FROM app.detalle_venta dv
     INNER JOIN app.venta v ON v.id_venta = dv.id_venta
     INNER JOIN app.producto p ON p.id_producto = dv.id_producto
     WHERE dv.id_producto = $1
       AND (v.fecha AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
     ORDER BY v.fecha DESC`,
    [idProducto, desde, hasta, TZ],
  );

  const totales = ventas.reduce(
    (acc, v) => {
      acc.unidades += Number(v.cantidad ?? 0);
      acc.total += Number(v.subtotal_linea ?? 0);
      acc.ganancia += Number(v.ganancia_linea ?? 0);
      return acc;
    },
    { unidades: 0, total: 0, ganancia: 0, operaciones: ventas.length },
  );

  return { producto, ventas, totales };
}

export async function fetchReporteMarca(idMarca, range) {
  const { desde, hasta } = range;
  const [marca] = await query(
    `SELECT m.id_marca, m.nombre FROM app.marca m WHERE m.id_marca = $1`,
    [idMarca],
  );
  if (!marca) return null;

  const productosBase = await query(
    `SELECT p.id_producto, p.codigo, p.nombre, p.stock, p.precio_compra, p.precio_venta
     FROM app.producto p
     WHERE p.marca_id = $1 AND COALESCE(p.archivado, FALSE) = FALSE
     ORDER BY p.nombre ASC`,
    [idMarca],
  );

  const vendidasRows = await query(
    `SELECT dv.id_producto, COALESCE(SUM(dv.cantidad), 0)::bigint AS unidades_vendidas
     FROM app.detalle_venta dv
     INNER JOIN app.venta v ON v.id_venta = dv.id_venta
     INNER JOIN app.producto p ON p.id_producto = dv.id_producto AND p.marca_id = $1
     WHERE (v.fecha AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
     GROUP BY dv.id_producto`,
    [idMarca, desde, hasta, TZ],
  );
  const vendidasMap = new Map(
    vendidasRows.map((r) => [Number(r.id_producto), Number(r.unidades_vendidas ?? 0)]),
  );
  const productos = productosBase.map((p) => ({
    ...p,
    unidades_vendidas: vendidasMap.get(Number(p.id_producto)) ?? 0,
  }));

  const ventas = await query(
    `SELECT
       v.id_venta,
       v.fecha,
       v.metodo_pago,
       p.codigo,
       p.nombre AS producto,
       dv.cantidad,
       dv.precio_unitario,
       (dv.cantidad * dv.precio_unitario)::numeric(14,2) AS subtotal_linea,
       (dv.cantidad * (dv.precio_unitario - COALESCE(p.precio_compra, 0)))::numeric(14,2) AS ganancia_linea
     FROM app.detalle_venta dv
     INNER JOIN app.venta v ON v.id_venta = dv.id_venta
     INNER JOIN app.producto p ON p.id_producto = dv.id_producto
     WHERE p.marca_id = $1
       AND COALESCE(p.archivado, FALSE) = FALSE
       AND (v.fecha AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
     ORDER BY v.fecha DESC`,
    [idMarca, desde, hasta, TZ],
  );

  const stockTotal = productos.reduce((s, p) => s + Number(p.stock ?? 0), 0);
  const totales = ventas.reduce(
    (acc, v) => {
      acc.unidades += Number(v.cantidad ?? 0);
      acc.total += Number(v.subtotal_linea ?? 0);
      acc.ganancia += Number(v.ganancia_linea ?? 0);
      return acc;
    },
    { unidades: 0, total: 0, ganancia: 0, operaciones: ventas.length, productos: productos.length, stockTotal },
  );

  return { marca, productos, ventas, totales };
}
