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

const cols = await db.any(
  `select column_name, data_type from information_schema.columns
   where table_schema='app' and table_name='presupuesto' order by ordinal_position`,
);
console.log("columns:", cols.map((c) => `${c.column_name}(${c.data_type})`).join(", "));

const spDef = await db.oneOrNone(
  `select pg_get_functiondef(p.oid) as def
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'spupsertpresupuesto'`,
);
if (spDef?.def) {
  const { writeFileSync } = await import("fs");
  writeFileSync("scripts/spupsertpresupuesto-full.sql", spDef.def, "utf8");
  console.log("wrote scripts/spupsertpresupuesto-full.sql", spDef.def.length, "chars");
}

const spGet = await db.oneOrNone(
  `select pg_get_functiondef(p.oid) as def
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'spgetpresupuesto'`,
);
if (spGet?.def) {
  console.log("\n--- spgetpresupuesto ---\n");
  console.log(spGet.def);
}

process.exit(0);
