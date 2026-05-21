export function moneyEs(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0,00";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function safeFileName(name, fallback = "archivo") {
  const s = String(name ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 50);
  return s || fallback;
}

export const EXCEL_BORDER_THICK = {
  top: { style: "medium" },
  left: { style: "medium" },
  bottom: { style: "medium" },
  right: { style: "medium" },
};

export const EXCEL_BORDER_THIN = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
