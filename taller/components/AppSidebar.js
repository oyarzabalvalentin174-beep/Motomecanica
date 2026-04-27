"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";

function IconChevron({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        d="m6 9 6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon({ children }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center align-middle">
      {children}
    </span>
  );
}

function IconReportes() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        d="M4 19h16M7 16V9m5 7V6m5 10v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconVentas() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        d="M6 5h12a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V6a1 1 0 0 1 1-1Zm4 4h4m-4 3h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDevolucion() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        d="M9 7H5v4M5 11c1.2-3.3 4.3-5.5 7.9-5.5 4.7 0 8.6 3.8 8.6 8.5s-3.9 8.5-8.6 8.5a8.6 8.6 0 0 1-8.2-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        d="M12 3 4 7l8 4 8-4-8-4Zm-8 8 8 4 8-4M4 15l8 4 8-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUsuarios() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-2 7a4 4 0 0 1 8 0m2 0a4 4 0 0 1 5-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMarcas() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        d="M4 6a2 2 0 0 1 2-2h3l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 11h8M8 15h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const menuItems = [
  { type: "link", href: "/reportes", label: "Reportes", id: "reportes", icon: IconReportes },
  {
    type: "group",
    label: "Ventas",
    id: "ventas",
    icon: IconVentas,
    children: [
      { href: "/ventas/ver-ventas", label: "Ver ventas", id: "ventas-lista" },
      { href: "/ventas/venta", label: "Venta", id: "venta-nueva" },
    ],
  },
  {
    type: "group",
    label: "Devolución",
    id: "devoluciones",
    icon: IconDevolucion,
    children: [
      { href: "/devolucion/ver-devolucion", label: "Ver devoluciones", id: "devoluciones-lista" },
      { href: "/devolucion/devolucion", label: "Devolución", id: "devolucion-nueva" },
    ],
  },
  { type: "link", href: "/stock", label: "Stock", id: "stock", icon: IconStock },
  { type: "link", href: "/marcas", label: "Marcas", id: "marcas", icon: IconMarcas },
  { type: "link", href: "/usuarios", label: "Usuarios", id: "usuarios", icon: IconUsuarios },
];

export default function AppSidebar({ active }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState({ ventas: false, devoluciones: false });

  const autoExpanded = useMemo(
    () => ({
      ventas: pathname?.startsWith("/ventas/"),
      devoluciones: pathname?.startsWith("/devolucion/"),
    }),
    [pathname],
  );

  return (
    <Sidebar anchor="left" width="340px">
      <div className="flex h-full flex-col">
        <div className="relative overflow-hidden border-b border-zinc-600/35 bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-800 px-5 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-red-950/25 via-transparent to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-90 shadow-[0_0_16px_rgba(220,38,38,0.45)]"
            aria-hidden
          />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            Negocio Taller
          </p>
          <h2 className="relative mt-1 text-xl font-semibold tracking-tight text-zinc-50">
            Panel principal
          </h2>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto bg-gradient-to-b from-zinc-100 to-zinc-50 px-3 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            if (item.type === "link") {
              const isActive = active ? item.id === active : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-[16px] font-semibold transition ${
                    isActive
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/90 shadow-[inset_3px_0_0_0_#dc2626]"
                      : "text-zinc-600 hover:bg-zinc-200/65 hover:text-zinc-900"
                  }`}
                >
                  <span className={`${isActive ? "text-red-600" : "text-zinc-500"}`}>
                    <MenuIcon>
                      <Icon />
                    </MenuIcon>
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            }

            const isOpen = expanded[item.id] || autoExpanded[item.id];

            return (
              <div key={item.id} className="rounded-xl">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [item.id]: !isOpen,
                    }))
                  }
                  className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-[16px] font-semibold transition ${
                    isOpen
                      ? "bg-zinc-200/70 text-zinc-900 ring-1 ring-zinc-300/40"
                      : "text-zinc-600 hover:bg-zinc-200/65 hover:text-zinc-900"
                  }`}
                >
                  <span className={`${isOpen ? "text-red-700" : "text-zinc-500"}`}>
                    <MenuIcon>
                      <Icon />
                    </MenuIcon>
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-zinc-500">
                    <IconChevron open={isOpen} />
                  </span>
                </button>

                <div
                  className={`grid overflow-hidden transition-all duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="min-h-0">
                    <div className="mt-1.5 space-y-1.5 pl-12 pr-1">
                      {item.children.map((child) => {
                        const isChildActive = pathname?.startsWith(child.href);
                        return (
                          <Link
                            key={child.id}
                            href={child.href}
                            className={`block rounded-lg px-3 py-2.5 text-[15px] font-medium transition ${
                              isChildActive
                                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80 shadow-[inset_3px_0_0_0_#dc2626]"
                                : "text-zinc-600 hover:bg-zinc-200/65 hover:text-zinc-900"
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-zinc-300/60 bg-gradient-to-b from-zinc-100 to-zinc-200/50 px-4 py-4">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("toggleSidebar", { detail: { isOpen: false } }),
              );
            }}
            className="w-full rounded-xl bg-gradient-to-r from-red-700 via-red-600 to-red-700 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-900/25 transition hover:from-red-600 hover:via-red-500 hover:to-red-600 hover:shadow-lg hover:shadow-red-900/30"
          >
            Cerrar menú
          </button>
        </div>
      </div>
    </Sidebar>
  );
}
