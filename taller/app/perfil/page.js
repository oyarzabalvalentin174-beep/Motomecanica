import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import PerfilClient from "@/components/PerfilClient";
import UserPop from "@/components/UserPop";
import { exec, query } from "@/components/db";
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
      const rows = await query(
        `select id_usuario, nombreusuario, nombre, apellido, ultimologin
         from app.usuario
         where id_usuario = $1
         limit 1`,
        [userId],
      );
      const row = rows?.[0] || null;
      return { user: row, error: row ? null : "No se encontró el usuario" };
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
