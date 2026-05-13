import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DesignerSettings } from "./types";

const defaultDesignerSettings: DesignerSettings = {
  apiBaseUrl: "http://localhost:9080",
  useDevProxy: true,
};

const settingsPath = resolve(process.cwd(), ".designer", "settings.json");

export function readDesignerSettings(): DesignerSettings {
  try {
    return normalizeDesignerSettings(JSON.parse(readFileSync(settingsPath, "utf-8")));
  } catch {
    return defaultDesignerSettings;
  }
}

export function writeDesignerSettings(settings: Partial<DesignerSettings>) {
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
