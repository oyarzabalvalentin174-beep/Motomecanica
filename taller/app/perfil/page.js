import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import PerfilClient from "@/components/PerfilClient";
import UserPop from "@/components/UserPop";
import { exec } from "@/components/db";
import { requireSession } from "@/lib/requireSession";

export const dynamic = "force-dynamic";

async function getPerfil() {
  const session = await requireSession("/perfil");
  const username = String(session?.user?.username || "").trim();
  const userId = Number(session?.user?.id);

  try {
    if (username) {
      const raw = await exec("spgetusuario", { nombreusuario: username, includehash: false });
      const bySp = Array.isArray(raw?.data) ? raw.data[0] : Array.isArray(raw) ? raw[0] : null;
      if (bySp) {
        return {
          user: {
            id_usuario: bySp.id_usuario,
            nombreusuario: bySp.nombreusuario,
            nombre: bySp.nombre,
            apellido: bySp.apellido,
            ultimologin: bySp.ultimologin || null,
          },
          error: null,
        };
      }
    }

    if (Number.isFinite(userId) && userId > 0) {
      const raw = await exec("spgetusuarioporid", { id_usuario: userId });
      const row = Array.isArray(raw?.data) ? raw.data[0] : Array.isArray(raw) ? raw[0] : null;
      if (row) {
        return {
          user: {
            id_usuario: row.id_usuario,
            nombreusuario: row.nombreusuario,
            nombre: row.nombre,
            apellido: row.apellido,
            ultimologin: row.ultimologin || null,
          },
          error: null,
        };
      }
      return { user: null, error: "No se encontró el usuario" };
    }

    return { user: null, error: "No se encontró el usuario logueado" };
  } catch (e) {
    return { user: null, error: e?.message || "No se pudo cargar el perfil" };
  }
}

export default async function PerfilPage() {
  const { user, error } = await getPerfil();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar />

      <main className="min-h-screen">
        <PerfilClient initialUser={user} loadError={error} />
      </main>
    </div>
  );
}
