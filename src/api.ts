import type { ApiHealth, ApiResource } from "./domain";

export const API_BASE_URL_STORAGE_KEY = "som-designer-api-base-url";
export const API_PROXY_ENABLED_STORAGE_KEY = "som-designer-api-proxy-enabled";
export const DEFAULT_API_BASE_URL = import.meta.env.VITE_SOM_API_BASE_URL ?? "http://dragon:9080";
export const DEFAULT_API_PROXY_ENABLED = import.meta.env.DEV;

export function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function readSavedApiBaseUrl() {
  return (
    normalizeApiBaseUrl(window.localStorage.getItem(API_BASE_URL_STORAGE_KEY) ?? "") ||
    DEFAULT_API_BASE_URL
  );
}

export function readSavedApiProxyEnabled() {
  const savedValue = window.localStorage.getItem(API_PROXY_ENABLED_STORAGE_KEY);

  if (savedValue === null) {
    return DEFAULT_API_PROXY_ENABLED;
  }

  return savedValue === "true";
}

export function saveApiBaseUrl(value: string) {
  const normalizedValue = normalizeApiBaseUrl(value);
  window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalizedValue);
  return normalizedValue;
}

export function saveApiProxyEnabled(value: boolean) {
  window.localStorage.setItem(API_PROXY_ENABLED_STORAGE_KEY, String(value));
  return value;
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
