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

  const payload = body?.payload && typeof body.payload === "object" ? body.payload : null;
  if (!payload) {
    return NextResponse.json({ error: "Enviá payload con id, nombre_persona, observaciones y lineas" }, { status: 400 });
  }

  try {
    const raw = await exec("spupsertpresupuesto", {
      data: JSON.stringify(payload),
      id_usuario: Number(session.user.id) || null,
    });

    if (raw?.status === "error") {
      return NextResponse.json({ error: raw.message || "Error al guardar presupuesto" }, { status: 422 });
    }

    return NextResponse.json(raw ?? { status: "success" });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}
