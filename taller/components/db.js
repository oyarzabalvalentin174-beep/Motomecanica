import pgPromise from "pg-promise";

const GLOBAL_KEY = "__taller_db_singleton__";
const PGP_KEY = "__taller_pgp_singleton__";

function getDb() {
  if (!globalThis[PGP_KEY]) {
    globalThis[PGP_KEY] = pgPromise({});
  }
  if (globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  const relaxSsl =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false" ||
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "0";

  // Supabase pooler (6543 / transaction mode) no soporta prepared statements como Postgres directo.
  const cn = {
    connectionString,
    max: 1,
    prepareThreshold: 0,
  };

  // En algunos entornos (p. ej. Windows) Node falla con "self-signed certificate in certificate chain"
  // hacia el pooler; DATABASE_SSL_REJECT_UNAUTHORIZED=false desactiva esa verificación (sigue TLS cifrado).
  if (relaxSsl) {
    cn.ssl = { rejectUnauthorized: false };
  }

  const dbInstance = globalThis[PGP_KEY](cn);
  globalThis[GLOBAL_KEY] = dbInstance;
  return dbInstance;
}

function parseValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return `${value}`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function procPar(par = {}) {
  const entries = Object.entries(par).filter(([, value]) => value !== undefined);
  return entries.map(([key, value]) => `p${key} := ${parseValue(value)}`).join(", ");
}

function parseDbPayload(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0];
  const firstKey = Object.keys(first)[0];
  const payload = first[firstKey];

  if (typeof payload !== "string") return payload;

  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

export async function exec(sp, par = {}) {
  const db = getDb();
  const namedParams = procPar(par);
  const query = namedParams
    ? `select app.${sp}(${namedParams});`
    : `select app.${sp}();`;

  const raw = await db.query(query);
  return parseDbPayload(raw);
}

export async function query(text, values = []) {
  const db = getDb();
  return db.any(text, values);
}
