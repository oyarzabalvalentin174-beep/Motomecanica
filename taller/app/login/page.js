"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    console.log("SUBMIT TRIGGERED");
    const username = event.target.username.value;
    const password = event.target.password.value;

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      console.log("LOGIN RESPONSE:", res);

      if (!res?.ok) {
        setErrorMessage(res?.error || "No se pudo iniciar sesión");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Error inesperado al iniciar sesión");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-200/80 via-zinc-50 to-white px-4 py-6 sm:px-6 sm:py-10">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white/95 p-5 shadow-xl shadow-zinc-900/10 backdrop-blur sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center sm:mb-8">
          <Image
            src="/logo.jpg"
            alt="Logo"
            width={120}
            height={120}
            className="mb-4 h-24 w-24 rounded-2xl border border-zinc-200 object-cover shadow-md sm:h-28 sm:w-28"
            priority
          />
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Ingresá con tu usuario y contraseña
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block text-sm font-medium text-zinc-800"
            >
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-black outline-none ring-0 transition placeholder:text-zinc-400 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(220,38,38,0.15)] sm:text-sm"
              placeholder="nombreusuario"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-zinc-800"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-black outline-none ring-0 transition placeholder:text-zinc-400 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(220,38,38,0.15)] sm:text-sm"
              placeholder="********"
              required
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-zinc-950 px-4 py-2.5 font-semibold text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(220,38,38,0.35)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Validando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
