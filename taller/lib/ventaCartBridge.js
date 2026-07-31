const STORAGE_KEY = "taller.venta.cart.v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function readVentaCart() {
  if (!canUseStorage()) return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((line) => ({
        id_producto: Number(line?.id_producto),
        nombre: String(line?.nombre ?? "").trim(),
        codigo_barra: line?.codigo_barra ?? "",
        stock: Number(line?.stock ?? 0),
        cantidad: Number(line?.cantidad ?? 0),
        precio_unitario: Number(line?.precio_unitario ?? 0),
      }))
      .filter(
        (l) =>
          Number.isFinite(l.id_producto) &&
          l.id_producto > 0 &&
          Number.isFinite(l.cantidad) &&
          l.cantidad >= 1 &&
          Number.isFinite(l.precio_unitario),
      );
  } catch {
    return [];
  }
}

export function writeVentaCart(lines) {
  if (!canUseStorage()) return;
  try {
    const safe = Array.isArray(lines) ? lines : [];
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // quota / private mode
  }
}

export function clearVentaCart() {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Agrega o suma 1 unidad al carrito persistido (para cruzar Stock → Ventas).
 * Usa siempre precio de lista (precio_venta). No fija método de pago.
 * @returns {{ ok: true, cart: array } | { ok: false, error: string }}
 */
export function addProductToVentaCart(product, delta = 1) {
  const id = Number(product?.id_producto);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "Producto inválido" };
  }

  const stock = Number(product?.stock ?? 0);
  if (stock < 1) {
    return { ok: false, error: "Sin stock para este producto" };
  }

  const nombre = String(product?.nombre ?? "").trim() || `Producto #${id}`;
  const precio = Number(product?.precio_venta ?? 0);
  const add = Math.max(1, Number(delta) || 1);

  const cart = readVentaCart();
  const idx = cart.findIndex((l) => l.id_producto === id);

  if (idx === -1) {
    const cantidad = Math.min(add, stock);
    cart.push({
      id_producto: id,
      nombre,
      codigo_barra: product?.codigo_barra ?? "",
      stock,
      cantidad,
      precio_unitario: precio,
    });
  } else {
    const nextQty = cart[idx].cantidad + add;
    if (nextQty > stock) {
      return { ok: false, error: "Cantidad mayor al stock disponible" };
    }
    cart[idx] = {
      ...cart[idx],
      nombre,
      codigo_barra: product?.codigo_barra ?? cart[idx].codigo_barra,
      stock,
      precio_unitario: precio,
      cantidad: nextQty,
    };
  }

  writeVentaCart(cart);
  return { ok: true, cart };
}
