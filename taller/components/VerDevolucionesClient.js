"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 10;

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(raw) {
  if (raw == null || raw === "") return "—";
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(raw);
  }
}

function buildPageHref(nextPage, { q = "", desde = "", hasta = "" } = {}) {
  const params = new URLSearchParams();
  if (String(q).trim()) params.set("q", String(q).trim());
  if (String(desde).trim()) params.set("desde", String(desde).trim());
  if (String(hasta).trim()) params.set("hasta", String(hasta).trim());
  params.set("page", String(nextPage));
  return `/devolucion/ver-devolucion?${params.toString()}`;
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaginationLink({ href, disabled, children }) {
  if (disabled || !href) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-400">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-red-400 hover:bg-red-50 hover:text-red-900"
    >
      {children}
    </Link>
  );
}

export default function VerDevolucionesClient({
  initialRows = [],
  total = 0,
  totalAll = 0,
  page = 1,
  pageSize = PAGE_SIZE,
  searchQuery = "",
  fechaDesde: fechaDesdeProp = "",
  fechaHasta: fechaHastaProp = "",
  listError = null,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchQuery);
  const [fechaDesde, setFechaDesde] = useState(fechaDesdeProp);
  const [fechaHasta, setFechaHasta] = useState(fechaHastaProp);
  const isFirstFilterRender = useRef(true);
  const lastFiltersRef = useRef({
    q: String(searchQuery || "").trim(),
    desde: String(fechaDesdeProp || "").trim(),
    hasta: String(fechaHastaProp || "").trim(),
  });

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const hayFiltroBusqueda = Boolean(String(searchQuery || "").trim());
  const hayFiltroFecha = Boolean(String(fechaDesdeProp || "").trim() || String(fechaHastaProp || "").trim());
  const hayAlgunFiltro = hayFiltroBusqueda || hayFiltroFecha;

  useEffect(() => {
    setSearch(searchQuery);
    setFechaDesde(fechaDesdeProp);
    setFechaHasta(fechaHastaProp);
    lastFiltersRef.current = {
      q: String(searchQuery || "").trim(),
      desde: String(fechaDesdeProp || "").trim(),
      hasta: String(fechaHastaProp || "").trim(),
    };
  }, [searchQuery, fechaDesdeProp, fechaHastaProp]);

  const pushFilters = useCallback(() => {
    const q = search.trim();
    const d0 = fechaDesde.trim();
    const d1 = fechaHasta.trim();
    const prev = lastFiltersRef.current;
    if (prev.q === q && prev.desde === d0 && prev.hasta === d1) return;
    lastFiltersRef.current = { q, desde: d0, hasta: d1 };
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (d0) params.set("desde", d0);
    if (d1) params.set("hasta", d1);
    params.set("page", "1");
    startTransition(() => {
      router.replace(`/devolucion/ver-devolucion?${params.toString()}`);
    });
  }, [search, fechaDesde, fechaHasta, router, startTransition]);

  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      pushFilters();
    }, 280);
    return () => clearTimeout(timeout);
  }, [search, fechaDesde, fechaHasta, pushFilters]);

  const limpiarFechas = useCallback(() => {
    setFechaDesde("");
    setFechaHasta("");
    lastFiltersRef.current = { ...lastFiltersRef.current, desde: "", hasta: "" };
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    params.set("page", "1");
    startTransition(() => {
      router.replace(`/devolucion/ver-devolucion?${params.toString()}`);
    });
  }, [router, search, startTransition]);

  const hrefParams = { q: searchQuery, desde: fechaDesdeProp, hasta: fechaHastaProp };

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      <section className="rounded-2xl border border-zinc-200/90 bg-white/95 p-4 shadow-md ring-1 ring-zinc-100 sm:p-5">
      <div className="mb-3 flex flex-col gap-3 border-b border-zinc-200/80 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Listado de devoluciones</h1>
          <p className="mt-0.5 text-sm text-zinc-500 sm:text-base">
            Historial de devoluciones registradas por venta y producto.
          </p>
        </div>
        <div
          className="flex shrink-0 items-baseline gap-1.5 self-start rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm ring-1 ring-zinc-100 sm:self-auto"
          role="status"
          aria-live="polite"
        >
          <span className="text-3xl font-bold tabular-nums leading-none text-zinc-900 sm:text-4xl">{total}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {hayAlgunFiltro ? "devoluciones (filtro)" : "devoluciones"}
          </span>
        </div>
      </div>

      {hayAlgunFiltro && totalAll !== total ? (
        <p className="mb-2 text-sm text-zinc-600">
          Coinciden <span className="font-semibold text-zinc-900">{total}</span> de{" "}
          <span className="font-semibold">{totalAll}</span> devoluciones registradas.
        </p>
      ) : null}

      <div className="mb-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end md:gap-x-3 md:gap-y-2">
        <div className="min-w-0 w-full md:w-[min(100%,19rem)] lg:w-[22rem]">
          <label
            className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
            htmlFor="buscar-devoluciones"
          >
            Venta, producto o motivo
          </label>
          <input
            id="buscar-devoluciones"
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID venta, nombre, código o motivo…"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none ring-0 transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
          <div>
            <label
              className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
              htmlFor="devoluciones-desde"
            >
              Desde
            </label>
            <input
              id="devoluciones-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full min-w-[9.25rem] rounded-lg border border-zinc-200 bg-white px-2 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20 sm:w-auto"
            />
          </div>
          <div>
            <label
              className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
              htmlFor="devoluciones-hasta"
            >
              Hasta
            </label>
            <input
              id="devoluciones-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full min-w-[9.25rem] rounded-lg border border-zinc-200 bg-white px-2 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20 sm:w-auto"
            />
          </div>
          {(fechaDesde || fechaHasta) && (
            <button
              type="button"
              onClick={limpiarFechas}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 sm:text-sm"
            >
              Limpiar fechas
            </button>
          )}
        </div>
      </div>

      {listError ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          {listError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-left text-sm leading-snug">
            <colgroup>
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/90 text-[11px] font-semibold uppercase leading-tight tracking-wide text-zinc-600">
              <tr>
                <th className="px-1.5 py-1.5 sm:px-2">Fecha</th>
                <th className="px-1.5 py-1.5 sm:px-2">Venta</th>
                <th className="px-1.5 py-1.5 sm:px-2">Producto</th>
                <th className="px-1.5 py-1.5 sm:px-2">Motivo</th>
                <th className="px-1.5 py-1.5 text-right sm:px-2">P. Unit.</th>
                <th className="px-1.5 py-1.5 text-right sm:px-2">Cant.</th>
                <th className="px-1.5 py-1.5 text-right sm:px-2">Subtotal</th>
                <th className="px-1.5 py-1.5 text-center sm:px-2">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {listError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                    No hay datos para mostrar.
                  </td>
                </tr>
              ) : initialRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    {totalAll === 0
                      ? "No hay devoluciones registradas."
                      : hayAlgunFiltro
                        ? "Ninguna devolución coincide con los filtros."
                        : "No hay devoluciones en esta página."}
                  </td>
                </tr>
              ) : (
                initialRows.map((d) => (
                  <tr key={d.id_devolucion} className="align-top hover:bg-zinc-50/80">
                    <td className="px-2 py-2 text-[13px] font-medium text-zinc-900">
                      {formatFecha(d.fecha)}
                    </td>
                    <td className="px-2 py-2 text-[13px] font-semibold text-zinc-700">
                      #{d.id_venta ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-[13px] text-zinc-800">
                      <p className="font-medium text-zinc-900">{d.producto_nombre ?? "—"}</p>
                      <p className="text-xs text-zinc-500">{d.producto_codigo || "Sin código"}</p>
                    </td>
                    <td className="px-2 py-2 text-[13px] text-zinc-700">
                      {d.motivo || "—"}
                    </td>
                    <td className="px-2 py-2 text-right text-[13px] tabular-nums text-zinc-800">
                      {money(d.precio_unitario)}
                    </td>
                    <td className="px-2 py-2 text-right text-[13px] tabular-nums font-semibold text-zinc-900">
                      {Number(d.cantidad ?? 0)}
                    </td>
                    <td className="px-2 py-2 text-right text-[13px] tabular-nums text-zinc-800">
                      {money(d.subtotal)}
                    </td>
                    <td className="px-1.5 py-1.5 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          d.agregado_stock ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {d.agregado_stock ? "Sí" : "No"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/80 px-3 py-3 sm:flex-row sm:px-4">
            <p className="text-sm font-medium text-zinc-600">
              Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <PaginationLink
                href={page <= 1 ? null : buildPageHref(page - 1, hrefParams)}
                disabled={page <= 1}
              >
                <span className="flex items-center gap-1 pr-1">
                  <ChevronLeft />
                  Anterior
                </span>
              </PaginationLink>
              <span className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-zinc-800 ring-1 ring-zinc-200">
                {page} / {totalPages}
              </span>
              <PaginationLink
                href={page >= totalPages ? null : buildPageHref(page + 1, hrefParams)}
                disabled={page >= totalPages}
              >
                <span className="flex items-center gap-1 pl-1">
                  Siguiente
                  <ChevronRight />
                </span>
              </PaginationLink>
            </div>
          </div>
        ) : null}
      </div>

      {isPending ? <p className="mt-3 text-center text-sm font-medium text-zinc-500">Actualizando…</p> : null}
      </section>
    </div>
  );
}
