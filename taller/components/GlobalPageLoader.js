"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const LOADER_MIN_MS = 700;

export default function GlobalPageLoader() {
  const pathname = usePathname();
  return <LoaderCycle key={pathname} />;
}

function LoaderCycle() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setVisible(false);
    }, LOADER_MIN_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  if (!visible) return null;

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
