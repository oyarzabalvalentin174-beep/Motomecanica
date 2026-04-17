import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { exec, query } from "@/components/db";

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
          await registerLoginAttempt(null, ip, false);
          await securityLog(null, ip, userAgent, false, "user_not_found");
          throw new Error("Usuario o contraseña incorrectos");
        }

        const storedPassword =
          user.contrasena || user["contraseña"] || user.contraseña || "";
        const passwordOk = storedPassword.startsWith("$2")
          ? await bcrypt.compare(password, storedPassword)
          : password === storedPassword;

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
