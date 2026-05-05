"use client";

import { useEffect, useMemo, useState } from "react";

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

function matchesSearch(venta, termLower) {
  if (!termLower) return true;
  const idVenta = String(venta?.id_venta ?? "").toLowerCase();
  if (idVenta.includes(termLower)) return true;
  const det = Array.isArray(venta?.detalle) ? venta.detalle : [];
  return det.some((d) => {
    const nom = String(d?.producto?.nombre ?? "").toLowerCase();
    const cod = String(d?.producto?.codigo ?? "").toLowerCase();
    return nom.includes(termLower) || cod.includes(termLower);
  });
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

export default function DevolucionClient({ initialVentas = [], listError = null }) {
  const [ventas, setVentas] = useState(Array.isArray(initialVentas) ? initialVentas : []);
  const [query, setQuery] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [selectedVentaId, setSelectedVentaId] = useState("");
  const [selectedDetalleId, setSelectedDetalleId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [agregarStock, setAgregarStock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);

  const ventasFiltradas = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    const d0 = String(fechaDesde || "").trim();
    const d1 = String(fechaHasta || "").trim();
    const desde = d0 && d1 && d0 > d1 ? d1 : d0;
    const hasta = d0 && d1 && d0 > d1 ? d0 : d1;

    return ventas
      .filter((v) => {
        if (!matchesSearch(v, q)) return false;
        const ymd = ventaYmd(v);
        if (!ymd) return true;
        if (desde && ymd < desde) return false;
        if (hasta && ymd > hasta) return false;
        return true;
      })
      .map((v) => {
        const det = Array.isArray(v?.detalle) ? v.detalle : [];
        const devolvibles = det.reduce((acc, d) => acc + Math.max(0, Number(d?.disponible ?? 0)), 0);
        return { ...v, devolvibles };
      })
      .filter((v) => v.devolvibles > 0);
  }, [ventas, query, fechaDesde, fechaHasta]);

  const selectedVenta = useMemo(
    () => ventas.find((v) => String(v?.id_venta) === String(selectedVentaId)) ?? null,
    [ventas, selectedVentaId],
  );

  const detallesDisponibles = useMemo(() => {
    const det = Array.isArray(selectedVenta?.detalle) ? selectedVenta.detalle : [];
    return det.filter((d) => Number(d?.disponible ?? 0) > 0);
  }, [selectedVenta]);

  const selectedDetalle = useMemo(
    () => detallesDisponibles.find((d) => String(d?.id_detalle) === String(selectedDetalleId)) ?? null,
    [detallesDisponibles, selectedDetalleId],
  );

  useEffect(() => {
    if (ventasFiltradas.length === 0) {
      if (selectedVentaId) {
        setSelectedVentaId("");
        setSelectedDetalleId("");
      }
      return;
    }
    const exists = ventasFiltradas.some((v) => String(v?.id_venta) === String(selectedVentaId));
    if (!exists) {
      setSelectedVentaId(String(ventasFiltradas[0].id_venta));
      setSelectedDetalleId("");
    }
  }, [ventasFiltradas, selectedVentaId]);

  async function submitDevolucion(e) {
    e.preventDefault();
    setBanner(null);

    if (!selectedVenta) {
      setBanner({ type: "error", text: "Seleccioná una venta." });
      return;
    }
    if (!selectedDetalle) {
      setBanner({ type: "error", text: "Seleccioná un ítem a devolver." });
      return;
    }

    const cant = parseInt(String(cantidad).trim(), 10);
    const maxCantidad = Number(selectedDetalle?.disponible ?? 0);
    if (!Number.isFinite(cant) || cant <= 0) {
      setBanner({ type: "error", text: "La cantidad debe ser mayor a 0." });
      return;
    }
    if (cant > maxCantidad) {
      setBanner({ type: "error", text: `Cantidad inválida. Máximo: ${maxCantidad}.` });
      return;
    }
    if (!String(motivo).trim()) {
      setBanner({ type: "error", text: "Ingresá el motivo de la devolución." });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/devolucion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_venta: String(selectedVenta.id_venta),
          id_detalle_venta: Number(selectedDetalle.id_detalle),
          cantidad: cant,
          motivo: String(motivo).trim(),
          agregar_stock: agregarStock,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "No se pudo registrar la devolución");
      }

      const rem = Number(json?.data?.disponible_restante ?? maxCantidad - cant);
      setVentas((prev) =>
        prev.map((v) => {
          if (String(v?.id_venta) !== String(selectedVenta.id_venta)) return v;
          const nextDet = (Array.isArray(v?.detalle) ? v.detalle : []).map((d) => {
            if (String(d?.id_detalle) !== String(selectedDetalle.id_detalle)) return d;
            const ya = Number(d?.ya_devuelto ?? 0) + cant;
            return { ...d, ya_devuelto: ya, disponible: Math.max(0, rem) };
          });
          return { ...v, detalle: nextDet };
        }),
      );

      setCantidad("1");
      setMotivo("");
      setSelectedDetalleId("");
      setBanner({
        type: "ok",
        text: `Devolución registrada para ${selectedDetalle.producto?.nombre ?? "producto"} (x${cant}).`,
      });
    } catch (err) {
      setBanner({ type: "error", text: err?.message || "Error inesperado al registrar la devolución." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-7xl flex-col px-3 py-3 sm:h-[calc(100dvh-8rem)] sm:px-5 sm:py-4 lg:px-6">
      <header className="mb-2 flex flex-col gap-2 border-b border-zinc-200/80 pb-2 sm:mb-3 sm:pb-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Nueva devolución</h1>
          <p className="mt-0.5 text-xs text-zinc-600 sm:text-sm">
            Filtrá ventas, elegí producto y registrá la devolución con motivo.
          </p>
        </div>
        <div className="flex shrink-0 items-baseline gap-1.5 self-start rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-zinc-100 md:self-auto">
          <span className="text-xl font-bold tabular-nums leading-none text-zinc-900 sm:text-2xl">
            {ventasFiltradas.length}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            ventas filtradas
          </span>
        </div>
      </header>

      {listError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          {listError}
        </div>
      ) : null}

      {banner ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full gap-4 lg:grid-cols-[1.08fr_1fr] xl:grid-cols-[1.12fr_1fr]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white/95 shadow-sm ring-1 ring-zinc-100">
          <div className="border-b border-zinc-200 bg-zinc-50/70 px-3 py-3 sm:px-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Buscador
                </label>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ID venta, nombre o código de producto..."
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div className="sm:min-w-[9.75rem]">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div className="sm:min-w-[9.75rem]">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </div>
          </div>

          <ul className="min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto">
            {ventasFiltradas.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-500">
                No hay ventas con unidades disponibles para devolución.
              </li>
            ) : (
              ventasFiltradas.map((v) => {
                const isSelected = String(v?.id_venta) === String(selectedVentaId);
                const detalle = Array.isArray(v?.detalle) ? v.detalle : [];
                return (
                  <li key={v.id_venta}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVentaId(String(v.id_venta));
                        setSelectedDetalleId("");
                        setBanner(null);
                      }}
                      className={`w-full cursor-pointer px-3 py-2.5 text-left transition sm:px-4 sm:py-3 ${
                        isSelected ? "bg-red-50/70 ring-1 ring-inset ring-red-200" : "hover:bg-zinc-50/80"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-900 sm:text-base">Venta #{v.id_venta}</p>
                        <p className="text-[11px] text-zinc-600 sm:text-xs">{formatFecha(v.fecha)}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-600 sm:text-xs">
                        {metodoLabel(v.metodo_pago)} · Total ${money(v.total)} · Devolvibles:{" "}
                        <span className="font-semibold text-zinc-900">{v.devolvibles}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {detalle.slice(0, 4).map((d) => (
                          <span
                            key={d.id_detalle}
                            className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700"
                          >
                            {d.producto?.codigo || "—"} · {d.producto?.nombre || "Producto"}
                          </span>
                        ))}
                        {detalle.length > 4 ? (
                          <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                            +{detalle.length - 4} más
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200/80 bg-white/95 p-4 shadow-sm ring-1 ring-zinc-100 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">Registrar devolución</h2>

          {!selectedVenta ? (
            <p className="mt-4 text-sm text-zinc-600">Seleccioná una venta de la lista para continuar.</p>
          ) : (
            <form className="mt-3 min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-1 sm:mt-4 sm:space-y-4" onSubmit={submitDevolucion}>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-900">Venta #{selectedVenta.id_venta}</p>
                <p>{formatFecha(selectedVenta.fecha)}</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Producto</label>
                <select
                  value={selectedDetalleId}
                  onChange={(e) => setSelectedDetalleId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Seleccionar...</option>
                  {detallesDisponibles.map((d) => (
                    <option key={d.id_detalle} value={d.id_detalle}>
                      [{d.producto?.codigo || "—"}] {d.producto?.nombre || "Producto"} · Vendido {d.cantidad} ·
                      Disponible {d.disponible}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Number(selectedDetalle?.disponible ?? 1))}
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20 sm:py-2 sm:text-sm"
                  />
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Precio unitario</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    ${money(Number(selectedDetalle?.precio_unitario ?? 0))}
                  </p>
                </div>
              </div>

              {selectedDetalle ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  Devuelto previamente: <span className="font-semibold">{selectedDetalle.ya_devuelto ?? 0}</span> ·
                  Disponible ahora: <span className="font-semibold">{selectedDetalle.disponible ?? 0}</span>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Motivo</label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={4}
                  placeholder="Ej: producto fallado, error de facturación, etc."
                  className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={agregarStock}
                  onChange={(e) => setAgregarStock(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500/40"
                />
                Reingresar unidades al stock
              </label>

              <button
                type="submit"
                disabled={busy || !selectedDetalle}
                className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-red-600 hover:to-red-500 disabled:opacity-50 sm:py-2.5"
              >
                {busy ? "Guardando..." : "Registrar devolución"}
              </button>
            </form>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
