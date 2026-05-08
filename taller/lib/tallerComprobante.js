/** Datos del taller para el comprobante (configurá con variables NEXT_PUBLIC_* en .env.local). */
export function getTallerComprobanteConfig() {
  return {
    nombre: process.env.NEXT_PUBLIC_TALLER_NOMBRE || "Motomecánica Oyarzabal",
    direccion: process.env.NEXT_PUBLIC_TALLER_DIRECCION || "",
    telefono: process.env.NEXT_PUBLIC_TALLER_TELEFONO || "",
    alias: process.env.NEXT_PUBLIC_TALLER_ALIAS || "oyarzabal.moto",
    logoPath: "/logo.jpg",
  };
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moneyEs(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * HTML para ventana de impresión (comprobante no fiscal).
 * origin: p. ej. window.location.origin para la imagen del logo.
 */
export function formatFechaVentaArg(raw) {
  if (raw == null || raw === "") return "—";
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(raw);
  }
}

function metodoPagoLabel(raw) {
  const m = String(raw ?? "").trim();
  if (!m) return "";
  const lower = m.toLowerCase();
  const map = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta",
    debito: "Débito",
    credito: "Crédito",
  };
  return map[lower] ?? m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
}

/**
 * Comprobante HTML a partir de un objeto venta como devuelve app.spgetventas (con detalle[]).
 */
export function buildComprobanteHtmlFromVenta(venta, origin) {
  const detalle = Array.isArray(venta?.detalle) ? venta.detalle : [];
  const lineas = detalle.map((d) => ({
    nombre: d.producto?.nombre ?? "—",
    cantidad: Number(d.cantidad ?? 0),
    precio_unitario: Number(d.precio_unitario ?? 0),
  }));
  const metodoLabel = metodoPagoLabel(venta?.metodo_pago);
  return buildComprobanteHtml({
    origin: origin || "",
    idVenta: venta?.id_venta,
    fecha: formatFechaVentaArg(venta?.fecha),
    lineas,
    subtotal: Number(venta?.subtotal ?? 0),
    descuento: Number(venta?.descuento ?? 0),
    total: Number(venta?.total ?? 0),
    metodoPago: metodoLabel || null,
    montoRecibido: null,
    vuelto: null,
  });
}

export function buildComprobanteHtml({
  origin,
  idVenta,
  fecha,
  lineas,
  subtotal,
  descuento,
  total,
  metodoPago,
  montoRecibido,
  vuelto,
}) {
  const cfg = getTallerComprobanteConfig();
  const logoUrl = `${origin || ""}${cfg.logoPath}`;

  const filas = (lineas || [])
    .map(
      (l) => `
    <tr>
      <td class="col-producto">${esc(l.nombre)}</td>
      <td class="num col-cant">${l.cantidad}</td>
      <td class="num col-pu">${moneyEs(l.precio_unitario)}</td>
      <td class="num col-sub">${moneyEs(Number(l.cantidad) * Number(l.precio_unitario))}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Comprobante</title>
  <style>
    @page { margin: 10mm; size: auto; }
    body { font-family: system-ui, Segoe UI, sans-serif; font-size: 15px; line-height: 1.35; color: #111; margin: 0; padding: 10px; background: #f0f0f0; box-sizing: border-box; }
    .recuadro { max-width: 132mm; width: 100%; margin: 0 auto; padding: 18px 16px; border: 2px solid #1a1a1a; border-radius: 10px; background: #fff; box-sizing: border-box; box-shadow: 0 1px 0 rgba(0,0,0,0.06); }
    .logo { text-align: center; margin-bottom: 14px; }
    .logo img { max-width: 280px; max-height: 165px; width: auto; height: auto; object-fit: contain; }
    h1 { font-size: 19px; margin: 0 0 6px; text-align: center; font-weight: 700; }
    .muted { color: #444; font-size: 13px; line-height: 1.45; text-align: center; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
    th, td { border-bottom: 1px solid #ccc; padding: 8px 6px; text-align: left; vertical-align: top; font-size: 14px; }
    th { font-size: 11px; text-transform: uppercase; color: #555; letter-spacing: 0.02em; }
    th.num { text-align: right; }
    th.col-producto, td.col-producto { width: 48%; word-wrap: break-word; overflow-wrap: anywhere; hyphens: auto; }
    th.col-cant, td.col-cant { width: 14%; }
    th.col-pu, td.col-pu { width: 19%; }
    th.col-sub, td.col-sub { width: 19%; }
    td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .tot { margin-top: 14px; font-size: 15px; }
    .tot div { display: flex; justify-content: space-between; padding: 4px 0; gap: 12px; }
    .tot .grand { font-weight: 700; font-size: 19px; border-top: 2px solid #111; margin-top: 8px; padding-top: 10px; }
    .pie { margin-top: 18px; font-size: 13px; color: #555; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .recuadro { box-shadow: none; border-color: #000; }
    }
  </style>
</head>
<body>
  <div class="recuadro">
    <div class="logo"><img src="${esc(logoUrl)}" alt="" /></div>
    <h1>${esc(cfg.nombre)}</h1>
    <div class="muted">
      ${cfg.direccion ? `${esc(cfg.direccion)}<br/>` : ""}
      ${cfg.telefono ? `Tel. ${esc(cfg.telefono)}<br/>` : ""}
      Comprobante no fiscal<br/>
      ${esc(fecha)}
    </div>
    <table>
      <thead>
        <tr>
          <th class="col-producto">Producto</th>
          <th class="num col-cant">Cantidad</th>
          <th class="num col-pu">Precio unitario</th>
          <th class="num col-sub">Subtotal</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="tot">
      <div><span>Subtotal</span><span>${moneyEs(subtotal)}</span></div>
      <div><span>Descuento</span><span>${moneyEs(descuento)}</span></div>
      <div class="grand"><span>Total</span><span>${moneyEs(total)}</span></div>
      ${metodoPago ? `<div><span>Método</span><span>${esc(metodoPago)}</span></div>` : ""}
      ${montoRecibido != null && Number.isFinite(Number(montoRecibido)) ? `<div><span>Recibido</span><span>${moneyEs(montoRecibido)}</span></div>` : ""}
      ${vuelto != null && Number.isFinite(Number(vuelto)) ? `<div><span>Vuelto</span><span>${moneyEs(vuelto)}</span></div>` : ""}
    </div>
    <p class="pie">Gracias por su compra.</p>
  </div>
</body>
</html>`;
}

/**
 * Imprime sin abrir ventana emergente: escribe el HTML en un iframe oculto y llama a print().
 * Evita bloqueos de popups; conviene llamarlo desde un click del usuario.
 */
export function printComprobanteHtml(html) {
  if (typeof document === "undefined") return false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Comprobante");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* noop */
    }
    setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* noop */
      }
    }, 800);
  };

  // Dar tiempo a que cargue el logo antes de print (especialmente en Chrome).
  setTimeout(runPrint, 450);
  return true;
}
