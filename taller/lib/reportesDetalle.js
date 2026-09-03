import { exec } from "@/components/db";
import { normalizeSpList } from "@/lib/execHelpers";

function requireSpOk(raw, fallbackMsg) {
  if (raw?.status === "error") throw new Error(raw.message || fallbackMsg);
  return raw;
}

function sumVentas(ventas, extra = {}) {
  return ventas.reduce(
    (acc, v) => {
      acc.unidades += Number(v.cantidad ?? 0);
      acc.total += Number(v.subtotal_linea ?? 0);
      acc.ganancia += Number(v.ganancia_linea ?? 0);
      return acc;
    },
    { unidades: 0, total: 0, ganancia: 0, operaciones: ventas.length, ...extra },
  );
}

export async function buscarProductos(q) {
  const term = String(q ?? "").trim();
  if (term.length < 1) return [];
  const raw = await exec("spbuscarproductos", { termino: term, limite: 20 });
  requireSpOk(raw, "Error al buscar productos");
  return normalizeSpList(raw);
}

export async function buscarMarcas(q) {
  const term = String(q ?? "").trim();
  if (term.length < 1) return [];
  const raw = await exec("spbuscarmarcas", { termino: term });
  requireSpOk(raw, "Error al buscar marcas");
  return normalizeSpList(raw);
}

export async function fetchReporteProducto(idProducto, range) {
  const { desde, hasta } = range;
  const raw = await exec("spgetreporteproducto", {
    id_producto: Number(idProducto),
    desde,
    hasta,
  });
  requireSpOk(raw, "Producto no encontrado");
  if (!raw?.producto) return null;
  const ventas = Array.isArray(raw.ventas) ? raw.ventas : [];
  return { producto: raw.producto, ventas, totales: sumVentas(ventas) };
}

export async function fetchReporteMarca(idMarca, range) {
  const { desde, hasta } = range;
  const raw = await exec("spgetreportemarca", {
    id_marca: Number(idMarca),
    desde,
    hasta,
  });
  requireSpOk(raw, "Marca no encontrada");
  if (!raw?.marca) return null;
  const productos = Array.isArray(raw.productos) ? raw.productos : [];
  const ventas = Array.isArray(raw.ventas) ? raw.ventas : [];
  const stockTotal = productos.reduce((s, p) => s + Number(p.stock ?? 0), 0);
  return {
    marca: raw.marca,
    productos,
    ventas,
    totales: sumVentas(ventas, { productos: productos.length, stockTotal }),
  };
}
