import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

type DesignerSettings = {
  apiBaseUrl: string;
  useDevProxy: boolean;
};

type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: string;
};

type AuthSession = {
  authenticated: boolean;
  user?: AuthUser;
};

type StoredSession = {
  user: AuthUser;
  expiresAt: number;
};

type LoginRequest = {
  username?: string;
  password?: string;
};

type AccountRow = {
  account_id: number;
  username: string;
  email: string;
  password: string;
  role_name: string;
};

type MysqlConnectionConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

const defaultDesignerSettings: DesignerSettings = {
  apiBaseUrl: "http://localhost:9080",
  useDevProxy: true,
};

const settingsPath = resolve(process.cwd(), ".designer", "settings.json");
const mysqlRolesPath = resolve(process.cwd(), "resources", "mysql", "create-roles-and-users.sql");
const mysqlSchemaPath = resolve(process.cwd(), "resources", "mysql", "create-som-designer.sql");
const sessionCookieName = "som_designer_session";
const sessionDurationMs = 8 * 60 * 60 * 1000;

export default defineConfig({
  plugins: [react(), designerSettingsPlugin()],
  server: {
    port: 5173,
    strictPort: false,
  },
});

function designerSettingsPlugin(): Plugin {
  const sessions = new Map<string, StoredSession>();

  return {
    name: "som-designer-settings",
    configureServer(server) {
      server.middlewares.use("/designer/auth/session", async (request, response) => {
        if (request.method !== "GET") {
          sendJson(response, 405, { error: "Method not allowed." });
          return;
        }

        sendJson(response, 200, toAuthSession(getAuthenticatedSession(request, sessions)));
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

          const sessionId = randomBytes(32).toString("base64url");
          sessions.set(sessionId, {
            user,
            expiresAt: Date.now() + sessionDurationMs,
          });

          response.setHeader("set-cookie", buildSessionCookie(sessionId));
          sendJson(response, 200, {
            authenticated: true,
            user,
          } satisfies AuthSession);
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

        const sessionId = readSessionId(request);

        if (sessionId) {
          sessions.delete(sessionId);
        }

        response.setHeader("set-cookie", expireSessionCookie());
        sendJson(response, 200, { authenticated: false } satisfies AuthSession);
      });

      server.middlewares.use("/designer/settings", async (request, response) => {
        if (!getAuthenticatedSession(request, sessions)) {
          sendJson(response, 401, { error: "Authentication required." });
          return;
        }

        if (request.method === "GET") {
          sendJson(response, 200, readDesignerSettings());
          return;
        }

        if (request.method === "PUT" || request.method === "POST") {
          try {
            const payload = JSON.parse(await readRequestBody(request)) as Partial<DesignerSettings>;
            const settings = writeDesignerSettings(payload);
            sendJson(response, 200, settings);
          } catch (error) {
            sendJson(response, 400, {
              error: error instanceof Error ? error.message : "Invalid designer settings payload.",
            });
          }
          return;
        }

        sendJson(response, 405, { error: "Method not allowed." });
      });

      server.middlewares.use("/api", async (request, response) => {
        if (!getAuthenticatedSession(request, sessions)) {
          sendJson(response, 401, { error: "Authentication required." });
          return;
        }

        const settings = readDesignerSettings();
        const targetUrl = new URL(`/api${request.url ?? ""}`, settings.apiBaseUrl);

        try {
          const body =
            request.method && ["GET", "HEAD"].includes(request.method)
              ? undefined
              : await readRequestBody(request);
          const proxyResponse = await fetch(targetUrl, {
            method: request.method,
            headers: buildProxyHeaders(request.headers),
            body,
          });

          response.statusCode = proxyResponse.status;
          proxyResponse.headers.forEach((value, key) => {
            response.setHeader(key, value);
          });
          response.setHeader("x-som-designer-target", settings.apiBaseUrl);
          response.end(Buffer.from(await proxyResponse.arrayBuffer()));
        } catch (error) {
          sendJson(response, 502, {
            error: error instanceof Error ? error.message : "API proxy request failed.",
            target: settings.apiBaseUrl,
          });
        }
      });
    },
  };
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

function readMysqlConnectionConfig(): MysqlConnectionConfig {
  return {
    host: process.env.SOM_DESIGNER_DB_HOST || "dragon",
    port: Number(process.env.SOM_DESIGNER_DB_PORT || 3306),
    database: process.env.SOM_DESIGNER_DB_NAME || readMysqlDatabaseName(),
    user: process.env.SOM_DESIGNER_DB_USER || "som_admin",
    password: process.env.SOM_DESIGNER_DB_PASSWORD || readMysqlPassword("som_admin"),
  };
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
    return "MySQL auth tables are missing. Run resources/mysql/create-som-designer.sql.";
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

function readMysqlDatabaseName() {
  try {
    const schemaSql = readFileSync(mysqlSchemaPath, "utf-8");
    return /CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS\s+`([^`]+)`/i.exec(schemaSql)?.[1] ?? "som-designer";
  } catch {
    return "som-designer";
  }
}

function readMysqlPassword(username: string) {
  try {
    const rolesSql = readFileSync(mysqlRolesPath, "utf-8");
    const escapedUsername = escapeRegExp(username);
    const passwordPattern = new RegExp(
      `CREATE\\s+USER\\s+IF\\s+NOT\\s+EXISTS\\s+'${escapedUsername}'@'localhost'\\s+IDENTIFIED\\s+BY\\s+'([^']+)'`,
      "i",
    );

    return passwordPattern.exec(rolesSql)?.[1] ?? "";
  } catch {
    return "";
  }
}

function getAuthenticatedSession(request: IncomingMessage, sessions: Map<string, StoredSession>) {
  const sessionId = readSessionId(request);

  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

function toAuthSession(session: StoredSession | null): AuthSession {
  if (!session) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    user: session.user,
  };
}

function readSessionId(request: IncomingMessage) {
  const cookies = parseCookies(request.headers.cookie ?? "");
  return cookies[sessionCookieName] ?? "";
}

function parseCookies(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, cookie) => {
      const [name, ...valueParts] = cookie.split("=");
      cookies[name] = valueParts.join("=");
      return cookies;
    }, {});
}

function buildSessionCookie(sessionId: string) {
  return `${sessionCookieName}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
    sessionDurationMs / 1000,
  )}`;
}

function expireSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readDesignerSettings(): DesignerSettings {
  try {
    return normalizeDesignerSettings(JSON.parse(readFileSync(settingsPath, "utf-8")));
  } catch {
    return defaultDesignerSettings;
  }
}

function writeDesignerSettings(settings: Partial<DesignerSettings>) {
  const normalizedSettings = normalizeDesignerSettings(settings);
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(normalizedSettings, null, 2)}\n`);
  return normalizedSettings;
}

function normalizeDesignerSettings(settings: Partial<DesignerSettings>): DesignerSettings {
  return {
    apiBaseUrl: normalizeApiBaseUrl(settings.apiBaseUrl ?? "") || defaultDesignerSettings.apiBaseUrl,
    useDevProxy:
      typeof settings.useDevProxy === "boolean"
        ? settings.useDevProxy
        : defaultDesignerSettings.useDevProxy,
  };
}

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf-8")));
    request.on("error", rejectBody);
  });
}

function buildProxyHeaders(headers: IncomingHttpHeaders) {
  const proxyHeaders = new Headers();

  Object.entries(headers).forEach(([key, value]) => {
    if (!value || ["connection", "content-length", "cookie", "host"].includes(key.toLowerCase())) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => proxyHeaders.append(key, entry));
      return;
    }

    proxyHeaders.set(key, value);
  });

  return proxyHeaders;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}
