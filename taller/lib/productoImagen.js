const MAX_SIDE = 720;
const JPEG_QUALITY = 0.72;
const MAX_CHARS = 380_000;

export function normalizeProductoImagenSrc(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (s.startsWith("data:image/")) return s;
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return s;
  if (s.length > 80 && /^[A-Za-z0-9+/=\s]+$/.test(s.slice(0, 120))) {
    return `data:image/jpeg;base64,${s.replace(/\s/g, "")}`;
  }
  return "";
}

function scaleSize(width, height, maxSide) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w <= 0 || h <= 0) return { width: maxSide, height: maxSide };
  const longest = Math.max(w, h);
  if (longest <= maxSide) return { width: Math.round(w), height: Math.round(h) };
  const ratio = maxSide / longest;
  return { width: Math.max(1, Math.round(w * ratio)), height: Math.max(1, Math.round(h * ratio)) };
}

function canvasToJpegDataUrl(canvas, quality) {
  return canvas.toDataURL("image/jpeg", quality);
}

async function drawToCanvas(source, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la imagen.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function encodeCanvas(canvas) {
  let quality = JPEG_QUALITY;
  let dataUrl = canvasToJpegDataUrl(canvas, quality);
  while (dataUrl.length > MAX_CHARS && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvasToJpegDataUrl(canvas, quality);
  }
  if (dataUrl.length > MAX_CHARS) {
    throw new Error("La foto quedó muy pesada. Probá otra más chica o acercá menos.");
  }
  return dataUrl;
}

export async function compressImageFile(file) {
  if (!file) throw new Error("No se eligió ninguna imagen.");
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("La imagen no puede superar 12 MB.");
  }

  let bitmap = null;
  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    }
  } catch {
    bitmap = null;
  }

  if (bitmap) {
    try {
      const size = scaleSize(bitmap.width, bitmap.height, MAX_SIDE);
      const canvas = await drawToCanvas(bitmap, size.width, size.height);
      return encodeCanvas(canvas);
    } finally {
      bitmap.close?.();
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo leer la imagen."));
      el.src = objectUrl;
    });
    const size = scaleSize(img.naturalWidth || img.width, img.naturalHeight || img.height, MAX_SIDE);
    const canvas = await drawToCanvas(img, size.width, size.height);
    return encodeCanvas(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function captureVideoFrame(videoEl) {
  if (!videoEl || !videoEl.videoWidth) {
    throw new Error("La cámara todavía no está lista.");
  }
  const size = scaleSize(videoEl.videoWidth, videoEl.videoHeight, MAX_SIDE);
  const canvas = await drawToCanvas(videoEl, size.width, size.height);
  return encodeCanvas(canvas);
}
