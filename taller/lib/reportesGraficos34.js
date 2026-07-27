import { exec, query } from "@/components/db";
import { resolveGraficos12Range } from "@/lib/reportesGraficos12";

const TZ = "America/Argentina/Buenos_Aires";

function ymdFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmdLocal(ymd) {
  return new Date(`${String(ymd).slice(0, 10)}T12:00:00`);
}

/** Normaliza fechas que vienen de pg (Date) o string a YYYY-MM-DD. */
function toYmd(value) {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s.slice(0, 10);
}

function eachDay(desde, hasta) {
  const out = [];
  const cur = parseYmdLocal(desde);
  const end = parseYmdLocal(hasta);
  while (cur <= end) {
    out.push(ymdFromDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function eachMonth(desde, hasta) {
  const out = [];
  const cur = parseYmdLocal(desde);
  cur.setDate(1);
  const end = parseYmdLocal(hasta);
  end.setDate(1);
  while (cur <= end) {
    out.push(ymdFromDate(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/** Lunes de la semana ISO que contiene `ymd`. */
function mondayOf(ymd) {
  const d = parseYmdLocal(ymd);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return ymdFromDate(d);
}

function eachWeek(desde, hasta) {
  const out = [];
  let cur = mondayOf(desde);
  const endMon = mondayOf(hasta);
  while (cur <= endMon) {
    out.push(cur);
    const d = parseYmdLocal(cur);
    d.setDate(d.getDate() + 7);
    cur = ymdFromDate(d);
  }
  return out;
}

function labelDay(ymd) {
  const d = parseYmdLocal(ymd);
  if (Number.isNaN(d.getTime())) return String(ymd);
  return d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" });
}

function labelMonth(ymd) {
  const d = parseYmdLocal(ymd);
  if (Number.isNaN(d.getTime())) return String(ymd);
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

function labelWeek(weekStartYmd) {
  const start = parseYmdLocal(weekStartYmd);
  const end = parseYmdLocal(weekStartYmd);
  end.setDate(end.getDate() + 6);
  const a = start.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  const b = end.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  return `${a} – ${b}`;
}

/**
 * Serie de ventas sumadas por bucket:
 * - dia → por hora
 * - semana → por día
 * - ultimomes → por semana
 * - mes / anio → por mes
 */
export async function fetchVentasSerieAgregada(par) {
  const { periodo, desde, hasta } = resolveGraficos12Range(par);

  if (periodo === "dia") {
    const rows = await query(
      `SELECT
         EXTRACT(HOUR FROM (v.fecha AT TIME ZONE $2))::int AS hora,
         COALESCE(SUM(COALESCE(v.total, 0)), 0)::numeric(14,2) AS total,
         COUNT(*)::int AS cantidad_ventas
       FROM app.venta v
       WHERE (v.fecha AT TIME ZONE $2)::date = $1::date
       GROUP BY 1
       ORDER BY 1`,
      [desde, TZ],
    );
    const byHour = new Map(
      (rows ?? []).map((r) => [Number(r.hora), { total: Number(r.total ?? 0), cantidad: Number(r.cantidad_ventas ?? 0) }]),
    );
    return Array.from({ length: 24 }, (_, h) => {
      const hit = byHour.get(h) || { total: 0, cantidad: 0 };
      const key = String(h).padStart(2, "0");
      return {
        fecha: `${desde}T${key}:00:00`,
        label: `${key}:00`,
        total: hit.total,
        cantidad_ventas: hit.cantidad,
      };
    });
  }

  if (periodo === "semana") {
    const rows = await query(
      `SELECT
         to_char((v.fecha AT TIME ZONE $3)::date, 'YYYY-MM-DD') AS dia,
         COALESCE(SUM(COALESCE(v.total, 0)), 0)::numeric(14,2) AS total,
         COUNT(*)::int AS cantidad_ventas
       FROM app.venta v
       WHERE (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY 1
       ORDER BY 1`,
      [desde, hasta, TZ],
    );
    const byDay = new Map(
      (rows ?? []).map((r) => {
        const key = toYmd(r.dia);
        return [key, { total: Number(r.total ?? 0), cantidad: Number(r.cantidad_ventas ?? 0) }];
      }),
    );
    return eachDay(desde, hasta).map((key) => {
      const hit = byDay.get(key) || { total: 0, cantidad: 0 };
      return {
        fecha: key,
        label: labelDay(key),
        total: hit.total,
        cantidad_ventas: hit.cantidad,
      };
    });
  }

  if (periodo === "ultimomes") {
    const rows = await query(
      `SELECT
         to_char(date_trunc('week', (v.fecha AT TIME ZONE $3)::timestamp)::date, 'YYYY-MM-DD') AS semana,
         COALESCE(SUM(COALESCE(v.total, 0)), 0)::numeric(14,2) AS total,
         COUNT(*)::int AS cantidad_ventas
       FROM app.venta v
       WHERE (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY 1
       ORDER BY 1`,
      [desde, hasta, TZ],
    );
    const byWeek = new Map(
      (rows ?? []).map((r) => {
        const key = toYmd(r.semana);
        return [key, { total: Number(r.total ?? 0), cantidad: Number(r.cantidad_ventas ?? 0) }];
      }),
    );
    return eachWeek(desde, hasta).map((key) => {
      const hit = byWeek.get(key) || { total: 0, cantidad: 0 };
      return {
        fecha: key,
        label: labelWeek(key),
        total: hit.total,
        cantidad_ventas: hit.cantidad,
      };
    });
  }

  // mes / anio → por mes
  const rows = await query(
    `SELECT
       to_char(date_trunc('month', (v.fecha AT TIME ZONE $3)::date)::date, 'YYYY-MM-DD') AS mes,
       COALESCE(SUM(COALESCE(v.total, 0)), 0)::numeric(14,2) AS total,
       COUNT(*)::int AS cantidad_ventas
     FROM app.venta v
     WHERE (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
     GROUP BY 1
     ORDER BY 1`,
    [desde, hasta, TZ],
  );
  const byMonth = new Map(
    (rows ?? []).map((r) => {
      const key = toYmd(r.mes);
      return [key, { total: Number(r.total ?? 0), cantidad: Number(r.cantidad_ventas ?? 0) }];
    }),
  );
  return eachMonth(desde, hasta).map((key) => {
    const hit = byMonth.get(key) || { total: 0, cantidad: 0 };
    return {
      fecha: key,
      label: labelMonth(key),
      total: hit.total,
      cantidad_ventas: hit.cantidad,
    };
  });
}

export async function fetchMetodosPagoPeriodo(par) {
  const { desde, hasta } = resolveGraficos12Range(par);
  return query(
    `SELECT
       COALESCE(NULLIF(TRIM(LOWER(v.metodo_pago)), ''), 'sin_definir') AS metodo,
       COUNT(*)::int AS cantidad_ventas,
       COALESCE(SUM(COALESCE(v.total, 0)), 0)::numeric(14,2) AS total_monto
     FROM app.venta v
     WHERE (v.fecha AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
     GROUP BY 1
     ORDER BY cantidad_ventas DESC, metodo ASC`,
    [desde, hasta, TZ],
  );
}

/** Carga métodos de pago + serie de ventas agregada (misma ventana de fechas). */
export async function loadGraficos34(par) {
  const range = resolveGraficos12Range(par);

  let metodos_pago = [];
  try {
    metodos_pago = (await fetchMetodosPagoPeriodo(par)) ?? [];
  } catch {
    try {
      const raw = await exec("spgetreportegraficos34", {
        ...par,
        periodo: par.periodo === "ultimomes" ? "mes" : par.periodo,
      });
      if (Array.isArray(raw?.metodos_pago)) metodos_pago = raw.metodos_pago;
    } catch {
      metodos_pago = [];
    }
  }

  const ventas_serie = await fetchVentasSerieAgregada(par);

  return {
    status: "ok",
    periodo: range.periodo,
    fecha_desde: range.desde,
    fecha_hasta: range.hasta,
    metodos_pago,
    ventas_serie,
  };
}
