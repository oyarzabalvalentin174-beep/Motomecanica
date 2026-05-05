import { redirect } from "next/navigation";
import { requireSession } from "@/lib/requireSession";

export default async function ReportesIndexPage() {
  await requireSession("/reportes");
  redirect("/reportes/graficos");
}
