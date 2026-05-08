import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import FichaTecnicaClient from "@/components/FichaTecnicaClient";
import { exec } from "@/components/db";
import { requireSession } from "@/lib/requireSession";

export const dynamic = "force-dynamic";

function normalizeArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export default async function FichaTecnicaPage(props) {
  await requireSession("/ficha-tecnica");
  const searchParams = await Promise.resolve(props.searchParams);
  const rawMoto = searchParams?.moto;
  const selectedId = Math.max(0, parseInt(String(rawMoto ?? ""), 10) || 0);

  let motos = [];
  let lineas = [];
  let listError = null;

  try {
    const rawMotos = await exec("spgetmotos");
    if (rawMotos?.status === "error") {
      listError = rawMotos.message || "No se pudieron cargar las motos";
    } else {
      motos = normalizeArray(rawMotos);
    }
  } catch (e) {
    listError = e?.message || "No se pudieron cargar las motos";
  }

  if (selectedId > 0 && !listError) {
    try {
      const rawFicha = await exec("spgetfichatecnica", { moto_id: selectedId });
      if (rawFicha?.status === "error") {
        listError = rawFicha.message || "No se pudo cargar la ficha técnica";
      } else {
        lineas = normalizeArray(rawFicha);
      }
    } catch (e) {
      listError = e?.message || "No se pudo cargar la ficha técnica";
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar active="ficha-tecnica" />

      <main className="min-h-screen pt-20 sm:pt-24">
        <FichaTecnicaClient
          initialMotos={motos}
          initialSelectedMotoId={selectedId}
          initialLineas={lineas}
          listError={listError}
        />
      </main>
    </div>
  );
}
