"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { buildComprobanteHtmlFromVenta, printComprobanteHtml } from "@/lib/tallerComprobante";

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

function metodoLabel(m) {
  const s = String(m ?? "").trim();
  if (!s) return "—";
  const map = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta",
    debito: "Débito",
    credito: "Crédito",
  };
  return map[s.toLowerCase()] ?? s;
}

function lineasProductosVenta(venta) {
  const det = Array.isArray(venta?.detalle) ? venta.detalle : [];
  return det.map((d, i) => ({
    key: d.id_detalle ?? `${venta.id_venta}-${i}`,
    texto: `${d.producto?.nombre ?? "—"} × ${Number(d.cantidad ?? 0)}`,
  }));
}

function buildPageHref(nextPage, { q = "", desde = "", hasta = "" } = {}) {
  const params = new URLSearchParams();
  if (String(q).trim()) params.set("q", String(q).trim());
  if (String(desde).trim()) params.set("desde", String(desde).trim());
  if (String(hasta).trim()) params.set("hasta", String(hasta).trim());
  params.set("page", String(nextPage));
  return `/ventas/ver-ventas?${params.toString()}`;
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

export default function VerVentasClient({
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
  const [printError, setPrintError] = useState(null);
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
  const hayFiltroProducto = Boolean(String(searchQuery || "").trim());
  const hayFiltroFecha = Boolean(String(fechaDesdeProp || "").trim() || String(fechaHastaProp || "").trim());
  const hayAlgúnFiltro = hayFiltroProducto || hayFiltroFecha;

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
      router.replace(`/ventas/ver-ventas?${params.toString()}`);
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

  const imprimirVenta = useCallback((venta) => {
    setPrintError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const html = buildComprobanteHtmlFromVenta(venta, origin);
    const ok = printComprobanteHtml(html);
    if (!ok) setPrintError("No se pudo abrir el diálogo de impresión.");
  }, []);

  const limpiarFechas = useCallback(() => {
    setFechaDesde("");
    setFechaHasta("");
    lastFiltersRef.current = { ...lastFiltersRef.current, desde: "", hasta: "" };
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    params.set("page", "1");
    startTransition(() => {
      router.replace(`/ventas/ver-ventas?${params.toString()}`);
    });
  }, [router, search, startTransition]);

  const hrefParams = { q: searchQuery, desde: fechaDesdeProp, hasta: fechaHastaProp };

  return (
    <div className="mx-auto w-full max-w-[100rem] px-3 pb-12 pt-2 sm:px-5 lg:px-6">
      <section className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-md shadow-zinc-900/5 sm:px-5">
        <div className="mb-3 flex flex-col gap-3 border-b border-zinc-200/80 pb-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Listado de ventas</h1>
            <p className="mt-1 text-sm text-zinc-500 sm:text-base">
              Historial, productos vendidos y reimpresión de comprobantes.
            </p>
          </div>
          <div
            className="flex shrink-0 items-baseline gap-1.5 self-start rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm ring-1 ring-zinc-100"
            role="status"
            aria-live="polite"
          >
            <span className="text-3xl font-bold tabular-nums leading-none text-zinc-900 sm:text-4xl">{total}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {hayAlgúnFiltro ? "ventas (filtro)" : "ventas"}
            </span>
          </div>
        </div>

        {hayAlgúnFiltro && totalAll !== total ? (
          <p className="mb-3 text-sm text-zinc-600">
            Coinciden <span className="font-semibold text-zinc-900">{total}</span> de{" "}
            <span className="font-semibold">{totalAll}</span> ventas cargadas.
          </p>
        ) : null}

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_auto_auto_auto] lg:items-end">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <label className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="buscar-producto-ventas">
              Producto
            </label>
            <input
              id="buscar-producto-ventas"
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o código…"
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-base text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="ventas-desde">
              Desde
            </label>
            <input
              id="ventas-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-base text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="ventas-hasta">
              Hasta
            </label>
            <input
              id="ventas-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-base text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>
          {(fechaDesde || fechaHasta) && (
            <button
              type="button"
              onClick={limpiarFechas}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 lg:mb-0"
            >
              Limpiar fechas
            </button>
          )}
        </div>

        {listError ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
            {listError}
          </div>
        ) : null}

        {printError ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{printError}</div>
        ) : null}

        {/* Mobile: cards */}
        <div className="space-y-3 md:hidden">
          {listError ? (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-zinc-500">
              No hay datos para mostrar.
            </p>
          ) : initialRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-zinc-500">
              {totalAll === 0
                ? "No hay ventas registradas."
                : hayAlgúnFiltro
                  ? "Ninguna venta coincide con los filtros."
                  : "No hay ventas en esta página."}
            </p>
          ) : (
            initialRows.map((v) => {
              const lineas = lineasProductosVenta(v);
              return (
                <article
                  key={v.id_venta}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zinc-900">{formatFecha(v.fecha)}</p>
                      <p className="mt-0.5 text-sm text-zinc-600">{metodoLabel(v.metodo_pago)}</p>
                    </div>
                    <p className="shrink-0 text-lg font-bold tabular-nums text-zinc-900">${money(v.total)}</p>
                  </div>
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Productos</p>
                    {lineas.length === 0 ? (
                      <p className="mt-1 text-sm text-zinc-400">—</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-sm text-zinc-800">
                        {lineas.map((l) => (
                          <li key={l.key} className="border-l-2 border-red-500/60 pl-2">
                            {l.texto}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-sm text-zinc-600">
                    <span>
                      Subtotal ${money(v.subtotal)}
                      {Number(v.descuento) > 0 ? ` · Desc. $${money(v.descuento)}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => imprimirVenta(v)}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                    >
                      Imprimir
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Desktop / tablet: tabla con scroll horizontal (como stock) */}
        <div className="mt-0 hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg shadow-zinc-900/8 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-base">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100/90">
                  <th className="w-[12%] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500">Fecha</th>
                  <th className="w-[10%] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500">Método</th>
                  <th className="w-[34%] min-w-[14rem] px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500">Productos</th>
                  <th className="w-[10%] px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Subtotal</th>
                  <th className="w-[8%] px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Desc.</th>
                  <th className="w-[10%] px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Total</th>
                  <th className="w-[10%] min-w-[6rem] px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Comp.</th>
                </tr>
              </thead>
              <tbody>
                {listError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                      No hay datos para mostrar.
                    </td>
                  </tr>
                ) : initialRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                      {totalAll === 0
                        ? "No hay ventas registradas."
                        : hayAlgúnFiltro
                          ? "Ninguna venta coincide con los filtros."
                          : "No hay ventas en esta página."}
                    </td>
                  </tr>
                ) : (
                  initialRows.map((v, idx) => {
                    const lineas = lineasProductosVenta(v);
                    return (
                      <tr
                        key={v.id_venta}
                        className={`border-b border-zinc-200 align-top ${idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}
                      >
                        <td className="px-3 py-2.5 font-medium text-zinc-900">{formatFecha(v.fecha)}</td>
                        <td className="px-3 py-2.5 text-zinc-700">{metodoLabel(v.metodo_pago)}</td>
                        <td className="break-words px-3 py-2.5 text-zinc-800">
                          {lineas.length === 0 ? (
                            <span className="text-zinc-400">—</span>
                          ) : lineas.length === 1 ? (
                            <p className="border-l-2 border-red-500/60 pl-2 leading-snug">{lineas[0].texto}</p>
                          ) : (
                            <ol className="list-decimal space-y-1 pl-5 marker:text-zinc-400">
                              {lineas.map((l) => (
                                <li key={l.key} className="leading-snug">
                                  {l.texto}
                                </li>
                              ))}
                            </ol>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-800">{money(v.subtotal)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{money(v.descuento)}</td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-zinc-900">{money(v.total)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => imprimirVenta(v)}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                          >
                            Imprimir
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 ? (
          <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row">
            <p className="text-sm text-zinc-600">
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

        {isPending ? (
          <p className="mt-2 text-center text-sm font-medium text-zinc-500">Actualizando…</p>
        ) : null}
      </section>
    </div>
  );
}
