import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";

const quickLinks = [
  {
    title: "Reportes",
    description: "Indicadores de negocio y rendimiento del taller.",
    href: "/reportes",
  },
  {
    title: "Ver ventas",
    description: "Consulta comprobantes y movimientos comerciales.",
    href: "/ventas/ver-ventas",
  },
  {
    title: "Ver devoluciones",
    description: "Seguimiento de devoluciones y reintegros activos.",
    href: "/devolucion/ver-devolucion",
  },
  {
    title: "Stock",
    description: "Control de inventario y faltantes en tiempo real.",
    href: "/stock",
  },
  {
    title: "Usuarios",
    description: "Gestión de perfiles, permisos y accesos del sistema.",
    href: "/usuarios",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar />

      <main className="mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">
            Panel Negocio Taller
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Estructura base lista para escalar: barra superior desacoplada,
            sidebar reutilizable y navegación centralizada para evitar código
            duplicado en cada página.
          </p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
            >
              <h2 className="text-base font-semibold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
