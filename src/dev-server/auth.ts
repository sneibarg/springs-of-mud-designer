import type { ViteDevServer } from "vite";
import { readMysqlConnectionConfig } from "./databaseSettings";
import { readRequestBody, sendJson } from "./http";
import type { SessionStore } from "./session";
import { toAuthSession } from "./session";
import type { AccountRow, AuthUser, LoginRequest } from "./types";

export function registerAuthRoutes(server: ViteDevServer, sessions: SessionStore) {
  server.middlewares.use("/designer/auth/session", async (request, response) => {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    sendJson(response, 200, toAuthSession(sessions.get(request)));
  });

  server.middlewares.use("/designer/auth/login", async (request, response) => {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    let payload: LoginRequest;

    try {
      payload = JSON.parse(await readRequestBody(request)) as LoginRequest;
    } catch {
      sendJson(response, 400, { error: "Invalid login request." });
      return;
    }

    try {
      const user = await authenticateAccount(payload.username ?? "", payload.password ?? "");

      if (!user) {
        sendJson(response, 401, { error: "Invalid username or password." });
        return;
      }

      sessions.create(response, user);
      sendJson(response, 200, {
        authenticated: true,
        user,
      });
    } catch (error) {
      sendJson(response, 503, {
        error: buildLoginFailureMessage(error),
      });
    }
  });

  server.middlewares.use("/designer/auth/logout", async (request, response) => {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    sessions.clear(request, response);
    sendJson(response, 200, { authenticated: false });
  });
}

async function authenticateAccount(usernameOrEmail: string, password: string): Promise<AuthUser | null> {
  const normalizedUsername = usernameOrEmail.trim();

  if (!normalizedUsername || !password) {
    return null;
  }

  const mysql = await import("mysql2/promise");
  const bcrypt = await import("bcryptjs");
  const connection = await mysql.createConnection(readMysqlConnectionConfig());

  try {
    const [rows] = await connection.execute(
      `
        SELECT a.account_id, a.username, a.email, a.password, r.role_name
        FROM accounts a
        INNER JOIN roles r ON r.role_id = a.role_id
        WHERE a.username = ? OR a.email = ?
        LIMIT 1
      `,
      [normalizedUsername, normalizedUsername],
    );
    const account = (rows as AccountRow[])[0];

    if (!account) {
      return null;
    }

    const passwordMatches = await verifyAccountPassword(password, account.password, bcrypt);

    if (!passwordMatches) {
      return null;
    }

    return {
      id: account.account_id,
      username: account.username,
      email: account.email,
      role: account.role_name,
    };
  } finally {
    await connection.end();
  }
}

async function verifyAccountPassword(
  candidatePassword: string,
  storedPassword: string,
  bcrypt: typeof import("bcryptjs"),
) {
  if (!storedPassword) {
    return false;
  }

  if (storedPassword.startsWith("{bcrypt}")) {
    return bcrypt.compare(candidatePassword, storedPassword.slice("{bcrypt}".length));
  }

  if (/^\$2[aby]\$\d{2}\$/.test(storedPassword)) {
    return bcrypt.compare(candidatePassword, storedPassword);
  }

  return candidatePassword === storedPassword;
}

function buildLoginFailureMessage(error: unknown) {
  if (!isNodeError(error)) {
    return "Login service is unavailable.";
  }

  if (error.code === "ECONNREFUSED") {
    return `MySQL is not accepting connections at ${error.address ?? "127.0.0.1"}:${error.port ?? 3306}.`;
  }

  if (error.code === "ER_ACCESS_DENIED_ERROR") {
    return "MySQL rejected the som_admin credentials.";
  }

  if (error.code === "ER_BAD_DB_ERROR") {
    return "MySQL database som-designer does not exist.";
  }

  if (error.code === "ER_NO_SUCH_TABLE") {
    return "MySQL auth tables are missing in the configured database.";
  }

  return error.message || "Login service is unavailable.";
}

function isNodeError(error: unknown): error is Error & {
  address?: string;
  code?: string;
  port?: number;
} {
  return error instanceof Error;
}
