import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import IngresoPedidoClient from "@/components/IngresoPedidoClient";
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

export default async function IngresoPedidoPage() {
  await requireSession("/ingreso-pedido");
  let productos = [];
  let marcas = [];
  let sectores = [];
  let listError = null;

  try {
    const [rawProductos, rawMarcas, rawSectores] = await Promise.all([
      exec("spgetproductos", { archivado: null }),
      exec("spgetmarcas", {}),
      exec("spgetsectores", {}),
    ]);
    productos = normalizeArray(rawProductos);
    marcas = normalizeArray(rawMarcas);
    sectores = normalizeArray(rawSectores);
  } catch (e) {
    listError = e?.message || "No se pudieron cargar los datos";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar active="ingreso-pedido" />

      <main className="min-h-screen pt-24 sm:pt-28">
        <IngresoPedidoClient initialProductos={productos} marcas={marcas} sectores={sectores} listError={listError} />
      </main>
    </div>
  );
}
