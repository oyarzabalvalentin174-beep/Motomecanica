import { exec } from "@/components/db";
import { resolveGraficos12Range } from "@/lib/reportesGraficos12";
import { normalizeSpList } from "@/lib/execHelpers";

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
 * Serie de ganancia por bucket (SP):
 * precio cobrado = precio_unitario * factor (dto. venta o método de pago)
 * ganancia = SUM(cantidad * (precio_cobrado - precio_compra))
 */
export async function fetchVentasSerieAgregada(par) {
  const { periodo, desde, hasta } = resolveGraficos12Range(par);
  const raw = await exec("spgetreportegananciaserie", { periodo, desde, hasta });
  if (raw?.status === "error") throw new Error(raw.message || "Error en ganancia");
  const rows = normalizeSpList(raw);

  if (periodo === "dia") {
    const byHour = new Map(
      (rows ?? []).map((r) => [Number(r.clave), { total: Number(r.total ?? 0), cantidad: Number(r.cantidad_ventas ?? 0) }]),
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
    const byDay = new Map(
      (rows ?? []).map((r) => {
        const key = toYmd(r.clave);
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
    const byWeek = new Map(
      (rows ?? []).map((r) => {
        const key = toYmd(r.clave);
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

  const byMonth = new Map(
    (rows ?? []).map((r) => {
      const key = toYmd(r.clave);
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
  const raw = await exec("spgetreportemetodospago", { desde, hasta });
  if (raw?.status === "error") throw new Error(raw.message || "Error en métodos de pago");
  return normalizeSpList(raw);
}

/**
 * Top marcas por cantidad de productos distintos vendidos (no unidades ni $).
 */
export async function fetchTopMarcasVentasProductos(par, limit = 10) {
  const { desde, hasta } = resolveGraficos12Range(par);
  const lim = Math.min(50, Math.max(1, Number(limit) || 10));
  const raw = await exec("spgetreportetopmarcasproductos", { desde, hasta, limit: lim });
  if (raw?.status === "error") throw new Error(raw.message || "Error en top marcas");
  return normalizeSpList(raw);
}

/** Carga métodos de pago + serie de ventas agregada (misma ventana de fechas). */
export async function loadGraficos34(par) {
  const range = resolveGraficos12Range(par);

  const [metodos_pago, ventas_serie, marcas_ventas_top] = await Promise.all([
    fetchMetodosPagoPeriodo(par).catch(() => []),
    fetchVentasSerieAgregada(par),
    fetchTopMarcasVentasProductos(par, 10).catch(() => []),
  ]);

  return {
    status: "ok",
    periodo: range.periodo,
    fecha_desde: range.desde,
    fecha_hasta: range.hasta,
    metodos_pago,
    ventas_serie,
    marcas_ventas_top: Array.isArray(marcas_ventas_top) ? marcas_ventas_top : [],
  };
}
