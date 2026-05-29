/**
 * Lectura flexible de presupuestos en Excel (plantillas variables).
 * Pensado para uso en el cliente (xlsx).
 */

const COL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function colIndexToLetter(idx) {
  if (idx < 0) return "—";
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = COL_LETTERS[r] + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Espacios que Excel usa en formato contable ($ alineado, número a la derecha). */
const EXCEL_SPACE_RE = /[\s\u00a0\u202f\u2007]/g;

/** ¿Parece monto AR tipo «$ 11.900,00» o «11.900,00»? */
export function looksLikeARMoneyString(raw) {
  const s = normalizeMoneyString(raw);
  if (!s || s === "$") return false;
  return (
    /^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(s) ||
    /^\d{1,3}(\.\d{3})+$/.test(s) ||
    /^\$/.test(String(raw ?? "").trim())
  );
}

function normalizeMoneyString(raw) {
  if (raw == null || raw === "") return "";
  return String(raw)
    .trim()
    .replace(EXCEL_SPACE_RE, " ")
    .replace(/^\$+\s*/u, "")
    .replace(EXCEL_SPACE_RE, "");
}

/**
 * Interpreta montos en pesos argentinos: $ 11.900,00 · 11.900,00 · 11900 · 11.9 (mal leído).
 */
export function parseMoneyARValue(raw) {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return fixMisreadThousandsNumber(raw);
  }

  let s = normalizeMoneyString(raw);
  if (!s || s === "$") return 0;

  const negative = /^-/.test(s) || /^\(.*\)$/.test(String(raw).trim());
  s = s.replace(/^\(|\)$/g, "").replace(/^-/, "");

  // 11.900,00 | 214.200,00
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return negative ? -n : n;
  }

  // 11.900 | 214.200 (miles con punto, sin decimales)
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    const n = parseFloat(s.replace(/\./g, ""));
    return negative ? -n : n;
  }

  // 11,900.00
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(s)) {
    const n = parseFloat(s.replace(/,/g, ""));
    return negative ? -n : n;
  }

  // 11900,50
  if (s.includes(",") && !s.includes(".")) {
    const n = parseFloat(s.replace(",", "."));
    return negative ? -n : n;
  }

  // 11.900 mal exportado como "11.9"
  if (/^\d{1,3}\.\d{1,3}$/.test(s)) {
    const n = parseMoneyFromSingleDot(s);
    if (n != null) return negative ? -n : n;
  }

  const plain = parseFloat(s.replace(",", "."));
  if (Number.isFinite(plain)) return negative ? -plain : plain;
  return 0;
}

/** Excel a veces guarda 11.900 como 11.9 (punto = miles en AR, no decimal US). */
function fixMisreadThousandsNumber(n) {
  if (!Number.isFinite(n) || n <= 0) return n;
  if (n >= 100000) return n;

  const str = n.toString();
  if (str.includes(".")) {
    const fixed = parseMoneyFromSingleDot(str);
    if (fixed != null && fixed >= n * 5) return fixed;
  }

  if (n >= 10000) return n;
  return n;
}

function parseMoneyFromSingleDot(s) {
  const m = String(s).match(/^(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const [, intPart, decPart] = m;
  if (decPart.length === 3) {
    return parseInt(intPart, 10) * 1000 + parseInt(decPart, 10);
  }
  if (decPart.length === 1) {
    return parseInt(intPart, 10) * 1000 + parseInt(decPart, 10) * 100;
  }
  if (decPart.length === 2) {
    return parseInt(intPart, 10) * 1000 + parseInt(decPart, 10) * 10;
  }
  return null;
}

export function formatMoneyARForInput(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const AR_MONEY_FORMATS = [
  '"$" #.##0,00',
  '"$"#.##0,00',
  '"$" #,##0.00',
  '#.##0,00',
  '#,##0.00',
  '# ##0,00',
];

/** Valor de celda priorizando texto formateado de Excel ($ 11.900,00). */
function cellValueForImport(cell, XLSX) {
  if (!cell) return "";

  const w = cell.w != null ? String(cell.w).trim() : "";
  if (w && w !== "$") return w;

  if (cell.t === "n" && typeof cell.v === "number" && XLSX?.SSF) {
    const formats = cell.z ? [cell.z, ...AR_MONEY_FORMATS] : AR_MONEY_FORMATS;
    for (const fmt of formats) {
      try {
        const formatted = XLSX.SSF.format(fmt, cell.v);
        if (formatted && String(formatted).trim() && String(formatted).trim() !== "$") {
          return String(formatted).trim();
        }
      } catch {
        /* siguiente */
      }
    }
    if (cell.v >= 100) return formatMoneyARForInput(cell.v);
  }

  if (cell.v != null && cell.v !== "") return cell.v;
  return w;
}

/**
 * Lee el importe de una fila (columna $ + columna monto, o celda «$ 11.900,00»).
 */
export function readMoneyFromRow(row, preferredCol = -1) {
  if (!row?.length) return 0;

  const tryCell = (raw) => {
    const s = cellToString(raw);
    if (!s || s === "$") return 0;
    return parseMoneyARValue(raw);
  };

  if (preferredCol >= 0 && preferredCol < row.length) {
    const cell = row[preferredCol];
    const s = cellToString(cell);
    if (s === "$") {
      if (preferredCol + 1 < row.length) {
        const combined = `$ ${cellToString(row[preferredCol + 1])}`;
        const v = parseMoneyARValue(combined);
        if (v > 0) return v;
      }
    } else {
      const v = tryCell(cell);
      if (v > 0) return v;
      if (preferredCol + 1 < row.length && cellToString(row[preferredCol + 1]) === "$") {
        const v2 = parseMoneyARValue(`$ ${cell}`);
        if (v2 > 0) return v2;
      }
    }
    if (preferredCol + 1 < row.length) {
      const next = tryCell(row[preferredCol + 1]);
      if (next > 0) return next;
    }
    if (preferredCol > 0) {
      const prev = tryCell(row[preferredCol - 1]);
      if (prev > 0) return prev;
    }
  }

  let best = 0;
  for (let c = row.length - 1; c >= 0; c--) {
    const s = cellToString(row[c]);
    if (!s || s === "$") continue;
    const v = tryCell(row[c]);
    if (v > best) best = v;
  }
  return best;
}

function sheetToImportGrid(sheet, XLSX) {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const grid = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push(cellValueForImport(sheet[addr], XLSX));
    }
    grid.push(row);
  }
  return grid;
}

function cellToString(raw) {
  if (raw == null) return "";
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toLocaleDateString("es-AR");
  }
  return String(raw).trim();
}

function normalizeKey(s) {
  return cellToString(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function columnMoneyScore(values) {
  let sum = 0;
  let hits = 0;
  for (const v of values) {
    const s = cellToString(v);
    if (!s || s === "$") continue;
    const n = parseMoneyARValue(v);
    if (n >= 100) {
      sum += n;
      hits += 1;
    } else if (looksLikeARMoneyString(v)) {
      hits += 1;
    }
  }
  return { sum, hits };
}

function isMostlyMoneyCol(values) {
  const { sum, hits } = columnMoneyScore(values);
  return hits > 0 && (sum > 0 || hits >= 2);
}

function isMostlyQtyCol(values) {
  let qty = 0;
  let total = 0;
  for (const v of values) {
    const s = cellToString(v);
    if (!s) continue;
    total += 1;
    const n = parseFloat(s.replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n <= 999 && Math.abs(n - Math.round(n)) < 0.001) qty += 1;
  }
  return total > 0 && qty / total >= 0.45;
}

function isMostlyTextCol(values) {
  let text = 0;
  let total = 0;
  for (const v of values) {
    const s = cellToString(v);
    if (!s || s === "$") continue;
    total += 1;
    if (!/^\d+([.,]\d+)?$/.test(s.replace(/\./g, "").replace(",", "."))) text += 1;
  }
  return total > 0 && text / total >= 0.55;
}

function rowLooksLikeTotal(row) {
  const joined = row.map(cellToString).join(" ").toUpperCase();
  return /\bTOTAL\b/.test(joined) && !/\bSUB\s*TOTAL\b/.test(joined);
}

function rowLooksLikeTableHeader(row) {
  const cells = row.map((c) => normalizeKey(c));
  const hasCant = cells.some((c) => /^cant/.test(c) || c === "cant.");
  const hasDesc = cells.some((c) => /descrip/.test(c) || c === "item" || c === "concepto");
  const hasPrice = cells.some((c) => /precio|importe|monto|valor/.test(c));
  return hasCant && (hasDesc || hasPrice);
}

function extractClienteFromRow(row) {
  const joined = row.map(cellToString).join(" ");
  const m = joined.match(/cliente\s*:?\s*(.+)/i);
  if (m) return m[1].trim();
  return "";
}

function extractKmFromGrid(grid, maxRow = 12) {
  for (let r = 0; r < Math.min(maxRow, grid.length); r++) {
    for (const cell of grid[r] || []) {
      const s = cellToString(cell);
      const kmLabel = s.match(/km\s*:?\s*([\d.,]+)/i);
      if (kmLabel) return kmLabel[1].replace(/\./g, "").replace(",", ".");
      if (/^k\s*\d{3,6}$/i.test(s.replace(/\s/g, ""))) {
        return s.replace(/^k/i, "").replace(/\D/g, "");
      }
      if (/^\d{4,7}$/.test(s.replace(/\./g, "")) && r > 2) {
        const prev = normalizeKey((grid[r - 1] || []).join(" "));
        if (prev.includes("km") || prev.includes("kilomet")) return s.replace(/\./g, "");
      }
    }
  }
  return "";
}

function extractVehiculoFromGrid(grid, maxRow = 12) {
  for (let r = 0; r < Math.min(maxRow, grid.length); r++) {
    const joined = (grid[r] || []).map(cellToString).join(" ");
    const m = joined.match(/veh[ií]culo\s*:?\s*(.+)/i);
    if (m) return m[1].trim();
  }
  return "";
}

function extractClienteFromGrid(grid, maxRow = 15) {
  for (let r = 0; r < Math.min(maxRow, grid.length); r++) {
    const name = extractClienteFromRow(grid[r] || []);
    if (name) return name;
  }
  return "";
}

function maxCols(grid) {
  return grid.reduce((m, row) => Math.max(m, (row || []).length), 0);
}

function padGrid(grid) {
  const cols = maxCols(grid);
  return grid.map((row) => {
    const r = [...(row || [])];
    while (r.length < cols) r.push("");
    return r.map((cell) => {
      if (typeof cell === "number" && Number.isFinite(cell)) return cell;
      return cellToString(cell);
    });
  });
}

function detectMappingFromHeaderRow(row) {
  const cols = row.length;
  let qtyCol = -1;
  let descCol = -1;
  let priceCol = -1;
  for (let c = 0; c < cols; c++) {
    const k = normalizeKey(row[c]);
    if (qtyCol < 0 && (/^cant/.test(k) || k === "cant")) qtyCol = c;
    if (descCol < 0 && (/descrip|concepto|item|detalle|producto/.test(k))) descCol = c;
    if (priceCol < 0 && (/precio|importe|monto|valor|subtotal/.test(k))) priceCol = c;
  }
  if (descCol >= 0 && priceCol >= 0) return { qtyCol, descCol, priceCol };
  return null;
}

function scoreColumnMapping(grid, startRow, endRow) {
  const cols = maxCols(grid);
  const sample = [];
  for (let r = startRow; r <= endRow && sample.length < 20; r++) {
    const row = grid[r] || [];
    if (rowLooksLikeTotal(row)) continue;
    const hasText = row.some((c) => cellToString(c).length > 2);
    const hasMoney = row.some((c) => parseMoneyARValue(c) > 0);
    if (hasText || hasMoney) sample.push(row);
  }
  if (!sample.length) return { qtyCol: 0, descCol: 1, priceCol: 3 };

  const colValues = Array.from({ length: cols }, (_, c) =>
    sample.map((row) => row[c] ?? ""),
  );

  let qtyCol = -1;
  let descCol = -1;
  let priceCol = -1;

  let bestMoneyCol = -1;
  let bestMoneySum = 0;
  for (let c = 0; c < cols; c++) {
    const vals = colValues[c];
    if (vals.every((v) => cellToString(v) === "$" || !cellToString(v))) continue;
    const { sum, hits } = columnMoneyScore(vals);
    if (hits > 0 && sum >= bestMoneySum) {
      bestMoneySum = sum;
      bestMoneyCol = c;
    }
    if (priceCol < 0 && isMostlyMoneyCol(vals)) priceCol = c;
  }
  if (bestMoneyCol >= 0) priceCol = bestMoneyCol;
  for (let c = 0; c < cols; c++) {
    if (c === priceCol) continue;
    const vals = colValues[c];
    if (descCol < 0 && isMostlyTextCol(vals)) descCol = c;
  }
  for (let c = 0; c < cols; c++) {
    if (c === priceCol || c === descCol) continue;
    const vals = colValues[c];
    if (qtyCol < 0 && isMostlyQtyCol(vals)) qtyCol = c;
  }

  if (descCol < 0) {
    let bestLen = 0;
    for (let c = 0; c < cols; c++) {
      if (c === priceCol) continue;
      const avg =
        colValues[c].reduce((a, v) => a + cellToString(v).length, 0) /
        Math.max(1, colValues[c].filter((v) => cellToString(v)).length);
      if (avg > bestLen) {
        bestLen = avg;
        descCol = c;
      }
    }
  }
  if (priceCol < 0) {
    for (let c = cols - 1; c >= 0; c--) {
      if (c === descCol) continue;
      if (isMostlyMoneyCol(colValues[c])) {
        priceCol = c;
        break;
      }
    }
  }
  if (priceCol < 0 && cols >= 4) priceCol = cols - 1;
  if (descCol < 0) descCol = priceCol > 1 ? 1 : 0;
  if (qtyCol < 0) qtyCol = descCol > 0 ? 0 : -1;

  return { qtyCol, descCol, priceCol };
}

function findTableBounds(grid) {
  let headerRow = -1;
  let dataStart = -1;
  let dataEnd = grid.length - 1;

  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    if (rowLooksLikeTableHeader(grid[r] || [])) {
      headerRow = r;
      dataStart = r + 1;
      break;
    }
  }

  if (dataStart < 0) {
    for (let r = 0; r < Math.min(grid.length, 35); r++) {
      const row = grid[r] || [];
      const moneyCols = row.filter((c) => parseMoneyARValue(c) > 500).length;
      const textCols = row.filter((c) => cellToString(c).length > 4).length;
      if (moneyCols >= 1 && textCols >= 1) {
        dataStart = r;
        break;
      }
    }
  }

  if (dataStart < 0) dataStart = 0;

  for (let r = dataStart; r < grid.length; r++) {
    if (rowLooksLikeTotal(grid[r] || [])) {
      dataEnd = r - 1;
      break;
    }
  }

  return { headerRow, dataStart, dataEnd };
}

function parseQtyCell(raw) {
  const s = cellToString(raw);
  if (!s) return 1;
  const n = parseFloat(s.replace(",", "."));
  if (Number.isFinite(n) && n > 0) return n;
  return 1;
}

/**
 * @param {unknown[][]} grid
 * @param {{ qtyCol: number, descCol: number, priceCol: number, dataStart: number, dataEnd: number, priceIsLineTotal?: boolean }} opts
 */
export function parseLineasFromGrid(grid, opts) {
  const {
    qtyCol,
    descCol,
    priceCol,
    dataStart,
    dataEnd,
    priceIsLineTotal = true,
  } = opts;
  const lineas = [];
  const warnings = [];

  for (let r = dataStart; r <= dataEnd; r++) {
    const row = grid[r] || [];
    if (rowLooksLikeTotal(row)) continue;

    let parametro = cellToString(row[descCol]);
    const monto = readMoneyFromRow(row, priceCol);
    const qtyRaw = qtyCol >= 0 ? row[qtyCol] : "";
    const qty = parseQtyCell(qtyRaw);

    if (!parametro && monto <= 0) continue;
    if (/^total\b/i.test(parametro)) continue;
    if (parametro === "$" || parametro === "—") continue;

    let cantidadOut = String(qty);
    let precio_unitario = monto;

    // En plantillas AR la columna precio suele ser el importe de la línea ($ 72.600,00), no unitario.
    if (priceIsLineTotal && qty > 1 && monto > 0) {
      parametro = `${qty} × ${parametro}`.trim();
      cantidadOut = "1";
    }

    if (!parametro && monto > 0) {
      warnings.push(`Fila ${r + 1}: monto sin descripción, se omitió.`);
      continue;
    }

    lineas.push({
      rowIndex: r,
      parametro,
      cantidad: cantidadOut,
      precio_unitario: formatMoneyARForInput(precio_unitario),
      subtotalExcel: monto,
      include: true,
    });
  }

  return { lineas, warnings };
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer
 * @param {(mod: object) => object} loadXlsx - import dinámico de 'xlsx'
 */
export function parsePresupuestoExcelBuffer(buffer, loadXlsx) {
  const XLSX = loadXlsx;
  const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const wb = XLSX.read(data, {
    type: "array",
    cellDates: true,
    cellNF: true,
    cellText: true,
  });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { ok: false, error: "El archivo no tiene hojas." };
  }
  const sheet = wb.Sheets[sheetName];
  const rawGrid = sheetToImportGrid(sheet, XLSX);
  const grid = padGrid(rawGrid);

  const nombrePersona = extractClienteFromGrid(grid);
  const km = extractKmFromGrid(grid);
  const datosVehiculo = extractVehiculoFromGrid(grid);

  const { headerRow, dataStart, dataEnd } = findTableBounds(grid);
  let mapping =
    headerRow >= 0 ? detectMappingFromHeaderRow(grid[headerRow]) : null;
  if (!mapping) {
    mapping = scoreColumnMapping(grid, dataStart, dataEnd);
  }

  const { lineas, warnings } = parseLineasFromGrid(grid, {
    ...mapping,
    dataStart,
    dataEnd,
    priceIsLineTotal: true,
  });

  let excelTotal = 0;
  for (let r = dataEnd + 1; r < Math.min(grid.length, dataEnd + 5); r++) {
    if (rowLooksLikeTotal(grid[r] || [])) {
      const row = grid[r];
      excelTotal = readMoneyFromRow(row, mapping.priceCol);
      if (excelTotal <= 0) {
        for (let c = 0; c < row.length; c++) {
          const v = readMoneyFromRow(row, c);
          if (v > excelTotal) excelTotal = v;
        }
      }
      break;
    }
  }

  const sumLineas = lineas.reduce(
    (s, l) => s + parseMoneyARValue(l.subtotalExcel),
    0,
  );
  if (excelTotal > 0 && lineas.length > 0) {
    const diff = Math.abs(sumLineas - excelTotal);
    if (diff > 1) {
      warnings.push(
        `La suma de líneas ($${sumLineas.toLocaleString("es-AR")}) no coincide con el TOTAL del Excel ($${excelTotal.toLocaleString("es-AR")}). Revisá filas o columnas.`,
      );
    }
  }

  const colCount = maxCols(grid);
  const columnOptions = Array.from({ length: colCount }, (_, i) => ({
    index: i,
    letter: colIndexToLetter(i),
  }));

  return {
    ok: true,
    sheetName,
    grid,
    header: {
      nombrePersona,
      km,
      datosVehiculo,
    },
    mapping: {
      ...mapping,
      headerRow,
      dataStart,
      dataEnd,
      priceIsLineTotal: true,
    },
    lineas,
    warnings,
    excelTotal,
    columnOptions,
  };
}

export async function parsePresupuestoExcelFile(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  return parsePresupuestoExcelBuffer(buffer, XLSX);
}
