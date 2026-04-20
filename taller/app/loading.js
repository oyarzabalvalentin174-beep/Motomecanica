import Image from "next/image";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-52 w-52 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-[6px] border-slate-200" />
          <div className="absolute inset-0 animate-spin rounded-full border-[6px] border-transparent border-t-blue-600 border-r-blue-500" />
          <div className="relative h-40 w-40 overflow-hidden rounded-full border-4 border-slate-100 bg-white shadow-md">
            <Image
              src="/logo.jpg"
              alt="Logo Negocio Taller"
              fill
              priority
              className="object-cover"
            />
          </div>
        </div>

        <p className="text-lg font-semibold uppercase tracking-[0.22em] text-slate-700">
          Cargando
        </p>
      </div>
    </div>
  );
}
