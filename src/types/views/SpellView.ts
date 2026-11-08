import type { EditableValue } from "../common";

export type SpellView = {
  id?: string;
  name: string;
  kind: string;
  handlerId: string;
  target: string;
  minPosition: string;
  nounDamage: string;
  functionName: string;
  guards: Array<Record<string, EditableValue>>;
  payload: Record<string, EditableValue>;
  levelByClass: Record<string, number>;
  ratingByClass: Record<string, number>;
  slot: number;
  minMana: number;
  beats: number;
  affectData: Array<Record<string, EditableValue>>;
  lambdas: string[];
};
