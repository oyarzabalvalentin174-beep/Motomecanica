import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { exec } from "@/components/db";
import { normalizeSpList } from "@/lib/execHelpers";

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
    const raw = await exec("spbuscarproductos", { termino: q, limite: 25 });
    if (raw?.status === "error") {
      return NextResponse.json({ error: raw.message || "Error al buscar productos" }, { status: 422 });
    }
    return NextResponse.json({ data: normalizeSpList(raw) });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Error al buscar productos" },
      { status: 500 },
    );
  }
}
