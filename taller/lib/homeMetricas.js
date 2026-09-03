import { exec } from "@/components/db";
import { moneyEs } from "@/lib/excelFormat";

const TZ = "America/Argentina/Buenos_Aires";

function todayYmd() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export async function loadHomeMetricas() {
  const hoy = todayYmd();
  const raw = await exec("spgethomemetricas", {});
  if (raw?.status === "error") throw new Error(raw.message || "Error en métricas");
  return {
    stockCero: Number(raw.stock_cero ?? 0),
    stockBajo: Number(raw.stock_bajo ?? 0),
    presupuestosVencidos: Array.isArray(raw.presupuestos_vencidos) ? raw.presupuestos_vencidos : [],
    hoy,
  };
}

export function formatFechaAr(iso) {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(String(iso).slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR");
}

export { moneyEs };
