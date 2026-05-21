"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeName(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function normalizeDescription(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

const MIN_BARCODE_LEN = 3;
const BARCODE_HINTS = new Map();
BARCODE_HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.ITF,
]);
BARCODE_HINTS.set(DecodeHintType.TRY_HARDER, true);

function findProductByCodigoBarraExacto(list, code) {
  const c = String(code ?? "").trim();
  if (!c) return null;
  return (Array.isArray(list) ? list : []).find((p) => String(p.codigo_barra ?? "").trim() === c) ?? null;
}

let scanSuccessAudioCtx;

function playScanSuccessSound() {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    scanSuccessAudioCtx = scanSuccessAudioCtx || new AC();
    const ctx = scanSuccessAudioCtx;
    if (ctx.state === "suspended") void ctx.resume();

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(1180, t0 + 0.07);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  } catch {
    // Navegador sin audio o política de autoplay.
  }
}

async function optimizeActiveCameraTrack(videoEl) {
  try {
    const stream = videoEl?.srcObject;
    const track = stream?.getVideoTracks?.()?.[0];
    if (!track?.getCapabilities || !track?.applyConstraints) return;

    const caps = track.getCapabilities();
    const advanced = [];

    if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
      advanced.push({ focusMode: "continuous" });
    }
    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
      advanced.push({ exposureMode: "continuous" });
    }
    if (typeof caps.zoom?.max === "number" && caps.zoom.max >= 1.2) {
      advanced.push({ zoom: Math.min(1.4, caps.zoom.max) });
    }
    if (advanced.length === 0) return;

    await track.applyConstraints({ advanced });
  } catch {
    // Ignorar dispositivos/navegadores que no soportan estas optimizaciones.
  }
}

async function pickBackCameraDeviceId() {
  try {
    const tempStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    tempStream.getTracks().forEach((t) => t.stop());
  } catch {
    // Si falla, se manejará en decodeFromVideoDevice.
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((d) => d.kind === "videoinput");
  if (videoInputs.length === 0) return undefined;

  const rear = videoInputs.find((d) => /back|rear|environment|trasera/i.test(d.label || ""));
  return rear?.deviceId || videoInputs[0].deviceId;
}

export default function IngresoPedidoClient({
  initialProductos = [],
  marcas = [],
  sectores = [],
  listError = null,
}) {
  const [productos, setProductos] = useState(Array.isArray(initialProductos) ? initialProductos : []);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ingresoStock, setIngresoStock] = useState("1");
  const [precioCompra, setPrecioCompra] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevaMarcaId, setNuevaMarcaId] = useState("");
  const [nuevoSectorId, setNuevoSectorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [clearedHint, setClearedHint] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanReady, setScanReady] = useState(false);

  const productosRef = useRef(productos);
  productosRef.current = productos;
  const videoScanRef = useRef(null);
  const scanControlsRef = useRef(null);
  const lastDetectedRef = useRef({ code: "", at: 0 });

  const marcasOptions = useMemo(
    () =>
      (Array.isArray(marcas) ? marcas : [])
        .map((m) => ({ id: Number(m?.id_marca), nombre: String(m?.nombre ?? "") }))
        .filter((m) => Number.isFinite(m.id) && m.id > 0 && m.nombre.trim())
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [marcas],
  );

  const sectoresOptions = useMemo(
    () =>
      (Array.isArray(sectores) ? sectores : [])
        .map((s) => ({ id: Number(s?.id_sector), descripcion: String(s?.descripcion ?? "") }))
        .filter((s) => Number.isFinite(s.id) && s.id > 0 && s.descripcion.trim())
        .sort((a, b) => a.descripcion.localeCompare(b.descripcion)),
    [sectores],
  );

  function selectProduct(p) {
    setSelected(p);
    setPrecioCompra(String(p?.precio_compra ?? 0));
    setPrecioVenta(String(p?.precio_venta ?? 0));
    setIngresoStock("1");
    setClearedHint(false);
    setBanner(null);
  }

  const applySearch = useCallback(
    (termInput, opts = {}) => {
      const raw = String(termInput ?? "").trim();
      const t = raw.toLowerCase();
      if (!t) {
        setBanner({ type: "error", text: "Ingresá código o nombre para buscar." });
        setResultados([]);
        return;
      }

      setQuery(raw);
      setClearedHint(false);

      const exact = findProductByCodigoBarraExacto(productosRef.current, raw);
      if (exact) {
        if (opts.fromScan) playScanSuccessSound();
        selectProduct(exact);
        setResultados([exact]);
        setBanner({
          type: "ok",
          text: opts.fromScan
            ? `Código leído: ${raw}. Producto seleccionado.`
            : `Producto encontrado: ${exact.nombre}`,
        });
        return;
      }

      const rows = productosRef.current.filter((p) => {
        const nom = String(p?.nombre ?? "").toLowerCase();
        const cod = String(p?.codigo ?? "").toLowerCase();
        const cb = String(p?.codigo_barra ?? "").toLowerCase();
        return nom.includes(t) || cod.includes(t) || cb.includes(t);
      });
      const limited = rows.slice(0, 20);
      setResultados(limited);

      if (rows.length === 0) {
        setSelected(null);
        setPrecioCompra("");
        setPrecioVenta("");
        setIngresoStock("1");
        setNuevoNombre(raw);
        setNuevoCodigo("");
        setBanner({
          type: "error",
          text: opts.fromScan
            ? `Código leído (${raw}) no encontrado. Podés crearlo abajo.`
            : "No se encontró producto. Podés crearlo abajo.",
        });
      } else if (rows.length === 1) {
        if (opts.fromScan) playScanSuccessSound();
        selectProduct(rows[0]);
        setBanner(
          opts.fromScan
            ? { type: "ok", text: `Código leído: ${raw}. Producto seleccionado.` }
            : null,
        );
      } else {
        setSelected(null);
        setPrecioCompra("");
        setPrecioVenta("");
        setIngresoStock("1");
        setBanner(
          opts.fromScan
            ? { type: "ok", text: `Código leído: ${raw}. Elegí un producto de la lista.` }
            : null,
        );
      }
    },
    [],
  );

  function runSearch() {
    applySearch(query);
  }

  const abrirCamaraEscaner = useCallback(() => {
    setBanner(null);
    setScanError(null);
    setScanReady(false);
    lastDetectedRef.current = { code: "", at: 0 };
    setCameraOpen(true);
  }, []);

  const handleDetectedCode = useCallback(
    (rawCode) => {
      const code = String(rawCode || "").trim();
      if (code.length < MIN_BARCODE_LEN) return;
      applySearch(code, { fromScan: true });
      setCameraOpen(false);
    },
    [applySearch],
  );

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let cancelled = false;

    const cleanup = () => {
      if (scanControlsRef.current) {
        scanControlsRef.current.stop();
        scanControlsRef.current = null;
      }
      const v = videoScanRef.current;
      if (v) {
        v.pause();
        v.srcObject = null;
      }
    };

    const start = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setScanError("Este navegador no permite acceso a cámara.");
          return;
        }
        const video = videoScanRef.current;
        if (!video) return;

        const deviceId = await pickBackCameraDeviceId();
        const reader = new BrowserMultiFormatReader(BARCODE_HINTS);
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          video,
          (result) => {
            if (cancelled) return;
            const raw = String(result?.getText?.() ?? "").trim();
            if (!raw) return;
            const now = Date.now();
            const last = lastDetectedRef.current;
            if (last.code === raw && now - last.at < 900) return;
            lastDetectedRef.current = { code: raw, at: now };
            if (navigator?.vibrate) navigator.vibrate(120);
            handleDetectedCode(raw);
          },
        );

        if (cancelled) {
          controls?.stop?.();
          return;
        }

        scanControlsRef.current = controls;
        await optimizeActiveCameraTrack(video);
        setScanReady(true);
      } catch (e) {
        const msg = String(e?.message || "");
        if (msg.toLowerCase().includes("permission")) {
          setScanError("Necesitamos acceso a la cámara para escanear códigos.");
        } else {
          setScanError(msg || "No se pudo abrir la cámara.");
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      cleanup();
      setScanReady(false);
    };
  }, [cameraOpen, handleDetectedCode]);

  function onQueryChange(value) {
    setQuery(value);
    if (selected) {
      setSelected(null);
      setResultados([]);
      setPrecioCompra("");
      setPrecioVenta("");
      setIngresoStock("1");
      setClearedHint(true);
    }
  }

  async function postItems(items) {
    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "No se pudo guardar");
    return json;
  }

  async function guardarExistente(e) {
    e.preventDefault();
    if (!selected?.id_producto) return;

    const delta = parseInt(String(ingresoStock).trim(), 10);
    const precioCompraRaw = String(precioCompra ?? "").trim();
    const precioVentaRaw = String(precioVenta ?? "").trim();
    const pc = precioCompraRaw === "" ? Number(selected?.precio_compra ?? 0) : Number(precioCompraRaw);
    const pv = precioVentaRaw === "" ? Number(selected?.precio_venta ?? 0) : Number(precioVentaRaw);
    if (!Number.isFinite(delta) || delta <= 0) {
      setBanner({ type: "error", text: "La cantidad a ingresar debe ser mayor a 0." });
      return;
    }
    if (!Number.isFinite(pc) || pc < 0 || !Number.isFinite(pv) || pv < 0) {
      setBanner({ type: "error", text: "Precios inválidos." });
      return;
    }

    const nuevoStock = Number(selected.stock ?? 0) + delta;
    const payload = {
      id_producto: Number(selected.id_producto),
      codigo_barra: selected.codigo_barra || null,
      codigo: selected.codigo || null,
      nombre: normalizeName(selected.nombre),
      descripcion: normalizeDescription(selected.descripcion),
      marca_id: Number(selected.marca_id) || null,
      sector_id: Number(selected.sector_id) || null,
      stock: nuevoStock,
      precio_compra: pc,
      precio_venta: pv,
      stock_minimo: Number(selected.stock_minimo ?? 0),
    };

    setBusy(true);
    try {
      await postItems([payload]);
      const updated = { ...selected, stock: nuevoStock, precio_compra: pc, precio_venta: pv };
      setSelected(updated);
      setProductos((prev) =>
        prev.map((p) => (Number(p.id_producto) === Number(updated.id_producto) ? updated : p)),
      );
      setBanner({ type: "ok", text: "Ingreso aplicado. Se actualizó stock y precios." });
      setIngresoStock("1");
      setPrecioCompra(String(pc));
      setPrecioVenta(String(pv));
    } catch (e2) {
      setBanner({ type: "error", text: e2?.message || "Error al guardar producto." });
    } finally {
      setBusy(false);
    }
  }

  async function crearNuevo(e) {
    e.preventDefault();
    const name = String(nuevoNombre || "").trim();
    const code = String(nuevoCodigo || "").trim();
    const marcaId = Number(nuevaMarcaId);
    const sectorId = Number(nuevoSectorId);
    const delta = parseInt(String(ingresoStock).trim(), 10);
    const pc = Number(precioCompra);
    const pv = Number(precioVenta);

    if (!name && !code) {
      setBanner({ type: "error", text: "Debés ingresar código o nombre." });
      return;
    }
    if (!Number.isFinite(marcaId) || marcaId <= 0 || !Number.isFinite(sectorId) || sectorId <= 0) {
      setBanner({ type: "error", text: "Seleccioná marca y sector." });
      return;
    }
    if (!Number.isFinite(delta) || delta <= 0) {
      setBanner({ type: "error", text: "La cantidad inicial debe ser mayor a 0." });
      return;
    }
    if (!Number.isFinite(pc) || pc < 0 || !Number.isFinite(pv) || pv < 0) {
      setBanner({ type: "error", text: "Precios inválidos." });
      return;
    }

    setBusy(true);
    try {
      await postItems([
        {
          codigo: code || null,
          codigo_barra: null,
          nombre: normalizeName(name || code),
          descripcion: null,
          marca_id: marcaId,
          sector_id: sectorId,
          stock: delta,
          precio_compra: pc,
          precio_venta: pv,
          stock_minimo: 0,
        },
      ]);
      setBanner({ type: "ok", text: "Producto creado correctamente." });
      setNuevoNombre("");
      setNuevoCodigo("");
      setNuevaMarcaId("");
      setNuevoSectorId("");
      setIngresoStock("1");
      setPrecioCompra("");
      setPrecioVenta("");
      setResultados([]);
      setQuery("");
    } catch (e2) {
      setBanner({ type: "error", text: e2?.message || "Error al crear producto." });
    } finally {
      setBusy(false);
    }
  }

  const showCreate = String(query || "").trim().length > 0 && resultados.length === 0 && !selected;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-4 border-b border-zinc-200/80 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Ingreso de pedido</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Buscá por código o nombre. Si existe, podés modificar stock, precio compra y precio venta.
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

      {clearedHint ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Cambiaste la búsqueda: se limpiaron los datos del producto anterior.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Código o nombre (obligatorio)
          </label>
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
              placeholder="Ej: ms5000, código de barras o nombre"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
            <button
              type="button"
              onClick={abrirCamaraEscaner}
              disabled={productos.length === 0}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
              title="Escanear código de barras con cámara"
              aria-label="Escanear código de barras con cámara"
            >
              <span aria-hidden>📷</span>
            </button>
            <button
              type="button"
              onClick={runSearch}
              disabled={productos.length === 0}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              Buscar
            </button>
          </div>

          <ul className="mt-3 max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
            {resultados.length === 0 ? (
              <li className="px-3 py-3 text-sm text-zinc-500">Sin resultados para mostrar.</li>
            ) : (
              resultados.map((p) => (
                <li key={p.id_producto} className="px-3 py-2.5 hover:bg-zinc-50">
                  <button type="button" onClick={() => selectProduct(p)} className="w-full text-left">
                    <p className="text-sm font-semibold text-zinc-900">{p.nombre}</p>
                    <p className="text-xs text-zinc-500">
                      {p.codigo || "Sin código"} · Stock {Number(p.stock || 0)} · Compra ${money(p.precio_compra)} ·
                      Venta ${money(p.precio_venta)}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          {selected ? (
            <form className="space-y-4" onSubmit={guardarExistente}>
              <h2 className="text-base font-semibold text-zinc-900">Producto encontrado</h2>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <p>
                  <span className="font-semibold text-zinc-900">Nombre:</span> {selected.nombre || "—"}
                </p>
                <p>
                  <span className="font-semibold text-zinc-900">Código:</span> {selected.codigo || "—"}
                </p>
                <p>
                  <span className="font-semibold text-zinc-900">Stock actual:</span> {Number(selected.stock || 0)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Ingreso stock</span>
                  <input
                    type="number"
                    min={1}
                    value={ingresoStock}
                    onChange={(e) => setIngresoStock(e.target.value)}
                    onFocus={() => {
                      if (String(ingresoStock) === "1") setIngresoStock("");
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Precio compra</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={precioCompra}
                    onChange={(e) => setPrecioCompra(e.target.value)}
                    onFocus={() => {
                      if (String(precioCompra) === String(selected?.precio_compra ?? "")) setPrecioCompra("");
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Precio venta</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(e.target.value)}
                    onFocus={() => {
                      if (String(precioVenta) === String(selected?.precio_venta ?? "")) setPrecioVenta("");
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-red-600 hover:to-red-500 disabled:opacity-50"
              >
                {busy ? "Guardando..." : "Guardar ingreso"}
              </button>
            </form>
          ) : showCreate ? (
            <form className="space-y-4" onSubmit={crearNuevo}>
              <h2 className="text-base font-semibold text-zinc-900">Producto no encontrado: crear nuevo</h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Nombre</span>
                  <input
                    type="text"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Código</span>
                  <input
                    type="text"
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Marca</span>
                  <select
                    value={nuevaMarcaId}
                    onChange={(e) => setNuevaMarcaId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  >
                    <option value="">Seleccionar...</option>
                    {marcasOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Sector</span>
                  <select
                    value={nuevoSectorId}
                    onChange={(e) => setNuevoSectorId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  >
                    <option value="">Seleccionar...</option>
                    {sectoresOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.descripcion}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Stock inicial</span>
                  <input
                    type="number"
                    min={1}
                    value={ingresoStock}
                    onChange={(e) => setIngresoStock(e.target.value)}
                    onFocus={() => {
                      if (String(ingresoStock) === "1") setIngresoStock("");
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Precio compra</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={precioCompra}
                    onChange={(e) => setPrecioCompra(e.target.value)}
                    onFocus={() => {
                      if (String(precioCompra) === "0" || String(precioCompra) === "0.00") setPrecioCompra("");
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Precio venta</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(e.target.value)}
                    onFocus={() => {
                      if (String(precioVenta) === "0" || String(precioVenta) === "0.00") setPrecioVenta("");
                    }}
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-red-600 hover:to-red-500 disabled:opacity-50"
              >
                {busy ? "Creando..." : "Crear e ingresar pedido"}
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
              Buscá un producto por código o nombre para continuar.
            </div>
          )}
        </section>
      </div>

      {cameraOpen ? (
        <div
          className="fixed inset-0 z-[72] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-scan-ingreso-pedido"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 id="modal-scan-ingreso-pedido" className="text-base font-semibold text-zinc-900">
                  Escanear código con cámara
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Apuntá al código de barras. Al detectarlo se busca y selecciona el producto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cerrar
              </button>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-black">
              <video ref={videoScanRef} autoPlay playsInline muted className="h-[280px] w-full object-cover" />
              {scanReady && !scanError ? (
                <>
                  <div className="pointer-events-none absolute inset-x-[8%] top-1/2 -translate-y-1/2 border-t-2 border-red-500/90 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                  <div className="pointer-events-none absolute inset-x-[8%] top-[calc(50%-16px)] h-8 rounded-md border border-red-500/35" />
                </>
              ) : null}
              {!scanReady && !scanError ? (
                <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm font-medium text-white">
                  Iniciando cámara...
                </div>
              ) : null}
            </div>

            {scanError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {scanError}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                Si no detecta, acercá o alejá el celular y mejorá la iluminación.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
