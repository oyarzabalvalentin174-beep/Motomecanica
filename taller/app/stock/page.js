import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import StockClient from "@/components/StockClient";
import { exec, query } from "@/components/db";

export const dynamic = "force-dynamic";

function normalizeArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export default async function StockPage() {
  let products = [];
  let marcas = [];
  let sectores = [];
  let listError = null;

  try {
    const [rawProducts, rawMarcas, rawSectores] = await Promise.all([
      exec("spgetproductos", { archivado: null }),
      query("select id_marca, nombre from app.marca order by nombre"),
      query("select id_sector, descripcion from app.sector order by descripcion"),
    ]);
    products = normalizeArray(rawProducts);
    marcas = Array.isArray(rawMarcas) ? rawMarcas : [];
    sectores = Array.isArray(rawSectores) ? rawSectores : [];
  } catch (e) {
    listError = e?.message || "No se pudieron cargar los productos";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar active="stock" />

      <main className="min-h-screen">
        <StockClient initialRows={products} marcas={marcas} sectores={sectores} listError={listError} />
      </main>
    </div>
  );
}
