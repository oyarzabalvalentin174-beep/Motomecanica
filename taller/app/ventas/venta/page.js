import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import VentaClient from "@/components/VentaClient";
import { exec } from "@/components/db";

export const dynamic = "force-dynamic";

function normalizeArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export default async function VentaPage() {
  let productos = [];
  let listError = null;

  try {
    const raw = await exec("spgetproductos", { archivado: false });
    productos = normalizeArray(raw);
  } catch (e) {
    listError = e?.message || "No se pudieron cargar los productos";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar />

      <main className="min-h-screen">
        <VentaClient initialProductos={productos} listError={listError} />
      </main>
    </div>
  );
}
