import type { IncomingHttpHeaders } from "node:http";
import type { ViteDevServer } from "vite";
import { readRequestBody, sendJson } from "./http";
import { readDesignerSettings } from "./settingsStore";
import type { SessionStore } from "./session";

export function registerProxyRoutes(server: ViteDevServer, sessions: SessionStore) {
  server.middlewares.use("/api", async (request, response) => {
    if (!sessions.get(request)) {
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
