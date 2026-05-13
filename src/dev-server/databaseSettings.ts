import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MysqlConnectionConfig } from "./types";

const databaseSettingsPath = resolve(process.cwd(), ".designer", "database.json");

const defaultDatabaseSettings: MysqlConnectionConfig = {
  host: "127.0.0.1",
  port: 3306,
  database: "som-designer",
  user: "som_admin",
  password: "",
};

export function readMysqlConnectionConfig(): MysqlConnectionConfig {
  const savedSettings = readDatabaseSettings();

  return {
    host: process.env.SOM_DESIGNER_DB_HOST || savedSettings.host,
    port: Number(process.env.SOM_DESIGNER_DB_PORT || savedSettings.port),
    database: process.env.SOM_DESIGNER_DB_NAME || savedSettings.database,
    user: process.env.SOM_DESIGNER_DB_USER || savedSettings.user,
    password: process.env.SOM_DESIGNER_DB_PASSWORD || savedSettings.password,
  };
}

function readDatabaseSettings(): MysqlConnectionConfig {
  try {
    return normalizeDatabaseSettings(JSON.parse(readFileSync(databaseSettingsPath, "utf-8")));
  } catch {
    return defaultDatabaseSettings;
  }
}

function normalizeDatabaseSettings(settings: Partial<MysqlConnectionConfig>): MysqlConnectionConfig {
  return {
    host: String(settings.host ?? "").trim() || defaultDatabaseSettings.host,
    port: Number(settings.port || defaultDatabaseSettings.port),
    database: String(settings.database ?? "").trim() || defaultDatabaseSettings.database,
    user: String(settings.user ?? "").trim() || defaultDatabaseSettings.user,
    password: String(settings.password ?? defaultDatabaseSettings.password),
  };
}
