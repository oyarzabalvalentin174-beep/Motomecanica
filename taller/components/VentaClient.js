"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import ModalPagoVenta from "@/components/ModalPagoVenta";

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineSubtotal(line) {
  return Number(line.cantidad || 0) * Number(line.precio_unitario || 0);
}

/** Misma lógica que /api/productos-buscar: CB exacto, código y nombre contienen el término (máx. 25). */
function filtrarProductos(catalogo, rawTerm) {
  const q = String(rawTerm || "").trim();
  if (!q || !Array.isArray(catalogo) || catalogo.length === 0) return [];

  const qLower = q.toLowerCase();
  const scored = [];

  for (const p of catalogo) {
    if (p?.archivado === true) continue;

    const cb = String(p.codigo_barra ?? "").trim();
    const cod = String(p.codigo ?? "").trim();
    const nom = String(p.nombre ?? "").trim();

    const matchBarcode = cb.length > 0 && cb === q;
    const matchCodigo = cod.length > 0 && cod.toLowerCase().includes(qLower);
    const matchNombre = nom.length > 0 && nom.toLowerCase().includes(qLower);

    if (matchBarcode || matchCodigo || matchNombre) {
      const sortKey = (nom || "").toLowerCase();
      scored.push({ p, score: matchBarcode ? 0 : 1, sortKey });
    }
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.sortKey.localeCompare(b.sortKey);
  });

  return scored.slice(0, 25).map((x) => x.p);
}

function findProductByCodigoBarraExacto(catalogo, code) {
  const c = String(code ?? "").trim();
  if (!c) return null;
  return catalogo.find((p) => String(p.codigo_barra ?? "").trim() === c) ?? null;
}

/** Misma decisión que addOrMergeLine: si se puede aplicar el delta sin error de stock. */
function willAddOrMergeSucceed(product, delta, prevLines) {
  const id = Number(product?.id_producto);
  if (!Number.isFinite(id) || id <= 0) return false;
  const stock = Number(product?.stock ?? 0);
  if (stock < 1) return false;

  const prev = Array.isArray(prevLines) ? prevLines : [];
  const idx = prev.findIndex((l) => l.id_producto === id);
  if (idx === -1) {
    const cant = Math.min(Math.max(1, delta), stock);
    return cant >= 1;
  }
  const line = prev[idx];
  const nextQty = line.cantidad + delta;
  if (nextQty < 1) return true;
  return nextQty <= line.stock;
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

export default function VentaClient({ initialProductos = [], listError = null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const buscadorRef = useRef(null);
  const cantidadInputRef = useRef(null);
  const modalesAbiertosRef = useRef({ cantidad: false, pago: false, camara: false });
  const videoScanRef = useRef(null);
  const scanControlsRef = useRef(null);
  const lastDetectedRef = useRef({ code: "", at: 0 });

  const catalogo = useMemo(
    () => (Array.isArray(initialProductos) ? initialProductos : []),
    [initialProductos],
  );

  const catalogoRef = useRef(catalogo);
  catalogoRef.current = catalogo;

  const [cart, setCart] = useState([]);
  const cartRef = useRef(cart);
  cartRef.current = cart;

  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [banner, setBanner] = useState(null);
  const setBannerRef = useRef(setBanner);
  setBannerRef.current = setBanner;

  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [cantidadModal, setCantidadModal] = useState(null);
  const [cantidadInput, setCantidadInput] = useState("1");
  const [descProduct, setDescProduct] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanReady, setScanReady] = useState(false);

  useEffect(() => {
    modalesAbiertosRef.current = { cantidad: !!cantidadModal, pago: modalPagoOpen, camara: cameraOpen };
  }, [cantidadModal, modalPagoOpen, cameraOpen]);

  useEffect(() => {
    if (cantidadModal) {
      setCantidadInput("1");
      const t = setTimeout(() => cantidadInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [cantidadModal]);

  const subtotal = useMemo(
    () => cart.reduce((acc, line) => acc + lineSubtotal(line), 0),
    [cart],
  );

  const aplicarBusqueda = useCallback(
    (term) => {
      const rows = filtrarProductos(catalogo, term);
      setResultados(rows);
      return rows;
    },
    [catalogo],
  );

  const addOrMergeLine = useCallback((product, delta = 1) => {
    setBannerRef.current(null);
    const id = Number(product?.id_producto);
    if (!Number.isFinite(id) || id <= 0) return;

    const stock = Number(product?.stock ?? 0);
    const precio = Number(product?.precio_venta ?? 0);
    const nombre = String(product?.nombre ?? "").trim() || `Producto #${id}`;

    if (stock < 1) {
      setBannerRef.current({ type: "error", text: "Sin stock para este producto" });
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((l) => l.id_producto === id);
      if (idx === -1) {
        const cant = Math.min(Math.max(1, delta), stock);
        return [
          ...prev,
          {
            id_producto: id,
            nombre,
            codigo_barra: product?.codigo_barra ?? "",
            stock,
            cantidad: cant,
            precio_unitario: precio,
          },
        ];
      }
      const copy = [...prev];
      const line = { ...copy[idx] };
      const nextQty = line.cantidad + delta;
      if (nextQty < 1) {
        copy.splice(idx, 1);
        return copy;
      }
      if (nextQty > line.stock) {
        queueMicrotask(() =>
          setBannerRef.current({ type: "error", text: "Cantidad mayor al stock disponible" }),
        );
        return prev;
      }
      line.cantidad = nextQty;
      copy[idx] = line;
      return copy;
    });
  }, []);

  const addOrMergeLineRef = useRef(addOrMergeLine);
  addOrMergeLineRef.current = addOrMergeLine;

  /** Lector global: captura en cualquier parte de esta pantalla (excepto zonas con data-no-global-barcode). */
  useEffect(() => {
    const buffer = { value: "" };
    let idleTimer;

    const clearIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = undefined;
    };

    const scheduleClear = () => {
      clearIdle();
      idleTimer = window.setTimeout(() => {
        buffer.value = "";
        idleTimer = undefined;
      }, 220);
    };

    const onKeyDown = (e) => {
      if (
        modalesAbiertosRef.current.cantidad ||
        modalesAbiertosRef.current.pago ||
        modalesAbiertosRef.current.camara
      ) {
        return;
      }

      const t = e.target;
      if (t && typeof t.closest === "function" && t.closest("[data-no-global-barcode]")) {
        return;
      }

      if (e.key === "Enter") {
        const code = buffer.value.trim();
        buffer.value = "";
        clearIdle();
        if (code.length < MIN_BARCODE_LEN) return;

        e.preventDefault();
        e.stopPropagation();

        const p = findProductByCodigoBarraExacto(catalogoRef.current, code);
        if (p) {
          if (willAddOrMergeSucceed(p, 1, cartRef.current)) playScanSuccessSound();
          setBannerRef.current(null);
          addOrMergeLineRef.current(p, 1);
        } else {
          setBannerRef.current({ type: "error", text: "Código de barras no encontrado" });
        }
        return;
      }

      if (e.key === "Escape" && buffer.value.length > 0) {
        buffer.value = "";
        clearIdle();
        return;
      }

      if (e.key === "Backspace" && buffer.value.length > 0) {
        const tag = t?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          buffer.value = buffer.value.slice(0, -1);
          scheduleClear();
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer.value += e.key;
        scheduleClear();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      clearIdle();
    };
  }, []);

  const tryAutoAddFromResults = useCallback(
    (term, rows) => {
      const t = String(term || "").trim();
      if (!rows?.length) return false;
      if (rows.length === 1) {
        addOrMergeLine(rows[0], 1);
        return true;
      }
      const first = rows[0];
      const cb = String(first?.codigo_barra ?? "").trim();
      if (cb && cb === t) {
        addOrMergeLine(first, 1);
        return true;
      }
      return false;
    },
    [addOrMergeLine],
  );

  const onBuscarClick = useCallback(() => {
    const rows = aplicarBusqueda(q);
    tryAutoAddFromResults(q, rows);
  }, [q, aplicarBusqueda, tryAutoAddFromResults]);

  const onBuscadorKeyDown = useCallback(
    (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      startTransition(() => {
        const rows = aplicarBusqueda(q);
        const added = tryAutoAddFromResults(q, rows);
        if (added) {
          setQ("");
          setResultados([]);
          buscadorRef.current?.focus();
        }
      });
    },
    [q, aplicarBusqueda, tryAutoAddFromResults],
  );

  useEffect(() => {
    const t = String(q).trim();
    if (t.length < 2) {
      setResultados([]);
      return;
    }
    const id = setTimeout(() => {
      aplicarBusqueda(t);
    }, 280);
    return () => clearTimeout(id);
  }, [q, aplicarBusqueda]);

  const updateQty = useCallback((id_producto, raw) => {
    const n = parseInt(String(raw), 10);
    setCart((prev) =>
      prev.map((line) => {
        if (line.id_producto !== id_producto) return line;
        if (!Number.isFinite(n) || n < 1) return { ...line, cantidad: 1 };
        if (n > line.stock) {
          queueMicrotask(() =>
            setBannerRef.current({ type: "error", text: "Cantidad mayor al stock" }),
          );
          return line;
        }
        return { ...line, cantidad: n };
      }),
    );
  }, []);

  const removeLine = useCallback((id_producto) => {
    setCart((prev) => prev.filter((l) => l.id_producto !== id_producto));
  }, []);

  const abrirModalPago = useCallback(() => {
    if (cart.length === 0) {
      setBanner({ type: "error", text: "Agregá al menos un producto al carrito" });
      return;
    }
    setBanner(null);
    setModalPagoOpen(true);
  }, [cart.length]);

  const onVentaCompletada = useCallback(
    (snap) => {
      setBanner({
        type: "ok",
        text: `Venta #${snap?.id_venta ?? ""} registrada. Total ${money(snap?.total)}`,
      });
      setCart([]);
      setQ("");
      setResultados([]);
      router.refresh();
    },
    [router],
  );

  const abrirCantidadParaProducto = useCallback((product) => {
    setBanner(null);
    setCantidadModal(product);
  }, []);

  const confirmarCantidadModal = useCallback(() => {
    if (!cantidadModal) return;
    const stock = Number(cantidadModal.stock ?? 0);
    let n = parseInt(String(cantidadInput).trim(), 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > stock) {
      setBanner({ type: "error", text: `Máximo disponible: ${stock}` });
      return;
    }
    addOrMergeLine(cantidadModal, n);
    setCantidadModal(null);
  }, [cantidadModal, cantidadInput, addOrMergeLine]);

  const handleDetectedCode = useCallback(
    (rawCode) => {
      const code = String(rawCode || "").trim();
      if (code.length < MIN_BARCODE_LEN) return;
      const p = findProductByCodigoBarraExacto(catalogoRef.current, code);
      if (p) {
        if (willAddOrMergeSucceed(p, 1, cartRef.current)) playScanSuccessSound();
        setBanner({ type: "ok", text: `Código leído: ${code}. Producto agregado.` });
        addOrMergeLine(p, 1);
        setQ("");
        setResultados([]);
      } else {
        setBanner({ type: "error", text: `Código leído (${code}) no encontrado.` });
        setQ(code);
        aplicarBusqueda(code);
      }
      setCameraOpen(false);
    },
    [addOrMergeLine, aplicarBusqueda],
  );

  const abrirCamaraEscaner = useCallback(() => {
    setBanner(null);
    setScanError(null);
    setScanReady(false);
    lastDetectedRef.current = { code: "", at: 0 };
    setCameraOpen(true);
  }, []);

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Nueva venta</h1>
      </header>

      {listError ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base font-medium text-amber-950">
          No se cargó el catálogo: {listError}
        </div>
      ) : null}

      {banner ? (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-base font-medium ${
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm ring-1 ring-zinc-100">
            <label className="block text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Buscar producto o código de barras
            </label>
            <div className="mt-2 flex gap-2">
              <input
                ref={buscadorRef}
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onBuscadorKeyDown}
                data-no-global-barcode
                placeholder="Nombre, código interno o lector de barras…"
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-base text-zinc-900 outline-none ring-0 transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-500/20"
              />
              <button
                type="button"
                onClick={abrirCamaraEscaner}
                disabled={catalogo.length === 0}
                className="shrink-0 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
                title="Escanear código de barras con cámara"
                aria-label="Escanear código de barras con cámara"
              >
                <span aria-hidden>📷</span>
              </button>
              <button
                type="button"
                onClick={() => onBuscarClick()}
                disabled={catalogo.length === 0}
                className="shrink-0 rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:from-red-600 hover:to-red-500 disabled:opacity-60"
              >
                Buscar
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              El lector funciona en toda esta pantalla (no hace falta el buscador): escaneá y al terminar se agrega 1
              unidad si el código existe. En el buscador, Enter sigue buscando como antes.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-white/90 shadow-sm ring-1 ring-zinc-100">
            <div className="border-b border-zinc-100 px-5 py-3">
              <h2 className="text-base font-semibold text-zinc-800">Resultados</h2>
            </div>
            <ul className="max-h-[min(420px,50vh)] divide-y divide-zinc-100 overflow-y-auto">
              {resultados.length === 0 ? (
                <li className="px-5 py-8 text-center text-base text-zinc-500">
                  {catalogo.length === 0
                    ? listError
                      ? "Sin catálogo. Revisá la conexión o recargá la página."
                      : "No hay productos activos."
                    : "Escribí al menos 2 caracteres o buscá por código / código de barras."}
                </li>
              ) : (
                resultados.map((p) => (
                  <li
                    key={p.id_producto}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50/80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-zinc-900">{p.nombre}</p>
                      <p className="text-sm font-medium text-zinc-700">
                        {p.marca_nombre ? `Marca: ${p.marca_nombre}` : "Sin marca"}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {p.codigo_barra ? `CB ${p.codigo_barra}` : "Sin código de barras"}
                        {p.codigo ? ` · ${p.codigo}` : ""} · Stock {p.stock} · ${money(p.precio_venta)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDescProduct(p)}
                        className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-blue-50 p-2 text-blue-800 hover:bg-blue-100"
                        title="Ver descripción"
                        aria-label="Ver descripción"
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirCantidadParaProducto(p)}
                        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                      >
                        Agregar
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="flex min-h-[min(520px,78vh)] flex-col rounded-2xl border border-zinc-200/80 bg-white/95 p-5 shadow-md ring-1 ring-zinc-100">
            <h2 className="text-base font-semibold uppercase tracking-wide text-zinc-500">Carrito</h2>
            {cart.length === 0 ? (
              <p className="mt-4 flex-1 text-base text-zinc-500">Vacío. Escaná o agregá desde resultados.</p>
            ) : (
              <ul className="mt-4 max-h-[min(480px,58vh)] flex-1 space-y-4 overflow-y-auto pr-1">
                {cart.map((line) => (
                  <li
                    key={line.id_producto}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-base shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-lg font-semibold leading-snug text-zinc-900 sm:text-xl">
                        {line.nombre}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeLine(line.id_producto)}
                        className="shrink-0 text-base font-semibold text-red-600 hover:text-red-700"
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-4">
                      <div data-no-global-barcode className="min-w-[120px] flex-1">
                        <label className="block text-sm font-semibold uppercase tracking-wide text-zinc-500">
                          Cantidad (máx. {line.stock})
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={line.stock}
                          value={line.cantidad}
                          onChange={(e) => updateQty(line.id_producto, e.target.value)}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-lg font-semibold text-zinc-900 tabular-nums"
                        />
                      </div>
                      <div className="min-w-[100px]">
                        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Precio unit.</p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">{money(line.precio_unitario)}</p>
                      </div>
                    </div>
                    <p className="mt-3 border-t border-zinc-200 pt-3 text-right text-base font-semibold text-zinc-800">
                      Subtotal <span className="tabular-nums">{money(lineSubtotal(line))}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto space-y-3 border-t border-zinc-100 pt-4">
              <div className="flex justify-between text-lg font-semibold text-zinc-900">
                <span>Total carrito</span>
                <span className="tabular-nums">{money(subtotal)}</span>
              </div>
              <button
                type="button"
                onClick={abrirModalPago}
                disabled={cart.length === 0}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 py-3.5 text-base font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-emerald-500 disabled:opacity-50"
              >
                Confirmar venta
              </button>
            </div>
          </div>
        </aside>
      </div>

      {descProduct ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-desc-titulo"
          data-no-global-barcode
        >
          <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 id="modal-desc-titulo" className="text-lg font-bold text-zinc-900">
              {descProduct.nombre}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {descProduct.marca_nombre ? `Marca: ${descProduct.marca_nombre}` : "Sin marca"}
              {descProduct.codigo ? ` · Código: ${descProduct.codigo}` : ""}
            </p>
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 whitespace-pre-wrap">
              {descProduct.descripcion || "Este producto no tiene descripción."}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDescProduct(null)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cantidadModal ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cantidad-titulo"
          data-no-global-barcode
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 id="modal-cantidad-titulo" className="text-base font-semibold text-zinc-900">
              Cantidad
            </h3>
            <p className="mt-1 truncate text-base text-zinc-600" title={cantidadModal.nombre}>
              {cantidadModal.nombre}
            </p>
            <p className="mt-1 text-sm text-zinc-500">Stock disponible: {cantidadModal.stock}</p>
            <label className="mt-4 block text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Unidades a agregar
              <input
                ref={cantidadInputRef}
                type="number"
                min={1}
                max={cantidadModal.stock}
                value={cantidadInput}
                onChange={(e) => setCantidadInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmarCantidadModal();
                  }
                }}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base text-zinc-900"
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 text-base font-semibold text-zinc-800 hover:bg-zinc-100"
                onClick={() => setCantidadModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-base font-semibold text-white hover:bg-zinc-800"
                onClick={confirmarCantidadModal}
              >
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cameraOpen ? (
        <div
          className="fixed inset-0 z-[72] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-scan-camara"
          data-no-global-barcode
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 id="modal-scan-camara" className="text-base font-semibold text-zinc-900">
                  Escanear código con cámara
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Apuntá al código de barras. Se agrega automáticamente al detectar.
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
                <div className="absolute inset-0 grid place-items-center bg-black/40 text-base font-medium text-white">
                  Iniciando cámara...
                </div>
              ) : null}
            </div>

            {scanError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-base text-red-900">
                {scanError}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                Si no detecta, acercá o alejás el celular/cámara y mejorá la iluminación.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <ModalPagoVenta
        open={modalPagoOpen}
        onClose={() => setModalPagoOpen(false)}
        cart={cart}
        subtotal={subtotal}
        onSaleSuccess={onVentaCompletada}
      />
    </div>
  );
}
