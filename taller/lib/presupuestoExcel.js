import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { getTallerComprobanteConfig } from "@/lib/tallerComprobante";
import { moneyEs } from "@/lib/excelFormat";

const FONT = "Arial";

const FILL_TABLE_HEAD = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4D4D8" } };
const FILL_DOC = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
const FILL_BRAND = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
const FILL_LOGO_BOX = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

const BORDER_THIN = {
  top: { style: "thin", color: { argb: "FF18181B" } },
  left: { style: "thin", color: { argb: "FF18181B" } },
  bottom: { style: "thin", color: { argb: "FF18181B" } },
  right: { style: "thin", color: { argb: "FF18181B" } },
};

const BORDER_THICK = {
  top: { style: "medium", color: { argb: "FF18181B" } },
  left: { style: "medium", color: { argb: "FF18181B" } },
  bottom: { style: "medium", color: { argb: "FF18181B" } },
  right: { style: "medium", color: { argb: "FF18181B" } },
};

function parseRange(range) {
  const [tl, br] = range.includes(":") ? range.split(":") : [range, range];
  const colL = (s) => s.toUpperCase().charCodeAt(0) - 64;
  const rowN = (s) => parseInt(s.replace(/\D/g, ""), 10);
  return {
    r1: rowN(tl),
    r2: rowN(br),
    c1: colL(tl),
    c2: colL(br),
    master: tl,
  };
}

function lineSubtotal(line) {
  const q = Number(line.cantidad ?? 1);
  const pu = Number(line.precio_unitario ?? 0);
  const qty = Number.isFinite(q) && q > 0 ? q : 1;
  return qty * (Number.isFinite(pu) ? pu : 0);
}

function up(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase();
}

/** Combina celdas y escribe solo en la maestra. */
function mergeWrite(ws, range, value, opts = {}) {
  const { r1, r2, master } = parseRange(range);
  ws.mergeCells(range);
  const c = ws.getCell(master);
  c.value = value ?? "";
  c.font = {
    name: FONT,
    size: opts.size ?? 11,
    bold: opts.bold ?? false,
    color: opts.color,
  };
  c.alignment = {
    vertical: "middle",
    horizontal: opts.align ?? "left",
    wrapText: opts.wrap ?? false,
  };
  if (opts.fill) c.fill = opts.fill;
  if (opts.border) c.border = opts.border;

  if (opts.height) {
    const h = opts.height / (r2 - r1 + 1);
    for (let r = r1; r <= r2; r++) ws.getRow(r).height = h;
  }
  return c;
}

function writeCell(ws, row, col, value, opts = {}) {
  const c = ws.getCell(row, col);
  c.value = value ?? "";
  c.font = {
    name: FONT,
    size: opts.size ?? 11,
    bold: opts.bold ?? false,
    color: opts.color,
  };
  c.alignment = {
    vertical: "middle",
    horizontal: opts.align ?? "left",
    wrapText: opts.wrap ?? false,
  };
  if (opts.fill) c.fill = opts.fill;
  if (opts.border) c.border = opts.border;
  return c;
}

function outlineBlock(ws, r1, r2, c1 = 1, c2 = 4) {
  for (let c = c1; c <= c2; c++) {
    const top = ws.getCell(r1, c);
    const bot = ws.getCell(r2, c);
    top.border = { ...top.border, top: BORDER_THICK.top };
    bot.border = { ...bot.border, bottom: BORDER_THICK.bottom };
  }
  for (let r = r1; r <= r2; r++) {
    const left = ws.getCell(r, c1);
    const right = ws.getCell(r, c2);
    left.border = { ...left.border, left: BORDER_THICK.left };
    right.border = { ...right.border, right: BORDER_THICK.right };
  }
}

function setColumnWidths(ws) {
  ws.getColumn(1).width = 13;
  ws.getColumn(2).width = 62;
  ws.getColumn(3).width = 7;
  ws.getColumn(4).width = 28;
}

/** Raíz de la app Next (cwd o subcarpeta taller). */
function appRoots() {
  const cwd = process.cwd();
  return [cwd, path.join(cwd, "taller"), path.join(cwd, "..", "taller")];
}

/** Busca logo en public/. */
export function resolveLogoPath() {
  const names = ["logo.jpg", "logo.jpeg", "logo.png"];
  for (const base of appRoots()) {
    for (const name of names) {
      const p = path.join(base, "public", name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** Carga el logo en memoria (fiable al exportar desde API). */
export function loadLogoAsset(explicitPath) {
  const filePath =
    explicitPath && fs.existsSync(explicitPath) ? explicitPath : resolveLogoPath();
  if (!filePath) return null;
  const buffer = fs.readFileSync(filePath);
  const lower = filePath.toLowerCase();
  const ext = lower.endsWith(".png") ? "png" : "jpeg";
  return { buffer, ext, path: filePath };
}

/** Dimensiones reales del PNG/JPEG para no deformar el logo. */
function getImagePixelSize(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  for (let i = 0; i < buffer.length - 9; i++) {
    if (buffer[i] === 0xff && buffer[i + 1] >= 0xc0 && buffer[i + 1] <= 0xc3) {
      return { width: buffer.readUInt16BE(i + 7), height: buffer.readUInt16BE(i + 5) };
    }
  }
  return { width: 1, height: 1 };
}

/** Logo en D1:D2 únicamente (no tapa columna Precio ni filas de la tabla). */
function logoAnchor(iw, ih) {
  const COL_D = 3;
  const COL_D_W_PX = 28 * 7 + 5;
  const BOX_H_PX = 98;
  const maxSide = Math.min(COL_D_W_PX - 10, BOX_H_PX);
  const scale = Math.min(maxSide / iw, maxSide / ih);
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const leftPx = (COL_D_W_PX - w) / 2;
  return {
    tl: { col: COL_D + leftPx / COL_D_W_PX, row: 0.06 },
    ext: { width: w, height: h },
  };
}

function addLogo(wb, ws, logoInput) {
  let buffer;
  let ext = "jpeg";

  if (logoInput && typeof logoInput === "object" && Buffer.isBuffer(logoInput.buffer)) {
    buffer = logoInput.buffer;
    ext = logoInput.ext === "png" ? "png" : "jpeg";
  } else if (typeof logoInput === "string" && fs.existsSync(logoInput)) {
    buffer = fs.readFileSync(logoInput);
    ext = logoInput.toLowerCase().endsWith(".png") ? "png" : "jpeg";
  } else {
    const asset = loadLogoAsset();
    if (!asset) return false;
    buffer = asset.buffer;
    ext = asset.ext;
  }

  try {
    const { width: iw, height: ih } = getImagePixelSize(buffer);
    const anchor = logoAnchor(iw, ih);
    const imgId = wb.addImage({ buffer, extension: ext });
    ws.addImage(imgId, anchor);
    return true;
  } catch {
    return false;
  }
}

function applyPrintSetup(ws, lastRow) {
  ws.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    verticalCentered: false,
    margins: {
      left: 0.55,
      right: 0.55,
      top: 0.6,
      bottom: 0.6,
      header: 0.2,
      footer: 0.2,
    },
  };
  if (lastRow > 0) ws.pageSetup.printArea = `A1:D${lastRow}`;
}

export async function buildPresupuestoWorkbook(presupuesto, logoInput) {
  const taller = getTallerComprobanteConfig();
  const wb = new ExcelJS.Workbook();
  wb.creator = taller.nombre;

  const ws = wb.addWorksheet("Presupuesto", {
    properties: { defaultRowHeight: 22 },
    views: [{ showGridLines: false }],
  });

  setColumnWidths(ws);

  const nombre = up(presupuesto.nombre_persona ?? "Cliente") || "CLIENTE";
  const lineas = (Array.isArray(presupuesto.lineas) ? presupuesto.lineas : []).filter((l) =>
    String(l.parametro ?? "").trim(),
  );
  const entregas = Array.isArray(presupuesto.entregas) ? presupuesto.entregas : [];
  const totalEntregas = Number(presupuesto.total_entregas ?? 0);
  const observaciones = up(presupuesto.observaciones ?? "");
  const datosVehiculo = String(presupuesto.datos_vehiculo ?? "").trim();
  const km = presupuesto.km != null && presupuesto.km !== "" ? String(presupuesto.km) : "";
  const hasVehiculo = Boolean(datosVehiculo || km);

  // Encabezado: nombre (A1:C2) + recuadro logo (D1:D2)
  mergeWrite(ws, "A1:C2", up(taller.nombre), {
    bold: true,
    size: 22,
    height: 78,
    fill: FILL_BRAND,
    border: BORDER_THICK,
  });

  mergeWrite(ws, "D1:D2", "", {
    fill: FILL_LOGO_BOX,
    border: BORDER_THICK,
    height: 78,
    align: "center",
  });

  mergeWrite(ws, "A3:D3", "PRESUPUESTO", {
    bold: true,
    size: 14,
    height: 30,
    fill: FILL_DOC,
    border: BORDER_THICK,
    color: { argb: "FFB91C1C" },
  });

  mergeWrite(ws, "A4:D4", `CLIENTE: ${nombre}`, {
    bold: true,
    size: 13,
    height: 30,
    fill: FILL_DOC,
    border: BORDER_THICK,
  });

  let headerEnd = 4;
  if (hasVehiculo) {
    mergeWrite(ws, "A5:C5", datosVehiculo ? `VEHÍCULO: ${up(datosVehiculo)}` : "", {
      bold: true,
      size: 13,
      height: 28,
      fill: FILL_DOC,
      border: BORDER_THICK,
    });
    mergeWrite(ws, "D5:D5", km ? `KM: ${km}` : "", {
      bold: true,
      size: 13,
      height: 28,
      fill: FILL_DOC,
      border: BORDER_THICK,
      align: "right",
    });
    headerEnd = 5;
  }

  let row = headerEnd + 2;
  const tableHeaderRow = row;

  writeCell(ws, row, 1, "Cant.", {
    bold: true,
    size: 12,
    fill: FILL_TABLE_HEAD,
    border: BORDER_THIN,
    align: "center",
  });
  writeCell(ws, row, 2, "Descripción", {
    bold: true,
    size: 12,
    fill: FILL_TABLE_HEAD,
    border: BORDER_THIN,
  });
  writeCell(ws, row, 3, "$", {
    bold: true,
    size: 12,
    fill: FILL_TABLE_HEAD,
    border: BORDER_THIN,
    align: "center",
  });
  writeCell(ws, row, 4, "Precio", {
    bold: true,
    size: 12,
    fill: FILL_TABLE_HEAD,
    border: BORDER_THIN,
    align: "right",
  });
  ws.getRow(row).height = 26;

  let totalGeneral = 0;
  row += 1;
  const firstDataRow = row;

  for (const line of lineas) {
    const sub = lineSubtotal(line);
    totalGeneral += sub;
    const qty = Number(line.cantidad ?? 1);
    const showQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
    let desc = up(line.parametro);
    const notas = String(line.notas ?? "").trim();
    if (notas) desc = `${desc}\n${up(notas)}`;

    writeCell(ws, row, 1, showQty, { size: 12, border: BORDER_THIN, align: "center" });
    writeCell(ws, row, 2, desc, { size: 12, border: BORDER_THIN, wrap: true });
    writeCell(ws, row, 3, "$", { size: 12, border: BORDER_THIN, align: "center" });
    writeCell(ws, row, 4, moneyEs(sub), { size: 12, border: BORDER_THIN, align: "right" });
    ws.getRow(row).height = desc.length > 48 ? 42 : 24;
    row += 1;
  }

  if (observaciones) {
    mergeWrite(ws, `A${row}:D${row}`, observaciones, {
      bold: true,
      size: 12,
      border: BORDER_THIN,
      wrap: true,
      height: 26,
    });
    row += 1;
  }

  const minBody = 6;
  const bodyCount = row - firstDataRow;
  for (let i = bodyCount; i < minBody; i++) {
    for (let c = 1; c <= 4; c++) writeCell(ws, row, c, "", { border: BORDER_THIN });
    ws.getRow(row).height = 24;
    row += 1;
  }

  const lastBodyRow = row - 1;
  outlineBlock(ws, tableHeaderRow, lastBodyRow);

  const totalRow = row;
  mergeWrite(ws, `A${totalRow}:B${totalRow}`, "TOTAL", {
    bold: true,
    size: 15,
    align: "right",
    border: BORDER_THICK,
    height: 34,
  });
  writeCell(ws, totalRow, 3, "$", {
    bold: true,
    size: 15,
    align: "center",
    border: BORDER_THICK,
  });
  writeCell(ws, totalRow, 4, moneyEs(totalGeneral), {
    bold: true,
    size: 15,
    align: "right",
    border: BORDER_THICK,
  });
  row += 2;

  if (totalEntregas > 0 || entregas.length > 0) {
    mergeWrite(ws, `A${row}:D${row}`, `TOTAL ENTREGAS: $ ${moneyEs(totalEntregas)}`, {
      bold: true,
      size: 13,
      height: 26,
      fill: FILL_DOC,
      border: BORDER_THIN,
    });
    row += 1;
    mergeWrite(ws, `A${row}:D${row}`, `SALDO PENDIENTE: $ ${moneyEs(Math.max(0, totalGeneral - totalEntregas))}`, {
      bold: true,
      size: 14,
      height: 28,
      fill: FILL_BRAND,
      border: BORDER_THIN,
    });
    row += 2;
  }

  if (entregas.length > 0) {
    mergeWrite(ws, `A${row}:D${row}`, "DETALLE DE ENTREGAS", {
      bold: true,
      size: 12,
      height: 24,
      fill: FILL_TABLE_HEAD,
      border: BORDER_THICK,
    });
    row += 1;
    const entFirstRow = row;
    for (const e of entregas) {
      const fecha = e.fecha_registro
        ? new Date(e.fecha_registro).toLocaleString("es-AR")
        : "—";
      mergeWrite(ws, `A${row}:C${row}`, fecha, { size: 12, border: BORDER_THIN });
      writeCell(ws, row, 4, moneyEs(Number(e.monto ?? 0)), {
        bold: true,
        size: 12,
        align: "right",
        border: BORDER_THIN,
      });
      ws.getRow(row).height = 24;
      row += 1;
    }
    outlineBlock(ws, entFirstRow, row - 1);
  }

  const lastRow = row - 1;
  setColumnWidths(ws);
  addLogo(wb, ws, logoInput);
  applyPrintSetup(ws, lastRow);
  return wb;
}

export async function workbookToBuffer(wb) {
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}

export function defaultLogoPath() {
  return resolveLogoPath() ?? path.join(process.cwd(), "public", "logo.jpg");
}
