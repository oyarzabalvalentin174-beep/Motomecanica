"use client";

import { useCallback, useMemo, useState } from "react";
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
} from "recharts";

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

function shortName(n, max = 14) {
  const s = String(n ?? "—").trim() || "—";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

const PIE_COLORS = ["#dc2626", "#0d9488", "#7c3aed", "#0369a1", "#ca8a04", "#64748b", "#db2777"];

const tooltipStyle = {
  backgroundColor: "rgba(24, 24, 27, 0.94)",
  border: "1px solid rgba(63, 63, 70, 0.9)",
  borderRadius: "12px",
  fontSize: "13px",
  padding: "10px 12px",
  color: "#fafafa",
};

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-900/5 ${className}`}
    >
      <header className="border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white px-4 py-3.5 sm:px-5">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">{subtitle}</p> : null}
      </header>
      <div className="min-h-[220px] flex-1 p-3 sm:min-h-[260px] sm:p-4">{children}</div>
    </section>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 text-center sm:h-[240px]">
      <p className="max-w-xs text-sm text-zinc-500">{message}</p>
    </div>
  );
}

function intFmt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function KpiCard({ label, value, hint, accent = "red" }) {
  const ring =
    accent === "teal"
      ? "shadow-[inset_0_0_0_1px_rgba(13,148,136,0.12)]"
      : accent === "violet"
        ? "shadow-[inset_0_0_0_1px_rgba(124,58,237,0.12)]"
        : accent === "amber"
          ? "shadow-[inset_0_0_0_1px_rgba(217,119,6,0.15)]"
          : "shadow-[inset_0_0_0_1px_rgba(220,38,38,0.12)]";
  const bar =
    accent === "teal"
      ? "from-teal-600/90 to-teal-500/80"
      : accent === "violet"
        ? "from-violet-600/90 to-violet-500/80"
        : accent === "amber"
          ? "from-amber-600/90 to-amber-500/80"
          : "from-red-600/90 to-red-500/80";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5 ${ring}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${bar}`} aria-hidden />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-zinc-500">{hint}</p> : null}
    </div>
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
  const [loading, setLoading] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [desde, hasta]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr12(null);
    setErr34(null);
    setErrKpis(null);
    try {
      const [r1, r2, rk] = await Promise.all([
        fetch(`/api/reportes/graficos-12${qs}`, { credentials: "include" }),
        fetch(`/api/reportes/graficos-34${qs}`, { credentials: "include" }),
        fetch("/api/reportes/kpis", { credentials: "include" }),
      ]);
      const j1 = await r1.json().catch(() => ({}));
      const j2 = await r2.json().catch(() => ({}));
      const jk = await rk.json().catch(() => ({}));
      if (!r1.ok) setErr12(j1?.error || "No se pudieron cargar datos de stock y ventas.");
      else setData12(j1);
      if (!r2.ok) setErr34(j2?.error || "No se pudieron cargar métodos de pago y evolución.");
      else setData34(j2);
      if (!rk.ok) setErrKpis(jk?.error || "No se pudieron cargar los indicadores de inventario.");
      else setDataKpis(jk);
    } catch (e) {
      setErr12(e?.message || "Error de red");
      setErr34(e?.message || "Error de red");
      setErrKpis(e?.message || "Error de red");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  const stockMas = Array.isArray(data12?.stock_mas) ? data12.stock_mas : [];
  const stockMenos = Array.isArray(data12?.stock_menos) ? data12.stock_menos : [];
  const ventasMas = Array.isArray(data12?.ventas_mas) ? data12.ventas_mas : [];
  const ventasMenos = Array.isArray(data12?.ventas_menos) ? data12.ventas_menos : [];

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

  const barVentasMas = ventasMas.map((r) => ({
    name: shortName(r.nombre ?? r.codigo ?? "—", 16),
    full: r.nombre ?? r.codigo ?? "—",
    unidades: Number(r.unidades ?? r.cantidad ?? 0),
  }));
  const barVentasMenos = ventasMenos.map((r) => ({
    name: shortName(r.nombre ?? r.codigo ?? "—", 16),
    full: r.nombre ?? r.codigo ?? "—",
    unidades: Number(r.unidades ?? r.cantidad ?? 0),
  }));

  const metodos = Array.isArray(data34?.metodos_pago) ? data34.metodos_pago : [];
  const pieData = metodos.map((r) => ({
    name: metodoLabel(r.metodo ?? r.metodo_pago),
    value: Number(r.cantidad_ventas ?? r.ventas ?? r.cantidad ?? 0),
    total: Number(r.total_monto ?? r.total ?? 0),
  }));

  const ventasDia = Array.isArray(data34?.ventas_por_dia) ? data34.ventas_por_dia : [];
  const areaData = ventasDia.map((r) => {
    const raw = r.fecha ?? r.dia ?? r.fecha_dia;
    let label = "—";
    if (raw) {
      try {
        const d = new Date(`${String(raw).slice(0, 10)}T12:00:00`);
        if (!Number.isNaN(d.getTime())) label = d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
      } catch {
        label = String(raw).slice(0, 10);
      }
    }
    return {
      label,
      total: Number(r.total ?? r.importe ?? 0),
      ventas: Number(r.cantidad_ventas ?? r.ventas_count ?? 0),
    };
  });

  const hasRange = Boolean(desde || hasta);

  const kpiOk = dataKpis && !errKpis;
  const uStock = kpiOk ? Number(dataKpis.unidades_stock ?? 0) : NaN;
  const nProd = kpiOk ? Number(dataKpis.productos_con_stock ?? 0) : NaN;
  const inv = kpiOk ? Number(dataKpis.total_invertido ?? 0) : NaN;
  const valVta = kpiOk ? Number(dataKpis.valor_venta_total ?? 0) : NaN;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
      <div className="mb-6 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Gráficos</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 sm:text-[15px]">
              Indicadores de inventario y, abajo, ventas y cobros según el período que elijas.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3 lg:w-auto lg:min-w-[320px] lg:max-w-md">
            <div className="grid flex-1 grid-cols-2 gap-2 sm:gap-3">
              <label className="block min-w-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Desde
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="block min-w-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Hasta
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-red-700 via-red-600 to-red-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-red-600 hover:via-red-500 hover:to-red-600 disabled:opacity-60 sm:flex-none"
              >
                {loading ? "Actualizando…" : "Aplicar"}
              </button>
              {hasRange ? (
                <button
                  type="button"
                  onClick={() => {
                    setDesde("");
                    setHasta("");
                  }}
                  disabled={loading}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Limpiar
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          Las fechas solo afectan gráficos de ventas, torta de pagos y evolución diaria. Las cartas de inventario son siempre al momento actual.
        </p>
      </div>

      {errKpis ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">{errKpis}</div>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          label="Unidades"
          value={kpiOk ? intFmt(uStock) : "—"}
          hint="Suma de stock de todos los productos activos."
          accent="red"
        />
        <KpiCard
          label="Productos"
          value={kpiOk ? intFmt(nProd) : "—"}
          hint="Cantidad de ítems con stock mayor a cero."
          accent="teal"
        />
        <KpiCard
          label="Total invertido"
          value={kpiOk ? `$${money(inv)}` : "—"}
          hint="Precio de compra × stock, sumado."
          accent="violet"
        />
        <KpiCard
          label="Si se vendiera todo"
          value={kpiOk ? `$${money(valVta)}` : "—"}
          hint="Precio de venta × stock (valor de catálogo)."
          accent="amber"
        />
      </div>

      {(err12 || err34) && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {err12 ? <p className="font-medium">{err12}</p> : null}
          {err34 ? <p className={`font-medium ${err12 ? "mt-2" : ""}`}>{err34}</p> : null}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <ChartCard
          title="Más stock"
          subtitle="Top 5 productos activos con mayor cantidad en depósito."
          className="lg:min-h-0"
        >
          {barStockMas.length === 0 ? (
            <EmptyChart message="No hay datos de stock para mostrar." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barStockMas} layout="vertical" margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#52525b", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: "#52525b", fontSize: 11 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [v, "Stock"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                />
                <Bar dataKey="stock" radius={[0, 6, 6, 0]} fill="#0d9488" maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Menos stock" subtitle="Top 5 productos activos con menor cantidad (mayor riesgo de quiebre).">
          {barStockMenos.length === 0 ? (
            <EmptyChart message="No hay datos de stock para mostrar." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barStockMenos} layout="vertical" margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#52525b", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: "#52525b", fontSize: 11 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [v, "Stock"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                />
                <Bar dataKey="stock" radius={[0, 6, 6, 0]} fill="#dc2626" maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
        <ChartCard
          title="Ventas por producto"
          subtitle="Top 5 más vendidos y menos vendidos (unidades en el período)."
          className="xl:col-span-1"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Más vendidos</p>
              {barVentasMas.length === 0 ? (
                <EmptyChart message="Sin ventas en el período seleccionado." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barVentasMas} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#52525b", fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) => [v, "Unidades"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                    />
                    <Bar dataKey="unidades" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">Menos vendidos</p>
              {barVentasMenos.length === 0 ? (
                <EmptyChart message="Sin datos de ranking de ventas bajas." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barVentasMenos} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#52525b", fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) => [v, "Unidades"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                    />
                    <Bar dataKey="unidades" fill="#b91c1c" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Métodos de pago"
          subtitle="Cantidad de ventas por método en el período."
          className="xl:col-span-1"
        >
          {pieData.length === 0 || pieData.every((d) => d.value <= 0) ? (
            <EmptyChart message="No hay ventas con método de pago en el período." />
          ) : (
            <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:justify-center">
              <div className="h-[240px] w-full max-w-[280px] sm:h-[260px] sm:max-w-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fafafa" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, _n, props) => [
                        `${value} ventas · $${money(props.payload?.total)}`,
                        props.payload?.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full max-w-xs space-y-2 text-sm lg:w-auto">
                {pieData.map((row, i) => (
                  <li key={row.name} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                    <span className="flex items-center gap-2 font-medium text-zinc-800">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {row.name}
                    </span>
                    <span className="shrink-0 text-zinc-600">
                      {row.value} · ${money(row.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard
          title="Evolución diaria"
          subtitle="Total facturado por día (últimos días del período; ver SP)."
        >
          {areaData.length === 0 ? (
            <EmptyChart message="No hay serie diaria para el período." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={areaData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} />
                <YAxis
                  tick={{ fill: "#52525b", fontSize: 12 }}
                  tickFormatter={(v) => `$${Number(v).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`$${money(v)}`, "Total del día"]}
                />
                <Area type="monotone" dataKey="total" stroke="#b91c1c" strokeWidth={2} fill="url(#fillTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
