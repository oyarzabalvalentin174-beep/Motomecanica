import {
  buildPresupuestoPdfBlob,
  buildPresupuestoPdfSnapshotFromClient,
} from "@/lib/presupuestoPdfDocument";

function safeFilename(name) {
  const base = String(name ?? "presupuesto")
    .trim()
    .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ.-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 48);
  return base || "presupuesto";
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function pdfBlobPareceVacio(blob) {
  return !blob || blob.size < 2048;
}

let pdfGenerationLock = null;

export async function generarPresupuestoPdfBlob(snapshot, filename = "presupuesto.pdf") {
  if (typeof document === "undefined") {
    throw new Error("Solo disponible en el navegador");
  }

  if (pdfGenerationLock) return pdfGenerationLock;

  pdfGenerationLock = (async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const blob = await buildPresupuestoPdfBlob(snapshot, origin);
    if (pdfBlobPareceVacio(blob)) {
      throw new Error("El PDF generado está vacío");
    }
    return blob;
  })();

  try {
    return await pdfGenerationLock;
  } finally {
    pdfGenerationLock = null;
  }
}

function buildPdfFile(blob, filename) {
  return new File([blob], filename, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}

async function compartirPdfConSistema(file) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }

  const attempts = [{ files: [file] }, { files: [file], title: "Presupuesto" }];

  for (const shareData of attempts) {
    try {
      if (navigator.canShare && !navigator.canShare(shareData)) continue;
      await navigator.share(shareData);
      return true;
    } catch (e) {
      if (e?.name === "AbortError") throw e;
    }
  }

  try {
    await navigator.share({ files: [file] });
    return true;
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return false;
  }
}

export async function compartirPresupuestoPorWhatsApp({ snapshot, clienteNombre, pdfPromise }) {
  const nom = String(clienteNombre ?? snapshot?.nombrePersona ?? "").trim() || "cliente";
  const filename = `presupuesto_${safeFilename(nom)}.pdf`;

  let blob;
  try {
    blob = pdfPromise ? await pdfPromise : await generarPresupuestoPdfBlob(snapshot, filename);
  } catch {
    blob = await generarPresupuestoPdfBlob(snapshot, filename);
  }

  if (pdfBlobPareceVacio(blob)) {
    blob = await generarPresupuestoPdfBlob(snapshot, filename);
  }

  const file = buildPdfFile(blob, filename);
  const mobile = isMobileDevice();

  try {
    const shared = await compartirPdfConSistema(file);
    if (shared) return { ok: true, mode: "share" };
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, cancelled: true };
  }

  if (mobile) {
    throw new Error(
      "No se pudo adjuntar el PDF. Usá Chrome o Safari, mantené un instante el botón antes de soltar, y elegí WhatsApp en el menú.",
    );
  }

  downloadBlob(blob, filename);
  return { ok: true, mode: "download" };
}

export function iniciarGeneracionPdfPresupuesto(snapshot) {
  const nom = String(snapshot?.nombrePersona ?? "").trim() || "cliente";
  const filename = `presupuesto_${safeFilename(nom)}.pdf`;
  return generarPresupuestoPdfBlob(snapshot, filename);
}

export { buildPresupuestoPdfSnapshotFromClient };
