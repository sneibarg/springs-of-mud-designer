import type { EditableValue } from "../common";
import type { GameIntegrityView } from "./GameIntegrityView";
import type { GameVersionView } from "./GameVersionView";

export type GameDataView = {
  id?: string;
  kind: string;
  status: string;
  version: GameVersionView;
  enums: Record<string, Record<string, number>>;
  attributeBonuses: Record<string, Record<string, EditableValue>>;
  classes: Record<string, Record<string, EditableValue>>;
  races: Record<string, Record<string, EditableValue>>;
  pcRaces: Record<string, Record<string, EditableValue>>;
  wiznetTable: Record<string, Record<string, string>>;
  groups: Record<string, Record<string, EditableValue>>;
  titles: Record<string, Record<string, EditableValue>>;
  itemTable: Record<string, Record<string, EditableValue>>;
  weapons: Record<string, Record<string, EditableValue>>;
  attacks: Record<string, Record<string, EditableValue>>;
  liquids: Record<string, Record<string, EditableValue>>;
  integrity: GameIntegrityView;
  denyList: string[];
};
