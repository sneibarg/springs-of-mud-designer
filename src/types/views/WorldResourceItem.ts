import type { EditableValue } from "../common";

export type WorldResourceItem = {
  id?: string;
  areaId?: string;
  vnum?: string | number;
  name?: string;
  description?: string;
  shortDescription?: string;
  longDescription?: string;
  race?: string;
  itemType?: string;
  level?: string | number;
};

export type EditableResourceDocument = WorldResourceItem & Record<string, EditableValue | undefined>;
