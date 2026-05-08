"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

function emptyDraftLine(motoId) {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    id: null,
    parametro: "",
    valor: "",
    notas: "",
    moto_id: motoId,
  };
}

export default function FichaTecnicaClient({
  initialMotos = [],
  initialSelectedMotoId = 0,
  initialLineas = [],
  listError = null,
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [banner, setBanner] = useState(null);

  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState("");

  const motos = useMemo(
    () =>
      (Array.isArray(initialMotos) ? initialMotos : [])
        .map((m) => ({
          id: Number(m?.id),
          marca: String(m?.marca ?? ""),
          modelo: String(m?.modelo ?? ""),
          anio: m?.anio != null ? Number(m.anio) : null,
        }))
        .filter((m) => Number.isFinite(m.id) && m.id > 0),
    [initialMotos],
  );

  const selectedId = Number(initialSelectedMotoId) > 0 ? Number(initialSelectedMotoId) : 0;
  const selectedMoto = useMemo(() => motos.find((m) => m.id === selectedId) ?? null, [motos, selectedId]);

  const [rows, setRows] = useState([]);

  useEffect(() => {
    const base = Array.isArray(initialLineas) ? initialLineas : [];
    setRows(
      base.map((r, i) => ({
        key: `db-${r?.id ?? i}`,
        id: r?.id != null ? Number(r.id) : null,
        parametro: String(r?.parametro ?? ""),
        valor: String(r?.valor ?? ""),
        notas: String(r?.notas ?? ""),
        moto_id: Number(r?.moto_id) || selectedId,
      })),
    );
  }, [initialLineas, selectedId]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const setMotoQuery = useCallback(
    (id) => {
      const next = Number(id) || 0;
      if (next <= 0) {
        router.replace("/ficha-tecnica");
        return;
      }
      router.replace(`/ficha-tecnica?moto=${next}`);
    },
    [router],
  );

  async function postMotos(items) {
    const res = await fetch("/api/motos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "No se pudo guardar la moto");
    return json;
  }

  async function postFicha(items) {
    const res = await fetch("/api/ficha-tecnica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "No se pudo guardar la ficha");
    return json;
  }

  const crearMoto = async (e) => {
    e.preventDefault();
    const m = marca.trim();
    const mo = modelo.trim();
    if (!m || !mo) {
      setBanner({ type: "error", text: "Marca y modelo son obligatorios." });
      return;
    }
    let anioNum = null;
    const ay = anio.trim();
    if (ay) {
      const n = parseInt(ay, 10);
      if (!Number.isFinite(n)) {
        setBanner({ type: "error", text: "Año inválido." });
        return;
      }
      anioNum = n;
    }
    setBanner(null);
    try {
      await postMotos([{ marca: m, modelo: mo, anio: anioNum }]);
      setMarca("");
      setModelo("");
      setAnio("");
      setBanner({ type: "ok", text: "Moto registrada. Elegila en el listado para cargar la ficha." });
      refresh();
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  };

  const eliminarMoto = async () => {
    if (!selectedMoto) return;
    const label = `${selectedMoto.marca} ${selectedMoto.modelo}`;
    if (!window.confirm(`¿Eliminar la moto «${label}»? Se borrarán también todas las líneas de ficha técnica.`)) {
      return;
    }
    setBanner(null);
    try {
      await postMotos([{ id: selectedMoto.id, eliminar: true }]);
      router.replace("/ficha-tecnica");
      setBanner({ type: "ok", text: "Moto eliminada." });
      refresh();
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  };

  const agregarLinea = () => {
    if (!selectedId) {
      setBanner({ type: "error", text: "Primero elegí una moto." });
      return;
    }
    setRows((prev) => [...prev, emptyDraftLine(selectedId)]);
    setBanner(null);
  };

  const actualizarCampo = (key, field, value) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const guardarLinea = async (row) => {
    const param = String(row.parametro || "").trim();
    if (!param) {
      setBanner({ type: "error", text: "El parámetro no puede quedar vacío." });
      return;
    }
    if (!selectedId) return;
    const moto_id = selectedId;
    const payload = {
      parametro: param,
      valor: String(row.valor || "").trim() || null,
      notas: String(row.notas || "").trim() || null,
      moto_id,
    };
    if (row.id) payload.id = row.id;

    setBanner(null);
    try {
      await postFicha([payload]);
      setBanner({ type: "ok", text: "Línea guardada." });
      refresh();
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  };

  const guardarTodas = async () => {
    if (!selectedId) return;
    const items = rows
      .map((row) => {
        const param = String(row.parametro || "").trim();
        if (!param) return null;
        const o = {
          parametro: param,
          valor: String(row.valor || "").trim() || null,
          notas: String(row.notas || "").trim() || null,
          moto_id: selectedId,
        };
        if (row.id) o.id = row.id;
        return o;
      })
      .filter(Boolean);
    if (items.length === 0) {
      setBanner({ type: "error", text: "No hay líneas con parámetro cargado." });
      return;
    }
    setBanner(null);
    try {
      await postFicha(items);
      setBanner({ type: "ok", text: "Ficha técnica guardada." });
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
    if (!window.confirm("¿Eliminar esta línea de la ficha técnica?")) return;
    setBanner(null);
    try {
      await postFicha([{ id: row.id, eliminar: true }]);
      setBanner({ type: "ok", text: "Línea eliminada." });
      refresh();
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    }
  };

  const inputCell =
    "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-base leading-snug text-zinc-900 shadow-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/15";

  const notesCell =
    "min-h-[5rem] max-h-56 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-base leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/15";

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 pb-8 pt-1 sm:px-5 lg:px-6">
      <header className="border-b border-zinc-200/90 pb-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Ficha técnica</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
          Motos y parámetros técnicos por unidad.
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

        {/* Moto activa + alta compacta */}
        <div className="grid gap-3 lg:grid-cols-[1fr_minmax(0,2fr)] lg:items-stretch lg:gap-5">
          <div className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm ring-1 ring-zinc-100 sm:p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">Moto en trabajo</h2>
            <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <label className="min-w-0 flex-1 text-sm font-semibold text-zinc-500">
                <span className="sr-only">Elegir moto</span>
                <select
                  value={selectedId || ""}
                  onChange={(e) => setMotoQuery(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 text-base font-semibold text-zinc-900 outline-none focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">— Elegir moto —</option>
                  {motos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.marca} · {m.modelo}
                      {m.anio != null && Number.isFinite(m.anio) ? ` (${m.anio})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selectedMoto ? (
                <button
                  type="button"
                  onClick={eliminarMoto}
                  className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-base font-semibold text-red-700 transition hover:bg-red-100"
                >
                  Eliminar moto
                </button>
              ) : null}
            </div>
            {!selectedMoto ? (
              <p className="mt-2 text-sm text-zinc-500 sm:text-base">Elegí una moto para cargar la tabla de abajo.</p>
            ) : (
              <p className="mt-auto pt-2 text-sm leading-snug text-zinc-400">
                Guardá con cada fila o con «Guardar todo».
              </p>
            )}
          </div>

          <form
            onSubmit={crearMoto}
            className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm ring-1 ring-zinc-100 sm:p-4"
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">Nueva moto</h2>
            <div className="mt-2 grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
              <label className="block text-sm font-semibold text-zinc-500 lg:col-span-1">
                Marca
                <input
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  maxLength={50}
                  className={`mt-1 ${inputCell}`}
                  placeholder="Ej. Honda"
                />
              </label>
              <label className="block text-sm font-semibold text-zinc-500 lg:col-span-1">
                Modelo
                <input
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  maxLength={50}
                  className={`mt-1 ${inputCell}`}
                  placeholder="Ej. XR 150"
                />
              </label>
              <label className="block text-sm font-semibold text-zinc-500 lg:col-span-1">
                Año <span className="font-normal text-zinc-400">(opc.)</span>
                <input
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  inputMode="numeric"
                  className={`mt-1 ${inputCell}`}
                  placeholder="2020"
                />
              </label>
              <div className="flex items-end lg:col-span-1">
                <button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-base font-semibold text-white shadow-sm transition hover:from-red-600 hover:to-red-500"
                >
                  Registrar moto
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Parámetros — ancho completo, densidad para muchas filas */}
        <section className="flex max-h-[calc(100vh-9.5rem)] min-h-[280px] flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-100 sm:max-h-[calc(100vh-8.5rem)] sm:rounded-2xl">
          <div className="flex shrink-0 flex-col gap-2 border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-50/90 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600 sm:text-base">Parámetros de la ficha</h2>
              <p className="mt-0.5 hidden text-sm text-zinc-500 sm:block sm:text-base">
                Una fila por dato · Notas amplias · Columna «Notas» usa el espacio principal
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={agregarLinea}
                disabled={!selectedId}
                className="min-h-11 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-base font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                + Parámetro
              </button>
              <button
                type="button"
                onClick={guardarTodas}
                disabled={!selectedId || rows.length === 0}
                className="min-h-11 rounded-lg bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-base font-semibold text-white shadow-sm hover:from-emerald-600 hover:to-emerald-500 disabled:opacity-50"
              >
                Guardar todo
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {!selectedId ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <p className="max-w-sm text-base text-zinc-500">
                  Elegí una moto arriba para cargar y editar los parámetros de esa unidad.
                </p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <p className="max-w-sm text-base text-zinc-500">
                  Todavía no hay filas. Usá «+ Parámetro» para sumar aceites, torque, etc.
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col style={{ width: "2.75rem" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "46%" }} />
                    <col style={{ width: "18%" }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-100/98 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] backdrop-blur-sm">
                    <tr className="text-sm font-semibold uppercase tracking-wide text-zinc-600 sm:text-base">
                      <th className="px-1 py-2.5 text-center font-medium text-zinc-500">#</th>
                      <th className="px-1.5 py-2 pl-1">Parámetro</th>
                      <th className="px-1.5 py-2">Valor</th>
                      <th className="px-1.5 py-2">Notas</th>
                      <th className="px-1.5 py-2 pr-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-base">
                    {rows.map((row, idx) => (
                      <tr
                        key={row.key}
                        className={`border-b border-zinc-100 align-top ${idx % 2 === 1 ? "bg-zinc-50/70" : "bg-white"}`}
                      >
                        <td className="px-1 py-1.5 text-center align-top">
                          <span className="inline-flex min-h-10 min-w-9 items-center justify-center rounded-md bg-zinc-100/90 text-sm font-bold tabular-nums text-zinc-600">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-1.5 py-1.5 align-top">
                          <input
                            value={row.parametro}
                            onChange={(e) => actualizarCampo(row.key, "parametro", e.target.value)}
                            maxLength={100}
                            className={inputCell}
                            placeholder="Parámetro"
                          />
                        </td>
                        <td className="px-1.5 py-1.5 align-top">
                          <input
                            value={row.valor}
                            onChange={(e) => actualizarCampo(row.key, "valor", e.target.value)}
                            maxLength={255}
                            className={inputCell}
                            placeholder="Valor"
                          />
                        </td>
                        <td className="px-1.5 py-1.5 align-top">
                          <textarea
                            value={row.notas}
                            onChange={(e) => actualizarCampo(row.key, "notas", e.target.value)}
                            rows={2}
                            className={notesCell}
                            placeholder="Referencias, códigos, medidas…"
                          />
                        </td>
                        <td className="px-2 py-1.5 pr-2 align-top">
                          <div className="flex min-w-[7.5rem] flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => guardarLinea(row)}
                              className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarLinea(row)}
                              className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-red-200 bg-red-50/90 px-3 py-2.5 text-base font-semibold text-red-800 shadow-sm transition hover:bg-red-100"
                            >
                              Quitar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
