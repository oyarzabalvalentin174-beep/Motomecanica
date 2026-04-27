import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { exec, query } from "@/components/db";

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
    // SP falló; se intenta consulta directa.
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
       where lower(trim(nombreusuario)) = lower(trim($1))
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
    await exec("spupsertusuario", {
      data: JSON.stringify([{ id_usuario: Number(userId), ultimologin: new Date().toISOString() }]),
      id_usuario: Number(userId),
    });
  } catch {
    // Non-critical side effect.
  }
}

const authDebug =
  process.env.NEXTAUTH_DEBUG === "1" || process.env.NEXTAUTH_DEBUG === "true";

function authLog(...args) {
  if (authDebug) console.log("[next-auth]", ...args);
}

const authOptions = {
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  debug: authDebug,
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
        const username = credentials?.username?.trim();
        const password = credentials?.password || "";
        const { ip, userAgent } = getRequestMeta(authContext);

        if (!username || !password) {
          throw new Error("Usuario y contraseña requeridos");
        }

        if (await checkIPBlocked(ip)) {
          throw new Error("IP temporalmente bloqueada por intentos fallidos");
        }

        if (await checkUserBlocked(username)) {
          throw new Error("Usuario bloqueado temporalmente");
        }

        const user = await getUserByUsername(username);

        if (!user) {
          authLog("USER_NOT_FOUND", { usernameLen: username.length });
          await registerLoginAttempt(null, ip, false);
          await securityLog(null, ip, userAgent, false, "user_not_found");
          throw new Error("Usuario o contraseña incorrectos");
        }

        const storedPassword =
          user?.contrasena || user?.["contraseña"] || user?.contraseña || "";
        const usesBcrypt = Boolean(storedPassword.startsWith("$2"));
        const passwordOk = usesBcrypt
          ? await bcrypt.compare(password, storedPassword)
          : password === storedPassword;

        await registerLoginAttempt(user.id_usuario, ip, passwordOk);

        if (!passwordOk) {
          authLog("BAD_PASSWORD", {
            id_usuario: user.id_usuario,
            usesBcrypt,
            storedLen: storedPassword?.length ?? 0,
          });
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

        return {
          id: String(user.id_usuario),
          id_usuario: user.id_usuario,
          username: user.nombreusuario,
          nombre: user.nombre,
          apellido: user.apellido,
          ultimologin: user.ultimologin || null,
          rol: user.rol || null,
        };
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

export { authOptions };

export async function GET(req, ctx) {
  return handler(req, ctx);
}

export async function POST(req, ctx) {
  return handler(req, ctx);
}
