import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import PresupuestosClient from "@/components/PresupuestosClient";
import { exec } from "@/components/db";
import { requireSession } from "@/lib/requireSession";

export const dynamic = "force-dynamic";

function normalizeList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export default async function PresupuestosPage(props) {
  await requireSession("/presupuestos");
  const searchParams = await Promise.resolve(props.searchParams);
  const rawId = searchParams?.id;
  const selectedId = Math.max(0, parseInt(String(rawId ?? ""), 10) || 0);

  let lista = [];
  let detail = null;
  let listError = null;

  try {
    const rawList = await exec("spgetpresupuestos");
    if (rawList?.status === "error") {
      listError = rawList.message || "No se pudieron cargar los presupuestos";
    } else {
      lista = normalizeList(rawList);
    }
  } catch (e) {
    listError = e?.message || "No se pudieron cargar los presupuestos";
  }

  if (selectedId > 0 && !listError) {
    try {
      const rawD = await exec("spgetpresupuesto", { presupuesto_id: selectedId });
      if (rawD?.status === "error") {
        listError = rawD.message || "No se pudo cargar el presupuesto";
      } else if (rawD?.data && typeof rawD.data === "object") {
        detail = rawD.data;
      }
    } catch (e) {
      listError = e?.message || "No se pudo cargar el presupuesto";
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80 print:bg-white">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar active="presupuestos" />

      <main className="min-h-screen pt-20 sm:pt-24 print:min-h-0 print:pt-0 print:bg-white">
        <PresupuestosClient
          initialList={lista}
          initialDetail={detail}
          initialSelectedId={selectedId}
          listError={listError}
        />
      </main>
    </div>
  );
}
