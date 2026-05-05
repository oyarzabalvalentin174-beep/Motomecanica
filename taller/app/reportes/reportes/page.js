import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";

export const dynamic = "force-dynamic";

export default function ReportesListaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-8 shadow-sm sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Reportes</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
            Acá podés sumar más adelante exportaciones a Excel o PDF, listados contables y cortes de caja. La sección
            <span className="font-medium text-zinc-800"> Gráficos </span>
            ya muestra indicadores en tiempo casi real desde la base.
          </p>
          <div className="mt-8 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-5 py-8 text-center">
            <p className="text-sm font-medium text-zinc-700">Nada configurado todavía</p>
            <p className="mt-2 text-xs text-zinc-500 sm:text-sm">
              Cuando definas qué tablas o SP querés listar, se puede armar el mismo estilo que “Ver ventas”.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
