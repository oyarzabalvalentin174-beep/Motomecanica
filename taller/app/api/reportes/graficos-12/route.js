import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { loadGraficos12 } from "@/lib/reportesGraficos12";

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

  const periodo = String(request.nextUrl.searchParams.get("periodo") ?? "mes")
    .trim()
    .toLowerCase();
  const fecha_ref = parseYmd(request.nextUrl.searchParams.get("fecha"));
  const fecha_desde = parseYmd(request.nextUrl.searchParams.get("desde"));
  const fecha_hasta = parseYmd(request.nextUrl.searchParams.get("hasta"));

  const par = { periodo: ["dia", "semana", "ultimomes", "mes", "anio"].includes(periodo) ? periodo : "mes" };
  if (fecha_ref !== undefined) par.fecha_ref = fecha_ref;
  if (fecha_desde !== undefined) par.fecha_desde = fecha_desde;
  if (fecha_hasta !== undefined) par.fecha_hasta = fecha_hasta;

  try {
    const raw = await loadGraficos12(par);
    return NextResponse.json(raw);
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error de base de datos" }, { status: 500 });
  }
}
