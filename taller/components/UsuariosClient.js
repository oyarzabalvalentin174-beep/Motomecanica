"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

const EMPTY_FORM = {
  nombre: "",
  apellido: "",
  nombreusuario: "",
  contrasena: "",
};

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

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m4 20 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z" strokeLinejoin="round" />
      <path d="m13 8 3 3" strokeLinecap="round" />
    </svg>
  );
}

function IconDelete() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function toForm(row) {
  return {
    nombre: row?.nombre || "",
    apellido: row?.apellido || "",
    nombreusuario: row?.nombreusuario || "",
    contrasena: "",
  };
}

function mapUserPayload(formState) {
  const payload = {
    nombre: formState.nombre.trim(),
    apellido: formState.apellido.trim(),
    nombreusuario: formState.nombreusuario.trim(),
  };
  const password = formState.contrasena.trim();
  if (password) payload.contrasena = password;
  return payload;
}

function mapCreatePayload(formState) {
  return {
    ...mapUserPayload(formState),
    contrasena: formState.contrasena.trim(),
    ultimologin: new Date().toISOString(),
  };
}

function isFormValid(formState) {
  return formState.nombre.trim() && formState.apellido.trim() && formState.nombreusuario.trim();
}

export default function UsuariosClient({ initialRows, total, page, pageSize, listError }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const canCreate = isFormValid(newForm) && Boolean(newForm.contrasena.trim());
  const canSave = isFormValid(editForm);

  const postItems = useCallback(async (items) => {
    const res = await fetch("/api/usuarios", {
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
    startTransition(() => router.refresh());
  }, [router]);

  const onChangeForm = (setter) => (e) => {
    const { name, value } = e.target;
    setter((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canCreate) return;
    setBanner(null);
    try {
      await postItems([mapCreatePayload(newForm)]);
      setNewForm(EMPTY_FORM);
      setShowNewUser(false);
      setBanner({ type: "ok", text: "Usuario creado correctamente." });
      refresh();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id_usuario);
    setEditForm(toForm(row));
    setBanner(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const saveEdit = async () => {
    if (!canSave || editingId == null) return;
    setBanner(null);
    try {
      await postItems([{ id_usuario: editingId, ...mapUserPayload(editForm), archivado: false }]);
      setEditingId(null);
      setEditForm(EMPTY_FORM);
      setBanner({ type: "ok", text: "Usuario actualizado." });
      refresh();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`¿Eliminar el usuario «${row.nombreusuario}»?`)) return;
    setBanner(null);
    try {
      await postItems([{ id_usuario: row.id_usuario, eliminar: true }]);
      setBanner({ type: "ok", text: "Usuario eliminado." });
      refresh();
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pt-28">
      <div className="rounded-3xl border border-zinc-200 bg-white px-6 py-6 shadow-lg shadow-zinc-900/5 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">User Management</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {total} usuarios registrados · Página {page} de {totalPages}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewUser((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-900/25 transition hover:from-red-600 hover:to-red-500"
          >
            + New User
          </button>
        </div>
      </div>

      {showNewUser ? (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg shadow-zinc-900/5"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Nombre">
              <input name="nombre" value={newForm.nombre} onChange={onChangeForm(setNewForm)} className={inputClass} />
            </Field>
            <Field label="Apellido">
              <input
                name="apellido"
                value={newForm.apellido}
                onChange={onChangeForm(setNewForm)}
                className={inputClass}
              />
            </Field>
            <Field label="Usuario">
              <input
                name="nombreusuario"
                value={newForm.nombreusuario}
                onChange={onChangeForm(setNewForm)}
                className={inputClass}
              />
            </Field>
            <Field label="Contraseña">
              <input
                name="contrasena"
                type="password"
                value={newForm.contrasena}
                onChange={onChangeForm(setNewForm)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className={cancelBtnClass} onClick={() => setShowNewUser(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={isPending || !canCreate} className={saveBtnClass}>
              Crear usuario
            </button>
          </div>
        </form>
      ) : null}

      {listError ? (
        <div className="mt-6 rounded-2xl border border-red-300/80 bg-red-50 px-5 py-4 text-sm font-medium text-red-900">
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

      {initialRows.length === 0 && !listError ? (
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white px-8 py-20 text-center shadow-lg shadow-zinc-900/5">
          <p className="text-lg font-medium text-zinc-600">No hay usuarios en esta página.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {initialRows.map((row) => {
            const isEditing = editingId === row.id_usuario;
            return (
              <article
                key={row.id_usuario}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-zinc-700 text-sm font-bold text-white">
                      {`${(row.nombre || "").slice(0, 1)}${(row.apellido || "").slice(0, 1)}`.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-900">
                        {row.nombre} {row.apellido}
                      </p>
                      <p className="truncate text-sm text-zinc-500">@{row.nombreusuario}</p>
                    </div>
                  </div>
                  {!isEditing ? (
                    <div className="flex items-center gap-1">
                      <button type="button" className={iconBtnClass} onClick={() => startEdit(row)}>
                        <IconEdit />
                      </button>
                      <button type="button" className={iconDeleteBtnClass} onClick={() => handleDelete(row)}>
                        <IconDelete />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-zinc-200 pt-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        name="nombre"
                        value={editForm.nombre}
                        onChange={onChangeForm(setEditForm)}
                        placeholder="Nombre"
                        className={inlineInputClass}
                      />
                      <input
                        name="apellido"
                        value={editForm.apellido}
                        onChange={onChangeForm(setEditForm)}
                        placeholder="Apellido"
                        className={inlineInputClass}
                      />
                      <input
                        name="nombreusuario"
                        value={editForm.nombreusuario}
                        onChange={onChangeForm(setEditForm)}
                        placeholder="Usuario"
                        className={inlineInputClass}
                      />
                      <input
                        name="contrasena"
                        value={editForm.contrasena}
                        type="password"
                        onChange={onChangeForm(setEditForm)}
                        placeholder="Nueva contraseña (opcional)"
                        className={inlineInputClass}
                      />
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button type="button" onClick={saveEdit} className={saveBtnClass} disabled={!canSave}>
                          Guardar
                        </button>
                        <button type="button" onClick={cancelEdit} className={cancelBtnClass}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-zinc-400">Last login</p>
                      <p className="text-sm font-medium text-zinc-700">{formatDate(row.ultimologin)}</p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-6 py-5 sm:flex-row sm:px-8">
          <p className="text-sm font-medium text-zinc-600">
            Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <PaginationLink href={page <= 1 ? null : `/usuarios?page=${page - 1}`} disabled={page <= 1}>
              <span className="flex items-center gap-1 pr-1">
                <ChevronLeft />
                Anterior
              </span>
            </PaginationLink>
            <span className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-zinc-800 ring-1 ring-zinc-200">
              {page} / {totalPages}
            </span>
            <PaginationLink
              href={page >= totalPages ? null : `/usuarios?page=${page + 1}`}
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

      {isPending ? <p className="mt-4 text-center text-sm font-medium text-zinc-500">Actualizando...</p> : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-zinc-800">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
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

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-zinc-50/80 px-4 py-3 text-base text-zinc-900 outline-none ring-red-500/30 transition placeholder:text-zinc-400 focus:border-red-500 focus:bg-white focus:ring-4";
const inlineInputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20";
const saveBtnClass =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";
const cancelBtnClass =
  "rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50";
const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition hover:border-red-300 hover:text-red-700";
const iconDeleteBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50";
