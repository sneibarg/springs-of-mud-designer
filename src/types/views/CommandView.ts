import type { EditableValue } from "../common";

export type CommandView = {
  id?: string;
  name: string;
  message: string;
  role: string;
  usage: string;
  skillId: string;
  shortcuts: string;
  position: string;
  log: string;
  help: string;
  level: string;
  payload: Record<string, EditableValue>;
  guards: Array<Record<string, EditableValue>>;
  lambdas: string[];
  enabled: boolean;
  pipeline: boolean;
  maxArguments: number;
};
