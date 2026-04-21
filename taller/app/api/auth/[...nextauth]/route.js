import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { exec, query } from "@/components/db";

/** true = logs detallados (usuario completo, checks). En Vercel: AUTH_DEBUG=1 */
function isAuthVerbose() {
  return (
    process.env.AUTH_DEBUG === "1" ||
    process.env.AUTH_DEBUG === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

/** Nunca escribe contraseña ni hash. En producción sin AUTH_DEBUG solo loguea authorize_fail. */
function logCredentials(event, payload = {}) {
  const verbose = isAuthVerbose();
  if (!verbose && event !== "authorize_fail") return;
  const { password: _p, storedPasswordPreview: _s, ...rest } = payload;
  console.log(
    `[nextauth][credentials][${event}]`,
    JSON.stringify({ ...rest, ts: new Date().toISOString() }),
  );
}

function getRequestMeta(req) {
  const headers = req?.headers;
  const getHeader = (name) => {
    if (!headers) return undefined;
    if (typeof headers.get === "function") return headers.get(name);
    if (typeof headers[name] === "string") return headers[name];
    if (Array.isArray(headers[name])) return headers[name][0];
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

  // Primary path: keep existing stored procedure behavior.
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

  // Fallback path: direct query prevents auth outages when SP signatures drift.
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
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const username = credentials?.username?.trim();
        const password = credentials?.password || "";
        const { ip, userAgent } = getRequestMeta(req);

        logCredentials("authorize_enter", {
          ...(isAuthVerbose()
            ? { username: username || null }
            : { usernameLength: username?.length ?? 0 }),
          hasUsername: Boolean(username),
          passwordLength: password.length,
          credentialKeys: credentials ? Object.keys(credentials) : [],
          ip,
          userAgentLength: userAgent?.length ?? 0,
        });

        if (!username || !password) {
          logCredentials("authorize_fail", {
            reason: "missing_credentials",
            hasUsername: Boolean(username),
            hasPassword: Boolean(password),
          });
          throw new Error("Usuario y contraseña requeridos");
        }

        if (await checkIPBlocked(ip)) {
          logCredentials("authorize_fail", { reason: "ip_blocked", ip });
          throw new Error("IP temporalmente bloqueada por intentos fallidos");
        }

        if (await checkUserBlocked(username)) {
          logCredentials("authorize_fail", { reason: "user_blocked", ip });
          throw new Error("Usuario bloqueado temporalmente");
        }

        const user = await getUserByUsername(username);
        if (!user) {
          logCredentials("authorize_fail", {
            reason: "user_not_found",
            lookedUpUsernameLen: username.length,
          });
          await registerLoginAttempt(null, ip, false);
          await securityLog(null, ip, userAgent, false, "user_not_found");
          throw new Error("Usuario o contraseña incorrectos");
        }

        logCredentials("user_loaded", {
          id_usuario: user.id_usuario,
          nombreusuarioLen: user.nombreusuario?.length ?? 0,
        });

        const storedPassword =
          user.contrasena || user["contraseña"] || user.contraseña || "";
        const usesBcrypt = Boolean(storedPassword.startsWith("$2"));
        const passwordOk = usesBcrypt
          ? await bcrypt.compare(password, storedPassword)
          : password === storedPassword;

        logCredentials("password_check", {
          id_usuario: user.id_usuario,
          usesBcrypt,
          storedPasswordLength: storedPassword.length,
          passwordOk,
        });

        await registerLoginAttempt(user.id_usuario, ip, passwordOk);

        if (!passwordOk) {
          logCredentials("authorize_fail", {
            reason: "invalid_password",
            id_usuario: user.id_usuario,
            usesBcrypt,
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

        logCredentials("authorize_ok", {
          id_usuario: user.id_usuario,
        });

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

export { handler as GET, handler as POST };
