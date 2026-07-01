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

const INLINE_PROPS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopStyle",
  "borderRightStyle",
  "borderBottomStyle",
  "borderLeftStyle",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "lineHeight",
  "textAlign",
  "verticalAlign",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "display",
  "width",
  "height",
  "minHeight",
  "maxWidth",
  "whiteSpace",
  "letterSpacing",
  "textTransform",
  "objectFit",
];

function kebabCase(prop) {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function prepareCloneForPdf(sourceEl, cloneEl) {
  if (!sourceEl || !cloneEl || sourceEl.nodeType !== 1 || cloneEl.nodeType !== 1) return;

  const cs = window.getComputedStyle(sourceEl);
  for (const prop of INLINE_PROPS) {
    const raw = cs.getPropertyValue(kebabCase(prop)) || cs[prop];
    if (!raw) continue;
    const val = prop.toLowerCase().includes("color") ? toSafeCssColor(raw) : raw;
    cloneEl.style.setProperty(kebabCase(prop), val);
  }

  cloneEl.removeAttribute("class");

  const srcKids = sourceEl.children;
  const cloneKids = cloneEl.children;
  for (let i = 0; i < srcKids.length; i += 1) {
    prepareCloneForPdf(srcKids[i], cloneKids[i]);
  }
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

/**
 * Genera un PDF del área de impresión del presupuesto (mismo contenido que Imprimir).
 */
export async function generarPresupuestoPdfBlob(elementId, filename = "presupuesto.pdf") {
  if (typeof document === "undefined") {
    throw new Error("Solo disponible en el navegador");
  }

  const el = document.getElementById(elementId);
  if (!el) throw new Error("No se encontró el área de impresión del presupuesto");

  const html2pdf = (await import("html2pdf.js")).default;

  const prevClass = el.className;
  const prevStyle = el.getAttribute("style");

  el.classList.remove("hidden");
  el.classList.add("block");
  el.style.cssText =
    "position:fixed;left:-12000px;top:0;width:210mm;max-width:210mm;background:#ffffff;color:#18181b;z-index:-1;pointer-events:none;";

  try {
    const opt = {
      margin: [0.2, 0.35, 0.2, 0.35],
      filename,
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          const cloneRoot = clonedDoc.getElementById(elementId);
          if (!cloneRoot) return;
          prepareCloneForPdf(el, cloneRoot);
          cloneRoot.style.background = "#ffffff";
          cloneRoot.style.color = "#18181b";
          clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => node.remove());
        },
      },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };
    return await html2pdf().set(opt).from(el).outputPdf("blob");
  } finally {
    el.className = prevClass;
    if (prevStyle == null) el.removeAttribute("style");
    else el.setAttribute("style", prevStyle);
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
  const blob = pdfPromise
    ? await pdfPromise
    : await generarPresupuestoPdfBlob(elementId, filename);
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
