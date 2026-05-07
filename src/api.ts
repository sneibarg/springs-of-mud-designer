import type { ApiHealth, ApiResource } from "./domain";

export const API_BASE_URL = import.meta.env.VITE_SOM_API_BASE_URL ?? "";

export async function checkApiHealth(): Promise<ApiHealth> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/game`, {
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
      detail: "Connected to Java persistence API",
    };
  } catch {
    return {
      state: "offline",
      detail: "Working in local draft mode",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export function buildCreateRequest(resource: ApiResource, payload: unknown) {
  return {
    method: "POST",
    url: `${API_BASE_URL}${resource.endpoint}`,
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
  };
}
