/**
 * Convierte valores de dinero que pueden venir de Postgres/JSON/inputs AR o US
 * a un number en pesos (no centavos).
 *
 * Casos:
 * - number 32554.5
 * - "32554.50" (decimal con punto)
 * - "32554,50" (decimal con coma)
 * - "32.554,50" (miles con punto + decimal con coma)
 * - "32.554" con exactamente 3 decimales tras un solo punto → miles AR (32554)
 */
export function coerceMoney(raw) {
  if (raw == null || raw === "") return 0;

  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return 0;
    return Math.round(raw * 100) / 100;
  }

  let s = String(raw).trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!s) return 0;

  // Formato AR con coma decimal: 1.250,50 o 1250,50
  if (s.includes(",")) {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  const dotCount = (s.match(/\./g) || []).length;

  // Varios puntos sin coma → separadores de miles: 1.234.567
  if (dotCount > 1) {
    const n = Number(s.replace(/\./g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  // Un solo punto
  if (dotCount === 1) {
    const m = s.match(/^(\d+)\.(\d+)$/);
    if (m) {
      const decimals = m[2];
      // Exactamente 3 dígitos tras el punto y la parte entera es chica → miles AR (32.554)
      // No confundir con decimales reales tipo 32554.500 (3 decimales de precisión)
      if (decimals.length === 3 && m[1].length <= 3) {
        const n = Number(m[1] + decimals);
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
      }
    }
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  const n = Number(s.replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Solo precio de venta lista/tarjeta de un producto de stock. */
export function precioVentaTarjetaFromProduct(product) {
  if (!product || typeof product !== "object") return 0;
  const raw =
    product.precio_venta ??
    product.precioVenta ??
    product.PrecioVenta ??
    product.PRECIO_VENTA ??
    null;
  return coerceMoney(raw);
}

/** Para inputs de presupuesto: 32554,50 (coma decimal, sin miles). */
export function formatPrecioUnitarioInput(n) {
  const x = coerceMoney(n);
  if (x < 0) return "0,00";
  return x.toFixed(2).replace(".", ",");
}
