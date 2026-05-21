import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  fetchMarcaDetalle,
  fetchMarcasResumen,
  fetchPresupuestoDetalle,
  fetchPresupuestosLista,
  fetchProductoResumen,
  fetchVentasAgrupadas,
  resolveRange,
} from "@/lib/reportesData";
import { fetchReporteMarca, fetchReporteProducto } from "@/lib/reportesDetalle";
import {
  buildPresupuestoWorkbook,
  loadLogoAsset,
  workbookToBuffer,
} from "@/lib/presupuestoExcel";
import { EXCEL_BORDER_THICK, EXCEL_BORDER_THIN, moneyEs, safeFileName } from "@/lib/excelFormat";

const FILL_HEAD = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4D4D8" } };

function outlineTable(ws, r1, r2, colCount) {
  for (let c = 1; c <= colCount; c++) {
    const top = ws.getCell(r1, c);
    const bot = ws.getCell(r2, c);
    top.border = { ...top.border, top: EXCEL_BORDER_THICK.top };
    bot.border = { ...bot.border, bottom: EXCEL_BORDER_THICK.bottom };
  }
  for (let r = r1; r <= r2; r++) {
    const left = ws.getCell(r, 1);
    const right = ws.getCell(r, colCount);
    left.border = { ...left.border, left: EXCEL_BORDER_THICK.left };
    right.border = { ...right.border, right: EXCEL_BORDER_THICK.right };
  }
}

/** Tabla simple: encabezado gris, bordes y marco exterior. */
function addSheetFromRows(wb, name, headers, rows, { moneyCols = [] } = {}) {
  const ws = wb.addWorksheet(name.slice(0, 31));
  const colCount = headers.length;

  headers.forEach((h, i) => {
    const c = ws.getCell(1, i + 1);
    c.value = h;
    c.font = { name: "Arial", bold: true, size: 11 };
    c.fill = FILL_HEAD;
    c.border = EXCEL_BORDER_THIN;
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.getRow(1).height = 22;

  let row = 2;
  for (const dataRow of rows) {
    dataRow.forEach((val, i) => {
      const c = ws.getCell(row, i + 1);
      const isMoney = moneyCols.includes(i);
      const num = Number(val);
      if (isMoney) c.value = moneyEs(num);
      else c.value = val ?? "";
      c.font = { name: "Arial", size: 11 };
      c.border = EXCEL_BORDER_THIN;
      c.alignment = {
        vertical: "middle",
        horizontal: isMoney || (typeof val === "number" && Number.isFinite(num)) ? "right" : "left",
      };
    });
    ws.getRow(row).height = 20;
    row += 1;
  }

  if (row > 2) outlineTable(ws, 1, row - 1, colCount);

  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = Math.min(Math.max(String(h).length + 5, 12), 40);
  });
  return ws;
}

export async function exportPresupuestosZip() {
  const lista = await fetchPresupuestosLista();
  const zip = new JSZip();
  const folder = zip.folder("presupuesto");
  const logo = loadLogoAsset();

  let generados = 0;
  for (const item of lista) {
    const id = Number(item.id);
    if (!id) continue;
    try {
      const det = await fetchPresupuestoDetalle(id);
      if (!det) continue;
      const wb = await buildPresupuestoWorkbook(det, logo);
      const buf = await workbookToBuffer(wb);
      const fname = `${safeFileName(det.nombre_persona, "cliente")}_${id}.xlsx`;
      folder.file(fname, buf);
      generados += 1;
    } catch (err) {
      folder.file(
        `_error_${id}.txt`,
        `No se pudo generar presupuesto #${id}: ${err?.message || err}`,
      );
    }
  }

  if (generados === 0) {
    folder.file(
      "LEEME.txt",
      lista.length === 0
        ? "No hay presupuestos guardados en el sistema."
        : `Hay ${lista.length} presupuesto(s) en la lista pero no se pudo generar ningún Excel. Revisá los archivos _error_*.txt si existen.`,
    );
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function exportVentasExcel(agrupacion, range) {
  const rows = await fetchVentasAgrupadas(agrupacion, range);
  const wb = new ExcelJS.Workbook();
  addSheetFromRows(
    wb,
    agrupacion === "semana" ? "Por dia semana" : "Por mes",
    ["Período", "Cant. ventas", "Subtotal", "Total facturado"],
    rows.map((r) => [
      r.periodo,
      Number(r.cantidad_ventas ?? 0),
      Number(r.subtotal ?? 0),
      Number(r.total_facturado ?? 0),
    ]),
  );
  return workbookToBuffer(wb);
}

export async function exportMarcasExcel(range) {
  const rows = await fetchMarcasResumen(range);
  const wb = new ExcelJS.Workbook();
  addSheetFromRows(
    wb,
    "Marcas",
    ["Marca", "Productos activos", "Unidades stock", "Unidades vendidas", "Total venta", "Costo", "Ganancia"],
    rows.map((r) => [
      r.marca,
      Number(r.productos_activos ?? 0),
      Number(r.unidades_stock ?? 0),
      Number(r.unidades_vendidas ?? 0),
      Number(r.total_venta ?? 0),
      Number(r.costo ?? 0),
      Number(r.ganancia ?? 0),
    ]),
  );
  return workbookToBuffer(wb);
}

export async function exportProductoExcel(range, idProducto) {
  if (idProducto) {
    const data = await fetchReporteProducto(idProducto, range);
    if (!data) throw new Error("Producto no encontrado");
    const wb = new ExcelJS.Workbook();
    const p = data.producto;
    addSheetFromRows(wb, "Ficha", ["Campo", "Valor"], [
      ["Código", p.codigo ?? ""],
      ["Producto", p.nombre],
      ["Marca", p.marca ?? ""],
      ["Stock", Number(p.stock ?? 0)],
      ["P. compra", moneyEs(p.precio_compra)],
      ["P. venta", moneyEs(p.precio_venta)],
      ["Unidades vendidas", data.totales.unidades],
      ["Total vendido", moneyEs(data.totales.total)],
      ["Ganancia", moneyEs(data.totales.ganancia)],
    ]);
    addSheetFromRows(
      wb,
      "Ventas",
      ["Venta", "Fecha", "Método", "Cant.", "P. unit.", "Subtotal", "Ganancia"],
      data.ventas.map((v) => [
        v.id_venta,
        v.fecha ? new Date(v.fecha).toLocaleString("es-AR") : "",
        v.metodo_pago ?? "",
        Number(v.cantidad ?? 0),
        Number(v.precio_unitario ?? 0),
        Number(v.subtotal_linea ?? 0),
        Number(v.ganancia_linea ?? 0),
      ]),
      { moneyCols: [4, 5, 6] },
    );
    return workbookToBuffer(wb);
  }

  const rows = await fetchProductoResumen(range);
  const wb = new ExcelJS.Workbook();
  addSheetFromRows(
    wb,
    "Productos",
    ["Código", "Producto", "Marca", "Veces", "Unidades", "Total", "Ganancia"],
    rows.map((r) => [
      r.codigo ?? "",
      r.producto,
      r.marca ?? "",
      Number(r.veces_vendido ?? 0),
      Number(r.unidades ?? 0),
      Number(r.total_venta ?? 0),
      Number(r.ganancia ?? 0),
    ]),
    { moneyCols: [5, 6] },
  );
  return workbookToBuffer(wb);
}

export async function exportMarcaExcel(range, idMarca) {
  if (idMarca) {
    const data = await fetchReporteMarca(idMarca, range);
    if (!data) throw new Error("Marca no encontrada");
    const wb = new ExcelJS.Workbook();
    addSheetFromRows(wb, "Resumen", ["Campo", "Valor"], [
      ["Marca", data.marca.nombre],
      ["Productos en catálogo", data.totales.productos],
      ["Stock total (u.)", data.totales.stockTotal],
      ["Unidades vendidas", data.totales.unidades],
      ["Total vendido", moneyEs(data.totales.total)],
      ["Ganancia", moneyEs(data.totales.ganancia)],
    ]);
    addSheetFromRows(
      wb,
      "Productos",
      ["Código", "Producto", "Stock", "Vendidas"],
      data.productos.map((p) => [
        p.codigo ?? "",
        p.nombre,
        Number(p.stock ?? 0),
        Number(p.unidades_vendidas ?? 0),
      ]),
    );
    addSheetFromRows(
      wb,
      "Ventas",
      ["Venta", "Fecha", "Producto", "Cant.", "Subtotal", "Ganancia"],
      data.ventas.map((v) => [
        v.id_venta,
        v.fecha ? new Date(v.fecha).toLocaleString("es-AR") : "",
        v.producto,
        Number(v.cantidad ?? 0),
        Number(v.subtotal_linea ?? 0),
        Number(v.ganancia_linea ?? 0),
      ]),
      { moneyCols: [4, 5] },
    );
    return workbookToBuffer(wb);
  }

  const rows = await fetchMarcaDetalle(range);
  const wb = new ExcelJS.Workbook();
  addSheetFromRows(
    wb,
    "Por marca",
    ["Marca", "Productos", "Stock", "Vendidas", "Total", "Ganancia"],
    rows.map((r) => [
      r.marca,
      Number(r.productos_activos ?? 0),
      Number(r.unidades_stock ?? 0),
      Number(r.unidades_vendidas ?? 0),
      Number(r.total_venta ?? 0),
      Number(r.ganancia ?? 0),
    ]),
    { moneyCols: [4, 5] },
  );
  return workbookToBuffer(wb);
}

export async function getReportePreview(tipo, params) {
  const range = resolveRange(params);

  switch (tipo) {
    case "presupuesto": {
      const lista = await fetchPresupuestosLista();
      return {
        columns: ["ID", "Cliente", "Última actualización"],
        rows: lista.map((p) => [
          p.id,
          String(p.nombre_persona ?? "—"),
          p.fecha_actualizacion
            ? new Date(p.fecha_actualizacion).toLocaleString("es-AR", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "—",
        ]),
        meta: { total: lista.length, hint: "Exportar genera carpeta presupuesto/ con un Excel por cliente." },
      };
    }
    case "ventas": {
      const agrupacion = params.agrupacion === "semana" ? "semana" : "mes";
      const rows = await fetchVentasAgrupadas(agrupacion, range);
      return {
        columns: ["Período", "Ventas", "Subtotal", "Total"],
        rows: rows.map((r) => [
          r.periodo,
          r.cantidad_ventas,
          `$${moneyEs(r.subtotal)}`,
          `$${moneyEs(r.total_facturado)}`,
        ]),
        meta: { desde: range.desde, hasta: range.hasta, agrupacion },
      };
    }
    case "marcas": {
      const rows = await fetchMarcasResumen(range);
      return {
        columns: ["Marca", "Productos", "Vendidas", "Total", "Ganancia"],
        rows: rows.map((r) => [
          r.marca,
          r.productos_activos,
          r.unidades_vendidas,
          `$${moneyEs(r.total_venta)}`,
          `$${moneyEs(r.ganancia)}`,
        ]),
        meta: { desde: range.desde, hasta: range.hasta },
      };
    }
    case "producto": {
      if (params.id_producto) {
        const data = await fetchReporteProducto(Number(params.id_producto), range);
        if (!data) throw new Error("Producto no encontrado");
        const p = data.producto;
        return {
          mode: "detalle",
          ficha: {
            codigo: p.codigo,
            nombre: p.nombre,
            marca: p.marca,
            stock: p.stock,
            precio_compra: p.precio_compra,
            precio_venta: p.precio_venta,
            stock_minimo: p.stock_minimo,
          },
          totales: data.totales,
          ventas: data.ventas.map((v) => ({
            id_venta: v.id_venta,
            fecha: v.fecha ? new Date(v.fecha).toLocaleString("es-AR") : "—",
            metodo: v.metodo_pago ?? "—",
            cantidad: v.cantidad,
            precio_unitario: v.precio_unitario,
            subtotal: v.subtotal_linea,
            ganancia: v.ganancia_linea,
          })),
          meta: { desde: range.desde, hasta: range.hasta },
        };
      }
      return {
        mode: "lista",
        pickHint: "Buscá un producto por código o nombre para ver todas sus ventas.",
        columns: [],
        rows: [],
        meta: { desde: range.desde, hasta: range.hasta },
      };
    }
    case "marca": {
      if (params.id_marca) {
        const data = await fetchReporteMarca(Number(params.id_marca), range);
        if (!data) throw new Error("Marca no encontrada");
        return {
          mode: "detalle",
          ficha: { nombre: data.marca.nombre },
          totales: data.totales,
          productos: data.productos.map((p) => ({
            codigo: p.codigo,
            nombre: p.nombre,
            stock: p.stock,
            vendidas: p.unidades_vendidas,
          })),
          ventas: data.ventas.map((v) => ({
            id_venta: v.id_venta,
            fecha: v.fecha ? new Date(v.fecha).toLocaleString("es-AR") : "—",
            producto: v.producto,
            codigo: v.codigo,
            cantidad: v.cantidad,
            subtotal: v.subtotal_linea,
            ganancia: v.ganancia_linea,
          })),
          meta: { desde: range.desde, hasta: range.hasta },
        };
      }
      return {
        mode: "lista",
        pickHint: "Buscá una marca por nombre para ver ventas y productos.",
        columns: [],
        rows: [],
        meta: { desde: range.desde, hasta: range.hasta },
      };
    }
    default:
      throw new Error("Tipo de reporte no válido");
  }
}

export async function exportReporte(tipo, params) {
  const range = resolveRange(params);

  switch (tipo) {
    case "presupuesto":
      return {
        buffer: await exportPresupuestosZip(),
        filename: "presupuestos.zip",
        contentType: "application/zip",
      };
    case "ventas":
      return {
        buffer: await exportVentasExcel(params.agrupacion === "semana" ? "semana" : "mes", range),
        filename: `ventas_${params.agrupacion || "mes"}_${range.desde}_${range.hasta}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    case "marcas":
      return {
        buffer: await exportMarcasExcel(range),
        filename: `marcas_${range.desde}_${range.hasta}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    case "producto": {
      const id = params.id_producto ? Number(params.id_producto) : null;
      const buf = await exportProductoExcel(range, id);
      return {
        buffer: buf,
        filename: id
          ? `producto_${id}_${range.desde}_${range.hasta}.xlsx`
          : `productos_${range.desde}_${range.hasta}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }
    case "marca": {
      const id = params.id_marca ? Number(params.id_marca) : null;
      const buf = await exportMarcaExcel(range, id);
      return {
        buffer: buf,
        filename: id
          ? `marca_${id}_${range.desde}_${range.hasta}.xlsx`
          : `marcas_${range.desde}_${range.hasta}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }
    default:
      throw new Error("Tipo de reporte no válido");
  }
}
