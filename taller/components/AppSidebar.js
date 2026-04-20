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
        <div className="border-b border-blue-800 bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100/90">
            Negocio Taller
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">Panel principal</h2>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto bg-slate-50 px-3 py-4">
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
                      ? "bg-blue-100 text-blue-800 ring-1 ring-blue-200"
                      : "text-slate-700 hover:bg-slate-200/70 hover:text-slate-900"
                  }`}
                >
                  <span className={`${isActive ? "text-blue-700" : "text-slate-500"}`}>
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
                      ? "bg-slate-200/80 text-slate-900"
                      : "text-slate-700 hover:bg-slate-200/70 hover:text-slate-900"
                  }`}
                >
                  <span className={`${isOpen ? "text-slate-900" : "text-slate-500"}`}>
                    <MenuIcon>
                      <Icon />
                    </MenuIcon>
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-slate-500">
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
                                ? "bg-blue-100 text-blue-800"
                                : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
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

        <div className="border-t border-slate-200 bg-white px-4 py-4">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("toggleSidebar", { detail: { isOpen: false } }),
              );
            }}
            className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
          >
            Cerrar menú
          </button>
        </div>
      </div>
    </Sidebar>
  );
}
