import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { exec } from "@/components/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Enviá al menos un ítem en items" }, { status: 400 });
  }

  try {
    const normalizedItems = items.map((item) => {
      if (item?.id_usuario || item?.eliminar) return item;
      return { ...item, ultimologin: item?.ultimologin || new Date().toISOString() };
    });

    const raw = await exec("spupsertusuario", {
      data: JSON.stringify(normalizedItems),
      id_usuario: Number(session.user.id) || null,
    });

    if (raw?.status === "error") {
      return NextResponse.json(
        { error: raw.message || "Error al guardar usuarios" },
        { status: 422 },
      );
    }

    return NextResponse.json(raw ?? { status: "success" });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Error de base de datos" },
      { status: 500 },
    );
  }
}
