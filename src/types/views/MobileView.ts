import type { EditableValue } from "../common";
import type { WorldResourceItem } from "./WorldResourceItem";

export type MobileView = WorldResourceItem & Record<string, EditableValue | undefined>;
