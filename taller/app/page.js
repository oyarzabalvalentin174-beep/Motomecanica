import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import { formatFechaAr, loadHomeMetricas, moneyEs } from "@/lib/homeMetricas";
import { requireSession } from "@/lib/requireSession";

const operationalShortcuts = [
  { label: "Registrar una venta", href: "/ventas/venta" },
  { label: "Uso personal / taller", href: "/uso-personal" },
  { label: "Crear devolucion", href: "/devolucion/devolucion" },
  { label: "Métricas", href: "/reportes" },
  { label: "Administrar usuarios", href: "/usuarios" },
];

export default async function Home() {
  await requireSession("/");

  let metricas = { stockCero: 0, stockBajo: 0, presupuestosVencidos: [], hoy: "" };
  try {
    metricas = await loadHomeMetricas();
  } catch {
    /* home sigue usable sin métricas */
  }

  const vencidosCount = metricas.presupuestosVencidos?.length ?? 0;
  const alertaDia =
    metricas.stockCero > 0 || metricas.stockBajo > 0 || vencidosCount > 0;

  const metricCards = [
    {
      title: "Sin stock",
      value: String(metricas.stockCero),
      detail: "Productos activos con stock 0",
      href: "/stock",
      tone: metricas.stockCero > 0 ? "danger" : "ok",
    },
    {
      title: "Stock mínimo",
      value: String(metricas.stockBajo),
      detail: "Productos activos con 1 o 2 unidades",
      href: "/stock",
      tone: metricas.stockBajo > 0 ? "warn" : "ok",
    },
    {
      title: "Presupuestos vencidos",
      value: String(vencidosCount),
      detail: "Fecha de entrega pasada y saldo pendiente",
      href: "/presupuestos",
      tone: vencidosCount > 0 ? "danger" : "ok",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-zinc-100">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar />

      <main className="mx-auto w-full max-w-7xl px-3 pb-8 pt-22 sm:px-5 sm:pt-24 lg:px-6">
        <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm shadow-zinc-900/5 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Inicio operativo
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                Panel principal del taller
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                Vista de control diario para priorizar trabajo, detectar bloqueos
                y entrar rapido a las tareas mas importantes.
              </p>
            </div>

            {alertaDia ? (
              <div className="rounded-xl border border-red-200/80 bg-red-50/70 px-4 py-3 text-sm text-red-900">
                <p className="font-semibold">Atencion del dia</p>
                <p className="mt-1 text-red-800/90">
                  Hay alertas en stock o presupuestos para revisar.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                <p className="font-semibold">Sin alertas criticas</p>
                <p className="mt-1 text-emerald-800/90">Stock y presupuestos al dia.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 lg:mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">Métricas</h2>
            <Link
              href="/reportes/graficos"
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Ver gráficos →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {metricCards.map((item) => {
              const border =
                item.tone === "danger"
                  ? "border-red-200 bg-red-50/40"
                  : item.tone === "warn"
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-zinc-200 bg-white";
              const valueColor =
                item.tone === "danger"
                  ? "text-red-700"
                  : item.tone === "warn"
                    ? "text-amber-800"
                    : "text-zinc-900";

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`block rounded-xl border p-4 shadow-sm shadow-zinc-900/5 transition hover:ring-2 hover:ring-red-200/80 ${border}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                    {item.title}
                  </p>
                  <p className={`mt-2 text-3xl font-semibold leading-none ${valueColor}`}>
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">{item.detail}</p>
                </Link>
              );
            })}
          </div>

          {vencidosCount > 0 ? (
            <article className="mt-4 rounded-xl border border-red-200/80 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">
                Presupuestos con saldo pendiente y fecha vencida
              </h3>
              <ul className="mt-3 divide-y divide-zinc-100">
                {metricas.presupuestosVencidos.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <Link
                        href={`/presupuestos?id=${p.id}`}
                        className="font-semibold text-zinc-900 hover:text-red-600"
                      >
                        {p.nombre_persona ?? `Presupuesto #${p.id}`}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        Venció {formatFechaAr(p.fecha_vence)}
                        {metricas.hoy ? ` · Hoy ${formatFechaAr(metricas.hoy)}` : ""}
                      </p>
                    </div>
                    <p className="font-semibold text-red-700">
                      Pendiente ${moneyEs(p.saldo)}
                    </p>
                  </li>
                ))}
              </ul>
              {vencidosCount > 8 ? (
                <p className="mt-2 text-xs text-zinc-500">
                  y {vencidosCount - 8} más en Presupuestos
                </p>
              ) : null}
            </article>
          ) : null}
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-6">
          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5 sm:p-5">
              <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">
                Atajos
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Accesos rapidos para no perder tiempo navegando.
              </p>

              <ul className="mt-3 space-y-2">
                {operationalShortcuts.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-red-300/80 hover:bg-white"
                    >
                      {item.label}
                      <span className="text-red-600" aria-hidden>
                        {"->"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5 sm:p-5">
            <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">
              Recordatorio de cierre
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li className="rounded-lg bg-zinc-50 px-3 py-2">
                Confirmar cobranzas del dia.
              </li>
              <li className="rounded-lg bg-zinc-50 px-3 py-2">
                Verificar devoluciones procesadas.
              </li>
              <li className="rounded-lg bg-zinc-50 px-3 py-2">
                Revisar faltantes para manana.
              </li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}
