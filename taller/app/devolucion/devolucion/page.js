import AppSidebar from "@/components/AppSidebar";
import DevolucionClient from "@/components/DevolucionClient";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import { exec, query } from "@/components/db";

export const dynamic = "force-dynamic";

function normalizeVentas(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export default async function DevolucionPage() {
  let ventas = [];
  let listError = null;

  try {
    const rawVentas = await exec("spgetventas", {});
    const baseVentas = normalizeVentas(rawVentas);

    const detalleIds = baseVentas.flatMap((v) =>
      (Array.isArray(v?.detalle) ? v.detalle : [])
        .map((d) => Number(d?.id_detalle))
        .filter((id) => Number.isFinite(id) && id > 0),
    );

    let devMap = new Map();
    if (detalleIds.length > 0) {
      const devoluciones = await query(
        `select detalle_venta_id, coalesce(sum(cantidad), 0)::int as ya_devuelto
         from app.detalle_devolucion
         where detalle_venta_id = any($1::int[])
         group by detalle_venta_id`,
        [detalleIds],
      );
      devMap = new Map(
        (Array.isArray(devoluciones) ? devoluciones : []).map((r) => [
          Number(r.detalle_venta_id),
          Number(r.ya_devuelto ?? 0),
        ]),
      );
    }

    ventas = baseVentas.map((v) => {
      const detalle = Array.isArray(v?.detalle) ? v.detalle : [];
      const detalleEnriquecido = detalle.map((d) => {
        const idDet = Number(d?.id_detalle);
        const cantVendida = Number(d?.cantidad ?? 0);
        const yaDevuelto = devMap.get(idDet) ?? 0;
        const disponible = Math.max(0, cantVendida - yaDevuelto);
        return {
          ...d,
          ya_devuelto: yaDevuelto,
          disponible,
        };
      });
      return { ...v, detalle: detalleEnriquecido };
    });
  } catch (e) {
    listError = e?.message || "No se pudieron cargar las ventas";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar />

      <main className="min-h-screen pt-24 sm:pt-28">
        <DevolucionClient initialVentas={ventas} listError={listError} />
      </main>
    </div>
  );
}
