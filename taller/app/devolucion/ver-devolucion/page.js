import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import VerDevolucionesClient from "@/components/VerDevolucionesClient";
import { exec } from "@/components/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeArray(raw) {
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

function rowYmd(row) {
  const raw = row?.fecha;
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

function rowInDateRange(row, desdeYmd, hastaYmd) {
  if (!desdeYmd && !hastaYmd) return true;
  const ymd = rowYmd(row);
  if (!ymd) return true;
  if (desdeYmd && ymd < desdeYmd) return false;
  if (hastaYmd && ymd > hastaYmd) return false;
  return true;
}

function rowMatchesQuery(row, termLower) {
  if (!termLower) return true;
  const idVenta = String(row?.id_venta ?? "").toLowerCase();
  const nom = String(row?.producto_nombre ?? "").toLowerCase();
  const cod = String(row?.producto_codigo ?? "").toLowerCase();
  const mot = String(row?.motivo ?? "").toLowerCase();
  return (
    idVenta.includes(termLower) ||
    nom.includes(termLower) ||
    cod.includes(termLower) ||
    mot.includes(termLower)
  );
}

export default async function VerDevolucionPage(props) {
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

  let devoluciones = [];
  let listError = null;

  try {
    const raw = await exec("spgetdevoluciones", {});
    devoluciones = normalizeArray(raw);
  } catch (e) {
    listError = e?.message || "No se pudieron cargar las devoluciones";
  }

  let filtradas = devoluciones.filter((d) => rowInDateRange(d, desdeYmd, hastaYmd));
  filtradas = query ? filtradas.filter((d) => rowMatchesQuery(d, query)) : filtradas;

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
        <VerDevolucionesClient
          initialRows={pageRows}
          total={total}
          totalAll={devoluciones.length}
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
