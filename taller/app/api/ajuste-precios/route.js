import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/components/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePositiveNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
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

  const scope = String(body?.scope ?? "").trim().toLowerCase();
  const operation = String(body?.operation ?? "").trim().toLowerCase();
  const porcentaje = parsePositiveNumber(body?.percentage);

  if (!["producto", "marca", "todos"].includes(scope)) {
    return NextResponse.json({ error: "scope inválido" }, { status: 400 });
  }
  if (!["aumentar", "disminuir"].includes(operation)) {
    return NextResponse.json({ error: "operation inválida" }, { status: 400 });
  }
  if (porcentaje == null) {
    return NextResponse.json({ error: "percentage inválido" }, { status: 400 });
  }

  const factor = operation === "aumentar" ? 1 + porcentaje / 100 : 1 - porcentaje / 100;
  const safeFactor = Math.max(0, factor);

  try {
    let sql = `
      update app.producto p
      set precio_venta = round(greatest(0, coalesce(p.precio_venta, 0) * $1)::numeric, 2)
      where coalesce(p.archivado, false) = false
    `;
    const params = [safeFactor];

    if (scope === "producto") {
      const idProducto = Number(body?.id_producto);
      if (!Number.isFinite(idProducto) || idProducto <= 0) {
        return NextResponse.json({ error: "id_producto inválido" }, { status: 400 });
      }
      sql += " and p.id_producto = $2 returning p.id_producto";
      params.push(idProducto);
    } else if (scope === "marca") {
      const marcaId = Number(body?.marca_id);
      if (!Number.isFinite(marcaId) || marcaId <= 0) {
        return NextResponse.json({ error: "marca_id inválido" }, { status: 400 });
      }
      sql += " and p.marca_id = $2 returning p.id_producto";
      params.push(marcaId);
    } else {
      sql += " returning p.id_producto";
    }

    const rows = await query(sql, params);
    const count = Array.isArray(rows) ? rows.length : 0;

    return NextResponse.json({
      status: "success",
      data: {
        updated: count,
        scope,
        operation,
        percentage: porcentaje,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}
