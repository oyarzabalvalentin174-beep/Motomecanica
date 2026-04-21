import Image from "next/image";
import LoadingSpinnerRings from "@/components/LoadingSpinnerRings";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-b from-zinc-50 via-white to-zinc-100/80">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-52 w-52 items-center justify-center">
          <LoadingSpinnerRings gradientId="route-loading-ring" />
          <div className="relative h-40 w-40 overflow-hidden rounded-full border border-zinc-200/80 bg-white shadow-lg shadow-zinc-900/8 ring-1 ring-white/80">
            <Image
              src="/logo.jpg"
              alt="Logo Negocio Taller"
              fill
              priority
              className="object-cover"
            />
          </div>
        </div>

        <p className="text-lg font-semibold uppercase tracking-[0.22em] text-zinc-700">
          Cargando
        </p>
      </div>
    </div>
  );
}
