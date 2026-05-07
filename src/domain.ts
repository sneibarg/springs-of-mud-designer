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
