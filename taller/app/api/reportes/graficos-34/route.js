import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { exec } from "@/components/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(param) {
  const t = String(param ?? "").trim();
  if (!YMD_RE.test(t)) return undefined;
  return t;
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fecha_desde = parseYmd(request.nextUrl.searchParams.get("desde"));
  const fecha_hasta = parseYmd(request.nextUrl.searchParams.get("hasta"));

  const par = {};
  if (fecha_desde !== undefined) par.fecha_desde = fecha_desde;
  if (fecha_hasta !== undefined) par.fecha_hasta = fecha_hasta;

  try {
    const raw = await exec("spgetreportegraficos34", par);
    if (raw?.status === "error") {
      return NextResponse.json({ error: raw.message || "Error en reporte" }, { status: 422 });
    }
    return NextResponse.json(raw ?? {});
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}
