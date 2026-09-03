import { exec } from "@/components/db";

const TZ = "America/Argentina/Buenos_Aires";

const PERIODOS_VALIDOS = ["dia", "semana", "ultimomes", "mes", "anio"];

function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function resolveGraficos12Range({
  periodo = "mes",
  fecha_ref,
  fecha_desde,
  fecha_hasta,
}) {
  const p = PERIODOS_VALIDOS.includes(periodo) ? periodo : "mes";

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
    desde = ymdLocal(d);
    const end = new Date(`${desde}T12:00:00`);
    end.setDate(end.getDate() + 4);
    hasta = ymdLocal(end);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    if (hasta > today) hasta = today;
  } else if (p === "ultimomes") {
    const end = new Date(`${ref}T12:00:00`);
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    desde = ymdLocal(start);
    const monthEnd = ymdLocal(lastDay);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    hasta = monthEnd > today ? today : monthEnd;
  } else if (p === "anio") {
    const end = new Date(`${ref}T12:00:00`);
    end.setDate(end.getDate() - 364);
    desde = ymdLocal(end);
    hasta = ref;
  } else {
    // mes → últimos 12 meses calendario
    const end = new Date(`${ref}T12:00:00`);
    const hastaMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    hasta = ymdLocal(hastaMonth);
    const desdeMonth = new Date(end.getFullYear(), end.getMonth() - 11, 1);
    desde = ymdLocal(desdeMonth);
  }

  return { periodo: p, desde, hasta };
}

/** Marcas: usa p.marca_id (no id_marca). */
export async function fetchMarcasGraficos12() {
  const raw = await exec("spgetreportegraficos12marcas", {});
  if (raw?.status === "error") throw new Error(raw.message || "Error en marcas");
  return {
    marcas_productos_mas: Array.isArray(raw?.marcas_productos_mas) ? raw.marcas_productos_mas : [],
    marcas_productos_menos: Array.isArray(raw?.marcas_productos_menos) ? raw.marcas_productos_menos : [],
    marcas_unidades_mas: Array.isArray(raw?.marcas_unidades_mas) ? raw.marcas_unidades_mas : [],
    marcas_unidades_menos: Array.isArray(raw?.marcas_unidades_menos) ? raw.marcas_unidades_menos : [],
  };
}

/** Stock y ventas por producto (SP; el SP viejo spgetreportegraficos12 puede seguir existiendo). */
export async function fetchGraficos12Core(par) {
  const { periodo, desde, hasta } = resolveGraficos12Range(par);
  const raw = await exec("spgetreportegraficos12core", { periodo, desde, hasta });
  if (raw?.status === "error") throw new Error(raw.message || "Error en reporte");
  return {
    status: "ok",
    periodo,
    fecha_desde: desde,
    fecha_hasta: hasta,
    stock_mas: Array.isArray(raw?.stock_mas) ? raw.stock_mas : [],
    stock_menos: Array.isArray(raw?.stock_menos) ? raw.stock_menos : [],
    ventas_mas: Array.isArray(raw?.ventas_mas) ? raw.ventas_mas : [],
    ventas_menos: Array.isArray(raw?.ventas_menos) ? raw.ventas_menos : [],
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
    if (raw?.status === "error") throw new Error(raw.message || "Error en reporte");
  } catch {
    raw = await fetchGraficos12Core(par);
  }
  const marcas = await fetchMarcasGraficos12();
  return { ...(raw ?? {}), ...marcas };
}
