import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { exportReporte } from "@/lib/reportesExcel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = new Set(["presupuesto", "ventas", "marcas", "producto", "marca"]);

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const tipo = String(sp.get("tipo") ?? "").trim().toLowerCase();
  if (!TIPOS.has(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  try {
    const { buffer, filename, contentType } = await exportReporte(tipo, {
      desde: sp.get("desde") ?? undefined,
      hasta: sp.get("hasta") ?? undefined,
      periodo: sp.get("periodo") ?? "mes",
      fecha_ref: sp.get("fecha") ?? undefined,
      agrupacion: sp.get("agrupacion") ?? "mes",
      id_producto: sp.get("id_producto") ?? undefined,
      id_marca: sp.get("id_marca") ?? undefined,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error al exportar" }, { status: 500 });
  }
}
