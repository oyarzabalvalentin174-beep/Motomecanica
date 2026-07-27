"use client";

import { useCallback, useState } from "react";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Area,
  AreaChart,
  Line,
} from "recharts";

const PERIODOS = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "ultimomes", label: "Último mes" },
  { id: "mes", label: "Meses" },
  { id: "anio", label: "Último año" },
];

const PIE_COLORS = ["#dc2626", "#0d9488", "#7c3aed", "#0369a1", "#ca8a04", "#64748b", "#db2777"];

const tooltipStyle = {
  backgroundColor: "rgba(9, 9, 11, 0.92)",
  border: "1px solid rgba(220, 38, 38, 0.25)",
  borderRadius: "12px",
  fontSize: "13px",
  padding: "10px 12px",
  color: "#fafafa",
  boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function metodoLabel(m) {
  const s = String(m ?? "").trim();
  if (!s || s === "sin_definir") return "Sin definir";
  const map = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta",
    debito: "Débito",
    credito: "Crédito",
  };
  return map[s.toLowerCase()] ?? s;
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function intFmt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function shortName(n, max = 18) {
  const s = String(n ?? "—").trim() || "—";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function periodoSubtitle(periodo, fecha) {
  if (periodo === "dia") return fecha ? `Suma facturada por hora · ${fecha}` : "Suma facturada por hora del día";
  if (periodo === "semana") return "Suma facturada por día en la semana (lun–dom)";
  if (periodo === "ultimomes") return "Suma facturada semana a semana del mes en curso";
  if (periodo === "mes") return "Suma facturada por mes (últimos 12 meses)";
  return "Suma facturada por mes (últimos 12 meses)";
}

function ChartCard({ title, subtitle, children, className = "", tall = false, accent = "red" }) {
  const accentBar =
    accent === "teal"
      ? "from-teal-500/80 via-teal-400/50 to-transparent"
      : accent === "violet"
        ? "from-violet-500/80 via-violet-400/50 to-transparent"
        : accent === "emerald"
          ? "from-emerald-500/80 via-emerald-400/50 to-transparent"
          : "from-red-600/90 via-red-500/40 to-transparent";

  return (
    <section
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.12)] backdrop-blur-sm ${className}`}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-red-500/[0.06] to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      <header className="relative border-b border-zinc-100/90 bg-gradient-to-r from-zinc-50 via-white to-zinc-50/80 px-4 py-4 sm:px-6 sm:py-5">
        <div className={`mb-2 h-0.5 w-16 rounded-full bg-gradient-to-r ${accentBar}`} aria-hidden />
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500 sm:text-sm">{subtitle}</p> : null}
      </header>
      <div className={`relative flex-1 p-3 sm:p-5 ${tall ? "min-h-[300px] sm:min-h-[360px]" : "min-h-[220px] sm:min-h-[260px]"}`}>
        {children}
      </div>
    </section>
  );
}

function EmptyChart({ message, tall = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200/90 bg-gradient-to-b from-zinc-50/80 to-white text-center ${tall ? "h-[280px] sm:h-[320px]" : "h-[200px] sm:h-[240px]"}`}
    >
      <p className="max-w-xs px-4 text-sm text-zinc-500">{message}</p>
    </div>
  );
}

function KpiCard({ label, value, hint, accent = "red" }) {
  const ring =
    accent === "teal"
      ? "shadow-[inset_0_0_0_1px_rgba(13,148,136,0.14)]"
      : accent === "violet"
        ? "shadow-[inset_0_0_0_1px_rgba(124,58,237,0.14)]"
        : accent === "amber"
          ? "shadow-[inset_0_0_0_1px_rgba(217,119,6,0.16)]"
          : "shadow-[inset_0_0_0_1px_rgba(220,38,38,0.14)]";
  const bar =
    accent === "teal"
      ? "from-teal-600/90 to-teal-400/70"
      : accent === "violet"
        ? "from-violet-600/90 to-violet-400/70"
        : accent === "amber"
          ? "from-amber-600/90 to-amber-400/70"
          : "from-red-600/90 to-red-400/70";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_4px_20px_-8px_rgba(24,24,27,0.15)] backdrop-blur-sm sm:p-5 ${ring}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${bar}`} aria-hidden />
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 sm:text-[11px]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function PeriodFilters({ periodo, setPeriodo, fecha, setFecha, onApply, onSelectPeriodo, loading, compact = false }) {
  return (
    <div
      className={`flex flex-col gap-3 ${compact ? "" : "rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 sm:flex-row sm:flex-wrap sm:items-end"}`}
    >
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPeriodo(p.id);
              onSelectPeriodo?.(p.id);
            }}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
              periodo === p.id
                ? "bg-gradient-to-r from-red-700 to-red-600 text-white shadow-sm shadow-red-900/20"
                : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {periodo === "dia" ? (
        <label className="block min-w-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:min-w-[140px]">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full min-h-[40px] rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900"
          />
        </label>
      ) : null}
      <button
        type="button"
        onClick={onApply}
        disabled={loading}
        className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
      >
        {loading ? "Actualizando…" : "Actualizar"}
      </button>
    </div>
  );
}

function VerticalBarBlock({ data, dataKey, fill, labelKey = "name", height = 260, valueLabel = "Stock" }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#52525b", fontSize: 12 }} />
        <YAxis type="category" dataKey={labelKey} width={108} tick={{ fill: "#52525b", fontSize: 11 }} tickLine={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [intFmt(v), valueLabel]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
        />
        <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} fill={fill} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarBlock({ data, dataKey, fill, height = 320 }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#52525b", fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={64} />
        <YAxis tick={{ fill: "#52525b", fontSize: 12 }} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [intFmt(v), "Unidades"]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
        />
        <Bar dataKey={dataKey} fill={fill} radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ReportesGraficosClient({
  initial12 = null,
  initial34 = null,
  initialKpis = null,
  error12: initialErr12 = null,
  error34: initialErr34 = null,
  errorKpis: initialErrKpis = null,
}) {
  const [data12, setData12] = useState(initial12);
  const [data34, setData34] = useState(initial34);
  const [dataKpis, setDataKpis] = useState(initialKpis);
  const [err12, setErr12] = useState(initialErr12);
  const [err34, setErr34] = useState(initialErr34);
  const [errKpis, setErrKpis] = useState(initialErrKpis);
  const [loading34, setLoading34] = useState(false);
  const [periodo, setPeriodo] = useState("mes");
  const [fecha, setFecha] = useState(todayYmd());

  const buildPeriodQs = useCallback((periodoVal, fechaVal) => {
    const p = new URLSearchParams({ periodo: periodoVal });
    if (periodoVal === "dia" && fechaVal) p.set("fecha", fechaVal);
    return `?${p.toString()}`;
  }, []);

  /** Solo actualiza la serie de Ventas facturadas; no toca métodos de pago ni el resto. */
  const refreshVentasSerie = useCallback(
    async (periodoOverride, fechaOverride) => {
      const periodoVal = periodoOverride ?? periodo;
      const fechaVal = fechaOverride ?? fecha;
      setLoading34(true);
      setErr34(null);
      try {
        const r = await fetch(`/api/reportes/graficos-34${buildPeriodQs(periodoVal, fechaVal)}`, {
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErr34(j?.error || "No se pudieron cargar las ventas facturadas.");
          return;
        }
        setData34((prev) => ({
          ...(prev && typeof prev === "object" ? prev : {}),
          ventas_serie: Array.isArray(j?.ventas_serie) ? j.ventas_serie : [],
          periodo: j?.periodo ?? periodoVal,
          fecha_desde: j?.fecha_desde,
          fecha_hasta: j?.fecha_hasta,
        }));
      } catch (e) {
        setErr34(e?.message || "Error de red");
      } finally {
        setLoading34(false);
      }
    },
    [periodo, fecha, buildPeriodQs],
  );

  const stockMas = Array.isArray(data12?.stock_mas) ? data12.stock_mas : [];
  const stockMenos = Array.isArray(data12?.stock_menos) ? data12.stock_menos : [];
  const ventasMas = Array.isArray(data12?.ventas_mas) ? data12.ventas_mas : [];
  const ventasMenos = Array.isArray(data12?.ventas_menos) ? data12.ventas_menos : [];
  const marcasProdMas = Array.isArray(data12?.marcas_productos_mas) ? data12.marcas_productos_mas : [];
  const marcasProdMenos = Array.isArray(data12?.marcas_productos_menos) ? data12.marcas_productos_menos : [];
  const marcasUniMas = Array.isArray(data12?.marcas_unidades_mas) ? data12.marcas_unidades_mas : [];
  const marcasUniMenos = Array.isArray(data12?.marcas_unidades_menos) ? data12.marcas_unidades_menos : [];

  const mapProducto = (r, max = 20) => ({
    name: shortName(r.nombre ?? r.codigo ?? "—", max),
    full: r.nombre ?? r.codigo ?? "—",
    unidades: Number(r.unidades ?? r.cantidad ?? 0),
  });

  const mapMarca = (r, key = "cantidad") => ({
    name: shortName(r.nombre_marca ?? r.marca ?? r.nombre ?? "—", 22),
    full: r.nombre_marca ?? r.marca ?? r.nombre ?? "—",
    valor: Number(r[key] ?? r.cantidad ?? r.unidades ?? 0),
  });

  const barStockMas = stockMas.map((r) => ({
    name: shortName(r.nombre ?? r.codigo ?? "—", 16),
    full: r.nombre ?? r.codigo ?? "—",
    stock: Number(r.stock ?? 0),
  }));
  const barStockMenos = stockMenos.map((r) => ({
    name: shortName(r.nombre ?? r.codigo ?? "—", 16),
    full: r.nombre ?? r.codigo ?? "—",
    stock: Number(r.stock ?? 0),
  }));

  const barVentasMas = ventasMas.map((r) => mapProducto(r));
  const barVentasMenos = ventasMenos.map((r) => mapProducto(r));
  const barMarcasProdMas = marcasProdMas.map((r) => mapMarca(r, "cantidad_productos"));
  const barMarcasProdMenos = marcasProdMenos.map((r) => mapMarca(r, "cantidad_productos"));
  const barMarcasUniMas = marcasUniMas.map((r) => mapMarca(r, "unidades"));
  const barMarcasUniMenos = marcasUniMenos.map((r) => mapMarca(r, "unidades"));

  const metodos = Array.isArray(data34?.metodos_pago) ? data34.metodos_pago : [];
  const pieData = metodos.map((r) => ({
    name: metodoLabel(r.metodo ?? r.metodo_pago),
    value: Number(r.cantidad_ventas ?? r.ventas ?? r.cantidad ?? 0),
    total: Number(r.total_monto ?? r.total ?? 0),
  }));

  const ventasSerie = Array.isArray(data34?.ventas_serie) ? data34.ventas_serie : [];
  const areaData = (() => {
    const buckets = new Map();
    for (const r of ventasSerie) {
      const raw = r.fecha ?? r.dia ?? r.periodo ?? r.mes ?? r.label;
      let sortKey = String(raw ?? "");
      let label = String(r.label ?? "").trim();

      if (!label || !r.label) {
        try {
          const s = String(raw ?? "");
          if (periodo === "dia") {
            if (s.includes("T")) {
              const d = new Date(s);
              if (!Number.isNaN(d.getTime())) {
                label = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
                sortKey = `${String(d.getHours()).padStart(2, "0")}`;
              }
            } else if (/^\d{1,2}$/.test(s) || /^\d{2}:\d{2}/.test(s)) {
              const h = parseInt(s, 10);
              label = `${String(h).padStart(2, "0")}:00`;
              sortKey = String(h).padStart(2, "0");
            }
          } else if (periodo === "ultimomes") {
            const d = new Date(`${s.slice(0, 10)}T12:00:00`);
            if (!Number.isNaN(d.getTime())) {
              const end = new Date(d);
              end.setDate(end.getDate() + 6);
              const a = d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
              const b = end.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
              label = `${a} – ${b}`;
              sortKey = s.slice(0, 10);
            }
          } else if (periodo === "mes" || periodo === "anio") {
            const d = new Date(`${s.slice(0, 10)}T12:00:00`);
            if (!Number.isNaN(d.getTime())) {
              label = d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
              sortKey = s.slice(0, 7);
            }
          } else {
            const d = new Date(`${s.slice(0, 10)}T12:00:00`);
            if (!Number.isNaN(d.getTime())) {
              label = d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" });
              sortKey = s.slice(0, 10);
            }
          }
        } catch {
          label = String(raw ?? "—").slice(0, 16);
        }
      }

      if (!label) label = "—";
      const key = sortKey || label;
      const prev = buckets.get(key) || { label, sortKey: key, total: 0 };
      prev.total += Number(r.total ?? r.importe ?? r.total_facturado ?? 0);
      if (!prev.label || prev.label === "—") prev.label = label;
      buckets.set(key, prev);
    }

    return Array.from(buckets.values())
      .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)))
      .map(({ label, total }) => ({ label, total }));
  })();

  const totalFacturado = areaData.reduce((acc, row) => acc + row.total, 0);

  const kpiOk = dataKpis && !errKpis;
  const uStock = kpiOk ? Number(dataKpis.unidades_stock ?? 0) : NaN;
  const nProd = kpiOk ? Number(dataKpis.productos_con_stock ?? 0) : NaN;
  const inv = kpiOk ? Number(dataKpis.total_invertido ?? 0) : NaN;
  const valVta = kpiOk ? Number(dataKpis.valor_venta_total ?? 0) : NaN;

  return (
    <div className="mx-auto w-full max-w-[90rem] px-4 pb-20 pt-20 sm:px-6 sm:pt-24 lg:px-10 lg:pt-28">
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-5 shadow-[0_8px_40px_-12px_rgba(24,24,27,0.18)] backdrop-blur-sm sm:p-7">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(220,38,38,0.08),transparent_50%)]"
          aria-hidden
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-600/90">Reportes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl lg:text-4xl">
            Dashboard de gráficos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
            Inventario en tiempo real, rankings y facturación. El filtro de período aplica solo al gráfico de ventas
            facturadas.
          </p>
        </div>
      </div>

      {errKpis ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">{errKpis}</div>
      ) : null}

      {/* 1 — Tarjetas KPI */}
      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="Unidades en stock" value={kpiOk ? intFmt(uStock) : "—"} hint="Suma de stock de productos activos." accent="red" />
        <KpiCard label="Productos con stock" value={kpiOk ? intFmt(nProd) : "—"} hint="Ítems activos con stock mayor a cero." accent="teal" />
        <KpiCard label="Total invertido" value={kpiOk ? `$${money(inv)}` : "—"} hint="Precio de compra × stock." accent="violet" />
        <KpiCard
          label="Valor si se vendiera todo"
          value={kpiOk ? `$${money(valVta)}` : "—"}
          hint="Precio de venta × stock actual."
          accent="amber"
        />
      </div>

      {(err12 || err34) && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {err12 ? <p>{err12}</p> : null}
          {err34 ? <p className={err12 ? "mt-2" : ""}>{err34}</p> : null}
        </div>
      )}

      {/* 2 — Productos más / menos vendidos (separados, grandes) */}
      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Productos con más ventas"
          subtitle="Top 10 por unidades vendidas · últimos 12 meses"
          tall
          accent="emerald"
        >
          {barVentasMas.length === 0 ? (
            <EmptyChart tall message="Sin ventas en el período." />
          ) : (
            <HorizontalBarBlock data={barVentasMas} dataKey="unidades" fill="#059669" height={340} />
          )}
        </ChartCard>
        <ChartCard
          title="Productos con menos ventas"
          subtitle="Top 10 con ventas registradas (menor volumen) · últimos 12 meses"
          tall
          accent="red"
        >
          {barVentasMenos.length === 0 ? (
            <EmptyChart tall message="Sin datos de ranking." />
          ) : (
            <HorizontalBarBlock data={barVentasMenos} dataKey="unidades" fill="#b91c1c" height={340} />
          )}
        </ChartCard>
      </div>

      {/* 3 — Métodos de pago */}
      <div className="mb-8">
        <ChartCard
          title="Métodos de pago"
          subtitle="Distribución de ventas y montos cobrados · últimos 12 meses"
          accent="violet"
        >
          {pieData.length === 0 || pieData.every((d) => d.value <= 0) ? (
            <EmptyChart message="No hay ventas con método de pago en el período." />
          ) : (
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-center lg:gap-10">
              <div className="h-[260px] w-full min-h-[260px] max-w-[300px]">
                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={96}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fafafa" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, _n, props) => [`${value} ventas · $${money(props.payload?.total)}`, props.payload?.name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full max-w-md space-y-2">
                {pieData.map((row, i) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/90 px-4 py-2.5"
                  >
                    <span className="flex items-center gap-2.5 font-medium text-zinc-800">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {row.name}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-zinc-600">
                      {row.value} · ${money(row.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      {/* 4 — Ventas facturadas (pesos) */}
      <div className="mb-8">
        <ChartCard
          title="Ventas facturadas"
          subtitle={periodoSubtitle(periodo, fecha)}
          className="overflow-visible"
        >
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600">
              Total en el período:{" "}
              <span className="text-lg font-semibold tabular-nums text-zinc-900">${money(totalFacturado)}</span>
            </p>
            <PeriodFilters
              compact
              periodo={periodo}
              setPeriodo={setPeriodo}
              fecha={fecha}
              setFecha={setFecha}
              onSelectPeriodo={(id) => void refreshVentasSerie(id, fecha)}
              onApply={() => void refreshVentasSerie()}
              loading={loading34}
            />
          </div>
          {areaData.length === 0 ? (
            <EmptyChart tall message="No hay datos para armar la serie en este período." />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={areaData} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
                <defs>
                  <linearGradient id="fillVentasTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#52525b", fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={periodo === "dia" ? 8 : 12}
                />
                <YAxis
                  tick={{ fill: "#52525b", fontSize: 12 }}
                  tickFormatter={(v) => `$${Number(v).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
                  width={72}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`$${money(v)}`, "Facturado"]}
                  labelFormatter={(l) => String(l)}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="none"
                  fill="url(#fillVentasTotal)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#b91c1c"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#b91c1c", stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#991b1b", stroke: "#fff", strokeWidth: 2 }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* 5 — Stock más / menos */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Más stock" subtitle="Top 10 productos activos con mayor cantidad en depósito." accent="teal">
          {barStockMas.length === 0 ? (
            <EmptyChart message="No hay datos de stock." />
          ) : (
            <VerticalBarBlock data={barStockMas} dataKey="stock" fill="#0d9488" height={280} />
          )}
        </ChartCard>
        <ChartCard title="Menos stock" subtitle="Top 10 con menor stock (riesgo de quiebre)." accent="red">
          {barStockMenos.length === 0 ? (
            <EmptyChart message="No hay datos de stock." />
          ) : (
            <VerticalBarBlock data={barStockMenos} dataKey="stock" fill="#dc2626" height={280} />
          )}
        </ChartCard>
      </div>

      {/* 6 — Marcas por cantidad de productos */}
      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Marcas con más productos" subtitle="Top 8 marcas por cantidad de ítems activos en catálogo." accent="teal">
          {barMarcasProdMas.length === 0 ? (
            <EmptyChart message="Sin datos de marcas." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barMarcasProdMas} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#52525b", fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#52525b", fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [intFmt(v), "Productos"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} fill="#0d9488" maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Marcas con menos productos" subtitle="Top 8 marcas con menor cantidad de productos activos." accent="red">
          {barMarcasProdMenos.length === 0 ? (
            <EmptyChart message="Sin datos de marcas." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barMarcasProdMenos} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#52525b", fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#52525b", fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [intFmt(v), "Productos"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} fill="#dc2626" maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* 7 — Marcas por unidades en stock */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Marcas con más unidades" subtitle="Top 8 por suma de stock de productos activos." accent="violet">
          {barMarcasUniMas.length === 0 ? (
            <EmptyChart message="Sin datos de unidades por marca." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barMarcasUniMas} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#52525b", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#52525b", fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [intFmt(v), "Unidades"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} fill="#7c3aed" maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Marcas con menos unidades" subtitle="Top 8 marcas con menor stock acumulado." accent="amber">
          {barMarcasUniMenos.length === 0 ? (
            <EmptyChart message="Sin datos de unidades por marca." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barMarcasUniMenos} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#52525b", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#52525b", fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [intFmt(v), "Unidades"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} fill="#d97706" maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ScrollToTopButton />
    </div>
  );
}
