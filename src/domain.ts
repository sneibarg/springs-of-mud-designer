import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Boxes,
  Castle,
  FlameKindling,
  MessageSquareText,
  Settings2,
  Sparkles,
  Swords,
} from "lucide-react";

export type FeatureStatus = "Ready" | "Drafting" | "Needs API" | "Planned";

export type FeatureKind =
  | "skills"
  | "spells"
  | "settings"
  | "areas"
  | "rooms"
  | "mobiles"
  | "items"
  | "communication";

export type ApiResource = {
  kind: FeatureKind;
  label: string;
  endpoint: string;
  fields: string[];
  icon: LucideIcon;
  status: FeatureStatus;
  summary: string;
};

export type DesignerDraft = {
  name: string;
  kind: FeatureKind;
  areaId: string;
  target: string;
  level: number;
  notes: string;
};

export type WorkQueueItem = {
  id: string;
  title: string;
  area: string;
  resource: FeatureKind;
  status: FeatureStatus;
  owner: string;
};

export type ApiHealth = {
  state: "checking" | "online" | "offline";
  detail: string;
};

export type AreaView = {
  id?: string;
  author: string;
  name: string;
  vnum: string;
  suggestedLevelRange: string;
  rooms: string[];
  mobiles: string[];
  objects: string[];
  shops: string[];
  resets: string[];
  specials: string[];
};

export type RoomView = {
  id?: string;
  areaId: string;
  vnum: string;
  name: string;
  description: string;
  extraDescription: string;
  pvp: boolean;
  spawn: boolean;
  spawnTimer: number;
  spawnTime: number;
  teleDelay: number;
  roomFlags: number;
  sectorType: number;
  exits: string[];
  mobiles: Record<string, string>;
};

export type ExitView = {
  direction: number;
  description: string;
  keyword: string;
  exit_flags: number;
  key: number;
  to_room_vnum: number;
  to_room_id: string;
  room_id: string;
  parseError?: string;
  raw: string;
};

export const iconByKind: Record<FeatureKind, LucideIcon> = {
  skills: Swords,
  spells: Sparkles,
  settings: Settings2,
  areas: Castle,
  rooms: BookOpen,
  mobiles: Bot,
  items: Boxes,
  communication: MessageSquareText,
};

export const resourceIcons = {
  BookOpen,
  Bot,
  Boxes,
  Castle,
  FlameKindling,
  MessageSquareText,
  Settings2,
  Sparkles,
  Swords,
};
