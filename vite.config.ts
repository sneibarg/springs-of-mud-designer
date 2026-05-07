import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

type DesignerSettings = {
  apiBaseUrl: string;
  useDevProxy: boolean;
};

const defaultDesignerSettings: DesignerSettings = {
  apiBaseUrl: "http://localhost:9080",
  useDevProxy: true,
};

const settingsPath = resolve(process.cwd(), ".designer", "settings.json");

export default defineConfig({
  plugins: [react(), designerSettingsPlugin()],
  server: {
    port: 5173,
    strictPort: false,
  },
});

function designerSettingsPlugin(): Plugin {
  return {
    name: "som-designer-settings",
    configureServer(server) {
      server.middlewares.use("/designer/settings", async (request, response) => {
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
    if (!value || ["connection", "content-length", "host"].includes(key.toLowerCase())) {
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
