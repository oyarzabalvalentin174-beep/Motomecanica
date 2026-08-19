import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pgPromise from "pg-promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const sqlPath = path.join(root, "sql", "alter_producto_imagen.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
const parts = sql
  .split(/;\s*(?=(?:ALTER TABLE|COMMENT ON|CREATE OR REPLACE FUNCTION))/i)
  .map((s) => s.replace(/^(\s*--[^\n]*\n)+/g, "").trim())
  .filter(Boolean);

const pgp = pgPromise({});
const relaxSsl =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false" ||
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "0";
const cn = {
  connectionString,
  max: 1,
  prepareThreshold: 0,
};
if (relaxSsl) cn.ssl = { rejectUnauthorized: false };

const db = pgp(cn);

try {
  for (const stmt of parts) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    console.log("Ejecutando:", preview);
    await db.none(stmt.endsWith(";") ? stmt : `${stmt};`);
  }
  console.log("OK: columna imagen en text + SPs actualizados");
} catch (e) {
  console.error("Error:", e?.message || e);
  process.exitCode = 1;
} finally {
  await pgp.end();
}
