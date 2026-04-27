import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import UsuariosClient from "@/components/UsuariosClient";
import { exec } from "@/components/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function normalizeUsuariosArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export default async function UsuariosPage(props) {
  const searchParams = await Promise.resolve(props.searchParams);
  const page = Math.max(1, parseInt(String(searchParams?.page || "1"), 10) || 1);

  let allUsers = [];
  let listError = null;

  try {
    const usersRaw = await exec("spgetusuarios");
    allUsers = normalizeUsuariosArray(usersRaw);
  } catch (e) {
    listError = e?.message || "No se pudieron cargar los usuarios";
  }

  const total = allUsers.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pageRows = allUsers.slice(offset, offset + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar active="usuarios" />

      <main className="min-h-screen">
        <UsuariosClient
          initialRows={pageRows}
          total={total}
          page={safePage}
          pageSize={PAGE_SIZE}
          listError={listError}
        />
      </main>
    </div>
  );
}
