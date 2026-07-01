const PDF_CAPTURE_HOST_ID = "presupuesto-pdf-capture-host";

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

let colorCanvas;
let colorCtx;

/** Convierte lab()/oklch() u otros formatos a rgb() para html2canvas. */
function toSafeCssColor(value) {
  const v = String(value ?? "").trim();
  if (!v || v === "transparent" || v === "rgba(0, 0, 0, 0)") return v;
  try {
    if (!colorCanvas) {
      colorCanvas = document.createElement("canvas");
      colorCtx = colorCanvas.getContext("2d");
    }
    colorCtx.fillStyle = "#000000";
    colorCtx.fillStyle = v;
    return colorCtx.fillStyle;
  } catch {
    return v;
  }
}

const COLOR_PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "column-rule-color",
  "caret-color",
  "fill",
  "stroke",
];

function fixModernColors(root, doc = document) {
  const win = doc.defaultView || window;
  const nodes = root.querySelectorAll("*");
  for (const node of [root, ...nodes]) {
    if (node.nodeType !== 1) continue;
    const cs = win.getComputedStyle(node);
    for (const prop of COLOR_PROPS) {
      const val = cs.getPropertyValue(prop);
      if (!val || !/oklch|lab\(|color\(/.test(val)) continue;
      node.style.setProperty(prop, toSafeCssColor(val));
    }
  }
}

function waitForNextFrame(count = 2) {
  return new Promise((resolve) => {
    let left = count;
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function waitForImages(root) {
  const imgs = root.querySelectorAll("img");
  await Promise.all(
    [...imgs].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

function removeCaptureHost() {
  document.getElementById(PDF_CAPTURE_HOST_ID)?.remove();
}

/** Clona el área de impresión en un contenedor estático (evita recortes en móvil). */
function createCaptureHost(sourceEl) {
  removeCaptureHost();

  const host = document.createElement("div");
  host.id = PDF_CAPTURE_HOST_ID;
  host.setAttribute("aria-hidden", "true");

  const clone = sourceEl.cloneNode(true);
  clone.removeAttribute("id");
  clone.classList.remove("hidden");
  clone.classList.add("presupuesto-print-clone", "block");

  host.appendChild(clone);
  document.body.appendChild(host);
  window.scrollTo(0, 0);

  return host;
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

/** PDF vacío suele pesar menos de ~2 KB. */
function pdfBlobPareceVacio(blob) {
  return !blob || blob.size < 2048;
}

let pdfGenerationLock = null;

/**
 * Genera un PDF del área de impresión del presupuesto (mismo contenido que Imprimir).
 */
export async function generarPresupuestoPdfBlob(elementId, filename = "presupuesto.pdf") {
  if (typeof document === "undefined") {
    throw new Error("Solo disponible en el navegador");
  }

  if (pdfGenerationLock) return pdfGenerationLock;

  pdfGenerationLock = (async () => {
    const sourceEl = document.getElementById(elementId);
    if (!sourceEl) throw new Error("No se encontró el área de impresión del presupuesto");

    const host = createCaptureHost(sourceEl);

    try {
      await waitForNextFrame(2);
      await waitForImages(host);
      fixModernColors(host);

      const captureHeight = Math.max(host.scrollHeight, host.offsetHeight, 200);
      if (captureHeight < 100) {
        throw new Error("El presupuesto no tiene contenido visible para generar el PDF");
      }

      const html2pdf = (await import("html2pdf.js")).default;

      const opt = {
        margin: [0.47, 0.47, 0.87, 0.47],
        filename,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc, clonedEl) => {
            const root = clonedEl || clonedDoc.getElementById(PDF_CAPTURE_HOST_ID);
            if (root) fixModernColors(root, clonedDoc);
          },
        },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      };

      const blob = await html2pdf().set(opt).from(host).outputPdf("blob");
      if (pdfBlobPareceVacio(blob)) {
        throw new Error("El PDF generado está vacío");
      }
      return blob;
    } finally {
      removeCaptureHost();
    }
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

/**
 * Comparte el PDF con el menú del sistema (en el teléfono: elegí WhatsApp y va adjunto).
 */
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

/**
 * Comparte el presupuesto en PDF.
 * @param {object} opts
 * @param {string} opts.elementId
 * @param {string} opts.clienteNombre
 * @param {Promise<Blob>} [opts.pdfPromise] PDF ya en generación (touchstart) para ganar tiempo
 */
export async function compartirPresupuestoPorWhatsApp({ elementId, clienteNombre, pdfPromise }) {
  const nom = String(clienteNombre ?? "").trim() || "cliente";
  const filename = `presupuesto_${safeFilename(nom)}.pdf`;

  let blob;
  try {
    blob = pdfPromise ? await pdfPromise : await generarPresupuestoPdfBlob(elementId, filename);
  } catch {
    blob = await generarPresupuestoPdfBlob(elementId, filename);
  }

  if (pdfBlobPareceVacio(blob)) {
    blob = await generarPresupuestoPdfBlob(elementId, filename);
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

/**
 * Inicia la generación del PDF antes del click (pointerdown) para conservar el gesto del usuario.
 */
export function iniciarGeneracionPdfPresupuesto(elementId, clienteNombre) {
  const nom = String(clienteNombre ?? "").trim() || "cliente";
  const filename = `presupuesto_${safeFilename(nom)}.pdf`;
  return generarPresupuestoPdfBlob(elementId, filename);
}
