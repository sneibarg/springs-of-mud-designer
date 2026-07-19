// @ts-ignore
import type { ViteDevServer, Plugin } from "vite";
import { registerAuthRoutes } from "./auth";
import { readRequestBody, sendJson } from "./http";
import { registerProxyRoutes } from "./proxy";
import { readDesignerSettings, writeDesignerSettings } from "./settingsStore";
import { createSessionStore } from "./session";
import type { DesignerSettings } from "./types";

export function designerSettingsPlugin(): Plugin {
  const sessions = createSessionStore();

  return {
    name: "som-designer-settings",
    configureServer(server) {
      registerAuthRoutes(server, sessions);
      registerSettingsRoutes(server, sessions);
      registerProxyRoutes(server, sessions);
    },
  };
}

function registerSettingsRoutes(server: ViteDevServer, sessions: ReturnType<typeof createSessionStore>) {
  server.middlewares.use("/designer/settings", async (request, response) => {
    if (!sessions.get(request)) {
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
}
