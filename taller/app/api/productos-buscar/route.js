import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/components/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ data: [] });
  }

  try {
    const term = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const rows = await query(
      `select
         p.id_producto,
         p.nombre,
         p.codigo_barra,
         p.codigo,
         p.stock,
         p.precio_venta
       from app.producto p
       where coalesce(p.archivado, false) = false
         and (
           p.codigo_barra = $1
           or p.codigo ilike $2
           or p.nombre ilike $2
         )
       order by
         case when p.codigo_barra = $1 then 0 else 1 end,
         p.nombre asc
       limit 25`,
      [q, term],
    );

    return NextResponse.json({ data: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Error al buscar productos" },
      { status: 500 },
    );
  }
}
