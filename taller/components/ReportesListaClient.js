"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const COLLAPSE_LIMIT = 8;

const REPORTES = [
  {
    id: "presupuesto",
    title: "Presupuestos por cliente",
    desc: "ZIP con carpeta presupuesto/: un Excel detallado por cada cliente.",
    icon: "📋",
    needsDates: false,
    agrupacion: false,
    needsPicker: false,
  },
  {
    id: "ventas",
    title: "Ventas por período",
    desc: "Totales facturados por día de la semana o por mes.",
    icon: "📈",
    needsDates: true,
    agrupacion: true,
    needsPicker: false,
  },
  {
    id: "marcas",
    title: "Resumen por marcas",
    desc: "Ventas, stock y ganancia por marca en el período.",
    icon: "🏷️",
    needsDates: true,
    agrupacion: false,
    needsPicker: false,
  },
  {
    id: "producto",
    title: "Reporte por producto",
    desc: "Buscá por código o nombre: ficha, stock, precios y cada venta del período.",
    icon: "📦",
    needsDates: true,
    agrupacion: false,
    needsPicker: true,
    pickerTipo: "producto",
  },
  {
    id: "marca",
    title: "Reporte por marca",
    desc: "Buscá la marca: productos del catálogo y todas las ventas asociadas.",
    icon: "🔖",
    needsDates: true,
    agrupacion: false,
    needsPicker: true,
    pickerTipo: "marca",
  },
];

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CollapsibleBlock({ title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const needsCollapse = count > COLLAPSE_LIMIT;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200">
      <button
        type="button"
        onClick={() => needsCollapse && setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 bg-zinc-50 px-3 py-2.5 text-left sm:px-4 ${
          needsCollapse ? "cursor-pointer hover:bg-zinc-100" : "cursor-default"
        }`}
      >
        <span className="text-sm font-semibold text-zinc-800">
          {title} <span className="font-normal text-zinc-500">({count})</span>
        </span>
        {needsCollapse ? (
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▼
          </span>
        ) : null}
      </button>
      <div className={needsCollapse && !open ? "max-h-[280px] overflow-hidden" : ""}>{children}</div>
      {needsCollapse && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full border-t border-zinc-100 bg-white py-2 text-center text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          Ver las {count} filas ▼
        </button>
      ) : null}
      {needsCollapse && open ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-full border-t border-zinc-100 bg-zinc-50 py-2 text-center text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
        >
          Ocultar ▲
        </button>
      ) : null}
    </div>
  );
}

function EntityPicker({ tipo, onSelect, selected }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 1) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/reportes/buscar?tipo=${tipo}&q=${encodeURIComponent(q.trim())}`,
          { credentials: "include" },
        );
        const j = await res.json();
        setHits(Array.isArray(j.data) ? j.data : []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q, tipo]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 sm:p-4">
      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {tipo === "marca" ? "Buscar marca" : "Buscar producto (código o nombre)"}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tipo === "marca" ? "Ej: Honda, Motul…" : "Ej: código o nombre…"}
          className="mt-1 w-full min-h-[42px] rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
        />
      </label>
      {loading ? <p className="mt-2 text-xs text-zinc-500">Buscando…</p> : null}
      {hits.length > 0 ? (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
          {hits.map((h) => {
            const id = tipo === "marca" ? h.id_marca : h.id_producto;
            const label =
              tipo === "marca"
                ? h.nombre
                : `${h.codigo ? `${h.codigo} · ` : ""}${h.nombre}${h.marca ? ` (${h.marca})` : ""}`;
            const isSel =
              tipo === "marca"
                ? selected?.id_marca === id
                : selected?.id_producto === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(h)}
                  className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-red-50 ${
                    isSel ? "bg-red-50 font-semibold text-red-900" : "text-zinc-800"
                  }`}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {selected ? (
        <p className="mt-2 text-xs text-emerald-800">
          Seleccionado:{" "}
          <span className="font-semibold">
            {tipo === "marca" ? selected.nombre : selected.nombre || selected.codigo}
          </span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">Elegí un ítem de la lista para cargar el reporte.</p>
      )}
    </div>
  );
}

function FichaProducto({ ficha, totales }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {[
        ["Código", ficha.codigo ?? "—"],
        ["Marca", ficha.marca ?? "—"],
        ["Stock", ficha.stock],
        ["P. compra", `$${money(ficha.precio_compra)}`],
        ["P. venta", `$${money(ficha.precio_venta)}`],
        ["Ganancia período", `$${money(totales?.ganancia)}`],
      ].map(([k, v]) => (
        <div key={k} className="rounded-lg border border-zinc-100 bg-zinc-50/90 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{k}</p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-900">{v}</p>
        </div>
      ))}
    </div>
  );
}

function DetalleProductoView({ preview }) {
  const ventas = preview.ventas ?? [];
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-zinc-900">{preview.ficha?.nombre}</h3>
      <FichaProducto ficha={preview.ficha} totales={preview.totales} />
      <div className="flex flex-wrap gap-3 text-sm text-zinc-600">
        <span>
          <strong>{preview.totales?.operaciones}</strong> líneas de venta
        </span>
        <span>
          <strong>{preview.totales?.unidades}</strong> unidades
        </span>
        <span>
          Total <strong>${money(preview.totales?.total)}</strong>
        </span>
      </div>
      <CollapsibleBlock title="Detalle de ventas" count={ventas.length}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
              <tr>
                {["Venta", "Fecha", "Método", "Cant.", "P. unit.", "Subtotal", "Ganancia"].map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventas.map((v, i) => (
                <tr key={`${v.id_venta}-${i}`} className="border-t border-zinc-100 hover:bg-zinc-50/80">
                  <td className="px-3 py-2 font-medium">#{v.id_venta}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{v.fecha}</td>
                  <td className="px-3 py-2">{v.metodo}</td>
                  <td className="px-3 py-2 text-center">{v.cantidad}</td>
                  <td className="px-3 py-2 text-right">${money(v.precio_unitario)}</td>
                  <td className="px-3 py-2 text-right">${money(v.subtotal)}</td>
                  <td className="px-3 py-2 text-right font-medium text-emerald-800">${money(v.ganancia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleBlock>
    </div>
  );
}

function DetalleMarcaView({ preview }) {
  const ventas = preview.ventas ?? [];
  const productos = preview.productos ?? [];
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-zinc-900">Marca: {preview.ficha?.nombre}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Productos", preview.totales?.productos],
          ["Stock total", preview.totales?.stockTotal],
          ["Unidades vendidas", preview.totales?.unidades],
          ["Ganancia", `$${money(preview.totales?.ganancia)}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-zinc-100 bg-zinc-50/90 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-zinc-500">{k}</p>
            <p className="mt-0.5 text-sm font-semibold">{v}</p>
          </div>
        ))}
      </div>
        <CollapsibleBlock title="Productos de la marca" count={productos.length}>
          {productos.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              No hay productos activos asignados a esta marca en el catálogo.
            </p>
          ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
              <tr>
                {["Código", "Producto", "Stock", "Vendidas"].map((c) => (
                  <th key={c} className="px-3 py-2 text-left">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.codigo + p.nombre} className="border-t border-zinc-100">
                  <td className="px-3 py-2">{p.codigo ?? "—"}</td>
                  <td className="px-3 py-2">{p.nombre}</td>
                  <td className="px-3 py-2">{p.stock}</td>
                  <td className="px-3 py-2">{p.vendidas}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          )}
        </CollapsibleBlock>
        <CollapsibleBlock title="Ventas de la marca" count={ventas.length}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
              <tr>
                {["Venta", "Fecha", "Producto", "Cant.", "Subtotal", "Ganancia"].map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 text-left">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventas.map((v, i) => (
                <tr key={`${v.id_venta}-${i}`} className="border-t border-zinc-100">
                  <td className="px-3 py-2">#{v.id_venta}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{v.fecha}</td>
                  <td className="px-3 py-2">
                    {v.codigo ? `${v.codigo} · ` : ""}
                    {v.producto}
                  </td>
                  <td className="px-3 py-2 text-center">{v.cantidad}</td>
                  <td className="px-3 py-2 text-right">${money(v.subtotal)}</td>
                  <td className="px-3 py-2 text-right text-emerald-800">${money(v.ganancia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleBlock>
    </div>
  );
}

export default function ReportesListaClient() {
  const [active, setActive] = useState(null);
  const [desde, setDesde] = useState(firstDayOfMonth());
  const [hasta, setHasta] = useState(todayYmd());
  const [agrupacion, setAgrupacion] = useState("mes");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pickedProducto, setPickedProducto] = useState(null);
  const [pickedMarca, setPickedMarca] = useState(null);

  const report = useMemo(() => REPORTES.find((r) => r.id === active) ?? null, [active]);

  const buildQs = useCallback(() => {
    const p = new URLSearchParams({ tipo: active });
    if (report?.needsDates) {
      if (desde) p.set("desde", desde);
      if (hasta) p.set("hasta", hasta);
    }
    if (report?.agrupacion) p.set("agrupacion", agrupacion);
    if (active === "producto" && pickedProducto?.id_producto) {
      p.set("id_producto", String(pickedProducto.id_producto));
    }
    if (active === "marca" && pickedMarca?.id_marca) {
      p.set("id_marca", String(pickedMarca.id_marca));
    }
    return p.toString();
  }, [active, report, desde, hasta, agrupacion, pickedProducto, pickedMarca]);

  const canLoad =
    !report?.needsPicker ||
    (active === "producto" && pickedProducto) ||
    (active === "marca" && pickedMarca);

  const loadPreview = useCallback(async () => {
    if (!active || !canLoad) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/datos?${buildQs()}`, { credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "No se pudieron cargar los datos");
      setPreview(j);
    } catch (e) {
      setError(e?.message || "Error de red");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [active, buildQs, canLoad]);

  const openReport = (id) => {
    setActive(id);
    setPreview(null);
    setError(null);
    setPickedProducto(null);
    setPickedMarca(null);
  };

  const closeReport = () => {
    setActive(null);
    setPreview(null);
    setError(null);
    setPickedProducto(null);
    setPickedMarca(null);
  };

  useEffect(() => {
    if (!active) return;
    if (report?.needsPicker && !canLoad) return;
    loadPreview();
  }, [active, pickedProducto, pickedMarca, desde, hasta, agrupacion, canLoad, report?.needsPicker, loadPreview]);

  const exportExcel = async () => {
    if (!active) return;
    if (active !== "presupuesto" && !canLoad) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/export?${buildQs()}`, { credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "No se pudo exportar");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const match = disp.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || "reporte.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message || "Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  if (!active) {
    return (
      <div>
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-600/90">Exportaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Reportes Excel</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Elegí un reporte para ver los datos y exportar a Excel.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REPORTES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openReport(r.id)}
              className="group flex flex-col rounded-2xl border border-zinc-200/90 bg-white/95 p-5 text-left shadow-sm transition hover:border-red-200/80 hover:shadow-md"
            >
              <span className="text-2xl" aria-hidden>
                {r.icon}
              </span>
              <span className="mt-3 text-base font-semibold text-zinc-900 group-hover:text-red-800">{r.title}</span>
              <span className="mt-1.5 text-xs leading-relaxed text-zinc-500 sm:text-sm">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white/95 text-zinc-900 shadow-lg">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 sm:text-xl">{report.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{report.desc}</p>
        </div>
        <button
          type="button"
          onClick={closeReport}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          ← Volver a reportes
        </button>
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-6">
        {report.needsPicker ? (
          <EntityPicker
            tipo={report.pickerTipo}
            selected={active === "producto" ? pickedProducto : pickedMarca}
            onSelect={(h) => {
              if (active === "producto") setPickedProducto(h);
              else setPickedMarca(h);
            }}
          />
        ) : null}

        {report.needsDates ? (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Desde
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="mt-1 block min-h-[40px] rounded-lg border border-zinc-200 bg-white px-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Hasta
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="mt-1 block min-h-[40px] rounded-lg border border-zinc-200 bg-white px-2 text-sm"
              />
            </label>
            {report.agrupacion ? (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "semana", label: "Día de semana" },
                  { id: "mes", label: "Por mes" },
                ].map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAgrupacion(a.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      agrupacion === a.id ? "bg-red-600 text-white" : "border border-zinc-200 bg-white"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={loadPreview}
              disabled={loading || !canLoad}
              className="min-h-[40px] rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Cargando…" : "Actualizar"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Cargando…" : "Actualizar listado"}
          </button>
        )}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : null}

        {preview?.pickHint && !canLoad ? (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
            {preview.pickHint}
          </p>
        ) : null}

        {loading && !preview ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando datos…</p>
        ) : null}

        {preview?.mode === "detalle" && active === "producto" ? <DetalleProductoView preview={preview} /> : null}
        {preview?.mode === "detalle" && active === "marca" ? <DetalleMarcaView preview={preview} /> : null}

        {preview?.columns?.length ? (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            {preview.meta?.hint ? (
              <p className="border-b bg-amber-50/80 px-3 py-2 text-xs text-amber-950">{preview.meta.hint}</p>
            ) : null}
            {preview.meta?.total != null ? (
              <p className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-600">
                Registros: <span className="font-semibold">{preview.meta.total}</span>
              </p>
            ) : null}
            <table className="min-w-full text-sm text-zinc-900">
              <thead className="bg-zinc-100 text-xs font-semibold uppercase text-zinc-700">
                <tr>
                  {preview.columns.map((c) => (
                    <th key={c} className="px-3 py-2.5 text-left">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows?.length ? (
                  preview.rows.map((row, i) => (
                    <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50/80">
                      {row.map((cell, j) => (
                        <td key={j} className="whitespace-nowrap px-3 py-2 text-zinc-900">
                          {cell === 0 || cell ? String(cell) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={preview.columns.length} className="px-3 py-8 text-center text-zinc-500">
                      {active === "presupuesto"
                        ? "No hay presupuestos guardados."
                        : "Sin datos en el período."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-zinc-100 pt-4 pb-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={exporting || (active !== "presupuesto" && !canLoad)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-gradient-to-r from-red-700 to-red-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {exporting
              ? "Generando…"
              : active === "presupuesto"
                ? "Descargar ZIP (presupuesto/)"
                : "Exportar a Excel"}
          </button>
        </div>
      </div>
    </div>
  );
}
