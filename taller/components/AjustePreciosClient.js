"use client";

import { useMemo, useState } from "react";

export default function AjustePreciosClient({ marcas = [], listError = null }) {
  const [scope, setScope] = useState("producto");
  const [operation, setOperation] = useState("aumentar");
  const [percentage, setPercentage] = useState("");
  const [search, setSearch] = useState("");
  const [searchRows, setSearchRows] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [marcaId, setMarcaId] = useState("");
  const [busySearch, setBusySearch] = useState(false);
  const [busySubmit, setBusySubmit] = useState(false);
  const [banner, setBanner] = useState(null);

  const marcasOrdenadas = useMemo(
    () =>
      (Array.isArray(marcas) ? marcas : [])
        .map((m) => ({ id: Number(m?.id_marca), nombre: String(m?.nombre ?? "") }))
        .filter((m) => Number.isFinite(m.id) && m.id > 0 && m.nombre.trim())
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [marcas],
  );

  const scopeLabel =
    scope === "producto" ? "Producto específico" : scope === "marca" ? "Por marca" : "Todos los productos";

  async function buscarProducto() {
    const q = search.trim();
    if (!q) {
      setSearchRows([]);
      return;
    }
    setBusySearch(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/productos-buscar?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo buscar productos");
      setSearchRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setSearchRows([]);
      setBanner({ type: "error", text: e?.message || "Error al buscar productos." });
    } finally {
      setBusySearch(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBanner(null);

    const pct = Number(percentage);
    if (!Number.isFinite(pct) || pct <= 0) {
      setBanner({ type: "error", text: "Ingresá un porcentaje válido mayor a 0." });
      return;
    }
    if (scope === "producto" && !selectedProduct?.id_producto) {
      setBanner({ type: "error", text: "Seleccioná un producto para ajustar." });
      return;
    }
    if (scope === "marca" && (!marcaId || Number(marcaId) <= 0)) {
      setBanner({ type: "error", text: "Seleccioná una marca para ajustar." });
      return;
    }

    setBusySubmit(true);
    try {
      const payload = {
        scope,
        operation,
        percentage: pct,
        ...(scope === "producto" ? { id_producto: Number(selectedProduct.id_producto) } : {}),
        ...(scope === "marca" ? { marca_id: Number(marcaId) } : {}),
      };

      const res = await fetch("/api/ajuste-precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo aplicar el ajuste");

      const updated = Number(json?.data?.updated ?? 0);
      setBanner({
        type: "ok",
        text: `Ajuste aplicado: ${operation} ${pct}% en ${updated} producto(s).`,
      });
    } catch (e2) {
      setBanner({ type: "error", text: e2?.message || "Error al aplicar ajuste de precios." });
    } finally {
      setBusySubmit(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="rounded-2xl border border-zinc-200 bg-white/95 p-5 shadow-md ring-1 ring-zinc-100">
        <header className="mb-4 border-b border-zinc-200/80 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Ajuste de precios</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Aplicá aumentos o descuentos por el mismo porcentaje a precio de compra y de venta (producto, marca o todo el
            catálogo).
          </p>
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Modo</span>
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setSelectedProduct(null);
                  setSearchRows([]);
                  setSearch("");
                  setMarcaId("");
                }}
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              >
                <option value="producto">Producto específico</option>
                <option value="marca">Por marca</option>
                <option value="todos">Todos los productos</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Operación</span>
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              >
                <option value="aumentar">Aumentar</option>
                <option value="disminuir">Disminuir</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Porcentaje (%)</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                placeholder="Ej: 7.5"
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              />
            </label>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-sm text-zinc-700">
            Modo seleccionado: <span className="font-semibold">{scopeLabel}</span>. Se va a{" "}
            <span className="font-semibold">{operation}</span> el precio de venta en el porcentaje indicado.
          </div>

          {scope === "producto" ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-zinc-900">Seleccionar producto</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por código o nombre"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
                <button
                  type="button"
                  onClick={buscarProducto}
                  disabled={busySearch || !search.trim()}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {busySearch ? "Buscando..." : "Buscar"}
                </button>
              </div>

              <ul className="mt-3 max-h-56 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
                {searchRows.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-zinc-500">Sin resultados.</li>
                ) : (
                  searchRows.map((p) => (
                    <li key={p.id_producto} className="px-3 py-2.5 hover:bg-zinc-50">
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(p)}
                        className="w-full text-left"
                      >
                        <p className="text-sm font-semibold text-zinc-900">{p.nombre}</p>
                        <p className="text-xs text-zinc-500">
                          {p.codigo || "Sin código"} · CB {p.codigo_barra || "—"} · ${Number(p.precio_venta || 0).toFixed(2)}
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>

              {selectedProduct ? (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  Producto seleccionado: <span className="font-semibold">{selectedProduct.nombre}</span> (
                  {selectedProduct.codigo || "sin código"})
                </div>
              ) : null}
            </div>
          ) : null}

          {scope === "marca" ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-zinc-900">Seleccionar marca</span>
                <select
                  value={marcaId}
                  onChange={(e) => setMarcaId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Seleccionar...</option>
                  {marcasOrdenadas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {scope === "todos" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Este ajuste impactará en todos los productos activos.
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busySubmit}
              className="rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-red-600 hover:to-red-500 disabled:opacity-50"
            >
              {busySubmit ? "Aplicando..." : "Aplicar ajuste"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
