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

  const metodo_pago =
    typeof body?.metodo_pago === "string" ? body.metodo_pago.trim() : "";
  const descuento = Number(body?.descuento ?? 0);
  if (!Number.isFinite(descuento) || descuento < 0) {
    return NextResponse.json({ error: "descuento inválido" }, { status: 400 });
  }

  const normalized = detalles.map((row) => ({
    id_producto: Number(row?.id_producto),
    cantidad: Number(row?.cantidad),
    precio_unitario: Number(row?.precio_unitario),
  }));

  for (const row of normalized) {
    if (
      !Number.isFinite(row.id_producto) ||
      row.id_producto <= 0 ||
      !Number.isFinite(row.cantidad) ||
      row.cantidad <= 0 ||
      !Number.isFinite(row.precio_unitario) ||
      row.precio_unitario < 0
    ) {
      return NextResponse.json({ error: "detalles con datos inválidos" }, { status: 400 });
    }
  }

  const payload = {
    metodo_pago: metodo_pago || null,
    descuento,
    detalles: normalized,
  };

  try {
    const raw = await exec("spupsertventa", {
      data: JSON.stringify(payload),
      id_usuario: Number(session.user.id) || null,
    });

    if (raw?.status === "error") {
      return NextResponse.json({ error: raw.message || "Error al registrar venta" }, { status: 422 });
    }

    return NextResponse.json(raw ?? { status: "success" });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}
