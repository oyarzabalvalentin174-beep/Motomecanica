import { readFileSync } from "fs";
import pgPromise from "pg-promise";

const envText = readFileSync(".env.local", "utf8");
const DATABASE_URL = envText.match(/DATABASE_URL=(.+)/)?.[1]?.trim();
const relax = /DATABASE_SSL_REJECT_UNAUTHORIZED=false/.test(envText);

const pgp = pgPromise({});
const db = pgp({
  connectionString: DATABASE_URL,
  max: 1,
  prepareThreshold: 0,
  ssl: relax ? { rejectUnauthorized: false } : undefined,
});

async function exec(sp, par = {}) {
  const parts = Object.entries(par)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (typeof v === "number") return `p${k} := ${v}`;
      return `p${k} := '${String(v).replace(/'/g, "''")}'`;
    });
  const q = parts.length ? `select app.${sp}(${parts.join(", ")});` : `select app.${sp}();`;
  const row = await db.one(q);
  const key = Object.keys(row)[0];
  let payload = row[key];
  if (typeof payload === "string") payload = JSON.parse(payload);
  return payload;
}

try {
  const pres = await exec("spgetpresupuestos");
  console.log("spgetpresupuestos keys:", pres && Object.keys(pres));
  console.log("data length:", Array.isArray(pres?.data) ? pres.data.length : "not array");
  if (pres?.data?.[0]) console.log("first item keys:", Object.keys(pres.data[0]));

  const cols = await db.any(
    `select column_name from information_schema.columns
     where table_schema='app' and table_name='producto'
     and column_name like '%marca%'`,
  );
  console.log("producto marca columns:", cols.map((c) => c.column_name));

  const countPres = await db.one("select count(*)::int as n from app.presupuesto");
  console.log("presupuesto count:", countPres.n);

  if (countPres.n > 0) {
    const id = (await db.one("select id from app.presupuesto limit 1")).id;
    const det = await exec("spgetpresupuesto", { presupuesto_id: id });
    console.log("detalle status:", det?.status);
    console.log("detalle keys:", det?.data ? Object.keys(det.data) : Object.keys(det || {}));
  }

  const dvCols = await db.any(
    `select column_name from information_schema.columns
     where table_schema='app' and table_name='detalle_venta'`,
  );
  console.log("detalle_venta:", dvCols.map((c) => c.column_name).join(", "));

  const motul = await db.one("select count(*)::int as n from app.producto where marca_id = $1", [11]);
  console.log("productos Motul (11):", motul.n);
} catch (e) {
  console.error("ERROR:", e.message);
}
process.exit(0);
