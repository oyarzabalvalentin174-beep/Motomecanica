"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getTallerComprobanteConfig } from "@/lib/tallerComprobante";
import { compartirPresupuestoPorWhatsApp } from "@/lib/presupuestoPdfShare";
import PresupuestoExcelImportModal from "@/components/PresupuestoExcelImportModal";

function parseQty(s) {
  const n = parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseMoneyAR(s) {
  const t = String(s ?? "").trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n) {
  return Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function lineSubtotal(row) {
  return parseQty(row.cantidad) * parseMoneyAR(row.precio_unitario);
}

function emptyLine(presupuestoId) {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    id: null,
    parametro: "",
    cantidad: "1",
    precio_unitario: "",
    valor: "",
    notas: "",
    presupuesto_id: presupuestoId || null,
  };
}

function fmtDateEs(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw);
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  const d = iso ? new Date(`${iso[1]}T12:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateToInput(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function headerExtrasPayload({
  observaciones,
  datosVehiculo,
  km,
  fechaElaboracion,
  fechaEntregaEstimada,
  fechaEntregaComprometida,
}) {
  const kmTrim = String(km ?? "").trim();
  let kmNum = null;
  if (kmTrim) {
    const t = kmTrim.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(t);
    kmNum = Number.isFinite(n) ? n : null;
  }
  return {
    observaciones: String(observaciones ?? "").trim() || null,
    datos_vehiculo: String(datosVehiculo ?? "").trim() || null,
    km: kmNum,
    fecha_elaboracion: fechaElaboracion || todayInput(),
    fecha_entrega_estimada: fechaEntregaEstimada || null,
    fecha_entrega_comprometida: fechaEntregaComprometida || null,
  };
}

function buildPayload(selectedId, nombrePersona, extras, rows) {
  const lineas = rows
    .map((row) => {
      const param = String(row.parametro || "").trim();
      if (!param) return null;
      const q = parseQty(row.cantidad);
      const pu = parseMoneyAR(row.precio_unitario);
      const o = {
        parametro: param,
        cantidad: q,
        precio_unitario: pu,
        notas: String(row.notas || "").trim() || null,
      };
      if (row.id) o.id = row.id;
      return o;
    })
    .filter(Boolean);

  const payload = {
    nombre_persona: String(nombrePersona || "").trim(),
    ...extras,
    lineas,
  };
  if (selectedId) payload.id = selectedId;
  return payload;
}

function normalizeSearch(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export default function PresupuestosClient({
  initialList = [],
  initialDetail = null,
  initialSelectedId = 0,
  listError = null,
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [banner, setBanner] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const taller = useMemo(() => getTallerComprobanteConfig(), []);

  const lista = useMemo(
    () =>
      (Array.isArray(initialList) ? initialList : [])
        .map((p) => ({
          id: Number(p?.id),
          nombre_persona: String(p?.nombre_persona ?? ""),
          observaciones: p?.observaciones != null ? String(p.observaciones) : "",
          fecha_actualizacion: p?.fecha_actualizacion,
        }))
        .filter((p) => Number.isFinite(p.id) && p.id > 0),
    [initialList],
  );

  const listaOrdenReciente = useMemo(
    () =>
      [...lista].sort((a, b) => {
        const ta = new Date(a.fecha_actualizacion || 0).getTime();
        const tb = new Date(b.fecha_actualizacion || 0).getTime();
        return tb - ta;
      }),
    [lista],
  );

  const listaFiltrada = useMemo(() => {
    const q = normalizeSearch(busqueda.trim());
    if (!q) return listaOrdenReciente.slice(0, 40);
    return listaOrdenReciente.filter((p) => {
      const nom = normalizeSearch(p.nombre_persona);
      const obs = normalizeSearch(p.observaciones);
      return nom.includes(q) || obs.includes(q);
    });
  }, [listaOrdenReciente, busqueda]);

  /** Hay coincidencia en todo el archivo (no solo en los 40 recientes) */
  const busquedaCoincideAlguno = useMemo(() => {
    const q = normalizeSearch(busqueda.trim());
    if (!q) return true;
    return lista.some((p) => {
      const nom = normalizeSearch(p.nombre_persona);
      const obs = normalizeSearch(p.observaciones);
      return nom.includes(q) || obs.includes(q);
    });
  }, [lista, busqueda]);

  const selectedId = Number(initialSelectedId) > 0 ? Number(initialSelectedId) : 0;

  const [nombrePersona, setNombrePersona] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [datosVehiculo, setDatosVehiculo] = useState("");
  const [km, setKm] = useState("");
  const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState("");
  const [fechaEntregaComprometida, setFechaEntregaComprometida] = useState("");
  const [fechaElaboracion, setFechaElaboracion] = useState(todayInput);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [entregas, setEntregas] = useState([]);
  const [nuevaEntregaMonto, setNuevaEntregaMonto] = useState("");
  const [rows, setRows] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [nuevoNombreBusqueda, setNuevoNombreBusqueda] = useState("");
  /** Con presupuesto guardado abierto: al elegirlo desde la lista se oculta el panel de búsqueda para centrar el trabajo. */
  const [listadoVisible, setListadoVisible] = useState(() => {
    const id = Number(initialSelectedId) > 0 ? Number(initialSelectedId) : 0;
    return !(id > 0);
  });

  const [logoPrintUrl, setLogoPrintUrl] = useState("");
  const workspaceRef = useRef(null);

  /** Solo hidratar desde el servidor cuando hay un presupuesto elegido en la URL y el detalle coincide. Así no se borra lo que escribís en «Nuevo». */
  useEffect(() => {
    if (selectedId <= 0) return;

    const d = initialDetail && typeof initialDetail === "object" ? initialDetail : null;
    const did = d?.id != null ? Number(d.id) : NaN;
    if (!Number.isFinite(did) || did !== selectedId) return;

    setNombrePersona(String(d.nombre_persona ?? ""));
    setObservaciones(String(d.observaciones ?? ""));
    setDatosVehiculo(String(d.datos_vehiculo ?? ""));
    setKm(d.km != null && String(d.km).trim() !== "" ? String(d.km) : "");
    setFechaEntregaEstimada(dateToInput(d.fecha_entrega_estimada));
    setFechaEntregaComprometida(dateToInput(d.fecha_entrega_comprometida));
    setFechaElaboracion(
      dateToInput(d.fecha_elaboracion) || dateToInput(d.fecha_actualizacion) || todayInput(),
    );
    const entregasRaw = Array.isArray(d.entregas) ? d.entregas : [];
    setEntregas(
      entregasRaw.map((e, i) => ({
        key: `ent-${e?.id ?? i}`,
        id: e?.id != null ? Number(e.id) : null,
        monto: Number(e?.monto ?? 0),
        fecha_registro: e?.fecha_registro ?? null,
      })),
    );
    setNuevaEntregaMonto("");
    const lineas = Array.isArray(d.lineas) ? d.lineas : [];
    setRows(
      lineas.map((r, i) => ({
        key: `db-${r?.id ?? i}`,
        id: r?.id != null ? Number(r.id) : null,
        parametro: String(r?.parametro ?? ""),
        cantidad:
          r?.cantidad != null && String(r.cantidad).trim() !== ""
            ? String(r.cantidad)
            : "1",
        precio_unitario:
          r?.precio_unitario != null && String(r.precio_unitario).trim() !== ""
            ? String(r.precio_unitario)
            : "",
        valor: String(r?.valor ?? ""),
        notas: String(r?.notas ?? ""),
        presupuesto_id: Number(d.id),
      })),
    );
  }, [initialDetail, selectedId]);

  useEffect(() => {
    if (selectedId > 0) setListadoVisible(false);
    else setListadoVisible(true);
  }, [selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setLogoPrintUrl(new URL(taller.logoPath || "/logo.jpg", window.location.origin).href);
    } catch {
      setLogoPrintUrl(`${window.location.origin}${taller.logoPath || "/logo.jpg"}`);
    }
  }, [taller.logoPath]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const setPresupuestoQuery = useCallback(
    (id) => {
      const next = Number(id) || 0;
      if (next <= 0) {
        router.replace("/presupuestos");
        return;
      }
      router.replace(`/presupuestos?id=${next}`);
    },
    [router],
  );

  const elegirPresupuestoDesdeLista = useCallback(
    (id) => {
      setBusqueda("");
      setListadoVisible(false);
      setPresupuestoQuery(id);
      requestAnimationFrame(() => {
        workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [setPresupuestoQuery],
  );

  const nuevoPresupuesto = useCallback(() => {
    setBanner(null);
    setNombrePersona("");
    setObservaciones("");
    setDatosVehiculo("");
    setKm("");
    setFechaEntregaEstimada("");
    setFechaEntregaComprometida("");
    setFechaElaboracion(todayInput());
    setEntregas([]);
    setNuevaEntregaMonto("");
    setRows([emptyLine(0)]);
    router.replace("/presupuestos");
  }, [router]);

  async function postPresupuesto(payload) {
    const res = await fetch("/api/presupuestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "No se pudo guardar");
    return json;
  }

  const totalGeneral = useMemo(() => {
    let t = 0;
    for (const row of rows) {
      if (!String(row.parametro || "").trim()) continue;
      t += lineSubtotal(row);
    }
    return t;
  }, [rows]);

  const montoSena = useMemo(
    () =>
      entregas.reduce((acc, e) => {
        const m = Number(e?.monto ?? 0);
        return acc + (Number.isFinite(m) ? m : 0);
      }, 0),
    [entregas],
  );
  const saldoPendiente = useMemo(
    () => Math.max(0, totalGeneral - montoSena),
    [totalGeneral, montoSena],
  );

  const guardarTodo = async () => {
    const nom = nombrePersona.trim();
    if (!nom) {
      setBanner({ type: "error", text: "Ingresá el nombre del cliente." });
      return;
    }
    const extras = headerExtrasPayload({
      observaciones,
      datosVehiculo,
      km,
      fechaElaboracion,
      fechaEntregaEstimada,
      fechaEntregaComprometida,
    });
    const payload = buildPayload(selectedId, nombrePersona, extras, rows);
    const entregaNueva = parseMoneyAR(nuevaEntregaMonto);
    if (entregaNueva > 0) payload.nueva_entrega_monto = entregaNueva;
    if (!payload.lineas?.length) {
      setBanner({
        type: "error",
        text: "Agregá al menos una línea con concepto (columna «Concepto / ítem»).",
      });
      return;
    }
    setBanner(null);
    try {
      const json = await postPresupuesto(payload);
      const newId = json?.id != null ? Number(json.id) : selectedId;
      setBanner({ type: "ok", text: "Presupuesto guardado." });
      if (entregaNueva > 0) setNuevaEntregaMonto("");
      if (Number.isFinite(newId) && newId > 0 && newId !== selectedId) {
        router.replace(`/presupuestos?id=${newId}`);
      }
      refresh();
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  };

  const eliminarLinea = async (row) => {
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r.key !== row.key));
      return;
    }
    if (!selectedId) {
      setRows((prev) => prev.filter((r) => r.key !== row.key));
      return;
    }
    if (!window.confirm("¿Quitar esta línea del presupuesto?")) return;
    setBanner(null);
    try {
      await postPresupuesto({
        id: selectedId,
        nombre_persona: nombrePersona.trim(),
        ...headerExtrasPayload({
          observaciones,
          datosVehiculo,
          km,
          fechaElaboracion,
          fechaEntregaEstimada,
          fechaEntregaComprometida,
        }),
        lineas: [{ id: row.id, eliminar: true }],
      });
      setBanner({ type: "ok", text: "Línea eliminada." });
      refresh();
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  };

  const eliminarPresupuesto = async () => {
    if (!selectedId) return;
    const nom = nombrePersona.trim() || "este presupuesto";
    if (!window.confirm(`¿Eliminar el presupuesto de «${nom}»?`)) return;
    setBanner(null);
    try {
      await postPresupuesto({ id: selectedId, eliminar: true });
      router.replace("/presupuestos");
      setBanner({ type: "ok", text: "Presupuesto eliminado." });
      refresh();
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  };

  const agregarLinea = () => {
    setRows((prev) => [...prev, emptyLine(selectedId)]);
    setBanner(null);
  };

  const actualizarCampo = (key, field, value) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const imprimir = () => {
    window.print();
  };

  const compartirWhatsApp = async () => {
    if (!puedeImprimir || sharingPdf) return;
    setSharingPdf(true);
    setBanner(null);
    try {
      const res = await compartirPresupuestoPorWhatsApp({
        elementId: "presupuesto-print-area",
        clienteNombre: nombrePersona,
      });
      if (res.cancelled) return;
      if (res.mode === "share") {
        setBanner({ type: "ok", text: "PDF listo para compartir." });
      } else {
        setBanner({
          type: "ok",
          text: "PDF descargado. En WhatsApp adjuntá el archivo desde tu dispositivo.",
        });
      }
    } catch (err) {
      setBanner({ type: "error", text: err?.message || "No se pudo generar el PDF." });
    } finally {
      setSharingPdf(false);
    }
  };

  const guardarNuevaEntrega = async () => {
    if (!selectedId) {
      setBanner({
        type: "error",
        text: "Primero guardá el presupuesto para poder registrar entregas.",
      });
      return;
    }
    const monto = parseMoneyAR(nuevaEntregaMonto);
    if (!(monto > 0)) {
      setBanner({ type: "error", text: "Ingresá un monto válido para la entrega." });
      return;
    }
    setBanner(null);
    try {
      await postPresupuesto({
        id: selectedId,
        nombre_persona: nombrePersona.trim(),
        ...headerExtrasPayload({
          observaciones,
          datosVehiculo,
          km,
          fechaElaboracion,
          fechaEntregaEstimada,
          fechaEntregaComprometida,
        }),
        nueva_entrega_monto: monto,
      });
      setNuevaEntregaMonto("");
      setBanner({ type: "ok", text: "Entrega registrada." });
      refresh();
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  };

  const volverAListado = useCallback(() => {
    setListadoVisible(true);
    setBusqueda("");
    setBanner(null);
    router.replace("/presupuestos");
    setNombrePersona("");
    setObservaciones("");
    setDatosVehiculo("");
    setKm("");
    setFechaEntregaEstimada("");
    setFechaEntregaComprometida("");
    setFechaElaboracion(todayInput());
    setEntregas([]);
    setNuevaEntregaMonto("");
    setRows([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router]);

  const cardSurface =
    "rounded-2xl border border-zinc-300/50 bg-zinc-100/92 p-4 shadow-sm sm:p-5";

  const inputCell =
    "h-11 w-full rounded-lg border border-zinc-300/55 bg-zinc-100/75 px-3 py-2 text-base leading-snug text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-red-400/70 focus:bg-zinc-50/95 focus:ring-2 focus:ring-red-500/10";

  const inputCellCompact =
    "h-10 w-full rounded-lg border border-zinc-300/55 bg-zinc-100/75 px-2 py-1.5 text-sm leading-snug text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-red-400/70 focus:bg-zinc-50/95 focus:ring-2 focus:ring-red-500/10 tabular-nums";

  const notesCell =
    "min-h-[5rem] max-h-56 w-full resize-y rounded-lg border border-zinc-300/55 bg-zinc-100/75 px-3 py-2.5 text-base leading-relaxed text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-red-400/70 focus:bg-zinc-50/95 focus:ring-2 focus:ring-red-500/10";

  const btnSecundario =
    "min-h-11 rounded-lg border border-zinc-300/60 bg-zinc-100/85 px-4 py-2 text-base font-semibold text-zinc-800 transition hover:bg-zinc-200/70";

  const btnWhatsApp =
    "min-h-11 rounded-lg border border-emerald-500/45 bg-emerald-600/90 px-4 py-2 text-base font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50";

  const btnPrimario =
    "min-h-11 rounded-lg bg-gradient-to-r from-emerald-700/90 to-emerald-600/90 px-4 py-2 text-base font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-emerald-500";

  const btnPeligro =
    "min-h-11 rounded-lg border border-red-300/50 bg-red-50/80 px-4 py-2 text-base font-semibold text-red-800 transition hover:bg-red-100/80";

  const puedeImprimir =
    Boolean(nombrePersona.trim()) &&
    rows.some((r) => String(r.parametro || "").trim().length > 0);

  const listaEsRecortada = !busqueda.trim() && lista.length > 40;
  const hayListaSistema = lista.length > 0;

  const busquedaTrim = busqueda.trim();
  const puedeCrearDesdeBusqueda = Boolean(busquedaTrim) && !busquedaCoincideAlguno;
  const hayPresupuestoAbierto =
    selectedId > 0 || Boolean(nombrePersona.trim()) || rows.length > 0;

  const abrirModalCrear = () => {
    setNuevoNombreBusqueda(busquedaTrim);
    setIsCreateModalOpen(true);
  };

  const confirmarCrearDesdeModal = () => {
    const nom = nuevoNombreBusqueda.trim();
    if (!nom) {
      setBanner({ type: "error", text: "Ingresá un nombre para crear el presupuesto." });
      return;
    }
    nuevoPresupuesto();
    setNombrePersona(nom);
    setBusqueda(nom);
    setIsCreateModalOpen(false);
    setBanner(null);
  };

  const aplicarImportacionExcel = useCallback(
    ({ nombrePersona: nom, km: kmImp, datosVehiculo: veh, lineas: lineasImp, modo }) => {
      setNombrePersona(nom);
      if (kmImp) setKm(kmImp);
      if (veh) setDatosVehiculo(veh);
      const nuevas = lineasImp.map((l, i) => ({
        key: `xls-${Date.now()}-${i}`,
        id: null,
        parametro: l.parametro,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        valor: "",
        notas: l.notas || "",
        presupuesto_id: selectedId || null,
      }));
      setRows((prev) => {
        const vacias = prev.filter((r) => !String(r.parametro || "").trim());
        const conDatos = prev.filter((r) => String(r.parametro || "").trim());
        if (modo === "append") {
          const base = conDatos.length ? conDatos : vacias.length ? [] : [];
          return [...base, ...nuevas];
        }
        return nuevas.length ? nuevas : [emptyLine(selectedId)];
      });
      setBanner({
        type: "ok",
        text: `Se importaron ${nuevas.length} línea(s) desde Excel. Revisá y guardá cuando esté correcto.`,
      });
      setListadoVisible(false);
      requestAnimationFrame(() => {
        workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [selectedId],
  );

  return (
    <>
      <div className="print:hidden">
        <div className="mx-auto w-full max-w-screen-2xl px-3 pb-10 pt-1 sm:px-5 lg:px-6">
          <header className="border-b border-zinc-300/40 pb-4">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-800 sm:text-3xl">
              Presupuestos
            </h1>
            {!hayPresupuestoAbierto ? (
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-zinc-600">
                Escribí el nombre del cliente abajo para buscar. Tocá uno de la lista para abrirlo.
              </p>
            ) : (
              <p className="mt-2 text-base text-zinc-600">
                Cliente:{" "}
                <span className="font-semibold text-zinc-800">
                  {nombrePersona.trim() || "Sin nombre"}
                </span>
              </p>
            )}
          </header>

          <div className="mt-4 space-y-4">
            {listError ? (
              <div className="rounded-lg border border-amber-300/50 bg-amber-50/90 px-4 py-3 text-base font-medium text-amber-950">
                {listError}
              </div>
            ) : null}

            {banner ? (
              <div
                className={`rounded-lg border px-4 py-3 text-base font-medium ${
                  banner.type === "ok"
                    ? "border-emerald-300/50 bg-emerald-50/90 text-emerald-900"
                    : "border-red-300/50 bg-red-50/90 text-red-900"
                }`}
              >
                {banner.text}
              </div>
            ) : null}

            {!hayPresupuestoAbierto ? (
              <section className={cardSurface}>
                <label className="block">
                  <span className="text-base font-semibold text-zinc-700">
                    Buscar presupuesto por nombre de cliente
                  </span>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Ejemplo: Juan Pérez"
                    className={`mt-2 ${inputCell} text-lg sm:text-base`}
                    autoComplete="off"
                  />
                </label>
                <p className="mt-2 text-sm text-zinc-500">
                  {!busquedaTrim
                    ? "Se muestran los últimos 40 presupuestos. Escribí un nombre para filtrar."
                    : "Presupuestos que coinciden con tu búsqueda."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={abrirModalCrear}
                    className="min-h-11 rounded-lg bg-gradient-to-r from-red-700/90 to-red-600/90 px-5 py-2.5 text-base font-semibold text-white shadow-sm transition hover:from-red-600 hover:to-red-500"
                  >
                    Nuevo presupuesto
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExcelImportOpen(true)}
                    className="min-h-11 rounded-lg border border-violet-300/50 bg-violet-50/80 px-4 py-2.5 text-base font-semibold text-violet-900 transition hover:bg-violet-100/70"
                  >
                    Importar Excel
                  </button>
                </div>
                <div className="mt-4 max-h-[min(420px,55vh)] overflow-y-auto rounded-xl border border-zinc-300/45 bg-zinc-100/70 p-2">
                  {!hayListaSistema ? (
                    <p className="px-2 py-8 text-center text-base text-zinc-500">
                      Todavía no hay presupuestos. Creá el primero con «Nuevo presupuesto».
                    </p>
                  ) : listaFiltrada.length === 0 && busquedaTrim ? (
                    <div className="px-2 py-6 text-center text-base text-zinc-600">
                      <p>No se encontró «{busquedaTrim}».</p>
                      {puedeCrearDesdeBusqueda ? (
                        <button
                          type="button"
                          onClick={abrirModalCrear}
                          className="mt-4 rounded-lg border border-emerald-300/50 bg-emerald-50/90 px-4 py-2.5 text-base font-semibold text-emerald-900 transition hover:bg-emerald-100/80"
                        >
                          Crear presupuesto para «{busquedaTrim}»
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {listaFiltrada.map((p) => {
                        const active = selectedId === p.id;
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => elegirPresupuestoDesdeLista(p.id)}
                              className={`w-full rounded-xl border px-4 py-3 text-left text-base transition ${
                                active
                                  ? "border-red-400/60 bg-red-50 font-semibold text-red-950"
                                  : "border-zinc-300/40 bg-zinc-50/90 text-zinc-800 hover:border-zinc-400/50 hover:bg-zinc-100/90"
                              }`}
                            >
                              <span className="line-clamp-2 leading-snug">{p.nombre_persona}</span>
                              {p.fecha_actualizacion ? (
                                <span
                                  className={`mt-1 block text-sm tabular-nums ${
                                    active ? "text-red-800/70" : "text-zinc-500"
                                  }`}
                                >
                                  {new Date(p.fecha_actualizacion).toLocaleDateString("es-AR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {listaEsRecortada ? (
                    <p className="mt-3 border-t border-zinc-300/40 px-1 pt-3 text-center text-sm text-zinc-500">
                      Hay más presupuestos guardados. Usá el buscador para encontrarlos.
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          {hayPresupuestoAbierto ? (
          <div
            ref={workspaceRef}
            id="presupuesto-workspace"
            className="mx-auto mt-4 w-full max-w-5xl space-y-4 lg:max-w-6xl"
          >
                <>
                  <div className={`${cardSurface} flex flex-col gap-4`}>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={volverAListado}
                        className={btnSecundario}
                      >
                        ← Volver
                      </button>
                      <div className="rounded-lg border border-emerald-300/45 bg-emerald-50/80 px-4 py-2.5 text-lg font-bold tabular-nums text-emerald-950">
                        Total: ${fmtMoney(totalGeneral)}
                      </div>
                      <button type="button" onClick={agregarLinea} className={btnSecundario}>
                        + Ítem
                      </button>
                      <button type="button" onClick={guardarTodo} className={btnPrimario}>
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={imprimir}
                        disabled={!puedeImprimir}
                        className={`${btnSecundario} disabled:opacity-50`}
                      >
                        Imprimir
                      </button>
                      <button
                        type="button"
                        onClick={() => void compartirWhatsApp()}
                        disabled={!puedeImprimir || sharingPdf}
                        className={btnWhatsApp}
                      >
                        {sharingPdf ? "Generando PDF…" : "WhatsApp PDF"}
                      </button>
                      {selectedId ? (
                        <button type="button" onClick={eliminarPresupuesto} className={btnPeligro}>
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <section className={cardSurface}>
                    <h2 className="text-base font-semibold text-zinc-700">Cliente y notas</h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-base font-semibold text-zinc-600">
                        Fecha de elaboración
                        <input
                          type="date"
                          value={fechaElaboracion}
                          onChange={(e) => setFechaElaboracion(e.target.value)}
                          className={`mt-1 ${inputCell}`}
                        />
                      </label>
                    </div>
                    <label className="mt-3 block text-base font-semibold text-zinc-600">
                      Nombre del cliente
                      <input
                        value={nombrePersona}
                        onChange={(e) => setNombrePersona(e.target.value)}
                        maxLength={200}
                        className={`mt-1 ${inputCell}`}
                        placeholder="Nombre y apellido"
                      />
                    </label>
                    <label className="mt-3 block text-base font-semibold text-zinc-600">
                      Observaciones <span className="font-normal text-zinc-400">(opcional)</span>
                      <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        rows={2}
                        className={`mt-1 ${notesCell} min-h-[4rem]`}
                        placeholder="Validez, forma de pago, etc."
                      />
                    </label>

                    <details className="group mt-4 rounded-xl border border-zinc-300/45 bg-zinc-100/65 open:border-zinc-300/55 open:bg-zinc-50/90">
                      <summary className="cursor-pointer list-none px-4 py-3 text-base font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-2">
                          <span>Vehículo y fechas de entrega (opcional)</span>
                          <span className="text-zinc-400 transition-transform group-open:-rotate-180">▼</span>
                        </span>
                      </summary>
                      <div className="space-y-3 border-t border-zinc-300/35 px-4 pb-4 pt-3">
                        <label className="block text-base font-semibold text-zinc-600">
                          Datos del vehículo
                          <input
                            value={datosVehiculo}
                            onChange={(e) => setDatosVehiculo(e.target.value)}
                            maxLength={500}
                            className={`mt-1 ${inputCell}`}
                            placeholder="Marca, modelo, año, patente…"
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-base font-semibold text-zinc-600">
                            Kilometraje
                            <input
                              value={km}
                              onChange={(e) => setKm(e.target.value)}
                              inputMode="decimal"
                              className={`mt-1 ${inputCell} tabular-nums`}
                              placeholder="Ej. 45200"
                            />
                          </label>
                          <label className="block text-base font-semibold text-zinc-600">
                            Entrega estimada
                            <input
                              type="date"
                              value={fechaEntregaEstimada}
                              onChange={(e) => setFechaEntregaEstimada(e.target.value)}
                              className={`mt-1 ${inputCell}`}
                            />
                          </label>
                          <label className="block text-base font-semibold text-zinc-600 sm:col-span-2">
                            Entrega comprometida
                            <input
                              type="date"
                              value={fechaEntregaComprometida}
                              onChange={(e) => setFechaEntregaComprometida(e.target.value)}
                              className={`mt-1 max-w-full sm:max-w-xs ${inputCell}`}
                            />
                          </label>
                        </div>
                      </div>
                    </details>
                  </section>

                  <section className={`${cardSurface} overflow-hidden p-0`}>
                    <div className="border-b border-zinc-300/40 bg-zinc-100/75 px-4 py-3 sm:px-5">
                      <h2 className="text-base font-semibold text-zinc-700">Ítems del presupuesto</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        Completá concepto, cantidad y precio. El subtotal se calcula solo.
                      </p>
                    </div>

                    <div className="p-0 sm:p-0">
                      {rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                          <p className="max-w-sm text-base text-zinc-600">
                            Agregá líneas de mano de obra, repuestos, etc.
                          </p>
                          <button type="button" onClick={agregarLinea} className={btnSecundario}>
                            + Agregar ítem
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[52rem] table-auto border-collapse text-left text-sm sm:min-w-0 sm:table-fixed sm:text-base">
                            <thead className="border-b border-zinc-300/40 bg-zinc-100/80 text-xs font-semibold uppercase tracking-wide text-zinc-600 sm:text-sm">
                              <tr>
                                <th className="w-10 whitespace-nowrap px-2 py-2.5 text-center font-medium text-zinc-500 sm:w-12">
                                  #
                                </th>
                                <th className="min-w-[10rem] px-2 py-2.5 text-left sm:min-w-0 sm:w-[32%]">
                                  Concepto
                                </th>
                                <th className="w-14 whitespace-nowrap px-1 py-2.5 text-center sm:w-[7%]">Cant.</th>
                                <th className="w-[6.5rem] whitespace-nowrap px-2 py-2.5 text-right sm:w-[12%]">
                                  P. unit.
                                </th>
                                <th className="w-[6.5rem] whitespace-nowrap px-2 py-2.5 text-right sm:w-[12%]">
                                  Subtotal
                                </th>
                                <th className="min-w-[9rem] px-2 py-2.5 text-left sm:min-w-0 sm:w-[29%]">Notas</th>
                                <th className="w-12 whitespace-nowrap px-1 py-2.5 text-center sm:w-14">
                                  <span className="sr-only">Quitar</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, idx) => {
                                const sub = lineSubtotal(row);
                                const tieneConcepto = Boolean(String(row.parametro || "").trim());
                                return (
                                  <tr
                                    key={row.key}
                                    className={`border-b border-zinc-300/30 align-top ${idx % 2 === 1 ? "bg-zinc-100/50" : "bg-zinc-50/80"}`}
                                  >
                                    <td className="px-2 py-2 text-center align-top">
                                      <span className="inline-flex min-h-9 min-w-8 items-center justify-center rounded-md bg-zinc-200/55 text-sm font-bold tabular-nums text-zinc-600">
                                        {idx + 1}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2 align-top">
                                      <input
                                        value={row.parametro}
                                        onChange={(e) =>
                                          actualizarCampo(row.key, "parametro", e.target.value)
                                        }
                                        maxLength={100}
                                        className={inputCell}
                                        placeholder="Ítem o servicio"
                                      />
                                    </td>
                                    <td className="px-1 py-2 align-top">
                                      <input
                                        value={row.cantidad}
                                        onChange={(e) =>
                                          actualizarCampo(row.key, "cantidad", e.target.value)
                                        }
                                        inputMode="decimal"
                                        className={inputCellCompact}
                                        placeholder="1"
                                      />
                                    </td>
                                    <td className="px-2 py-2 align-top">
                                      <input
                                        value={row.precio_unitario}
                                        onChange={(e) =>
                                          actualizarCampo(row.key, "precio_unitario", e.target.value)
                                        }
                                        inputMode="decimal"
                                        className={inputCellCompact}
                                        placeholder="0"
                                      />
                                    </td>
                                    <td className="px-2 py-2 align-top">
                                      <div
                                        className={`flex min-h-10 items-center justify-end rounded-lg border border-zinc-300/35 bg-zinc-100/70 px-2 text-sm font-semibold tabular-nums text-zinc-800 sm:text-base ${tieneConcepto ? "" : "text-zinc-400"}`}
                                      >
                                        ${fmtMoney(tieneConcepto ? sub : 0)}
                                      </div>
                                    </td>
                                    <td className="px-2 py-2 align-top">
                                      <textarea
                                        value={row.notas}
                                        onChange={(e) =>
                                          actualizarCampo(row.key, "notas", e.target.value)
                                        }
                                        rows={2}
                                        className="min-h-[3.25rem] max-h-36 w-full resize-y rounded-lg border border-zinc-300/55 bg-zinc-100/75 px-2 py-2 text-sm leading-relaxed text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-red-400/70 focus:bg-zinc-50/95 focus:ring-2 focus:ring-red-500/10"
                                        placeholder="Detalle"
                                      />
                                    </td>
                                    <td className="px-1 py-2 align-top">
                                      <button
                                        type="button"
                                        aria-label="Quitar línea"
                                        title="Quitar línea"
                                        onClick={() => eliminarLinea(row)}
                                        className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-red-300/45 bg-red-50/70 px-1 py-1.5 text-base font-bold text-red-800 transition hover:bg-red-100/70"
                                      >
                                        ×
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={7} className="border-t border-zinc-300/40 bg-zinc-100/65 px-3 py-3">
                                  <button
                                    type="button"
                                    onClick={agregarLinea}
                                    className="w-full rounded-lg border border-dashed border-zinc-400/50 bg-zinc-50/90 py-2.5 text-base font-semibold text-zinc-800 transition hover:border-emerald-500/50 hover:bg-emerald-50/80 hover:text-emerald-900"
                                  >
                                    + Agregar ítem
                                  </button>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
              {rows.length > 0 ? (
                <div className="flex shrink-0 flex-col items-end gap-0.5 border-t border-zinc-300/40 bg-zinc-100/70 px-4 py-3 sm:px-5">
                  {montoSena > 0 ? (
                    <p className="text-base font-semibold tabular-nums text-zinc-700">
                      Saldo pendiente:{" "}
                      <span className="text-zinc-900">${fmtMoney(saldoPendiente)}</span>
                    </p>
                  ) : null}
                  <p className="text-lg font-bold tabular-nums text-zinc-900">
                    Total presupuesto:{" "}
                    <span className="text-emerald-800">${fmtMoney(totalGeneral)}</span>
                  </p>
                </div>
              ) : null}
              <div className="border-t border-zinc-300/40 bg-zinc-50/85 px-4 py-4 sm:px-5">
                <h3 className="text-base font-semibold text-zinc-700">Entregas</h3>
                {entregas.length > 0 ? (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-300/40">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="bg-zinc-100/70 text-zinc-600">
                        <tr>
                          <th className="px-3 py-2">Fecha y hora</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entregas.map((e) => (
                          <tr key={e.key} className="border-t border-zinc-100">
                            <td className="px-3 py-2 text-zinc-700">
                              {e.fecha_registro
                                ? new Date(e.fecha_registro).toLocaleString("es-AR")
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-zinc-900">
                              ${fmtMoney(e.monto)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">
                    Todavía no hay entregas registradas para este presupuesto.
                  </p>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(160px,220px)_auto] sm:items-end">
                  <label className="block text-base font-semibold text-zinc-600">
                    Nueva entrega ($)
                    <input
                      value={nuevaEntregaMonto}
                      onChange={(e) => setNuevaEntregaMonto(e.target.value)}
                      inputMode="decimal"
                      className={`mt-1 ${inputCell} tabular-nums`}
                      placeholder="0"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={guardarNuevaEntrega}
                    className="min-h-11 rounded-lg border border-emerald-300/50 bg-emerald-50/80 px-4 py-2 text-base font-semibold text-emerald-800 transition hover:bg-emerald-100/70"
                  >
                    + Registrar entrega
                  </button>
                </div>
                {!selectedId ? (
                  <p className="mt-2 text-sm text-zinc-500">
                    En un presupuesto nuevo, la primera entrega se guarda al tocar «Guardar».
                  </p>
                ) : null}
              </div>
            </section>
                </>
          </div>
          ) : null}
        </div>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-zinc-300/50 bg-zinc-50 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Crear nuevo presupuesto</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Ingresá el nombre del cliente para abrir el presupuesto nuevo.
            </p>
            <label className="mt-3 block text-sm font-semibold text-zinc-500">
              Nombre del cliente
              <input
                value={nuevoNombreBusqueda}
                onChange={(e) => setNuevoNombreBusqueda(e.target.value)}
                className={`mt-1 ${inputCell}`}
                placeholder="Nombre y apellido"
                autoFocus
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarCrearDesdeModal}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Crear y abrir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PresupuestoExcelImportModal
        open={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onApply={aplicarImportacionExcel}
      />

      {/* Solo vista impresión: marco, logo con URL absoluta (id usado en globals.css @media print) */}
      <div id="presupuesto-print-area" className="hidden print:block">
        <div className="box-border bg-white p-4 text-zinc-900 print:p-3">
          <div className="box-border flex min-h-0 flex-col border-[3px] border-double border-zinc-900 p-6 print:p-5">
            <header className="flex flex-wrap items-start gap-5 border-b-2 border-zinc-900 pb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  logoPrintUrl ||
                  (typeof window !== "undefined"
                    ? `${window.location.origin}${taller.logoPath || "/logo.jpg"}`
                    : taller.logoPath || "/logo.jpg")
                }
                alt=""
                width={96}
                height={96}
                className="h-24 w-24 shrink-0 rounded-xl border-2 border-zinc-800 bg-white object-cover print:h-28 print:w-28"
                style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
                  Presupuesto
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{taller.nombre}</h2>
                <p className="mt-1 text-xs text-zinc-700">
                  Portugal esquina Uruguay, General Deheza, Cordoba
                </p>
                <p className="text-xs text-zinc-700">3584906623</p>
                <p className="text-xs text-zinc-700">alexis_oya@hotmail.com</p>
              </div>
            </header>

            <div className="mt-5 border border-zinc-900 bg-white p-4 text-sm leading-relaxed print:border-zinc-800 print:p-3">
              <div
                className={
                  datosVehiculo.trim() || km.trim()
                    ? "grid gap-4 sm:grid-cols-3 sm:gap-x-8"
                    : "grid gap-3 sm:grid-cols-2"
                }
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Cliente</p>
                  <p className="mt-1 text-base font-semibold text-zinc-900">
                    {nombrePersona.trim() || "—"}
                  </p>
                </div>
                <div className="min-w-0 sm:text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Fecha de elaboración
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-zinc-900">
                    {fechaElaboracion ? fmtDateEs(fechaElaboracion) : fmtDateEs(todayInput())}
                  </p>
                </div>
                {datosVehiculo.trim() || km.trim() ? (
                  <div className="min-w-0 sm:border-l sm:border-zinc-200 sm:pl-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Vehículo</p>
                    {datosVehiculo.trim() ? (
                      <p className="mt-1 text-base font-semibold text-zinc-900">{datosVehiculo.trim()}</p>
                    ) : null}
                    {km.trim() ? (
                      <p className="mt-1.5 text-sm text-zinc-800">
                        <span className="font-semibold text-zinc-900">Km </span>
                        <span className="tabular-nums">{km.trim()}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {observaciones.trim() ? (
                <div className="mt-4 border-t border-zinc-200 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Observaciones
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-800">{observaciones.trim()}</p>
                </div>
              ) : null}
              {fechaEntregaEstimada || fechaEntregaComprometida ? (
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 border-t border-zinc-200 pt-3 text-sm text-zinc-800">
                  {fechaEntregaEstimada ? (
                    <p>
                      <span className="font-semibold text-zinc-900">Entrega estimada: </span>
                      {fmtDateEs(fechaEntregaEstimada)}
                    </p>
                  ) : null}
                  {fechaEntregaComprometida ? (
                    <p>
                      <span className="font-semibold text-zinc-900">Entrega comprometida: </span>
                      {fmtDateEs(fechaEntregaComprometida)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <table className="mt-5 w-full border-collapse border border-zinc-900 text-sm leading-snug print:text-[13px]">
              <colgroup>
                <col className="w-[2rem]" />
                <col />
                <col className="w-[3.25rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[5.5rem]" />
                <col className="min-w-[6rem]" />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-zinc-900 bg-zinc-200 text-left text-[10px] font-bold uppercase tracking-wide text-zinc-900 print:bg-zinc-100 print:text-[9px]">
                  <th className="border-r border-zinc-800 px-1 py-1 print:py-0.5">#</th>
                  <th className="border-r border-zinc-800 px-1.5 py-1 print:py-0.5">Concepto</th>
                  <th className="border-r border-zinc-800 px-1 py-1 text-center print:py-0.5">Cant.</th>
                  <th className="border-r border-zinc-800 px-1 py-1 text-right print:py-0.5">P. unit.</th>
                  <th className="border-r border-zinc-800 px-1 py-1 text-right print:py-0.5">Subtotal</th>
                  <th className="px-1.5 py-1 print:py-0.5">Notas</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((row) => String(row.parametro || "").trim())
                  .map((row, i) => {
                    const sub = lineSubtotal(row);
                    const notasStr = String(row.notas || "").trim();
                    const paramStr = String(row.parametro || "").trim();
                    const notasLargas =
                      notasStr.length > 120 ||
                      notasStr.includes("\n") ||
                      notasStr.length > 60;
                    const conceptoLargo =
                      paramStr.length > 90 || paramStr.includes("\n");
                    const filaCompacta = !notasLargas && !conceptoLargo;
                    const pyPrint = filaCompacta ? "print:py-0.5" : "print:py-1";
                    return (
                      <tr key={`print-${row.key}`} className="border-b border-zinc-400 align-top">
                        <td
                          className={`border-r border-zinc-300 px-1 py-1.5 tabular-nums text-zinc-700 ${pyPrint} print:align-top`}
                        >
                          {i + 1}
                        </td>
                        <td
                          className={`border-r border-zinc-300 px-1.5 py-1.5 font-medium ${pyPrint} ${filaCompacta ? "print:leading-tight" : ""}`}
                        >
                          {row.parametro}
                        </td>
                        <td
                          className={`border-r border-zinc-300 px-1 py-1.5 text-center tabular-nums ${pyPrint} print:align-top`}
                        >
                          {parseQty(row.cantidad)}
                        </td>
                        <td
                          className={`border-r border-zinc-300 px-1 py-1.5 text-right tabular-nums ${pyPrint} print:align-top`}
                        >
                          ${fmtMoney(parseMoneyAR(row.precio_unitario))}
                        </td>
                        <td
                          className={`border-r border-zinc-300 px-1 py-1.5 text-right font-semibold tabular-nums ${pyPrint} print:align-top`}
                        >
                          ${fmtMoney(sub)}
                        </td>
                        <td
                          className={`px-1.5 py-1.5 text-zinc-800 ${pyPrint} ${notasLargas ? "whitespace-pre-wrap align-top" : "whitespace-normal align-top print:leading-tight"}`}
                        >
                          {notasStr ? notasStr : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            <div className="mt-5 space-y-2 border-t-2 border-zinc-900 pt-3 text-right print:mt-4">
              {montoSena > 0 ? (
                <p className="text-base text-zinc-800">
                  <span className="font-semibold">Total entregas</span>:{" "}
                  <span className="tabular-nums font-semibold">${fmtMoney(montoSena)}</span>
                </p>
              ) : null}
              <p className="text-lg font-bold tabular-nums">
                Total presupuesto: <span className="text-zinc-900">${fmtMoney(totalGeneral)}</span>
              </p>
              {montoSena > 0 ? (
                <p className="text-xl font-bold tabular-nums">
                  Saldo pendiente:{" "}
                  <span className="text-zinc-900">${fmtMoney(saldoPendiente)}</span>
                </p>
              ) : null}
            </div>
            {entregas.length > 0 ? (
              <div className="mt-3 border border-zinc-400 p-3">
                <p className="text-sm font-semibold text-zinc-800">Detalle de entregas</p>
                <div className="mt-1 space-y-1 text-sm">
                  {entregas.map((e) => (
                    <p key={`print-ent-${e.key}`} className="flex items-center justify-between gap-3">
                      <span>{e.fecha_registro ? new Date(e.fecha_registro).toLocaleString("es-AR") : "—"}</span>
                      <span className="font-semibold tabular-nums">${fmtMoney(e.monto)}</span>
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
