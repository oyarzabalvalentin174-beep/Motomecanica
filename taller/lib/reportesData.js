import { exec } from "@/components/db";
import { normalizeSpList, unwrapSpEntity } from "@/lib/execHelpers";

const TZ = "America/Argentina/Buenos_Aires";

function requireSpOk(raw, fallbackMsg) {
  if (raw?.status === "error") throw new Error(raw.message || fallbackMsg);
  return raw;
}

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
  const raw = await exec("spgetpresupuestos", {});
  requireSpOk(raw, "Error al listar presupuestos");
  return normalizeSpList(raw).map(mapPresupuestoListaItem).filter((p) => p.id > 0);
}

export async function fetchPresupuestoDetalle(id) {
  const raw = await exec("spgetpresupuesto", { presupuesto_id: id });
  requireSpOk(raw, "Error al cargar presupuesto");
  return unwrapSpEntity(raw, ["id", "nombre_persona", "lineas"]);
}

export async function fetchVentasAgrupadas(agrupacion, range) {
  const { desde, hasta } = range;
  const raw = await exec("spgetreporteventasagrupadas", {
    agrupacion,
    desde,
    hasta,
  });
  requireSpOk(raw, "Error al agrupar ventas");
  return normalizeSpList(raw);
}

export async function fetchMarcasResumen(range) {
  const { desde, hasta } = range;
  const raw = await exec("spgetreportemarcasresumen", { desde, hasta });
  requireSpOk(raw, "Error al cargar marcas");
  return normalizeSpList(raw);
}

export async function fetchProductoResumen(range) {
  const { desde, hasta } = range;
  const raw = await exec("spgetreporteproductosresumen", { desde, hasta });
  requireSpOk(raw, "Error al cargar productos");
  return normalizeSpList(raw);
}

export async function fetchMarcaDetalle(range) {
  const rows = await fetchMarcasResumen(range);
  return rows.filter((r) => Number(r.unidades_vendidas ?? 0) > 0 || Number(r.productos_activos ?? 0) > 0);
}
