import type { EditableValue } from "../common";

export type SkillView = {
  id?: string;
  name: string;
  kind: string;
  handlerId: string;
  target: string;
  minPosition: string;
  nounDamage: string;
  fightExecutor: string;
  guards: Array<Record<string, EditableValue>>;
  payload: Record<string, EditableValue>;
  fightPlan: Record<string, EditableValue>;
  levelByClass: Record<string, number>;
  ratingByClass: Record<string, number>;
  slot: number;
  minMana: number;
  beats: number;
};
