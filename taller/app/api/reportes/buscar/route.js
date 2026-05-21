import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buscarMarcas, buscarProductos } from "@/lib/reportesDetalle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const tipo = String(sp.get("tipo") ?? "").trim().toLowerCase();
  const q = String(sp.get("q") ?? "").trim();

  if (!q) return NextResponse.json({ data: [] });

  try {
    if (tipo === "marca") {
      const data = await buscarMarcas(q);
      return NextResponse.json({ data });
    }
    const data = await buscarProductos(q);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error al buscar" }, { status: 500 });
  }
}
