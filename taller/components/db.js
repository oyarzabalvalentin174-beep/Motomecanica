import pgPromise from "pg-promise";

const pgp = pgPromise({});
let dbInstance;

function getDb() {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  // Supabase pooler (6543 / transaction mode) no soporta prepared statements como Postgres directo.
  dbInstance = pgp({
    connectionString,
    max: 1,
    prepareThreshold: 0,
  });
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
