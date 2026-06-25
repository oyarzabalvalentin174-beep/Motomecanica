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

  const detalles = Array.isArray(body?.detalles) ? body.detalles : null;
  if (!detalles || detalles.length === 0) {
    return NextResponse.json({ error: "Enviá al menos un ítem en detalles" }, { status: 400 });
  }

  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";

  const merged = new Map();
  for (const row of detalles) {
    const id_producto = Number(row?.id_producto);
    const cantidad = Number(row?.cantidad);
    if (!Number.isFinite(id_producto) || id_producto <= 0 || !Number.isFinite(cantidad) || cantidad <= 0) {
      return NextResponse.json({ error: "detalles con datos inválidos" }, { status: 400 });
    }
    merged.set(id_producto, (merged.get(id_producto) ?? 0) + cantidad);
  }

  const normalized = [...merged.entries()].map(([id_producto, cantidad]) => ({
    id_producto,
    cantidad,
  }));

  const payload = {
    motivo: motivo || null,
    detalles: normalized,
  };

  try {
    const raw = await exec("spupsertusopersonal", {
      data: JSON.stringify(payload),
      id_usuario: Number(session.user.id) || null,
    });

    if (raw?.status === "error") {
      return NextResponse.json({ error: raw.message || "Error al registrar uso personal" }, { status: 422 });
    }

    return NextResponse.json(raw ?? { status: "success" });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}
