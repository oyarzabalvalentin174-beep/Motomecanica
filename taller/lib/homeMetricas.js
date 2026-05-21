import { exec, query } from "@/components/db";
import { moneyEs } from "@/lib/excelFormat";

const TZ = "America/Argentina/Buenos_Aires";

function todayYmd() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

async function fetchStockMetricas() {
  const [cero] = await query(
    `SELECT COUNT(*)::int AS n
     FROM app.producto p
     WHERE COALESCE(p.archivado, FALSE) = FALSE
       AND COALESCE(p.stock, 0) <= 0`,
  );
  const [bajo] = await query(
    `SELECT COUNT(*)::int AS n
     FROM app.producto p
     WHERE COALESCE(p.archivado, FALSE) = FALSE
       AND COALESCE(p.stock, 0) > 0
       AND COALESCE(p.stock, 0) <= 2`,
  );
  return {
    stockCero: Number(cero?.n ?? 0),
    stockBajo: Number(bajo?.n ?? 0),
  };
}

async function fetchPresupuestosVencidos(hoy) {
  const rows = await query(
    `WITH totales AS (
       SELECT
         p.id,
         p.nombre_persona,
         COALESCE(p.fecha_entrega_comprometida, p.fecha_entrega_estimada) AS fecha_vence,
         COALESCE(SUM(
           CASE
             WHEN btrim(COALESCE(pl.parametro, '')) = '' THEN 0
             ELSE COALESCE(NULLIF(pl.cantidad, 0), 1) * COALESCE(pl.precio_unitario, 0)
           END
         ), 0)::numeric(14, 2) AS total
       FROM app.presupuesto p
       LEFT JOIN app.presupuesto_linea pl ON pl.presupuesto_id = p.id
       GROUP BY p.id, p.nombre_persona, p.fecha_entrega_comprometida, p.fecha_entrega_estimada
     ),
     pagos AS (
       SELECT presupuesto_id, COALESCE(SUM(monto), 0)::numeric(14, 2) AS entregado
       FROM app.presupuesto_entrega
       GROUP BY presupuesto_id
     )
     SELECT
       t.id,
       t.nombre_persona,
       t.fecha_vence,
       t.total,
       COALESCE(pg.entregado, 0) AS entregado,
       (t.total - COALESCE(pg.entregado, 0))::numeric(14, 2) AS saldo
     FROM totales t
     LEFT JOIN pagos pg ON pg.presupuesto_id = t.id
     WHERE t.fecha_vence IS NOT NULL
       AND t.fecha_vence < $1::date
       AND (t.total - COALESCE(pg.entregado, 0)) > 0.01
     ORDER BY t.fecha_vence ASC, t.id ASC`,
    [hoy],
  );
  return rows.map((r) => ({
    id: r.id,
    nombre_persona: r.nombre_persona,
    fecha_vence: r.fecha_vence,
    total: Number(r.total ?? 0),
    entregado: Number(r.entregado ?? 0),
    saldo: Number(r.saldo ?? 0),
  }));
}

async function fetchViaSp() {
  const raw = await exec("spgethomemetricas", {});
  if (raw?.status === "error") throw new Error(raw.message || "Error en métricas");
  if (raw?.status === "ok" || raw?.status === "success") {
    return {
      stockCero: Number(raw.stock_cero ?? 0),
      stockBajo: Number(raw.stock_bajo ?? 0),
      presupuestosVencidos: Array.isArray(raw.presupuestos_vencidos) ? raw.presupuestos_vencidos : [],
    };
  }
  return null;
}

export async function loadHomeMetricas() {
  const hoy = todayYmd();
  try {
    const fromSp = await fetchViaSp();
    if (fromSp) return { ...fromSp, hoy };
  } catch (e) {
    if (!String(e?.message ?? "").includes("spgethomemetricas")) throw e;
  }

  const stock = await fetchStockMetricas();
  const presupuestosVencidos = await fetchPresupuestosVencidos(hoy);
  return { ...stock, presupuestosVencidos, hoy };
}

export function formatFechaAr(iso) {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(String(iso).slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR");
}

export { moneyEs };
