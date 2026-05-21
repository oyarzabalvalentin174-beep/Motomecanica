/** Normaliza respuestas JSON de SPs (lista). */
export function normalizeSpList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (raw?.status === "success" || raw?.status === "ok") {
    if (Array.isArray(raw.data)) return raw.data;
  }
  return [];
}

/**
 * SP de detalle (ej. spgetpresupuesto) devuelve el objeto en `data` o en la raíz junto a status.
 */
export function unwrapSpEntity(raw, entityKeys = ["id", "nombre_persona"]) {
  if (!raw) return null;
  if (raw.status === "error") {
    throw new Error(raw.message || "Error en la operación");
  }
  if (raw.data != null && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return raw.data;
  }
  const hasEntity = entityKeys.some((k) => raw[k] != null && raw[k] !== "");
  if (hasEntity) {
    const copy = { ...raw };
    delete copy.status;
    delete copy.message;
    return copy;
  }
  return raw.data ?? null;
}
