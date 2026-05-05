import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import VerVentasClient from "@/components/VerVentasClient";
import { exec } from "@/components/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeVentasArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function parseYmd(s) {
  const t = String(s ?? "").trim();
  if (!YMD_RE.test(t)) return null;
  return t;
}

/** Primeros 10 chars si es ISO, si no fecha local Y-M-D. */
function ventaYmd(venta) {
  const raw = venta?.fecha;
  if (raw == null) return null;
  const s = String(raw);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function ventaEnRangoFechas(venta, desdeYmd, hastaYmd) {
  if (!desdeYmd && !hastaYmd) return true;
  const vy = ventaYmd(venta);
  if (!vy) return true;
  if (desdeYmd && vy < desdeYmd) return false;
  if (hastaYmd && vy > hastaYmd) return false;
  return true;
}

function ventaCoincideBusquedaProducto(venta, termLower) {
  if (!termLower) return true;
  const det = Array.isArray(venta?.detalle) ? venta.detalle : [];
  return det.some((d) => {
    const nom = String(d.producto?.nombre ?? "").toLowerCase();
    const cod = String(d.producto?.codigo ?? "").toLowerCase();
    return nom.includes(termLower) || cod.includes(termLower);
  });
}

export default async function VerVentasPage(props) {
  const searchParams = await Promise.resolve(props.searchParams);
  const page = Math.max(1, parseInt(String(searchParams?.page || "1"), 10) || 1);
  const query = String(searchParams?.q || "").trim().toLowerCase();

  let desdeYmd = parseYmd(searchParams?.desde);
  let hastaYmd = parseYmd(searchParams?.hasta);
  if (desdeYmd && hastaYmd && desdeYmd > hastaYmd) {
    const t = desdeYmd;
    desdeYmd = hastaYmd;
    hastaYmd = t;
  }

  let ventas = [];
  let listError = null;

  try {
    const raw = await exec("spgetventas", {});
    ventas = normalizeVentasArray(raw);
  } catch (e) {
    listError = e?.message || "No se pudieron cargar las ventas";
  }

  let filtradas = ventas.filter((v) => ventaEnRangoFechas(v, desdeYmd, hastaYmd));
  filtradas = query ? filtradas.filter((v) => ventaCoincideBusquedaProducto(v, query)) : filtradas;

  const total = filtradas.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtradas.slice(offset, offset + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar />

      <main className="min-h-screen pt-24 sm:pt-28">
        <VerVentasClient
          initialRows={pageRows}
          total={total}
          totalAll={ventas.length}
          page={safePage}
          pageSize={PAGE_SIZE}
          searchQuery={String(searchParams?.q || "")}
          fechaDesde={String(searchParams?.desde || "")}
          fechaHasta={String(searchParams?.hasta || "")}
          listError={listError}
        />
      </main>
    </div>
  );
}
