import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { getTallerComprobanteConfig } from "@/lib/tallerComprobante";
import { coerceMoney } from "@/lib/moneyCoerce";

const PAGE_W = 210;
const M = 12;
const INNER_W = PAGE_W - M * 2;
const FRAME_INSET = 4;

function fmtMoney(n) {
  const x = coerceMoney(n);
  if (!Number.isFinite(x)) return "0,00";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateEs(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw);
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  const d = iso ? new Date(`${iso[1]}T12:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayInput() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function parseQty(s) {
  const n = parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseMoneyAR(s) {
  return coerceMoney(s);
}

function lineSubtotal(row) {
  return parseQty(row?.cantidad) * parseMoneyAR(row?.precio_unitario);
}

function normalizeSnapshot(snapshot, origin = "") {
  const cfg = getTallerComprobanteConfig();
  const taller = snapshot?.taller ?? cfg;
  const logoUrl =
    snapshot?.logoUrl ||
    (origin ? `${origin}${taller.logoPath || "/logo.jpg"}` : taller.logoPath || "/logo.jpg");

  const lineas = (Array.isArray(snapshot?.lineas) ? snapshot.lineas : [])
    .map((row) => ({
      parametro: String(row?.parametro ?? "").trim(),
      cantidad: parseQty(row?.cantidad),
      precio_unitario: parseMoneyAR(row?.precio_unitario),
      notas: String(row?.notas ?? "").trim(),
      subtotal: Number.isFinite(Number(row?.subtotal))
        ? Number(row.subtotal)
        : lineSubtotal(row),
    }))
    .filter((row) => row.parametro);

  const totalGeneral = Number.isFinite(Number(snapshot?.totalGeneral))
    ? Number(snapshot.totalGeneral)
    : lineas.reduce((acc, row) => acc + row.subtotal, 0);

  const montoSena = Number(snapshot?.montoSena ?? 0);
  const saldoPendiente = Number.isFinite(Number(snapshot?.saldoPendiente))
    ? Number(snapshot.saldoPendiente)
    : Math.max(0, totalGeneral - montoSena);

  return {
    taller,
    logoUrl,
    nombrePersona: String(snapshot?.nombrePersona ?? "").trim() || "—",
    datosVehiculo: String(snapshot?.datosVehiculo ?? "").trim(),
    km: String(snapshot?.km ?? "").trim(),
    observaciones: String(snapshot?.observaciones ?? "").trim(),
    fechaElaboracion: snapshot?.fechaElaboracion || todayInput(),
    fechaEntregaEstimada: snapshot?.fechaEntregaEstimada || "",
    fechaEntregaComprometida: snapshot?.fechaEntregaComprometida || "",
    lineas,
    totalGeneral,
    montoSena,
    saldoPendiente,
    entregas: Array.isArray(snapshot?.entregas) ? snapshot.entregas : [],
  };
}

async function fetchLogoDataUrl(url) {
  if (!url || typeof fetch === "undefined") return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function logoFormat(dataUrl) {
  const s = String(dataUrl ?? "");
  if (s.startsWith("data:image/png")) return "PNG";
  if (s.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function drawDoubleFrame(doc, x, y, w, h) {
  doc.setDrawColor(24, 24, 27);
  doc.setLineWidth(0.8);
  doc.rect(x, y, w, h, "S");
  doc.setLineWidth(0.3);
  doc.rect(x + 1.2, y + 1.2, w - 2.4, h - 2.4, "S");
}

function writeLines(doc, lines, x, y, maxWidth, lineHeight = 4.2) {
  let cy = y;
  for (const line of lines) {
    const parts = doc.splitTextToSize(String(line ?? ""), maxWidth);
    doc.text(parts, x, cy);
    cy += parts.length * lineHeight;
  }
  return cy;
}

/**
 * Genera el PDF del presupuesto con jsPDF (sin html2canvas).
 */
export async function buildPresupuestoPdfBlob(snapshot, origin = "") {
  const data = normalizeSnapshot(snapshot, origin);
  const cfg = data.taller;
  const direccion = cfg.direccion || "Portugal esquina Uruguay, General Deheza, Cordoba";
  const telefono = cfg.telefono || "3584906623";
  const email = cfg.email || "alexis_oya@hotmail.com";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const contentX = M + FRAME_INSET;
  const contentW = INNER_W - FRAME_INSET * 2;
  let y = M + FRAME_INSET + 2;

  const logoDataUrl = await fetchLogoDataUrl(data.logoUrl);
  const logoSize = 28;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, logoFormat(logoDataUrl), contentX, y, logoSize, logoSize);
    } catch {
      /* sin logo */
    }
  }

  const headerTextX = contentX + logoSize + 6;
  const headerTextW = contentW - logoSize - 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  doc.text("PRESUPUESTO", headerTextX, y + 4);
  doc.text(fmtDateEs(data.fechaElaboracion), contentX + contentW, y + 4, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(24, 24, 27);
  doc.text(String(cfg.nombre || "Motomecánica Oyarzabal"), headerTextX, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(63, 63, 70);
  y = writeLines(doc, [direccion, telefono, email], headerTextX, y + 18, headerTextW, 3.8);
  y = Math.max(y, M + FRAME_INSET + logoSize + 4);

  doc.setDrawColor(24, 24, 27);
  doc.setLineWidth(0.4);
  doc.line(contentX, y, contentX + contentW, y);
  y += 6;

  const clientBoxTop = y;
  y += 5;
  const halfW = (contentW - 8) / 2;
  const hasVehiculo = Boolean(data.datosVehiculo || data.km);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text("CLIENTE", contentX + 3, y);
  if (hasVehiculo) doc.text("VEHÍCULO", contentX + halfW + 8, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  y += 5;
  doc.text(data.nombrePersona, contentX + 3, y);

  if (hasVehiculo) {
    let vy = y;
    if (data.datosVehiculo) {
      doc.text(data.datosVehiculo, contentX + halfW + 8, vy);
      vy += 5;
    }
    if (data.km) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Km ${data.km}`, contentX + halfW + 8, vy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
    }
  }

  y += 6;

  if (data.observaciones) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(113, 113, 122);
    doc.text("OBSERVACIONES", contentX + 3, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(39, 39, 42);
    y = writeLines(doc, [data.observaciones], contentX + 3, y + 4, contentW - 6, 4) + 2;
  }

  if (data.fechaEntregaEstimada || data.fechaEntregaComprometida) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(39, 39, 42);
    const parts = [];
    if (data.fechaEntregaEstimada) {
      parts.push(`Entrega estimada: ${fmtDateEs(data.fechaEntregaEstimada)}`);
    }
    if (data.fechaEntregaComprometida) {
      parts.push(`Entrega comprometida: ${fmtDateEs(data.fechaEntregaComprometida)}`);
    }
    y = writeLines(doc, [parts.join("   ")], contentX + 3, y + 2, contentW - 6, 4) + 2;
  }

  doc.setLineWidth(0.25);
  doc.rect(contentX, clientBoxTop, contentW, y - clientBoxTop, "S");
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: contentX, right: M + FRAME_INSET },
    tableWidth: contentW,
    head: [["#", "Concepto", "Cant.", "P. unit.", "Subtotal", "Notas"]],
    body: data.lineas.map((row, i) => [
      String(i + 1),
      row.parametro,
      String(row.cantidad),
      `$${fmtMoney(row.precio_unitario)}`,
      `$${fmtMoney(row.subtotal)}`,
      row.notas || "—",
    ]),
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 1.8,
      lineColor: [24, 24, 27],
      lineWidth: 0.15,
      textColor: [24, 24, 27],
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [244, 244, 245],
      textColor: [24, 24, 27],
      fontStyle: "bold",
      fontSize: 7,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 62 },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 22, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 28 },
    },
    theme: "grid",
    didDrawPage: () => {
      drawDoubleFrame(doc, M, M, INNER_W, doc.internal.pageSize.getHeight() - M * 2);
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 6;
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - M - FRAME_INSET - 30) {
    doc.addPage();
    y = M + FRAME_INSET + 4;
    drawDoubleFrame(doc, M, M, INNER_W, pageH - M * 2);
  }

  doc.setDrawColor(24, 24, 27);
  doc.setLineWidth(0.4);
  doc.line(contentX, y, contentX + contentW, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(39, 39, 42);
  if (data.montoSena > 0) {
    doc.text(`Total entregas: $${fmtMoney(data.montoSena)}`, contentX + contentW, y, {
      align: "right",
    });
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(24, 24, 27);
  doc.text(`Total presupuesto: $${fmtMoney(data.totalGeneral)}`, contentX + contentW, y, {
    align: "right",
  });
  y += 6;

  if (data.montoSena > 0) {
    doc.setFontSize(13);
    doc.text(`Saldo pendiente: $${fmtMoney(data.saldoPendiente)}`, contentX + contentW, y, {
      align: "right",
    });
    y += 8;
  }

  if (data.entregas.length > 0) {
    if (y > pageH - M - FRAME_INSET - 20) {
      doc.addPage();
      y = M + FRAME_INSET + 4;
      drawDoubleFrame(doc, M, M, INNER_W, pageH - M * 2);
    }
    doc.setDrawColor(161, 161, 170);
    doc.setLineWidth(0.25);
    doc.rect(contentX, y, contentW, 8 + data.entregas.length * 5, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Detalle de entregas", contentX + 3, y + 5);
    y += 9;
    doc.setFont("helvetica", "normal");
    for (const e of data.entregas) {
      const fecha = e?.fecha_registro
        ? new Date(e.fecha_registro).toLocaleString("es-AR")
        : "—";
      doc.text(String(fecha), contentX + 3, y);
      doc.text(`$${fmtMoney(e?.monto)}`, contentX + contentW - 3, y, { align: "right" });
      y += 5;
    }
  }

  drawDoubleFrame(doc, M, M, INNER_W, pageH - M * 2);

  return doc.output("blob");
}

export function buildPresupuestoPdfSnapshotFromClient({
  taller,
  logoPrintUrl,
  nombrePersona,
  datosVehiculo,
  km,
  observaciones,
  fechaElaboracion,
  fechaEntregaEstimada,
  fechaEntregaComprometida,
  rows,
  totalGeneral,
  montoSena,
  saldoPendiente,
  entregas,
  origin,
}) {
  const lineas = (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row?.parametro ?? "").trim())
    .map((row) => {
      const cantidad = parseQty(row.cantidad);
      const precio_unitario = coerceMoney(row.precio_unitario);
      return {
        parametro: row.parametro,
        cantidad,
        precio_unitario,
        notas: row.notas,
        subtotal: cantidad * precio_unitario,
      };
    });

  return {
    taller,
    logoUrl: logoPrintUrl || (origin ? `${origin}${taller?.logoPath || "/logo.jpg"}` : ""),
    nombrePersona,
    datosVehiculo,
    km,
    observaciones,
    fechaElaboracion,
    fechaEntregaEstimada,
    fechaEntregaComprometida,
    lineas,
    totalGeneral,
    montoSena,
    saldoPendiente,
    entregas,
  };
}
