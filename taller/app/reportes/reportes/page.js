import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import ReportesListaClient from "@/components/ReportesListaClient";
import { requireSession } from "@/lib/requireSession";

export const dynamic = "force-dynamic";

export default async function ReportesListaPage() {
  await requireSession("/reportes/reportes");

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar active="reportes-lista" />

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-20 sm:px-6 sm:pt-24 lg:max-w-6xl lg:px-8">
        <ReportesListaClient />
      </main>
    </div>
  );
}
