import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import MarcasClient from "@/components/MarcasClient";
import { exec } from "@/components/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function normalizeMarcasArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export default async function MarcasPage(props) {
  const searchParams = await Promise.resolve(props.searchParams);
  const page = Math.max(1, parseInt(String(searchParams?.page || "1"), 10) || 1);
  const query = String(searchParams?.q || "").trim().toLowerCase();

  let allMarcas = [];
  let listError = null;

  try {
    const raw = await exec("spgetmarcas");
    allMarcas = normalizeMarcasArray(raw);
  } catch (e) {
    listError = e?.message || "No se pudieron cargar las marcas";
  }

  const filteredMarcas = query
    ? allMarcas.filter((item) => String(item?.nombre || "").toLowerCase().includes(query))
    : allMarcas;

  const total = filteredMarcas.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pageRows = filteredMarcas.slice(offset, offset + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar active="marcas" />

      <main className="min-h-screen">
        <MarcasClient
          initialRows={pageRows}
          total={total}
          page={safePage}
          pageSize={PAGE_SIZE}
          searchQuery={String(searchParams?.q || "")}
          listError={listError}
        />
      </main>
    </div>
  );
}
