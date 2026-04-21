"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]">
      <path
        d="M20 12a8 8 0 1 1-2.35-5.65M20 4v5.5h-5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        d="M7 10a5 5 0 0 1 10 0v3.6l1.3 2.3c.3.6-.1 1.1-.7 1.1H6.4c-.6 0-1-.5-.7-1.1L7 13.6V10Zm3.7 9a1.8 1.8 0 0 0 2.6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function UserPop({ loadAlerts }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [alertasCount, setAlertasCount] = useState({ total: 0, urgentes: 0 });
  const menuRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const source = loadAlerts ? await loadAlerts() : [];
        const alertas = Array.isArray(source) ? source : source?.data ?? [];
        const urgentes = Array.isArray(alertas)
          ? alertas.filter((item) => Number(item?.prioridad) === 1).length
          : 0;

        setAlertasCount({
          total: Array.isArray(alertas) ? alertas.length : 0,
          urgentes,
        });
      } catch {
        setAlertasCount({ total: 0, urgentes: 0 });
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("toggleSidebar", {
          detail: { toggle: true },
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-[1000] border-b border-zinc-600/40 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 shadow-[inset_0_-1px_0_0_rgba(220,38,38,0.28),inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Abrir menú lateral"
            aria-expanded="false"
            onClick={handleMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-500/45 bg-zinc-700/35 text-zinc-100 transition hover:border-red-500/55 hover:bg-red-600/85 hover:text-white"
          >
            <IconMenu />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
              Sistema de gestión
            </p>
            <p className="truncate text-xs font-semibold text-zinc-50 sm:text-sm">
              {currentDate.toLocaleString("es-AR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            aria-label="Actualizar datos"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-500/45 bg-zinc-700/35 text-zinc-100 transition hover:border-red-500/55 hover:bg-red-600/85 hover:text-white"
          >
            <IconRefresh />
          </button>

          <button
            type="button"
            aria-label="Alertas"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-500/45 bg-zinc-700/35 text-zinc-100 transition hover:border-red-500/55 hover:bg-red-600/85 hover:text-white"
          >
            <IconBell />
            {alertasCount.total > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm ring-1 ring-red-400/40">
                {alertasCount.total}
              </span>
            ) : null}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-label="Opciones de usuario"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-500/45 bg-zinc-700/35 text-zinc-100 transition hover:border-red-500/55 hover:bg-red-600/85 hover:text-white"
            >
              <IconUser />
            </button>

            {profileMenuOpen ? (
              <div className="absolute right-0 z-[2000] mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/10">
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    router.push("/usuarios");
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
                >
                  Mi perfil
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    router.push("/login");
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {alertasCount.urgentes > 0 ? (
        <div className="mx-auto flex max-w-7xl items-center justify-end px-4 pb-2 text-[11px] font-semibold text-red-600 sm:px-6">
          {alertasCount.urgentes} alerta(s) urgente(s)
        </div>
      ) : null}
    </header>
  );
}
