import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { exec, query } from "@/components/db";

console.log("🔥 NEXTAUTH FILE LOADED 🔥");

function logCredentials(event, payload = {}) {
  const { password: _p, storedPasswordPreview: _s, ...rest } = payload;
  console.log(
    "[AUTH DEBUG]",
    event,
    JSON.stringify({ ...rest, ts: new Date().toISOString() }),
  );
}

/** App Router: ejecución en Node (pg / bcrypt). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NextAuth pasa a authorize(credentials, authContext) donde authContext es
 * { query, body, headers, method } (no el Request de Next).
 * También soportamos un objeto tipo Headers ( .get ).
 */
function getRequestMeta(authContext) {
  const headers = authContext?.headers;
  if (!headers) {
    return { ip: "0.0.0.0", userAgent: "unknown" };
  }

  const getHeader = (name) => {
    if (typeof headers.get === "function") {
      return headers.get(name);
    }
    const lower = name.toLowerCase();
    const key = Object.keys(headers).find((k) => k.toLowerCase() === lower);
    if (!key) return undefined;
    const v = headers[key];
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v[0];
    return undefined;
  };

  const forwarded = getHeader("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "0.0.0.0";
  const userAgent = getHeader("user-agent") || "unknown";
  return { ip, userAgent };
}

async function checkIPBlocked(ip) {
  try {
    const result = await exec("sp_security_check_ip", { ip });
    return Boolean(result?.blocked || result?.is_blocked);
  } catch {
    try {
      const rows = await query(
        `select count(*)::int as total
         from app.security_log
         where ip = $1
           and success = false
           and created_at > now() - interval '15 minutes'`,
        [ip],
      );
      return (rows?.[0]?.total || 0) >= 5;
    } catch {
      return false;
    }
  }
}

async function getUserByUsername(username) {
  const normalizedUsername = username?.trim();
  if (!normalizedUsername) return null;

  try {
    const result = await exec("spgetusuario", {
      nombreusuario: normalizedUsername,
      includehash: true,
    });
    const userFromSp = result?.data?.[0] || null;
    if (userFromSp) return userFromSp;
  } catch {
    // Fall through to direct query.
  }

  try {
    const rows = await query(
      `select
         id_usuario,
         nombreusuario,
         nombre,
         apellido,
         "contraseña" as contrasena,
         ultimologin,
         null::text as rol
       from app.usuario
       where lower(nombreusuario) = lower($1)
       limit 1`,
      [normalizedUsername],
    );
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

async function checkUserBlocked(username) {
  try {
    const rows = await query(
      `select bloqueado_hasta
       from app.usuario
       where lower(nombreusuario) = lower($1)
       limit 1`,
      [username],
    );
    const blockedUntil = rows?.[0]?.bloqueado_hasta;
    return blockedUntil ? new Date(blockedUntil) > new Date() : false;
  } catch {
    return false;
  }
}

async function registerLoginAttempt(userId, ip, success) {
  try {
    await exec("spregistrarintento", {
      _id_usuario: userId || null,
      _ip: ip,
      _exitoso: success,
    });
  } catch {
    // Non-critical side effect.
  }
}

async function securityLog(userId, ip, userAgent, success, reason = null) {
  try {
    await exec("sp_security_log_insert", {
      _id_usuario: userId || null,
      _ip: ip,
      _user_agent: userAgent,
      _success: success,
      _reason: reason,
    });
  } catch {
    // Non-critical side effect.
  }
}

async function updateLastLogin(userId) {
  try {
    await exec("spupdateusuarios", {
      _id_usuario: userId,
      _ultimologin: new Date(),
    });
  } catch {
    // Non-critical side effect.
  }
}

const authOptions = {
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  debug: process.env.NEXTAUTH_DEBUG === "1" || process.env.NEXTAUTH_DEBUG === "true",
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, authContext) {
        console.log("🔥 AUTHORIZE RUNNING 🔥");
        console.log(
          "CREDENTIALS:",
          process.env.NODE_ENV === "production"
            ? {
                username: credentials?.username,
                password: credentials?.password ? "[REDACTED]" : credentials?.password,
              }
            : credentials,
        );
        console.log("=== AUTHORIZE START ===");
        const username = credentials?.username?.trim();
        const password = credentials?.password || "";
        const { ip, userAgent } = getRequestMeta(authContext);
        logCredentials("authorize_enter", {
          username,
          passwordLength: password?.length,
          ip,
        });

        console.log("=== LOGIN INTENTO ===");
        console.log("USERNAME:", username);
        console.log("PASSWORD LENGTH:", password?.length);
        console.log("REQUEST META:", {
          ip,
          userAgentSnippet: String(userAgent).slice(0, 80),
        });
        console.log("🌍 ENV CHECK:");
        console.log(
          "DATABASE_URL:",
          process.env.DATABASE_URL ? "EXISTS" : "MISSING",
        );
        console.log("NODE_ENV:", process.env.NODE_ENV);

        if (!username || !password) {
          console.log("authorize fail: missing_credentials");
          throw new Error("Usuario y contraseña requeridos");
        }

        if (await checkIPBlocked(ip)) {
          console.log("authorize fail: ip_blocked", { ip });
          throw new Error("IP temporalmente bloqueada por intentos fallidos");
        }

        if (await checkUserBlocked(username)) {
          console.log("authorize fail: user_blocked");
          throw new Error("Usuario bloqueado temporalmente");
        }

        const user = await getUserByUsername(username);
        console.log("👤 USER FROM DB:", user);
        console.log("USER RESULT:", user);

        if (!user) {
          await registerLoginAttempt(null, ip, false);
          await securityLog(null, ip, userAgent, false, "user_not_found");
          throw new Error("Usuario o contraseña incorrectos");
        }

        const storedPassword =
          user?.contrasena || user?.["contraseña"] || user?.contraseña || "";
        console.log(
          "STORED PASSWORD:",
          process.env.NODE_ENV === "production" ? "[REDACTED]" : storedPassword,
        );
        console.log("STORED LENGTH:", storedPassword?.length);
        console.log("IS BCRYPT:", storedPassword?.startsWith("$2"));
        console.log("STORED PASSWORD LENGTH:", storedPassword.length);
        console.log("USES BCRYPT:", storedPassword.startsWith("$2"));
        const usesBcrypt = Boolean(storedPassword.startsWith("$2"));
        const passwordOk = usesBcrypt
          ? await bcrypt.compare(password, storedPassword)
          : password === storedPassword;

        console.log("PASSWORD OK:", passwordOk);

        await registerLoginAttempt(user.id_usuario, ip, passwordOk);

        if (!passwordOk) {
          await securityLog(
            user.id_usuario,
            ip,
            userAgent,
            false,
            "invalid_password",
          );
          throw new Error("Usuario o contraseña incorrectos");
        }

        await securityLog(user.id_usuario, ip, userAgent, true, "login_success");
        await updateLastLogin(user.id_usuario);

        const sessionUser = {
          id: String(user.id_usuario),
          id_usuario: user.id_usuario,
          username: user.nombreusuario,
          nombre: user.nombre,
          apellido: user.apellido,
          ultimologin: user.ultimologin || null,
          rol: user.rol || null,
        };

        console.log("authorize success:", {
          id_usuario: sessionUser.id_usuario,
          username: sessionUser.username,
        });

        return sessionUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id_usuario ?? Number(user.id);
        token.username = user.username;
        token.nombre = user.nombre;
        token.apellido = user.apellido;
        token.rol = user.rol;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id,
        username: token.username,
        nombre: token.nombre,
        apellido: token.apellido,
        rol: token.rol,
      };
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export async function GET(req, ctx) {
  console.log("🔥 NEXTAUTH GET HIT 🔥", req.url);
  return handler(req, ctx);
}

export async function POST(req, ctx) {
  console.log("🔥 NEXTAUTH POST HIT 🔥", req.url);
  return handler(req, ctx);
}
