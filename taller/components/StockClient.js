"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

const EMPTY_FORM = {
  id_producto: null,
  codigo_barra: "",
  codigo: "",
  nombre: "",
  descripcion: "",
  marca_id: "",
  sector_id: "",
  stock: "",
  precio_venta: "",
  precio_compra: "",
  stock_minimo: "",
};

const PAGE_SIZE = 10;
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

const MIN_BARCODE_LEN = 3;

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
    // Ignorar dispositivos/navegadores sin soporte de constraints avanzadas.
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
    // Si falla, se manejará luego al iniciar scanner.
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((d) => d.kind === "videoinput");
  if (videoInputs.length === 0) return undefined;

  const rear = videoInputs.find((d) => /back|rear|environment|trasera/i.test(d.label || ""));
  return rear?.deviceId || videoInputs[0].deviceId;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Precios según método de pago (misma lógica que ventas). */
function preciosPorMetodo(precioVenta) {
  const lista = round2(precioVenta);
  return {
    lista,
    efectivo: round2(lista * 0.9),
    transferencia: round2(lista * 0.95),
    tarjeta: lista,
  };
}

function normalizeSearch(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Buscador suelto: cada palabra cuenta por separado (sin exigir frase continua ni conectores). */
function matchesLooseSearch(row, rawTerm) {
  const STOP = new Set(["de", "del", "la", "el", "los", "las", "y", "o", "a", "en", "para", "con", "por", "un", "una", "al"]);

  const parts = normalizeSearch(rawTerm)
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter(Boolean);

  if (parts.length === 0) return true;

  const tokens = parts.filter((t) => t.length > 1 && !STOP.has(t));
  const meaningful = tokens.length > 0 ? tokens : parts;

  const blob = normalizeSearch(
    [
      row.id_producto,
      row.codigo_barra,
      row.codigo,
      row.nombre,
      row.descripcion,
      row.marca_nombre,
      row.sector_descripcion,
    ]
      .filter((v) => v != null && String(v).trim() !== "")
      .join(" "),
  );

  return meaningful.every((token) => blob.includes(token));
}

function toForm(row) {
  return {
    id_producto: row?.id_producto ?? null,
    codigo_barra: row?.codigo_barra ?? "",
    codigo: row?.codigo ?? "",
    nombre: row?.nombre ?? "",
    descripcion: row?.descripcion ?? "",
    marca_id: row?.marca_id ? String(row.marca_id) : "",
    sector_id: row?.sector_id ? String(row.sector_id) : "",
    stock: String(row?.stock ?? 0),
    precio_venta: String(row?.precio_venta ?? 0),
    precio_compra: String(row?.precio_compra ?? 0),
    stock_minimo: String(row?.stock_minimo ?? 5),
  };
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function mapPayload(formState) {
  return {
    ...(formState.id_producto ? { id_producto: Number(formState.id_producto) } : {}),
    codigo_barra: formState.codigo_barra.trim() || null,
    codigo: formState.codigo.trim() || null,
    nombre: normalizeName(formState.nombre),
    descripcion: normalizeDescription(formState.descripcion),
    marca_id: cleanNumber(formState.marca_id, null),
    sector_id: cleanNumber(formState.sector_id, null),
    stock: cleanNumber(formState.stock, 0),
    precio_venta: cleanNumber(formState.precio_venta, 0),
    precio_compra: cleanNumber(formState.precio_compra, 0),
    stock_minimo: cleanNumber(formState.stock_minimo, 0),
  };
}

function isValid(formState) {
  const compra = Number(formState.precio_compra);
  const venta = Number(formState.precio_venta);
  return (
    formState.nombre.trim() &&
    formState.marca_id &&
    formState.sector_id &&
    venta >= 0 &&
    compra >= 0 &&
    venta >= compra
  );
}

function getStockDotClass(stock, stockMinimo) {
  const s = Number(stock || 0);
  const min = Number(stockMinimo || 0);

  if (s === 0) return "bg-red-500";
  if (s > min + 5) return "bg-emerald-500";
  return "bg-amber-400";
}

export default function StockClient({ initialRows, marcas = [], sectores = [], listError }) {
  const router = useRouter();
  const videoScanRef = useRef(null);
  const scanControlsRef = useRef(null);
  const lastDetectedRef = useRef({ code: "", at: 0 });
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState(null);
  const [q, setQ] = useState("");
  const [marcaFilter, setMarcaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("activos");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [sortBy, setSortBy] = useState("az");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [descProduct, setDescProduct] = useState(null);
  const [priceProduct, setPriceProduct] = useState(null);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState("form");
  const [scanError, setScanError] = useState(null);
  const [scanReady, setScanReady] = useState(false);

  const marcasOptions = useMemo(
    () =>
      marcas
        .map((m) => ({ id: Number(m.id_marca), nombre: m.nombre }))
        .filter((m) => Number.isFinite(m.id) && m.nombre)
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))),
    [marcas],
  );

  const sectoresOptions = useMemo(
    () =>
      sectores
        .map((s) => ({ id: Number(s.id_sector), descripcion: s.descripcion }))
        .filter((s) => Number.isFinite(s.id) && s.descripcion)
        .sort((a, b) => String(a.descripcion).localeCompare(String(b.descripcion))),
    [sectores],
  );

  const filteredRows = useMemo(() => {
    const term = q.trim();
    const base = initialRows.filter((row) => {
      if (statusFilter === "activos" && row.archivado) return false;
      if (statusFilter === "archivados" && !row.archivado) return false;
      if (marcaFilter !== "all" && Number(row.marca_id) !== Number(marcaFilter)) return false;
      if (sectorFilter !== "all" && Number(row.sector_id) !== Number(sectorFilter)) return false;
      if (!term) return true;
      return matchesLooseSearch(row, term);
    });

    if (sortBy === "stock_desc") {
      return [...base].sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
    }
    if (sortBy === "stock_asc") {
      return [...base].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    }
    if (sortBy === "za") {
      return [...base].sort((a, b) => String(b.nombre || "").localeCompare(String(a.nombre || "")));
    }
    if (sortBy === "random") {
      return [...base].sort(() => Math.random() - 0.5);
    }
    return [...base].sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));
  }, [initialRows, q, marcaFilter, sectorFilter, statusFilter, sortBy]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const postItems = useCallback(async (items) => {
    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error al guardar");
    return data;
  }, []);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const compra = Number(formState.precio_compra);
    const venta = Number(formState.precio_venta);

    if (venta < compra) {
      setBanner({
        type: "err",
        text: "No se puede crear/editar el producto porque el precio de venta es menor al precio de compra.",
      });
      return;
    }

    if (!isValid(formState)) return;
    setBanner(null);
    try {
      await postItems([mapPayload(formState)]);
      setBanner({ type: "ok", text: formState.id_producto ? "Producto actualizado." : "Producto creado." });
      setShowForm(false);
      setFormState(EMPTY_FORM);
      refresh();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  };

  const startCreate = () => {
    setFormState(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (row) => {
    setFormState(toForm(row));
    setShowForm(true);
  };

  const abrirCamaraEscaner = useCallback((target = "form") => {
    setScanTarget(target);
    setScanError(null);
    setScanReady(false);
    lastDetectedRef.current = { code: "", at: 0 };
    setCameraOpen(true);
  }, []);

  const handleDetectedCode = useCallback((rawCode) => {
    const code = String(rawCode || "").trim();
    if (code.length < MIN_BARCODE_LEN) return;
    if (scanTarget === "search") {
      setQ(code);
      setPage(1);
      setBanner({ type: "ok", text: `Código leído en buscador: ${code}` });
    } else {
      setFormState((prev) => ({ ...prev, codigo_barra: code }));
      setBanner({ type: "ok", text: `Código leído: ${code}` });
    }
    setCameraOpen(false);
  }, [scanTarget]);

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

  const archiveProduct = async (row) => {
    if (!window.confirm(`¿Archivar el producto "${row.nombre}"?`)) return;
    setBanner(null);
    try {
      await postItems([{ id_producto: row.id_producto, archivar: true }]);
      setBanner({ type: "ok", text: "Producto archivado." });
      refresh();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[100rem] px-3 pb-12 pt-18 sm:px-5 lg:px-6 lg:pt-20">
      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-md shadow-zinc-900/5 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Stock</h1>
            <p className="text-sm text-zinc-500">Listado completo de productos con filtros y gestión</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[820px]">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar: palabras sueltas en código, nombre o descripción…"
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-base text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
            <button
              type="button"
              onClick={() => abrirCamaraEscaner("search")}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              title="Escanear código de barras para buscar"
              aria-label="Escanear código de barras para buscar"
            >
              <span aria-hidden>📷</span>
            </button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                value={marcaFilter}
                onChange={(e) => {
                  setMarcaFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              >
                <option value="all">Marca: todas</option>
                {marcasOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              <select
                value={sectorFilter}
                onChange={(e) => {
                  setSectorFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              >
                <option value="all">Sector: todos</option>
                {sectoresOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.descripcion}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              >
                <option value="az">Nombre A-Z</option>
                <option value="za">Nombre Z-A</option>
                <option value="random">Orden al azar</option>
                <option value="stock_desc">Más stock</option>
                <option value="stock_asc">Menos stock</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("activos")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              statusFilter === "activos" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            Activos
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("archivados")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              statusFilter === "archivados" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            Archivados
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("todos")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              statusFilter === "todos" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            Todos
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-500">{total} productos</span>
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg bg-gradient-to-r from-red-700 to-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Nuevo producto
            </button>
          </div>
        </div>
      </div>

      {showForm ? (
        <form onSubmit={onSubmit} className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-md shadow-zinc-900/5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Código barra</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  name="codigo_barra"
                  value={formState.codigo_barra}
                  onChange={onChange}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
                <button
                  type="button"
                  onClick={() => abrirCamaraEscaner("form")}
                  className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
                  title="Escanear código de barras con cámara"
                  aria-label="Escanear código de barras con cámara"
                >
                  <span aria-hidden>📷</span>
                </button>
              </div>
            </label>
            <Input label="Código" name="codigo" value={formState.codigo} onChange={onChange} />
            <Input label="Nombre *" name="nombre" value={formState.nombre} onChange={onChange} />
            <Input label="Descripción" name="descripcion" value={formState.descripcion} onChange={onChange} />
            <Select label="Marca *" name="marca_id" value={formState.marca_id} onChange={onChange} options={marcasOptions.map((m) => ({ value: String(m.id), label: m.nombre }))} />
            <Select label="Sector *" name="sector_id" value={formState.sector_id} onChange={onChange} options={sectoresOptions.map((s) => ({ value: String(s.id), label: s.descripcion }))} />
            <Input label="Stock" name="stock" type="number" value={formState.stock} onChange={onChange} />
            <Input label="Stock mínimo" name="stock_minimo" type="number" value={formState.stock_minimo} onChange={onChange} />
            <Input label="Precio compra" name="precio_compra" type="number" step="0.01" value={formState.precio_compra} onChange={onChange} />
            <Input label="Precio venta" name="precio_venta" type="number" step="0.01" value={formState.precio_venta} onChange={onChange} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700">
              Cancelar
            </button>
            <button type="submit" disabled={!isValid(formState) || isPending} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {formState.id_producto ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </form>
      ) : null}

      {listError ? <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">{listError}</div> : null}

      {banner ? (
        <div className={`mt-3 rounded-xl border px-4 py-3 text-sm font-medium ${banner.type === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}>
          {banner.text}
        </div>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg shadow-zinc-900/8">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-base">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100/90">
                {[
                  { label: "Código", className: "w-[8%]" },
                  { label: "Código barra", className: "w-[9%]" },
                  { label: "Nombre", className: "w-[22%] min-w-[14rem]" },
                  { label: "Marca", className: "w-[9%]" },
                  { label: "Sector", className: "w-[9%]" },
                  { label: "Stock", className: "w-[5%]" },
                  { label: "Min", className: "w-[5%]" },
                  { label: "P. compra", className: "w-[8%]" },
                  { label: "P. venta", className: "w-[8%]" },
                  { label: "Estado", className: "w-[7%]" },
                  { label: "Acciones", className: "w-[10%] min-w-[13rem]" },
                ].map((h) => (
                  <th
                    key={h.label}
                    className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500 ${h.className}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, idx) => (
                <tr key={row.id_producto} className={`border-b border-zinc-200 ${idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}>
                  <td className="px-3 py-2.5 text-base text-zinc-700">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${getStockDotClass(
                          row.stock,
                          row.stock_minimo,
                        )}`}
                        title="Estado de stock"
                      />
                      <span>{row.codigo || "-"}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-base text-zinc-700">{row.codigo_barra || "-"}</td>
                  <td className="px-3 py-2.5 text-base font-semibold leading-snug text-zinc-900">
                    {row.nombre}
                  </td>
                  <td className="px-3 py-2.5 text-base text-zinc-700">{row.marca_nombre || "-"}</td>
                  <td className="px-3 py-2.5 text-base text-zinc-700">{row.sector_descripcion || "-"}</td>
                  <td className="px-3 py-2.5 text-base text-zinc-700">{row.stock}</td>
                  <td className="px-3 py-2.5 text-base text-zinc-700">{row.stock_minimo}</td>
                  <td className="px-3 py-2.5 text-base text-zinc-700">${money(row.precio_compra)}</td>
                  <td className="px-3 py-2.5 text-base font-bold tabular-nums text-zinc-900">${money(row.precio_venta)}</td>
                  <td className="px-3 py-2.5 text-base">
                    <span className={`rounded-md px-2 py-1 text-sm font-semibold ${row.archivado ? "bg-zinc-200 text-zinc-700" : "bg-emerald-100 text-emerald-800"}`}>
                      {row.archivado ? "Archivado" : "Activo"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDescProduct(row)}
                        className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-blue-50 p-1.5 text-blue-800"
                        title="Ver descripción"
                        aria-label="Ver descripción"
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceProduct(row)}
                        className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 p-1.5 text-emerald-800"
                        title="Ver precios por método de pago"
                        aria-label="Ver precios por método de pago"
                      >
                        <PriceIcon />
                      </button>
                      <button type="button" onClick={() => startEdit(row)} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800">
                        Editar
                      </button>
                      {!row.archivado ? (
                        <button type="button" onClick={() => archiveProduct(row)} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">
                          Archivar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-sm text-zinc-600">
            Mostrando {total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {descProduct ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-900">{descProduct.nombre}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {descProduct.codigo ? `Código: ${descProduct.codigo}` : "Sin código"}
            </p>
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-base text-zinc-700 whitespace-pre-wrap">
              {descProduct.descripcion || "Este producto no tiene descripción."}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDescProduct(null)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {priceProduct ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-900">{priceProduct.nombre}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Precios según método de pago
              {priceProduct.codigo ? ` · ${priceProduct.codigo}` : ""}
            </p>
            {(() => {
              const p = preciosPorMetodo(priceProduct.precio_venta);
              return (
                <ul className="mt-4 space-y-2">
                  <li className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-700">Lista / Tarjeta</span>
                    <span className="text-base font-bold tabular-nums text-zinc-900">${money(p.tarjeta)}</span>
                  </li>
                  <li className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-sky-900">Transferencia</p>
                      <p className="text-xs text-sky-700">5% de descuento</p>
                    </div>
                    <span className="text-base font-bold tabular-nums text-sky-950">${money(p.transferencia)}</span>
                  </li>
                  <li className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-emerald-900">Efectivo</p>
                      <p className="text-xs text-emerald-700">10% de descuento</p>
                    </div>
                    <span className="text-base font-bold tabular-nums text-emerald-950">${money(p.efectivo)}</span>
                  </li>
                </ul>
              );
            })()}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setPriceProduct(null)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cameraOpen ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="modal-scan-stock">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 id="modal-scan-stock" className="text-base font-semibold text-zinc-900">
                  Escanear código de barras
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {scanTarget === "search"
                    ? "Apuntá al código para cargarlo en el buscador."
                    : "Apuntá al código para cargarlo en el campo automáticamente."}
                </p>
              </div>
              <button type="button" onClick={() => setCameraOpen(false)} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
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
                <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm font-medium text-white">Iniciando cámara...</div>
              ) : null}
            </div>

            {scanError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{scanError}</div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">Si no detecta, mejorá la iluminación o acercá/alejá la cámara.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
      />
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      <select
        {...props}
        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
      >
        <option value="">Seleccionar...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
