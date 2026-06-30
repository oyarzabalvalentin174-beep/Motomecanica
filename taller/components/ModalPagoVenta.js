"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildComprobanteHtml, getTallerComprobanteConfig, printComprobanteHtml } from "@/lib/tallerComprobante";

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function isEditableTarget(target) {
  if (!target || typeof target !== "object") return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return Boolean(target.isContentEditable);
}

function appendMontoChar(prev, char) {
  const s = String(prev ?? "");
  if (char === "," || char === ".") {
    if (s.includes(",") || s.includes(".")) return s;
    return s === "" ? "0," : `${s},`;
  }
  if (!/^\d$/.test(char)) return s;
  return s + char;
}

export default function ModalPagoVenta({ open, onClose, cart, subtotal, onSaleSuccess }) {
  const router = useRouter();
  const [step, setStep] = useState("metodo");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState("");
  const [saleSnapshot, setSaleSnapshot] = useState(null);
  const montoInputRef = useRef(null);

  const cfg = getTallerComprobanteConfig();
  const descEfectivo = round2(subtotal * 0.1);
  const totalEfectivo = round2(subtotal - descEfectivo);
  const totalTarjetaTransfer = round2(subtotal);

  const montoNum = Number(String(montoRecibido).replace(",", "."));
  const vuelto =
    step === "efectivo" && Number.isFinite(montoNum) ? round2(Math.max(0, montoNum - totalEfectivo)) : null;

  useEffect(() => {
    if (open) {
      setStep("metodo");
      setMontoRecibido("");
      setError(null);
      setSaleSnapshot(null);
      setPending(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && step === "metodo") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, onClose]);

  useEffect(() => {
    if (!open || step !== "efectivo") return undefined;
    const t = setTimeout(() => montoInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, step]);

  useEffect(() => {
    if (!open || step !== "efectivo" || pending) return undefined;

    const onKeyDown = (e) => {
      if (isEditableTarget(e.target)) return;

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        setMontoRecibido((prev) => appendMontoChar(prev, e.key));
        return;
      }

      if (e.key === "," || e.key === ".") {
        e.preventDefault();
        setMontoRecibido((prev) => appendMontoChar(prev, ","));
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        setMontoRecibido((prev) => String(prev ?? "").slice(0, -1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, step, pending]);

  const detallesPayload = useCallback(
    () =>
      cart.map((l) => ({
        id_producto: l.id_producto,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
      })),
    [cart],
  );

  const snapshotLineas = useCallback(
    () =>
      cart.map((l) => ({
        nombre: l.nombre,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
      })),
    [cart],
  );

  const registrarVenta = useCallback(
    async (metodo_pago, descuento) => {
      setError(null);
      setPending(true);
      try {
        const res = await fetch("/api/ventas", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metodo_pago: metodo_pago || null,
            descuento: round2(descuento),
            detalles: detallesPayload(),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) router.push("/login");
          setError(body?.error || "No se pudo registrar la venta");
          return null;
        }
        if (body?.status === "error") {
          setError(body?.message || "Error al registrar");
          return null;
        }
        return body;
      } catch {
        setError("Error de red");
        return null;
      } finally {
        setPending(false);
      }
    },
    [cart, detallesPayload, router],
  );

  const imprimirComprobante = useCallback((snap) => {
    setError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const fecha = new Date().toLocaleString("es-AR");
    const lineas = snap.lineas?.length
      ? snap.lineas
      : cart.map((l) => ({
          nombre: l.nombre,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
        }));
    const html = buildComprobanteHtml({
      origin,
      idVenta: snap.id_venta,
      fecha,
      lineas,
      subtotal: snap.subtotal,
      descuento: snap.descuento,
      total: snap.total,
      metodoPago: snap.metodo_label,
      montoRecibido: snap.monto_recibido,
      vuelto: snap.vuelto,
    });
    const ok = printComprobanteHtml(html);
    if (!ok) setError("No se pudo iniciar la impresión.");
  }, [cart]);

  const finalizarExito = useCallback(
    (snap) => {
      onSaleSuccess?.(snap);
      onClose();
    },
    [onClose, onSaleSuccess],
  );

  const confirmarEfectivo = useCallback(async () => {
    const monto = Number(String(montoRecibido).replace(",", "."));
    if (!Number.isFinite(monto) || monto < totalEfectivo) {
      setError("Ingresá un monto igual o mayor al total a pagar.");
      return;
    }
    const body = await registrarVenta("efectivo", descEfectivo);
    if (!body) return;
    setSaleSnapshot({
      id_venta: body.id_venta,
      subtotal: body.subtotal ?? subtotal,
      descuento: body.descuento ?? descEfectivo,
      total: body.total ?? totalEfectivo,
      metodo_label: "Efectivo",
      monto_recibido: monto,
      vuelto: round2(monto - totalEfectivo),
      lineas: snapshotLineas(),
    });
    setStep("exito");
  }, [
    descEfectivo,
    montoRecibido,
    registrarVenta,
    snapshotLineas,
    subtotal,
    totalEfectivo,
  ]);

  const calcKeyClass =
    "rounded-lg border border-zinc-200 bg-white py-2 text-base font-semibold text-zinc-900 transition hover:bg-zinc-50 active:bg-zinc-100 sm:py-2.5";

  if (!open) return null;

  const btnBase =
    "rounded-xl px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 sm:px-4 sm:py-3";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pago-titulo"
      data-no-global-barcode
    >
      <div
        className={`flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl ${
          step === "efectivo"
            ? "h-[calc(100dvh-1.5rem)] sm:h-auto sm:max-h-[min(580px,calc(100dvh-2rem))]"
            : "max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(640px,calc(100dvh-2rem))]"
        }`}
      >
        <div className="shrink-0 border-b border-zinc-100 px-4 pb-3 pt-4 sm:px-5">
          <h2 id="modal-pago-titulo" className="text-base font-semibold text-zinc-900 sm:text-lg">
            {step === "metodo" && "Método de pago"}
            {step === "efectivo" && "Efectivo"}
            {step === "transferencia" && "Transferencia"}
            {step === "tarjeta" && "Tarjeta"}
            {step === "exito" && "Venta registrada"}
          </h2>
        </div>

        {error ? (
          <p className="mx-4 mt-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-5">
            {error}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-3 sm:px-5 sm:py-4">

        {step === "metodo" ? (
          <div className="flex h-full flex-col gap-3">
            <p className="text-sm text-zinc-600">Elegí cómo cobrás esta venta.</p>
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-center text-2xl font-bold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
              {money(subtotal)}
            </p>
            <div className="mt-auto grid gap-2 sm:gap-3">
              <button
                type="button"
                className={`${btnBase} w-full bg-gradient-to-r from-emerald-700 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-500 focus:ring-emerald-500`}
                onClick={() => setStep("efectivo")}
              >
                Efectivo
              </button>
              <button
                type="button"
                className={`${btnBase} w-full bg-gradient-to-r from-sky-700 to-sky-600 text-white hover:from-sky-600 hover:to-sky-500 focus:ring-sky-500`}
                onClick={() => setStep("transferencia")}
              >
                Transferencia
              </button>
              <button
                type="button"
                className={`${btnBase} w-full bg-gradient-to-r from-violet-700 to-violet-600 text-white hover:from-violet-600 hover:to-violet-500 focus:ring-violet-500`}
                onClick={() => setStep("tarjeta")}
              >
                Tarjeta
              </button>
              <button
                type="button"
                className={`${btnBase} w-full border border-zinc-300 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 focus:ring-zinc-400`}
                onClick={onClose}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {step === "efectivo" ? (
          <div className="flex h-full min-h-0 flex-col gap-2 sm:gap-2.5">
            <dl className="shrink-0 space-y-0.5 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-xs sm:text-sm">
              <div className="flex justify-between text-zinc-600">
                <dt>Subtotal</dt>
                <dd className="font-medium tabular-nums text-zinc-900">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-zinc-600">
                <dt>Descuento 10%</dt>
                <dd className="font-medium tabular-nums text-emerald-700">−{money(descEfectivo)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-zinc-200 pt-1.5 font-semibold text-zinc-900">
                <dt>Total a pagar</dt>
                <dd className="text-xl font-bold tabular-nums sm:text-2xl">{money(totalEfectivo)}</dd>
              </div>
            </dl>

            <label className="block shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Monto recibido
              <input
                ref={montoInputRef}
                type="text"
                inputMode="decimal"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void confirmarEfectivo();
                  }
                }}
                className="mt-0.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-lg font-semibold tabular-nums text-zinc-900 sm:py-2.5 sm:text-xl"
                placeholder="0,00"
                autoComplete="off"
              />
            </label>

            <div
              className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-1.5 sm:gap-2"
              aria-label="Calculadora"
            >
              {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className={`${calcKeyClass} min-h-0`}
                  disabled={pending}
                  onClick={() => setMontoRecibido((prev) => appendMontoChar(prev, digit))}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                className={`${calcKeyClass} min-h-0`}
                disabled={pending}
                onClick={() => setMontoRecibido((prev) => appendMontoChar(prev, ","))}
              >
                ,
              </button>
              <button
                type="button"
                className={`${calcKeyClass} min-h-0`}
                disabled={pending}
                onClick={() => setMontoRecibido((prev) => appendMontoChar(prev, "0"))}
              >
                0
              </button>
              <button
                type="button"
                className={`${calcKeyClass} min-h-0`}
                disabled={pending}
                onClick={() => setMontoRecibido((prev) => String(prev ?? "").slice(0, -1))}
                aria-label="Borrar último dígito"
              >
                ⌫
              </button>
            </div>

            <div className="shrink-0 space-y-2 border-t border-zinc-100 pt-2">
              <p className="text-sm font-medium text-zinc-800">
                Vuelto:{" "}
                <span className="text-base font-bold tabular-nums text-emerald-700 sm:text-lg">
                  {vuelto != null ? money(vuelto) : "—"}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`${btnBase} border border-zinc-300 bg-white text-zinc-800`}
                  onClick={() => setStep("metodo")}
                  disabled={pending}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className={`${btnBase} flex-1 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white disabled:opacity-50`}
                  disabled={
                    pending ||
                    !Number.isFinite(montoNum) ||
                    montoNum < totalEfectivo
                  }
                  onClick={() => void confirmarEfectivo()}
                >
                  {pending ? "Registrando…" : "Confirmar venta"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === "transferencia" ? (
          <div className="flex h-full flex-col gap-3">
            <p className="text-sm text-zinc-600">Enviá el importe al siguiente alias:</p>
            <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-center text-3xl font-bold tabular-nums tracking-tight text-sky-950">
              {money(totalTarjetaTransfer)}
            </p>
            <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-lg font-semibold tracking-wide text-sky-950">
              {cfg.alias}
            </p>
            <div className="mt-auto flex gap-2">
              <button
                type="button"
                className={`${btnBase} border border-zinc-300 bg-white text-zinc-800`}
                onClick={() => setStep("metodo")}
                disabled={pending}
              >
                Volver
              </button>
              <button
                type="button"
                className={`${btnBase} flex-1 bg-gradient-to-r from-sky-700 to-sky-600 text-white disabled:opacity-50`}
                disabled={pending}
                onClick={async () => {
                  const body = await registrarVenta("transferencia", 0);
                  if (!body) return;
                  setSaleSnapshot({
                    id_venta: body.id_venta,
                    subtotal: body.subtotal ?? subtotal,
                    descuento: body.descuento ?? 0,
                    total: body.total ?? totalTarjetaTransfer,
                    metodo_label: "Transferencia",
                    monto_recibido: null,
                    vuelto: null,
                    lineas: snapshotLineas(),
                  });
                  setStep("exito");
                }}
              >
                {pending ? "Registrando…" : "Confirmar venta"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "tarjeta" ? (
          <div className="flex h-full flex-col gap-3">
            <p className="text-sm text-zinc-600">
              Cobro con tarjeta por el monto indicado. No se aplica descuento adicional.
            </p>
            <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-4 text-center text-3xl font-bold tabular-nums tracking-tight text-violet-950">
              {money(totalTarjetaTransfer)}
            </p>
            <div className="mt-auto flex gap-2">
              <button
                type="button"
                className={`${btnBase} border border-zinc-300 bg-white text-zinc-800`}
                onClick={() => setStep("metodo")}
                disabled={pending}
              >
                Volver
              </button>
              <button
                type="button"
                className={`${btnBase} flex-1 bg-gradient-to-r from-violet-700 to-violet-600 text-white disabled:opacity-50`}
                disabled={pending}
                onClick={async () => {
                  const body = await registrarVenta("tarjeta", 0);
                  if (!body) return;
                  setSaleSnapshot({
                    id_venta: body.id_venta,
                    subtotal: body.subtotal ?? subtotal,
                    descuento: body.descuento ?? 0,
                    total: body.total ?? totalTarjetaTransfer,
                    metodo_label: "Tarjeta",
                    monto_recibido: null,
                    vuelto: null,
                    lineas: snapshotLineas(),
                  });
                  setStep("exito");
                }}
              >
                {pending ? "Registrando…" : "Confirmar venta"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "exito" && saleSnapshot ? (
          <div className="flex h-full flex-col gap-3">
            <p className="text-sm text-zinc-700">
              Venta <span className="font-semibold">#{saleSnapshot.id_venta}</span> por{" "}
              <span className="font-semibold">{money(saleSnapshot.total)}</span>.
            </p>
            <button
              type="button"
              className={`${btnBase} w-full bg-zinc-900 text-white hover:bg-zinc-800`}
              onClick={() => imprimirComprobante(saleSnapshot)}
            >
              Imprimir comprobante
            </button>
            <button
              type="button"
              className={`${btnBase} w-full border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`}
              onClick={() => finalizarExito(saleSnapshot)}
            >
              Cerrar
            </button>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
