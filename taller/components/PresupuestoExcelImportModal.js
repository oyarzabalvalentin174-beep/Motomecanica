"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  parseLineasFromGrid,
  parseMoneyARValue,
  parsePresupuestoExcelFile,
} from "@/lib/presupuestoExcelImport";

function fmtMoney(n) {
  return Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function lineSubtotalPreview(line) {
  const q = parseFloat(String(line.cantidad ?? "1").replace(",", ".")) || 1;
  const pu = parseMoneyARValue(line.precio_unitario);
  return (q > 0 ? q : 1) * pu;
}

const ROLE_OPTIONS = [
  { value: "ignore", label: "Ignorar" },
  { value: "qty", label: "Cantidad" },
  { value: "desc", label: "Descripción / concepto" },
  { value: "price", label: "Precio / importe" },
];

function rolesToMapping(roles, colCount) {
  const qtyCol = roles.findIndex((r) => r === "qty");
  const descCol = roles.findIndex((r) => r === "desc");
  const priceCol = roles.findIndex((r) => r === "price");
  return {
    qtyCol: qtyCol >= 0 ? qtyCol : -1,
    descCol: descCol >= 0 ? descCol : Math.min(1, colCount - 1),
    priceCol: priceCol >= 0 ? priceCol : Math.max(0, colCount - 1),
  };
}

function mappingToRoles(mapping, colCount) {
  const roles = Array.from({ length: colCount }, () => "ignore");
  if (mapping.qtyCol >= 0 && mapping.qtyCol < colCount) roles[mapping.qtyCol] = "qty";
  if (mapping.descCol >= 0 && mapping.descCol < colCount) roles[mapping.descCol] = "desc";
  if (mapping.priceCol >= 0 && mapping.priceCol < colCount) roles[mapping.priceCol] = "price";
  return roles;
}

export default function PresupuestoExcelImportModal({ open, onClose, onApply }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [nombrePersona, setNombrePersona] = useState("");
  const [km, setKm] = useState("");
  const [datosVehiculo, setDatosVehiculo] = useState("");
  const [lineas, setLineas] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [roles, setRoles] = useState([]);
  const [dataStart, setDataStart] = useState(0);
  const [dataEnd, setDataEnd] = useState(0);
  const [priceIsLineTotal, setPriceIsLineTotal] = useState(true);
  const [modoCarga, setModoCarga] = useState("replace");

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setParseResult(null);
    setNombrePersona("");
    setKm("");
    setDatosVehiculo("");
    setLineas([]);
    setWarnings([]);
    setRoles([]);
    setDataStart(0);
    setDataEnd(0);
    setPriceIsLineTotal(true);
    setModoCarga("replace");
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const colCount = parseResult?.columnOptions?.length ?? 0;

  const reparseLineas = useCallback(
    (grid, start, end, roleList, priceAsTotal) => {
      if (!grid?.length) return;
      const mapping = rolesToMapping(roleList, grid[0]?.length ?? colCount);
      const { lineas: parsed, warnings: w } = parseLineasFromGrid(grid, {
        ...mapping,
        dataStart: start,
        dataEnd: end,
        priceIsLineTotal: priceAsTotal,
      });
      setLineas(parsed);
      setWarnings(w);
    },
    [colCount],
  );

  useEffect(() => {
    if (!parseResult?.grid) return;
    reparseLineas(parseResult.grid, dataStart, dataEnd, roles, priceIsLineTotal);
  }, [roles, dataStart, dataEnd, priceIsLineTotal, parseResult?.grid, reparseLineas]);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const result = await parsePresupuestoExcelFile(file);
      if (!result.ok) {
        setError(result.error || "No se pudo leer el archivo.");
        return;
      }
      setParseResult(result);
      setNombrePersona(result.header?.nombrePersona ?? "");
      setKm(result.header?.km ?? "");
      setDatosVehiculo(result.header?.datosVehiculo ?? "");
      setDataStart(result.mapping?.dataStart ?? 0);
      setDataEnd(result.mapping?.dataEnd ?? 0);
      setPriceIsLineTotal(result.mapping?.priceIsLineTotal !== false);
      const cc = result.columnOptions?.length ?? 0;
      setRoles(mappingToRoles(result.mapping, cc));
      setLineas(result.lineas ?? []);
      setWarnings(result.warnings ?? []);
    } catch (e) {
      setError(e?.message || "Error al procesar el Excel.");
    } finally {
      setLoading(false);
    }
  };

  const totalPreview = useMemo(() => {
    return lineas
      .filter((l) => l.include !== false)
      .reduce((s, l) => s + lineSubtotalPreview(l), 0);
  }, [lineas]);

  const includedCount = lineas.filter((l) => l.include !== false).length;

  const updateLinea = (idx, field, value) => {
    setLineas((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  };

  const setRoleForCol = (colIdx, role) => {
    setRoles((prev) => {
      const next = [...prev];
      while (next.length <= colIdx) next.push("ignore");
      if (role !== "ignore") {
        for (let i = 0; i < next.length; i++) {
          if (next[i] === role) next[i] = "ignore";
        }
      }
      next[colIdx] = role;
      return next;
    });
  };

  const confirmar = () => {
    const nom = nombrePersona.trim();
    if (!nom) {
      setError("Indicá el nombre del cliente antes de cargar.");
      return;
    }
    const activas = lineas
      .filter((l) => l.include !== false && String(l.parametro || "").trim())
      .map((l) => ({
        parametro: String(l.parametro).trim(),
        cantidad: String(l.cantidad || "1"),
        precio_unitario: String(l.precio_unitario ?? ""),
        notas: "",
      }));
    if (!activas.length) {
      setError("Marcá al menos una línea con concepto para importar.");
      return;
    }
    onApply({
      nombrePersona: nom,
      km: km.trim(),
      datosVehiculo: datosVehiculo.trim(),
      lineas: activas,
      modo: modoCarga,
    });
    onClose();
  };

  if (!open) return null;

  const inputCell =
    "h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/15";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="excel-import-title"
    >
      <div className="flex max-h-[min(96vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <header className="shrink-0 border-b border-zinc-200 px-4 py-3 sm:px-5">
          <h2 id="excel-import-title" className="text-lg font-semibold text-zinc-900">
            Importar presupuesto desde Excel
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Subí un archivo .xlsx o .xls. Revisá los datos detectados y ajustá las columnas si el formato es distinto.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-gradient-to-r from-red-700 to-red-600 px-4 py-2 text-sm font-semibold text-white hover:from-red-600 disabled:opacity-60"
            >
              {loading ? "Leyendo…" : parseResult ? "Elegir otro archivo" : "Seleccionar Excel"}
            </button>
            {parseResult?.sheetName ? (
              <span className="text-xs text-zinc-500">Hoja: {parseResult.sheetName}</span>
            ) : null}
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </p>
          ) : null}

          {parseResult ? (
            <div className="mt-4 space-y-4">
              <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Datos del encabezado
                </h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-zinc-600 sm:col-span-2">
                    Cliente
                    <input
                      value={nombrePersona}
                      onChange={(e) => setNombrePersona(e.target.value)}
                      className={`mt-1 ${inputCell}`}
                      placeholder="Nombre detectado o editá manualmente"
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-600">
                    KM <span className="font-normal text-zinc-400">(opc.)</span>
                    <input
                      value={km}
                      onChange={(e) => setKm(e.target.value)}
                      className={`mt-1 ${inputCell}`}
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-600">
                    Vehículo <span className="font-normal text-zinc-400">(opc.)</span>
                    <input
                      value={datosVehiculo}
                      onChange={(e) => setDatosVehiculo(e.target.value)}
                      className={`mt-1 ${inputCell}`}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-zinc-200 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Columnas y filas
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Si los ítems no coinciden, asigná qué columna es cantidad, descripción y precio.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {parseResult.columnOptions?.map((col) => (
                    <label
                      key={col.index}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <span className="font-bold text-zinc-700">Col {col.letter}</span>
                      <select
                        value={roles[col.index] ?? "ignore"}
                        onChange={(e) => setRoleForCol(col.index, e.target.value)}
                        className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-xs"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <label className="text-xs font-medium text-zinc-600">
                    Primera fila de ítems (nº)
                    <input
                      type="number"
                      min={1}
                      value={dataStart + 1}
                      onChange={(e) =>
                        setDataStart(Math.max(0, (parseInt(e.target.value, 10) || 1) - 1))
                      }
                      className={`mt-1 ${inputCell}`}
                    />
                  </label>
                  <label className="text-xs font-medium text-zinc-600">
                    Última fila de ítems (nº)
                    <input
                      type="number"
                      min={1}
                      value={dataEnd + 1}
                      onChange={(e) =>
                        setDataEnd(Math.max(dataStart, (parseInt(e.target.value, 10) || 1) - 1))
                      }
                      className={`mt-1 ${inputCell}`}
                    />
                  </label>
                  <label className="flex items-end gap-2 text-xs text-zinc-700 sm:pb-2">
                    <input
                      type="checkbox"
                      checked={priceIsLineTotal}
                      onChange={(e) => setPriceIsLineTotal(e.target.checked)}
                      className="size-4 rounded border-zinc-300"
                    />
                    Los importes son por línea como en Excel ($ 72.600,00), no precio unitario
                  </label>
                </div>
              </section>

              {warnings.length > 0 ? (
                <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  {warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              ) : null}

              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Vista previa ({includedCount} líneas)
                  </h3>
                  <p className="text-sm font-bold tabular-nums text-emerald-800">
                    Total seleccionado: ${fmtMoney(totalPreview)}
                  </p>
                </div>
                <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-200">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="sticky top-0 bg-zinc-100 text-xs uppercase text-zinc-600">
                      <tr>
                        <th className="w-10 px-2 py-2">✓</th>
                        <th className="px-2 py-2">Concepto</th>
                        <th className="w-16 px-2 py-2 text-center">Cant.</th>
                        <th className="w-28 px-2 py-2 text-right">Importe</th>
                        <th className="w-28 px-2 py-2 text-right">En formulario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((line, idx) => (
                        <tr key={line.rowIndex ?? idx} className="border-t border-zinc-100">
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={line.include !== false}
                              onChange={(e) =>
                                updateLinea(idx, "include", e.target.checked)
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={line.parametro}
                              onChange={(e) =>
                                updateLinea(idx, "parametro", e.target.value)
                              }
                              className="w-full min-w-[10rem] rounded border border-zinc-200 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={line.cantidad}
                              onChange={(e) =>
                                updateLinea(idx, "cantidad", e.target.value)
                              }
                              className="w-14 rounded border border-zinc-200 px-1 py-1 text-center text-sm tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={line.precio_unitario}
                              onChange={(e) =>
                                updateLinea(idx, "precio_unitario", e.target.value)
                              }
                              className="w-full rounded border border-zinc-200 px-2 py-1 text-right text-sm tabular-nums"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-zinc-800">
                            ${fmtMoney(lineSubtotalPreview(line))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <fieldset className="rounded-lg border border-zinc-200 px-3 py-2">
                <legend className="px-1 text-xs font-semibold text-zinc-600">
                  Al confirmar
                </legend>
                <label className="mt-1 flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="radio"
                    name="modoCarga"
                    checked={modoCarga === "replace"}
                    onChange={() => setModoCarga("replace")}
                  />
                  Reemplazar ítems actuales del formulario
                </label>
                <label className="mt-1 flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="radio"
                    name="modoCarga"
                    checked={modoCarga === "append"}
                    onChange={() => setModoCarga("append")}
                  />
                  Agregar al final de los ítems existentes
                </label>
              </fieldset>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-zinc-500">
              Formatos habituales: cantidad | descripción | $ | precio, con cliente arriba y fila TOTAL al final.
              Si tu plantilla es distinta, podés ajustar columnas después de cargar el archivo.
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!parseResult || loading || includedCount === 0}
            onClick={confirmar}
            className="rounded-lg bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:from-emerald-600 disabled:opacity-50"
          >
            Cargar en el presupuesto
          </button>
        </footer>
      </div>
    </div>
  );
}
