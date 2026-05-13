import type { ApiHealth, ApiResource } from "./domain";

export const DESIGNER_SETTINGS_STORAGE_KEY = "som-designer-settings";
export const API_BASE_URL_STORAGE_KEY = "som-designer-api-base-url";
export const API_PROXY_ENABLED_STORAGE_KEY = "som-designer-api-proxy-enabled";
export const DEFAULT_API_BASE_URL = "http://localhost:9080";
export const DEFAULT_API_PROXY_ENABLED = import.meta.env.DEV;

export type DesignerSettings = {
  apiBaseUrl: string;
  useDevProxy: boolean;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: string;
};

export type AuthSession = {
  authenticated: boolean;
  user?: AuthUser;
};

export const DEFAULT_DESIGNER_SETTINGS: DesignerSettings = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  useDevProxy: DEFAULT_API_PROXY_ENABLED,
};

export function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export async function loadDesignerSettings(): Promise<DesignerSettings> {
  try {
    const response = await fetch("/designer/settings");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return normalizeDesignerSettings((await response.json()) as Partial<DesignerSettings>);
  } catch {
    return DEFAULT_DESIGNER_SETTINGS;
  }
}

export async function saveDesignerSettings(settings: DesignerSettings) {
  const normalizedSettings = normalizeDesignerSettings(settings);
  const response = await fetch("/designer/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalizedSettings),
  });

  if (!response.ok) {
    throw new Error(`Unable to save designer settings: HTTP ${response.status}`);
  }

  return normalizeDesignerSettings((await response.json()) as Partial<DesignerSettings>);
}

export async function loadAuthSession(): Promise<AuthSession> {
  try {
    const response = await fetch("/designer/auth/session");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return normalizeAuthSession((await response.json()) as Partial<AuthSession>);
  } catch {
    return { authenticated: false };
  }
}

export async function loginDesigner(username: string, password: string): Promise<AuthSession> {
  const response = await fetch("/designer/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Login failed: HTTP ${response.status}`);
  }

  return normalizeAuthSession((await response.json()) as Partial<AuthSession>);
}

export async function logoutDesigner() {
  await fetch("/designer/auth/logout", {
    method: "POST",
  });
}

export function readSavedApiBaseUrl() {
  return DEFAULT_DESIGNER_SETTINGS.apiBaseUrl;
}

export function readSavedApiProxyEnabled() {
  return DEFAULT_DESIGNER_SETTINGS.useDevProxy;
}

export function resolveFetchBaseUrl(apiBaseUrl: string, useDevProxy: boolean) {
  return useDevProxy ? "" : normalizeApiBaseUrl(apiBaseUrl);
}

export async function checkApiHealth(
  apiBaseUrl: string,
  useDevProxy: boolean,
): Promise<ApiHealth> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const fetchBaseUrl = resolveFetchBaseUrl(baseUrl, useDevProxy);

  try {
    const response = await fetch(`${fetchBaseUrl}/api/v1/game`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        state: "offline",
        detail: `Backend answered with HTTP ${response.status}`,
      };
    }

    return {
      state: "online",
      detail: useDevProxy ? `Connected through local proxy to ${baseUrl}` : `Connected to ${baseUrl}`,
    };
  } catch {
    return {
      state: "offline",
      detail: useDevProxy ? `Local proxy cannot reach ${baseUrl}` : `Browser cannot reach ${baseUrl}`,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export function buildCreateRequest(
  apiBaseUrl: string,
  useDevProxy: boolean,
  resource: ApiResource,
  payload: unknown,
) {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const fetchBaseUrl = resolveFetchBaseUrl(baseUrl, useDevProxy);

  return {
    method: "POST",
    url: `${fetchBaseUrl}${resource.endpoint}`,
    targetServer: baseUrl,
    routedThroughDevProxy: useDevProxy,
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
  };
}

export function buildApiUrl(apiBaseUrl: string, useDevProxy: boolean, endpoint: string) {
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const fetchBaseUrl = resolveFetchBaseUrl(baseUrl, useDevProxy);

  return `${fetchBaseUrl}${endpoint}`;
}

function normalizeDesignerSettings(settings: Partial<DesignerSettings>): DesignerSettings {
  return {
    apiBaseUrl: normalizeApiBaseUrl(settings.apiBaseUrl ?? "") || DEFAULT_API_BASE_URL,
    useDevProxy:
      typeof settings.useDevProxy === "boolean" ? settings.useDevProxy : DEFAULT_API_PROXY_ENABLED,
  };
}

function normalizeAuthSession(session: Partial<AuthSession>): AuthSession {
  if (!session.authenticated || !session.user) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    user: {
      id: Number(session.user.id),
      username: String(session.user.username ?? ""),
      email: String(session.user.email ?? ""),
      role: String(session.user.role ?? ""),
    },
  };
}
