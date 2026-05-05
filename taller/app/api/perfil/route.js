import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { exec, query } from "@/components/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeUser(raw) {
  if (Array.isArray(raw?.data) && raw.data.length > 0) return raw.data[0];
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return null;
}

async function getCurrentUser(session) {
  const username = String(session?.user?.username || "").trim();
  const userId = Number(session?.user?.id);

  if (username) {
    try {
      const raw = await exec("spgetusuario", {
        nombreusuario: username,
        includehash: true,
      });
      const byUsername = normalizeUser(raw);
      if (byUsername) return byUsername;
    } catch {
      // fallback query below
    }
  }

  if (Number.isFinite(userId) && userId > 0) {
    const rows = await query(
      `select id_usuario, nombreusuario, nombre, apellido, ultimologin, "contraseña" as contrasena
       from app.usuario
       where id_usuario = $1
       limit 1`,
      [userId],
    );
    return rows?.[0] || null;
  }

  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const user = await getCurrentUser(session);
    if (!user) {
      return NextResponse.json({ error: "No se encontró el usuario" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id_usuario: user.id_usuario,
        nombreusuario: user.nombreusuario,
        nombre: user.nombre,
        apellido: user.apellido,
        ultimologin: user.ultimologin || null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = String(body?.nombre || "").trim();
  const apellido = String(body?.apellido || "").trim();
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");

  if (!nombre || !apellido) {
    return NextResponse.json({ error: "Nombre y apellido son obligatorios" }, { status: 400 });
  }

  if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
    return NextResponse.json(
      { error: "Para cambiar contraseña debés completar contraseña actual y nueva" },
      { status: 400 },
    );
  }

  if (newPassword && newPassword.length < 6) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener al menos 6 caracteres" },
      { status: 400 },
    );
  }

  try {
    const user = await getCurrentUser(session);
    if (!user) {
      return NextResponse.json({ error: "No se encontró el usuario" }, { status: 404 });
    }

    let passwordToStore;
    if (newPassword) {
      const stored = String(user?.contrasena || user?.["contraseña"] || "");
      const usesBcrypt = stored.startsWith("$2");
      const validCurrent = usesBcrypt ? await bcrypt.compare(currentPassword, stored) : currentPassword === stored;
      if (!validCurrent) {
        return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 400 });
      }
      passwordToStore = await bcrypt.hash(newPassword, 12);
    }

    const item = {
      id_usuario: Number(user.id_usuario),
      nombre,
      apellido,
      nombreusuario: user.nombreusuario,
    };
    if (passwordToStore) item.contrasena = passwordToStore;

    const raw = await exec("spupsertusuario", {
      data: JSON.stringify([item]),
      id_usuario: Number(session.user.id) || null,
    });

    if (raw?.status === "error") {
      return NextResponse.json({ error: raw.message || "No se pudo guardar el perfil" }, { status: 422 });
    }

    return NextResponse.json({ status: "success" });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}
