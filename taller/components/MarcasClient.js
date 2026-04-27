"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

const PAGE_SIZE = 10;

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function buildPageHref(nextPage, searchQuery) {
  const params = new URLSearchParams();
  if (searchQuery?.trim()) params.set("q", searchQuery.trim());
  params.set("page", String(nextPage));
  return `/marcas?${params.toString()}`;
}

export default function MarcasClient({
  initialRows,
  total,
  page,
  pageSize = PAGE_SIZE,
  searchQuery = "",
  listError,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState(null);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState(searchQuery);
  const isFirstSearchRender = useRef(true);
  const lastAppliedSearchRef = useRef(String(searchQuery || "").trim());
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  const postItems = useCallback(async (items) => {
    const res = await fetch("/api/marcas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Error al guardar");
    }
    return data;
  }, []);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const applySearch = useCallback(
    (value) => {
      const q = value.trim();
      if (q === lastAppliedSearchRef.current) return;
      lastAppliedSearchRef.current = q;
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("page", "1");
      router.replace(`/marcas?${params.toString()}`);
    },
    [router],
  );

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      applySearch(search);
    }, 180);

    return () => clearTimeout(timeout);
  }, [search, applySearch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBanner(null);
    try {
      await postItems([{ nombre: name }]);
      setNewName("");
      setBanner({ type: "ok", text: "Marca creada correctamente." });
      refresh();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id_marca);
    setEditName(row.nombre || "");
    setBanner(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async () => {
    const name = editName.trim();
    if (!name || editingId == null) return;
    try {
      await postItems([{ id_marca: editingId, nombre: name }]);
      setEditingId(null);
      setBanner({ type: "ok", text: "Marca actualizada." });
      refresh();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`¿Eliminar la marca «${row.nombre}»?`)) return;
    try {
      await postItems([{ id_marca: row.id_marca, eliminar: true }]);
      setBanner({ type: "ok", text: "Marca eliminada." });
      refresh();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-18 sm:px-6 lg:px-8 lg:pt-20">
      <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-md shadow-zinc-900/5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Marcas</h1>
            <p className="text-sm text-zinc-500">
              {total} registros · Página {page} de {totalPages}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar marca..."
              className="w-full min-w-0 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 sm:w-64"
            />
          </div>
        </div>
      </div>

      {listError ? (
        <div
          className="mt-8 rounded-2xl border border-red-300/80 bg-red-50 px-5 py-4 text-sm font-medium text-red-900"
          role="alert"
        >
          {listError}
        </div>
      ) : null}

      {banner ? (
        <div
          className={`mt-6 rounded-2xl border px-5 py-3.5 text-sm font-medium ${
            banner.type === "ok"
              ? "border-emerald-300/80 bg-emerald-50 text-emerald-900"
              : "border-red-300/80 bg-red-50 text-red-900"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      {/* Nueva marca */}
      <form
        onSubmit={handleCreate}
        className="mt-3 flex flex-col gap-3 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-md shadow-zinc-900/5 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="nueva-marca" className="block text-sm font-semibold text-zinc-800">
            Nueva marca
          </label>
          <input
            id="nueva-marca"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. Bosch, Mann, Original…"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50/80 px-3.5 py-2.5 text-sm text-zinc-900 outline-none ring-red-500/30 transition placeholder:text-zinc-400 focus:border-red-500 focus:bg-white focus:ring-4"
            maxLength={120}
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !newName.trim()}
          className="shrink-0 rounded-lg bg-gradient-to-r from-red-700 to-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-900/25 transition hover:from-red-600 hover:to-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Agregar marca
        </button>
      </form>

      {/* Tabla */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-lg shadow-zinc-900/8">
        <div className="border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-4 py-3 sm:px-5">
          <h2 className="text-base font-bold text-zinc-900">Listado de marcas</h2>
          <p className="text-xs text-zinc-500">Hasta {pageSize} por página</p>
        </div>

        {initialRows.length === 0 && !listError ? (
          <div className="px-8 py-20 text-center">
            <p className="text-lg font-medium text-zinc-600">No hay marcas en esta página.</p>
            <p className="mt-2 text-sm text-zinc-500">Creá la primera usando el formulario de arriba.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-zinc-200 bg-zinc-100/90">
                  <th className="border-r border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-5">
                    ID
                  </th>
                  <th className="border-r border-zinc-200 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-5">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-5">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {initialRows.map((row, idx) => (
                  <tr
                    key={row.id_marca}
                    className={`border-b border-zinc-200 transition hover:bg-red-50/30 ${
                      idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50"
                    }`}
                  >
                    <td className="border-r border-zinc-200 px-4 py-3.5 align-middle font-mono text-sm text-zinc-500 sm:px-5">
                      {row.id_marca}
                    </td>
                    <td className="border-r border-zinc-200 px-4 py-3.5 align-middle sm:px-5">
                      {editingId === row.id_marca ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                          maxLength={120}
                          autoFocus
                        />
                      ) : (
                        <span className="text-base font-semibold text-zinc-900">{row.nombre}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle sm:px-5">
                      {editingId === row.id_marca ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm hover:border-red-300 hover:text-red-800"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 ? (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-200 bg-zinc-50/80 px-6 py-5 sm:flex-row sm:px-8">
            <p className="text-sm font-medium text-zinc-600">
              Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <PaginationLink
                href={page <= 1 ? null : buildPageHref(page - 1, searchQuery)}
                disabled={page <= 1}
              >
                <span className="flex items-center gap-1 pr-1">
                  <ChevronLeft />
                  Anterior
                </span>
              </PaginationLink>
              <span className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-zinc-800 ring-1 ring-zinc-200">
                {page} / {totalPages}
              </span>
              <PaginationLink
                href={page >= totalPages ? null : buildPageHref(page + 1, searchQuery)}
                disabled={page >= totalPages}
              >
                <span className="flex items-center gap-1 pl-1">
                  Siguiente
                  <ChevronRight />
                </span>
              </PaginationLink>
            </div>
          </div>
        ) : null}
      </div>

      {isPending ? (
        <p className="mt-4 text-center text-sm font-medium text-zinc-500">Actualizando…</p>
      ) : null}
    </div>
  );
}

function PaginationLink({ href, disabled, children }) {
  if (disabled || !href) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-400">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-red-400 hover:bg-red-50 hover:text-red-900"
    >
      {children}
    </Link>
  );
}
