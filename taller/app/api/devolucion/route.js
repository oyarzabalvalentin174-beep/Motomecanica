import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { exec } from "@/components/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = await exec("spgetdevoluciones", {});
    return NextResponse.json({ data: Array.isArray(raw) ? raw : [] });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error al listar devoluciones" }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const idVenta = String(body?.id_venta ?? "").trim();
  const idDetalleVenta = Number(body?.id_detalle_venta);
  const cantidad = Number(body?.cantidad);
  const motivo = String(body?.motivo ?? "").trim();
  const agregarStock = body?.agregar_stock === true;

  if (!idVenta) {
    return NextResponse.json({ error: "id_venta es obligatorio" }, { status: 400 });
  }
  if (!Number.isFinite(idDetalleVenta) || idDetalleVenta <= 0) {
    return NextResponse.json({ error: "id_detalle_venta invalido" }, { status: 400 });
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isInteger(cantidad)) {
    return NextResponse.json({ error: "cantidad invalida" }, { status: 400 });
  }
  if (!motivo) {
    return NextResponse.json({ error: "motivo es obligatorio" }, { status: 400 });
  }

  try {
    const payload = {
      id_venta: idVenta,
      id_detalle_venta: idDetalleVenta,
      cantidad,
      motivo,
      agregar_stock: agregarStock,
    };
    const raw = await exec("spupsertdevolucion", {
      data: JSON.stringify(payload),
      id_usuario: Number(session?.user?.id) || null,
    });
    if (raw?.status === "error") {
      return NextResponse.json({ error: raw.message || "Error al registrar devolucion" }, { status: 422 });
    }
    return NextResponse.json(raw ?? {
      status: "success",
      data: null,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}
