import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { exec } from "@/components/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeData(raw) {
  if (!raw || raw?.status === "error") return null;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const motoId = Number(request.nextUrl.searchParams.get("moto_id"));
  if (!Number.isFinite(motoId) || motoId <= 0) {
    return NextResponse.json({ error: "moto_id inválido" }, { status: 400 });
  }

  try {
    const raw = await exec("spgetfichatecnica", { moto_id: motoId });
    if (raw?.status === "error") {
      return NextResponse.json({ error: raw.message || "Error al cargar ficha" }, { status: 422 });
    }
    return NextResponse.json({ data: normalizeData(raw) ?? [] });
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

  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Enviá al menos un ítem en items" }, { status: 400 });
  }

  try {
    const raw = await exec("spupsertfichatecnica", {
      data: JSON.stringify(items),
      id_usuario: Number(session.user.id) || null,
    });

    if (raw?.status === "error") {
      return NextResponse.json({ error: raw.message || "Error al guardar ficha" }, { status: 422 });
    }

    return NextResponse.json(raw ?? { status: "success" });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}
