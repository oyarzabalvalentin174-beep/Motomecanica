import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pgPromise from "pg-promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const DATABASE_URL = envText.match(/DATABASE_URL=(.+)/)?.[1]?.trim();
const relax = /DATABASE_SSL_REJECT_UNAUTHORIZED=false/.test(envText);

if (!DATABASE_URL) {
  console.error("DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

const pgp = pgPromise({});
const db = pgp({
  connectionString: DATABASE_URL,
  max: 1,
  prepareThreshold: 0,
  ssl: relax ? { rejectUnauthorized: false } : undefined,
});

const sql = readFileSync(join(__dirname, "sp-uso-personal.sql"), "utf8");

try {
  await db.none(sql);
  console.log("OK: tablas y spupsertusopersonal aplicados.");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}

process.exit(0);
