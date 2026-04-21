import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";

const statusCards = [
  {
    title: "Ordenes en curso",
    value: "24",
    detail: "6 para entregar hoy",
  },
  {
    title: "Turnos confirmados",
    value: "14",
    detail: "3 sin repuestos asignados",
  },
  {
    title: "Stock critico",
    value: "8",
    detail: "Items con menos de 2 unidades",
  },
  {
    title: "Alertas urgentes",
    value: "3",
    detail: "Requieren validacion manual",
  },
];

const priorities = [
  {
    title: "Revisar devoluciones pendientes",
    description: "Hay 2 devoluciones abiertas hace mas de 48 horas.",
    href: "/devolucion/ver-devolucion",
    label: "Alta",
  },
  {
    title: "Validar compras para stock critico",
    description: "Pastillas de freno y filtro de aceite en minimo.",
    href: "/stock",
    label: "Media",
  },
  {
    title: "Control de caja de cierre",
    description: "Falta registrar 1 comprobante del turno tarde.",
    href: "/ventas/ver-ventas",
    label: "Alta",
  },
];

const operationalShortcuts = [
  { label: "Registrar una venta", href: "/ventas/venta" },
  { label: "Crear devolucion", href: "/devolucion/devolucion" },
  { label: "Consultar reportes", href: "/reportes" },
  { label: "Administrar usuarios", href: "/usuarios" },
];

export default function Home() {
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

            <div className="rounded-xl border border-red-200/80 bg-red-50/70 px-4 py-3 text-sm text-red-900">
              <p className="font-semibold">Atencion del dia</p>
              <p className="mt-1 text-red-800/90">
                Hay pendientes urgentes para revisar antes del cierre.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-6 lg:grid-cols-4">
          {statusCards.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                {item.title}
              </p>
              <p className="mt-2 text-2xl font-semibold leading-none text-zinc-900">
                {item.value}
              </p>
              <p className="mt-2 text-sm text-zinc-600">{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:mt-6 lg:grid-cols-[1.35fr_1fr]">
          <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">
                Prioridades del dia
              </h2>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                {priorities.length} tareas
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {priorities.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="block rounded-xl border border-zinc-200 bg-zinc-50/65 p-3 transition hover:border-red-200 hover:bg-red-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900 sm:text-[15px]">
                      {item.title}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.label === "Alta"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-600">{item.description}</p>
                </Link>
              ))}
            </div>
          </article>

          <div className="space-y-4">
            <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5 sm:p-5">
              <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">
                Atajos operativos
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
          </div>
        </section>
      </main>
    </div>
  );
}
