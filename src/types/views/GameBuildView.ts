import type { EditableValue } from "../common";

export type GameBuildView = {
  source: string;
  toolVersion: string;
  extra: Record<string, EditableValue>;
};
