import type { ApiResource } from "./types/common";
import { environment } from "./environments/environment";

export const DESIGNER_SETTINGS_STORAGE_KEY = "som-designer-settings";
export const API_BASE_URL_STORAGE_KEY = "som-designer-api-base-url";
export const API_PROXY_ENABLED_STORAGE_KEY = "som-designer-api-proxy-enabled";
export const THEME_STORAGE_KEY = "som-designer-theme";
export const DEFAULT_API_BASE_URL = environment.designer.apiBaseUrl;
export const DEFAULT_API_PROXY_ENABLED = environment.designer.useDevProxy;

export function createContentDocumentId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type DesignerTheme = "light" | "dark";

export type DesignerSettings = {
  apiBaseUrl: string;
  useDevProxy: boolean;
  theme: DesignerTheme;
};

export const DEFAULT_DESIGNER_SETTINGS: DesignerSettings = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  useDevProxy: DEFAULT_API_PROXY_ENABLED,
  theme: "light",
};

export function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export async function loadDesignerSettings(): Promise<DesignerSettings> {
  return readDesignerSettings();
}

export async function saveDesignerSettings(settings: DesignerSettings) {
  const normalizedSettings = normalizeDesignerSettings(settings);
  window.localStorage.setItem(DESIGNER_SETTINGS_STORAGE_KEY, JSON.stringify(normalizedSettings));
  window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalizedSettings.apiBaseUrl);
  window.localStorage.setItem(API_PROXY_ENABLED_STORAGE_KEY, String(normalizedSettings.useDevProxy));
  window.localStorage.setItem(THEME_STORAGE_KEY, normalizedSettings.theme);

  return normalizedSettings;
}

export function readSavedApiBaseUrl() {
  return readDesignerSettings().apiBaseUrl;
}

export function readSavedApiProxyEnabled() {
  return readDesignerSettings().useDevProxy;
}

export function readSavedTheme() {
  return readDesignerSettings().theme;
}

export function resolveFetchBaseUrl(apiBaseUrl: string, useDevProxy: boolean) {
  return environment.designer.forceDevProxy || useDevProxy ? "" : normalizeApiBaseUrl(apiBaseUrl);
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
    useDevProxy: environment.designer.forceDevProxy
      ? true
      : typeof settings.useDevProxy === "boolean"
        ? settings.useDevProxy
        : DEFAULT_API_PROXY_ENABLED,
    theme: settings.theme === "dark" ? "dark" : "light",
  };
}

function readDesignerSettings(): DesignerSettings {
  try {
    const storedSettings = window.localStorage.getItem(DESIGNER_SETTINGS_STORAGE_KEY);

    if (storedSettings) {
      return normalizeDesignerSettings(JSON.parse(storedSettings) as Partial<DesignerSettings>);
    }

    return normalizeDesignerSettings({
      apiBaseUrl: window.localStorage.getItem(API_BASE_URL_STORAGE_KEY) ?? DEFAULT_API_BASE_URL,
      useDevProxy: window.localStorage.getItem(API_PROXY_ENABLED_STORAGE_KEY) === "true",
      theme: window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light",
    });
  } catch {
    return DEFAULT_DESIGNER_SETTINGS;
  }
}
