"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default function PerfilClient({ initialUser, loadError }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState(null);
  const [form, setForm] = useState({
    nombre: initialUser?.nombre || "",
    apellido: initialUser?.apellido || "",
    currentPassword: "",
    newPassword: "",
  });

  const canSave = form.nombre.trim() && form.apellido.trim();

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setBanner(null);

    try {
      const res = await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar el perfil");
      }

      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }));
      setBanner({ type: "ok", text: "Perfil actualizado correctamente." });
      startTransition(() => router.refresh());
    } catch (err) {
      setBanner({ type: "err", text: err.message });
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pt-28">
      <div className="rounded-3xl border border-zinc-200 bg-white px-6 py-6 shadow-lg shadow-zinc-900/5 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Mi perfil</h1>
        <p className="mt-1 text-sm text-zinc-500">Datos del usuario logueado y seguridad de acceso.</p>
      </div>

      {loadError ? (
        <div className="mt-6 rounded-2xl border border-red-300/80 bg-red-50 px-5 py-4 text-sm font-medium text-red-900">
          {loadError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg shadow-zinc-900/5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <input name="nombre" value={form.nombre} onChange={onChange} className={inputClass} required />
          </Field>
          <Field label="Apellido">
            <input name="apellido" value={form.apellido} onChange={onChange} className={inputClass} required />
          </Field>
          <Field label="Usuario">
            <input value={initialUser?.nombreusuario || "-"} className={readOnlyClass} disabled />
          </Field>
          <Field label="Último login">
            <input value={formatDate(initialUser?.ultimologin)} className={readOnlyClass} disabled />
          </Field>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
          <h2 className="text-sm font-semibold text-zinc-800">Cambiar contraseña</h2>
          <p className="mt-1 text-xs text-zinc-500">Completá ambos campos solo si querés actualizarla.</p>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Contraseña actual">
              <input
                name="currentPassword"
                type="password"
                value={form.currentPassword}
                onChange={onChange}
                className={inputClass}
                placeholder="********"
              />
            </Field>
            <Field label="Nueva contraseña">
              <input
                name="newPassword"
                type="password"
                value={form.newPassword}
                onChange={onChange}
                className={inputClass}
                placeholder="Mínimo 6 caracteres"
              />
            </Field>
          </div>
        </div>

        {banner ? (
          <div
            className={`mt-5 rounded-2xl border px-5 py-3.5 text-sm font-medium ${
              banner.type === "ok" ? "border-emerald-300/80 bg-emerald-50 text-emerald-900" : "border-red-300/80 bg-red-50 text-red-900"
            }`}
          >
            {banner.text}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button type="submit" disabled={isPending || !canSave} className={saveBtnClass}>
            {isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
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

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-zinc-50/80 px-4 py-3 text-base text-zinc-900 outline-none ring-red-500/30 transition placeholder:text-zinc-400 focus:border-red-500 focus:bg-white focus:ring-4";
const readOnlyClass =
  "w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-base text-zinc-700 outline-none";
const saveBtnClass =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";
