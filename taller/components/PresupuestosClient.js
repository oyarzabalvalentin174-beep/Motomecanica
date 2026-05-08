"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getTallerComprobanteConfig } from "@/lib/tallerComprobante";

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

function headerExtrasPayload({
  observaciones,
  datosVehiculo,
  km,
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

  const listaFiltrada = useMemo(() => {
    const q = normalizeSearch(busqueda.trim());
    if (!q) return lista;
    return lista.filter((p) => {
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
  const [entregas, setEntregas] = useState([]);
  const [nuevaEntregaMonto, setNuevaEntregaMonto] = useState("");
  const [rows, setRows] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [nuevoNombreBusqueda, setNuevoNombreBusqueda] = useState("");

  const [logoPrintUrl, setLogoPrintUrl] = useState("");

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

  const nuevoPresupuesto = useCallback(() => {
    setBanner(null);
    setNombrePersona("");
    setObservaciones("");
    setDatosVehiculo("");
    setKm("");
    setFechaEntregaEstimada("");
    setFechaEntregaComprometida("");
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

  const inputCell =
    "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-base leading-snug text-zinc-900 shadow-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/15";

  const notesCell =
    "min-h-[5rem] max-h-56 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-base leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/15";

  const fechaImpresion = useMemo(() => new Date().toLocaleDateString("es-AR"), []);

  const puedeImprimir =
    Boolean(nombrePersona.trim()) &&
    rows.some((r) => String(r.parametro || "").trim().length > 0);

  const busquedaTrim = busqueda.trim();
  const busquedaNorm = normalizeSearch(busquedaTrim);
  const hayCoincidencias = listaFiltrada.length > 0;
  const puedeCrearDesdeBusqueda = Boolean(busquedaTrim) && !hayCoincidencias;
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

  return (
    <>
      <div className="print:hidden">
        <div className="mx-auto w-full max-w-screen-2xl px-3 pb-8 pt-1 sm:px-5 lg:px-6">
          <header className="border-b border-zinc-200/90 pb-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Presupuestos
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
              Buscá un presupuesto guardado o creá uno nuevo: cliente, ítems con cantidad y precio, total automático y guardado.
            </p>
          </header>

          <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
            {listError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-base font-medium text-amber-950">
                {listError}
              </div>
            ) : null}

            {banner ? (
              <div
                className={`rounded-lg border px-3 py-2 text-base font-medium ${
                  banner.type === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-red-200 bg-red-50 text-red-900"
                }`}
              >
                {banner.text}
              </div>
            ) : null}

            <div className="space-y-4">
              <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm ring-1 ring-zinc-100">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Buscar presupuesto
                </h2>
                <label className="mt-2 block text-sm font-semibold text-zinc-500">
                  Nombre del cliente u observaciones
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className={`mt-1 ${inputCell}`}
                    autoComplete="off"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={abrirModalCrear}
                    className="rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:from-red-600 hover:to-red-500"
                  >
                    + Crear presupuesto
                  </button>
                  <button
                    type="button"
                    onClick={nuevoPresupuesto}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    Limpiar y empezar de cero
                  </button>
                  {selectedId ? (
                    <button
                      type="button"
                      onClick={eliminarPresupuesto}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-base font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      Eliminar este presupuesto
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 max-h-[min(320px,42vh)] overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50/50 p-2">
                  {!busquedaTrim ? (
                    <p className="px-2 py-5 text-center text-sm text-zinc-500">
                      Escribí un nombre para ver resultados o crear uno nuevo.
                    </p>
                  ) : listaFiltrada.length === 0 ? (
                    <div className="px-2 py-5 text-center text-sm text-zinc-500">
                      <p>No se encontraron presupuestos para "{busquedaTrim}".</p>
                      {puedeCrearDesdeBusqueda ? (
                        <button
                          type="button"
                          onClick={abrirModalCrear}
                          className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          Crear presupuesto para "{busquedaTrim}"
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {listaFiltrada.map((p) => {
                        const active = selectedId === p.id;
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => setPresupuestoQuery(p.id)}
                              className={`w-full rounded-lg px-3 py-2.5 text-left text-base transition ${
                                active
                                  ? "bg-red-600 font-semibold text-white shadow-sm ring-2 ring-red-400/40"
                                  : "bg-white text-zinc-800 hover:bg-zinc-100"
                              }`}
                            >
                              <span className="line-clamp-2">{p.nombre_persona}</span>
                              {p.fecha_actualizacion ? (
                                <span
                                  className={`mt-0.5 block text-xs ${
                                    active ? "text-red-100" : "text-zinc-500"
                                  }`}
                                >
                                  Última actualización:{" "}
                                  {new Date(p.fecha_actualizacion).toLocaleString("es-AR")}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>

              {hayPresupuestoAbierto ? (
                <div className="flex min-h-0 flex-col gap-4">
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm ring-1 ring-zinc-100">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {selectedId ? "Cliente (presupuesto abierto)" : "Nuevo — datos del cliente"}
                  </h2>
                  <label className="mt-2 block text-sm font-semibold text-zinc-500">
                    Nombre del cliente
                    <input
                      value={nombrePersona}
                      onChange={(e) => setNombrePersona(e.target.value)}
                      maxLength={200}
                      className={`mt-1 ${inputCell}`}
                      placeholder="Nombre y apellido"
                    />
                  </label>
                  <label className="mt-3 block text-sm font-semibold text-zinc-500">
                    Observaciones <span className="font-normal text-zinc-400">(opc.)</span>
                    <textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      rows={2}
                      className={`mt-1 ${notesCell} min-h-[4rem]`}
                      placeholder="Validez del presupuesto, forma de pago, etc."
                    />
                  </label>

                  <div className="mt-4 border-t border-zinc-100 pt-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Vehículo{" "}
                      <span className="font-normal normal-case text-zinc-400">(opc.)</span>
                    </h3>
                    <label className="mt-2 block text-sm font-semibold text-zinc-500">
                      Datos del vehículo
                      <input
                        value={datosVehiculo}
                        onChange={(e) => setDatosVehiculo(e.target.value)}
                        maxLength={500}
                        className={`mt-1 ${inputCell}`}
                        placeholder="Marca, modelo, año, patente…"
                      />
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-zinc-500">
                        Kilometraje
                        <input
                          value={km}
                          onChange={(e) => setKm(e.target.value)}
                          inputMode="decimal"
                          className={`mt-1 ${inputCell} tabular-nums`}
                          placeholder="Ej. 45200"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-zinc-500">
                        Fecha entrega estimada
                        <input
                          type="date"
                          value={fechaEntregaEstimada}
                          onChange={(e) => setFechaEntregaEstimada(e.target.value)}
                          className={`mt-1 ${inputCell}`}
                        />
                      </label>
                      <label className="block text-sm font-semibold text-zinc-500">
                        Fecha entrega comprometida
                        <input
                          type="date"
                          value={fechaEntregaComprometida}
                          onChange={(e) => setFechaEntregaComprometida(e.target.value)}
                          className={`mt-1 ${inputCell}`}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-6 text-center text-zinc-600">
                  Seleccioná un presupuesto desde la búsqueda o creá uno nuevo para empezar.
                </div>
              )}
            </div>

            <section className="flex max-h-[calc(100vh-9.5rem)] min-h-[280px] flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-100 sm:max-h-[calc(100vh-8.5rem)] sm:rounded-2xl">
              <div className="flex shrink-0 flex-col gap-2 border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-50/90 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600 sm:text-base">
                    Ítems y montos
                  </h2>
                  <p className="mt-0.5 hidden text-sm text-zinc-500 sm:block sm:text-base">
                    Cantidad × precio unitario = subtotal · Total abajo
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-base font-bold tabular-nums text-emerald-900">
                    <div>Total ítems: ${fmtMoney(totalGeneral)}</div>
                    {montoSena > 0 ? (
                      <div className="mt-0.5 text-sm font-semibold text-emerald-800">
                        Saldo pendiente: ${fmtMoney(saldoPendiente)}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={agregarLinea}
                    className="min-h-11 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-base font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                  >
                    + Ítem
                  </button>
                  <button
                    type="button"
                    onClick={guardarTodo}
                    className="min-h-11 rounded-lg bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-base font-semibold text-white shadow-sm hover:from-emerald-600 hover:to-emerald-500"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={imprimir}
                    disabled={!puedeImprimir}
                    className="min-h-11 rounded-lg border border-zinc-400 bg-zinc-100 px-4 py-2 text-base font-semibold text-zinc-900 shadow-sm hover:bg-zinc-200 disabled:opacity-50"
                  >
                    Imprimir
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {rows.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                    <p className="max-w-sm text-base text-zinc-500">
                      Tocá «+ Ítem» o «Nuevo presupuesto» para empezar a cargar líneas.
                    </p>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                    <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
                      <colgroup>
                        <col style={{ width: "2.5rem" }} />
                        <col style={{ width: "22%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "28%" }} />
                        <col style={{ width: "10%" }} />
                      </colgroup>
                      <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-100/98 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] backdrop-blur-sm">
                        <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-600 sm:text-sm">
                          <th className="px-1 py-2.5 text-center font-medium text-zinc-500">#</th>
                          <th className="px-1.5 py-2 pl-1">Concepto</th>
                          <th className="px-1.5 py-2">Cant.</th>
                          <th className="px-1.5 py-2">P. unit.</th>
                          <th className="px-1.5 py-2">Subtotal</th>
                          <th className="px-1.5 py-2">Notas</th>
                          <th className="px-1.5 py-2 pr-2 text-center">Quitar</th>
                        </tr>
                      </thead>
                      <tbody className="text-base">
                        {rows.map((row, idx) => {
                          const sub = lineSubtotal(row);
                          const tieneConcepto = Boolean(String(row.parametro || "").trim());
                          return (
                            <tr
                              key={row.key}
                              className={`border-b border-zinc-100 align-top ${idx % 2 === 1 ? "bg-zinc-50/70" : "bg-white"}`}
                            >
                              <td className="px-1 py-1.5 text-center align-top">
                                <span className="inline-flex min-h-10 min-w-8 items-center justify-center rounded-md bg-zinc-100/90 text-sm font-bold tabular-nums text-zinc-600">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-1.5 py-1.5 align-top">
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
                              <td className="px-1.5 py-1.5 align-top">
                                <input
                                  value={row.cantidad}
                                  onChange={(e) =>
                                    actualizarCampo(row.key, "cantidad", e.target.value)
                                  }
                                  inputMode="decimal"
                                  className={`${inputCell} tabular-nums`}
                                  placeholder="1"
                                />
                              </td>
                              <td className="px-1.5 py-1.5 align-top">
                                <input
                                  value={row.precio_unitario}
                                  onChange={(e) =>
                                    actualizarCampo(row.key, "precio_unitario", e.target.value)
                                  }
                                  inputMode="decimal"
                                  className={`${inputCell} tabular-nums`}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-1.5 py-1.5 align-top">
                                <div
                                  className={`flex min-h-10 items-center rounded-md border border-zinc-100 bg-zinc-50 px-3 text-base font-semibold tabular-nums text-zinc-800 ${tieneConcepto ? "" : "text-zinc-400"}`}
                                >
                                  ${fmtMoney(tieneConcepto ? sub : 0)}
                                </div>
                              </td>
                              <td className="px-1.5 py-1.5 align-top">
                                <textarea
                                  value={row.notas}
                                  onChange={(e) =>
                                    actualizarCampo(row.key, "notas", e.target.value)
                                  }
                                  rows={2}
                                  className={`${notesCell} min-h-[4.5rem]`}
                                  placeholder="Detalle"
                                />
                              </td>
                              <td className="px-2 py-1.5 pr-2 align-top">
                                <button
                                  type="button"
                                  onClick={() => eliminarLinea(row)}
                                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border-2 border-red-200 bg-red-50/90 px-2 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-100"
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {rows.length > 0 ? (
                <div className="flex shrink-0 flex-col items-end gap-0.5 border-t border-zinc-200 bg-zinc-50/90 px-4 py-3">
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
              <div className="border-t border-zinc-200 bg-white px-4 py-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Entregas
                </h3>
                {entregas.length > 0 ? (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="bg-zinc-50 text-zinc-600">
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
                  <label className="block text-sm font-semibold text-zinc-500">
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
                    className="min-h-11 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-base font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100"
                  >
                    + Registrar entrega
                  </button>
                </div>
                {!selectedId ? (
                  <p className="mt-2 text-sm text-zinc-500">
                    En un presupuesto nuevo, la primera entrega se guarda al tocar "Guardar".
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
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

      {/* Solo vista impresión: marco, logo con URL absoluta */}
      <div className="hidden print:block">
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

            <div className="mt-5 grid gap-3 border border-zinc-800 bg-zinc-50/80 p-4 text-sm leading-relaxed print:bg-white">
              <p className="text-base">
                <span className="font-semibold text-zinc-800">Cliente: </span>
                {nombrePersona.trim() || "—"}
              </p>
              {observaciones.trim() ? (
                <p>
                  <span className="font-semibold text-zinc-800">Observaciones: </span>
                  {observaciones.trim()}
                </p>
              ) : null}
              {(datosVehiculo.trim() ||
                km.trim() ||
                fechaEntregaEstimada ||
                fechaEntregaComprometida) ? (
                <div className="grid gap-2 border-t border-zinc-300 pt-3 sm:grid-cols-2">
                  {datosVehiculo.trim() ? (
                    <p className="sm:col-span-2">
                      <span className="font-semibold text-zinc-800">Vehículo: </span>
                      {datosVehiculo.trim()}
                    </p>
                  ) : null}
                  {km.trim() ? (
                    <p>
                      <span className="font-semibold text-zinc-800">Km: </span>
                      {km.trim()}
                    </p>
                  ) : null}
                  {fechaEntregaEstimada ? (
                    <p>
                      <span className="font-semibold text-zinc-800">Entrega estimada: </span>
                      {fmtDateEs(fechaEntregaEstimada)}
                    </p>
                  ) : null}
                  {fechaEntregaComprometida ? (
                    <p>
                      <span className="font-semibold text-zinc-800">Entrega comprometida: </span>
                      {fmtDateEs(fechaEntregaComprometida)}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-zinc-500">Impreso: {fechaImpresion}</p>
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
