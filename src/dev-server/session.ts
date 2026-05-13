import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthSession, AuthUser, StoredSession } from "./types";

const sessionCookieName = "som_designer_session";
const sessionDurationMs = 8 * 60 * 60 * 1000;

export type SessionStore = ReturnType<typeof createSessionStore>;

export function createSessionStore() {
  const sessions = new Map<string, StoredSession>();

  return {
    create(response: ServerResponse, user: AuthUser) {
      const sessionId = randomBytes(32).toString("base64url");
      sessions.set(sessionId, {
        user,
        expiresAt: Date.now() + sessionDurationMs,
      });
      response.setHeader("set-cookie", buildSessionCookie(sessionId));
    },

    clear(request: IncomingMessage, response: ServerResponse) {
      const sessionId = readSessionId(request);

      if (sessionId) {
        sessions.delete(sessionId);
      }

      response.setHeader("set-cookie", expireSessionCookie());
    },

    get(request: IncomingMessage) {
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
    },
  };
}

export function toAuthSession(session: StoredSession | null): AuthSession {
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
