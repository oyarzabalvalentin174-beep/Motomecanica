import AppSidebar from "@/components/AppSidebar";
import AjustePreciosClient from "@/components/AjustePreciosClient";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import { exec } from "@/components/db";
import { requireSession } from "@/lib/requireSession";

export const dynamic = "force-dynamic";

function normalizeArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export default async function AjustePreciosPage() {
  await requireSession("/ajuste-precios");
  let marcas = [];
  let listError = null;

  try {
    const rawMarcas = await exec("spgetmarcas", {});
    marcas = normalizeArray(rawMarcas);
  } catch (e) {
    listError = e?.message || "No se pudieron cargar las marcas";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar />

      <main className="min-h-screen pt-24 sm:pt-28">
        <AjustePreciosClient marcas={marcas} listError={listError} />
      </main>
    </div>
  );
}
