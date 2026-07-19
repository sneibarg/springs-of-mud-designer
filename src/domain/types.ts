import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Boxes,
  Castle,
  CircleHelp,
  GraduationCap,
  FlameKindling,
  Gamepad2,
  MessageSquareText,
  NotebookText,
  ScrollText,
  Settings2,
  Sparkles,
  Swords,
  UsersRound,
} from "lucide-react";

export type FeatureStatus = "Ready" | "Drafting" | "Needs API" | "Planned";

export type FeatureKind =
  | "skills"
  | "spells"
  | "settings"
  | "game"
  | "areas"
  | "rooms"
  | "mobiles"
  | "items"
  | "shops"
  | "resets"
  | "specials"
  | "classes"
  | "races"
  | "commands"
  | "helps"
  | "socials"
  | "notes"
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

export type EditableValue =
  | string
  | number
  | boolean
  | null
  | EditableValue[]
  | { [key: string]: EditableValue };

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

export type MobileView = WorldResourceItem & Record<string, EditableValue | undefined>;
export type EditableResourceDocument = WorldResourceItem & Record<string, EditableValue | undefined>;

export type ClassView = {
  id?: string;
  name: string;
  whoName: string;
  primaryAttribute: string;
  startingWeapon: string;
  baseGroup: string;
  defaultGroup: string;
  skillAdept: number;
  thac0_00: number;
  thac0_32: number;
  hpMin: number;
  hpMax: number;
  fMana: boolean;
};

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
  function: string[];
  enabled: boolean;
  pipeline: boolean;
  maxArguments: number;
};

export type HelpView = {
  id?: string;
  level: number;
  keyword: string;
  text: string;
};

export type SocialView = {
  id?: string;
  name: string;
  charNoArg: string;
  othersNoArg: string;
  charFound: string;
  othersFound: string;
  victFound: string;
  charNotFound: string;
  charAuto: string;
  othersAuto: string;
};

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

export type GameVersionView = {
  family: string;
  lineage: string[];
  semver: string;
  createdAt: string;
  notes: string;
};

export type GameConstantsView = {
  max: Record<string, number>;
  pulses: Record<string, number>;
};

export type GameIntegrityView = {
  contentHash: string;
  build: GameBuildView;
};

export type GameBuildView = {
  source: string;
  toolVersion: string;
  extra: Record<string, EditableValue>;
};

export type ItemView = {
  id?: string;
  areaId: string;
  vnum: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  material: string;
  itemType: string;
  extraFlags: string;
  wearFlags: string;
  value0: string;
  value1: string;
  value2: string;
  value3: string;
  value4: string;
  level: number;
  weight: number;
  cost: number;
  condition: string;
  affectData: string[];
  extraDescription: string[];
};

export type NoteView = {
  id?: string;
  type: number;
  sender: string;
  date: string;
  toList: string;
  subject: string;
  text: string;
  dateStamp: number;
};

export type RaceView = {
  id?: string;
  name: string;
  size: string;
  skills: string[];
  classMultiplier: number[];
  points: number;
  str: number;
  maxStr: number;
  INT: number;
  maxInt: number;
  con: number;
  maxCon: number;
  wis: number;
  maxWis: number;
  dex: number;
  maxDex: number;
};

export type ResetView = {
  id?: string;
  areaId: string;
  command: string;
  arg1: string;
  arg2: string;
  arg3: string;
  arg4: string;
  comment: string;
};

export type ShopView = {
  id?: string;
  areaId: string;
  keeper: number;
  buyType0: number;
  buyType1: number;
  buyType2: number;
  buyType3: number;
  buyType4: number;
  profitBuy: number;
  profitSell: number;
  openHour: number;
  closeHour: number;
  comment: string;
};

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

export type SpecialView = {
  id?: string;
  areaId: string;
  mobVnum: string;
  name: string;
  comment: string;
  specialFunction: string[];
};

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

export const iconByKind: Record<FeatureKind, LucideIcon> = {
  skills: Swords,
  spells: Sparkles,
  settings: Settings2,
  game: Gamepad2,
  areas: Castle,
  rooms: BookOpen,
  mobiles: Bot,
  items: Boxes,
  shops: Boxes,
  resets: FlameKindling,
  specials: ScrollText,
  classes: GraduationCap,
  races: UsersRound,
  commands: ScrollText,
  helps: CircleHelp,
  socials: MessageSquareText,
  notes: NotebookText,
  communication: MessageSquareText,
};

export const resourceIcons = {
  BookOpen,
  Bot,
  Boxes,
  Castle,
  CircleHelp,
  FlameKindling,
  Gamepad2,
  GraduationCap,
  MessageSquareText,
  NotebookText,
  ScrollText,
  Settings2,
  Sparkles,
  Swords,
  UsersRound,
};
