import AppSidebar from "@/components/AppSidebar";
import GlobalPageLoader from "@/components/GlobalPageLoader";
import UserPop from "@/components/UserPop";
import ReportesGraficosClient from "@/components/ReportesGraficosClient";
import { exec } from "@/components/db";

export const dynamic = "force-dynamic";

export default async function ReportesGraficosPage() {
  let initial12 = null;
  let initial34 = null;
  let initialKpis = null;
  let error12 = null;
  let error34 = null;
  let errorKpis = null;

  try {
    initial12 = await exec("spgetreportegraficos12", {});
  } catch (e) {
    error12 = e?.message || "No se pudo ejecutar spgetreportegraficos12";
  }

  try {
    initial34 = await exec("spgetreportegraficos34", {});
  } catch (e) {
    error34 = e?.message || "No se pudo ejecutar spgetreportegraficos34";
  }

  try {
    initialKpis = await exec("spgetreportekpis", {});
  } catch (e) {
    errorKpis = e?.message || "No se pudo ejecutar spgetreportekpis";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-200/90 via-zinc-100 to-zinc-200/80">
      <GlobalPageLoader />
      <UserPop />
      <AppSidebar />

      <main className="min-h-screen">
        <ReportesGraficosClient
          initial12={initial12}
          initial34={initial34}
          initialKpis={initialKpis}
          error12={error12}
          error34={error34}
          errorKpis={errorKpis}
        />
      </main>
    </div>
  );
}
