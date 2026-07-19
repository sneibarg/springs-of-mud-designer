import type { AreaView, EditableResourceDocument, EditableValue, ExitView, FeatureKind, MobileView, RoomView } from "./types";
import {
  directionNames,
  emptyEditableResourceDrafts,
  preferredEditableResourceFields,
  preferredMobileFields,
} from "./constants";
export function normalizeArea(area: AreaView): AreaView {
  return {
    id: area.id,
    author: area.author ?? "",
    name: area.name ?? "",
    vnum: area.vnum ?? "",
    suggestedLevelRange: area.suggestedLevelRange ?? "",
    rooms: sortVnumStrings(area.rooms ?? []),
    mobiles: sortVnumStrings(area.mobiles ?? []),
    objects: sortVnumStrings(area.objects ?? []),
    shops: sortVnumStrings(area.shops ?? []),
    resets: sortVnumStrings(area.resets ?? []),
    specials: sortVnumStrings(area.specials ?? []),
  };
}

export function normalizeRoom(room: RoomView): RoomView {
  return {
    id: room.id,
    areaId: room.areaId ?? "",
    vnum: room.vnum ?? "",
    name: room.name ?? "",
    description: room.description ?? "",
    extraDescription: room.extraDescription ?? "",
    pvp: Boolean(room.pvp),
    spawn: Boolean(room.spawn),
    spawnTimer: Number(room.spawnTimer ?? 0),
    spawnTime: Number(room.spawnTime ?? 0),
    teleDelay: Number(room.teleDelay ?? 0),
    roomFlags: Number(room.roomFlags ?? 0),
    sectorType: Number(room.sectorType ?? 0),
    exits: room.exits ?? [],
    mobiles: room.mobiles ?? {},
  };
}

export function normalizeMobile(mobile: MobileView): MobileView {
  return {
    ...mobile,
    id: mobile.id,
    areaId: mobile.areaId ?? "",
    vnum: mobile.vnum ?? "",
    name: mobile.name ?? "",
  };
}

export function normalizeEditableResourceDocument(
    document: EditableResourceDocument,
    kind: FeatureKind,
): EditableResourceDocument {
  const normalizedDocument = {
    ...getEmptyEditableResourceDraft(kind),
    ...document,
    id: document.id,
  };

  if ("areaId" in normalizedDocument) {
    normalizedDocument.areaId = document.areaId ?? "";
  }

  return normalizedDocument;
}

export function parseExitView(rawExit: string): ExitView {
  try {
    const parsed = parseSerializedExit(rawExit);

    return {
      direction: Number(parsed.direction ?? -1),
      description: String(parsed.description ?? ""),
      keyword: String(parsed.keyword ?? ""),
      exit_flags: Number(parsed.exit_flags ?? 0),
      key: Number(parsed.key ?? 0),
      to_room_vnum: Number(parsed.to_room_vnum ?? 0),
      to_room_id: String(parsed.to_room_id ?? ""),
      room_id: String(parsed.room_id ?? ""),
      raw: rawExit,
    };
  } catch (error) {
    return {
      direction: -1,
      description: "",
      keyword: "",
      exit_flags: 0,
      key: 0,
      to_room_vnum: 0,
      to_room_id: "",
      room_id: "",
      raw: rawExit,
      parseError: error instanceof Error ? error.message : "Unable to parse exit.",
    };
  }
}

export function parseSerializedExit(rawExit: string): Record<string, unknown> {
  try {
    return JSON.parse(rawExit) as Record<string, unknown>;
  } catch {
    const jsonLikeValue = rawExit
      .replace(/\bNone\b/g, "null")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value: string) => {
        return JSON.stringify(value.replace(/\\'/g, "'"));
      });

    return JSON.parse(jsonLikeValue) as Record<string, unknown>;
  }
}

export function findRoomForExit(rooms: RoomView[], exitView: ExitView) {
  return rooms.find(
    (room) =>
      (exitView.to_room_id && room.id === exitView.to_room_id) ||
      (exitView.to_room_vnum && String(room.vnum) === String(exitView.to_room_vnum)),
  );
}

export function directionLabel(direction: number) {
  return directionNames[direction] ?? `direction ${direction}`;
}

export function upsertArea(areas: AreaView[], savedArea: AreaView) {
  const existingIndex = areas.findIndex((area) => area.id === savedArea.id);

  if (existingIndex === -1) {
    return [...areas, savedArea].sort(compareAreas);
  }

  return areas.map((area, index) => (index === existingIndex ? savedArea : area)).sort(compareAreas);
}

export function upsertRoom(rooms: RoomView[], savedRoom: RoomView) {
  const existingIndex = rooms.findIndex((room) => room.id === savedRoom.id);

  if (existingIndex === -1) {
    return [...rooms, savedRoom].sort(compareRooms);
  }

  return rooms.map((room, index) => (index === existingIndex ? savedRoom : room)).sort(compareRooms);
}

export function upsertRoomForArea(rooms: RoomView[], savedRoom: RoomView, areaId: string) {
  const remainingRooms = rooms.filter((room) => room.id !== savedRoom.id);

  if (!areaId || areaId === "new" || savedRoom.areaId !== areaId) {
    return remainingRooms.sort(compareRooms);
  }

  return upsertRoom(remainingRooms, savedRoom);
}

export function upsertMobile(mobiles: MobileView[], savedMobile: MobileView) {
  const existingIndex = mobiles.findIndex((mobile) => mobile.id === savedMobile.id);

  if (existingIndex === -1) {
    return [...mobiles, savedMobile].sort(compareMobiles);
  }

  return mobiles.map((mobile, index) => (index === existingIndex ? savedMobile : mobile)).sort(compareMobiles);
}

export function upsertMobileForArea(mobiles: MobileView[], savedMobile: MobileView, areaId: string) {
  const remainingMobiles = mobiles.filter((mobile) => mobile.id !== savedMobile.id);

  if (!areaId || savedMobile.areaId !== areaId) {
    return remainingMobiles.sort(compareMobiles);
  }

  return upsertMobile(remainingMobiles, savedMobile);
}

export function upsertEditableResourceDocument(
    documents: EditableResourceDocument[],
    savedDocument: EditableResourceDocument,
) {
  const existingIndex = documents.findIndex((document) => document.id === savedDocument.id);

  if (existingIndex === -1) {
    return [...documents, savedDocument].sort(compareEditableResourceDocuments);
  }

  return documents
      .map((document, index) => (index === existingIndex ? savedDocument : document))
      .sort(compareEditableResourceDocuments);
}

export function upsertEditableResourceDocumentForArea(
    documents: EditableResourceDocument[],
    savedDocument: EditableResourceDocument,
    areaId: string,
) {
  const remainingDocuments = documents.filter((document) => document.id !== savedDocument.id);

  if (!areaId || savedDocument.areaId !== areaId) {
    return remainingDocuments.sort(compareEditableResourceDocuments);
  }

  return upsertEditableResourceDocument(remainingDocuments, savedDocument);
}

export function mergeRooms(existingRooms: RoomView[], incomingRooms: RoomView[]) {
  return incomingRooms.reduce((mergedRooms, room) => upsertRoom(mergedRooms, room), existingRooms);
}

export function validateRoom(room: RoomView) {
  if (!room.areaId.trim()) {
    return "Area id is required.";
  }

  if (!room.name.trim()) {
    return "Room name is required.";
  }

  return "";
}

export function validateMobile(mobile: MobileView) {
  if (!String(mobile.areaId ?? "").trim()) {
    return "Area id is required.";
  }

  if (!String(mobile.name ?? "").trim()) {
    return "Mobile name is required.";
  }

  return "";
}

export function validateEditableResourceDocument(document: EditableResourceDocument, label: string) {
  if ("areaId" in document && !String(document.areaId ?? "").trim()) {
    return "Area id is required.";
  }

  if (label === "Help" && !String(document.keyword ?? "").trim()) {
    return "Help keyword is required.";
  }

  if (
      (label === "Items" ||
          label === "Classes" ||
          label === "Races" ||
          label === "Skills" ||
          label === "Spells" ||
          label === "Commands" ||
          label === "Emotes") &&
      !String(document.name ?? "").trim()
  ) {
    return `${singularResourceLabel(label)} name is required.`;
  }

  return "";
}

export function compareAreas(left: AreaView, right: AreaView) {
  return compareByVnumThenName(left, right);
}

export function compareRooms(left: RoomView, right: RoomView) {
  return compareByVnumThenName(left, right);
}

export function compareMobiles(left: MobileView, right: MobileView) {
  return compareByVnumThenName(left, right);
}

export function compareEditableResourceDocuments(
    left: EditableResourceDocument,
    right: EditableResourceDocument,
) {
  return compareByVnumThenName(
      {
        vnum: sortableScalar(left.vnum ?? left.keeper ?? left.arg1),
        name: documentDisplayName(left, "items"),
        id: left.id,
      },
      {
        vnum: sortableScalar(right.vnum ?? right.keeper ?? right.arg1),
        name: documentDisplayName(right, "items"),
        id: right.id,
      },
  );
}

export function compareByVnumThenName(
    left: { vnum?: string | number; name?: string; id?: string },
    right: { vnum?: string | number; name?: string; id?: string },
) {
  const leftVnum = firstNumber(left.vnum);
  const rightVnum = firstNumber(right.vnum);

  if (leftVnum !== rightVnum) {
    return leftVnum - rightVnum;
  }

  return String(left.vnum ?? left.name ?? left.id ?? "").localeCompare(
      String(right.vnum ?? right.name ?? right.id ?? ""),
      undefined,
      { numeric: true, sensitivity: "base" },
  );
}

export function sortVnumStrings(values: string[]) {
  return [...values].sort((left, right) =>
      compareByVnumThenName({ vnum: left, name: left }, { vnum: right, name: right }),
  );
}

export function firstNumber(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

export function sortableScalar(value: EditableValue | undefined) {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return undefined;
}

export function formatAreaOption(area: AreaView) {
  const label = area.name || "Unnamed area";
  return area.vnum ? `${area.vnum} - ${label}` : label;
}

export function mobileFieldNames(...sources: Array<MobileView | MobileView[]>) {
  const fieldNames = new Set<string>(preferredMobileFields);

  sources.flat().forEach((source) => {
    Object.keys(source).forEach((fieldName) => fieldNames.add(fieldName));
  });

  return [...fieldNames].sort((left, right) => {
    const leftIndex = preferredMobileFields.indexOf(left);
    const rightIndex = preferredMobileFields.indexOf(right);

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.POSITIVE_INFINITY : leftIndex) -
          (rightIndex === -1 ? Number.POSITIVE_INFINITY : rightIndex);
    }

    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function editableResourceFieldNames(kind: FeatureKind, ...sources: Array<EditableResourceDocument | EditableResourceDocument[]>) {
  const preferredFields = preferredEditableResourceFields[kind] ?? ["id", "areaId"];
  const fieldNames = new Set<string>(preferredFields);

  sources.flat().forEach((source) => {
    Object.keys(source).forEach((fieldName) => fieldNames.add(fieldName));
  });

  return [...fieldNames].sort((left, right) => {
    const leftIndex = preferredFields.indexOf(left);
    const rightIndex = preferredFields.indexOf(right);

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.POSITIVE_INFINITY : leftIndex) -
          (rightIndex === -1 ? Number.POSITIVE_INFINITY : rightIndex);
    }

    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function getEmptyEditableResourceDraft(kind: FeatureKind) {
  return { ...(emptyEditableResourceDrafts[kind] ?? { areaId: "" }) };
}

export function singularResourceLabel(label: string) {
  if (label === "Mobiles") {
    return "Mobile";
  }

  if (label === "Items") {
    return "Item";
  }

  if (label === "Shops") {
    return "Shop";
  }

  if (label === "Resets") {
    return "Reset";
  }

  if (label === "Specials") {
    return "Special";
  }

  if (label === "Classes") {
    return "Class";
  }

  if (label === "Races") {
    return "Race";
  }

  if (label === "Commands") {
    return "Command";
  }

  if (label === "Emotes") {
    return "Emote";
  }

  if (label === "Help") {
    return "Help";
  }

  return label.endsWith("s") ? label.slice(0, -1) : label;
}

export function documentDisplayName(document: EditableResourceDocument, kind: FeatureKind) {
  if (kind === "shops") {
    return `Shopkeeper ${document.keeper ?? "unknown"}`;
  }

  if (kind === "resets") {
    return [document.command, document.arg1, document.arg2, document.arg3, document.arg4]
        .filter((value) => String(value ?? "").trim())
        .join(" ") || "Unnamed reset";
  }

  if (kind === "specials") {
    return String(document.name ?? document.mobVnum ?? document.id ?? "Unnamed special");
  }

  if (kind === "helps") {
    return String(document.keyword ?? document.id ?? "Unnamed help");
  }

  if (kind === "game") {
    return String(document.kind ?? document.id ?? "Unnamed game data");
  }

  if (kind === "classes" || kind === "skills" || kind === "spells" || kind === "commands" || kind === "socials") {
    return String(document.name ?? document.whoName ?? document.id ?? "Unnamed class");
  }

  if (kind === "races") {
    return String(document.name ?? document.size ?? document.id ?? "Unnamed race");
  }

  return String(document.name ?? document.vnum ?? document.id ?? "Unnamed item");
}

export function documentSecondaryLabel(document: EditableResourceDocument, kind: FeatureKind) {
  if (kind === "shops") {
    return `Buy ${document.profitBuy ?? 0} / Sell ${document.profitSell ?? 0}`;
  }

  if (kind === "resets") {
    return String(document.comment ?? document.id ?? "No comment");
  }

  if (kind === "specials") {
    return String(document.mobVnum ?? document.comment ?? document.id ?? "No mob vnum");
  }

  if (kind === "helps") {
    return `Level ${document.level ?? 0}`;
  }

  if (kind === "game") {
    return String(document.status ?? document.id ?? "No status");
  }

  if (kind === "classes") {
    return String(document.whoName ?? document.primaryAttribute ?? document.id ?? "No who name");
  }

  if (kind === "skills") {
    return String(document.target ?? document.minPosition ?? document.id ?? "No target");
  }

  if (kind === "spells") {
    return String(document.functionName ?? document.target ?? document.id ?? "No function");
  }

  if (kind === "commands") {
    return String(document.usage ?? document.role ?? document.id ?? "No usage");
  }

  if (kind === "socials") {
    return String(document.charNoArg ?? document.othersNoArg ?? document.id ?? "No emote text");
  }

  if (kind === "races") {
    return `Size ${document.size ?? "unknown"} / ${document.points ?? 0} points`;
  }

  return String(document.vnum ?? document.itemType ?? document.id ?? "No vnum");
}

export function isComplexValue(value: EditableValue | undefined): value is EditableValue[] | { [key: string]: EditableValue } {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

export function formatEditableValue(value: EditableValue | undefined) {
  if (value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

export function listToText(value: string[]) {
  return value.join("\n");
}

export function textToList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function textToLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function mapToText(value: Record<string, string>) {
  return Object.entries(value)
    .map(([key, mapValue]) => `${key}=${mapValue}`)
    .join("\n");
}

export function textToMap(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, item) => {
      const [key, ...valueParts] = item.split("=");
      const trimmedKey = key.trim();

      if (trimmedKey) {
        result[trimmedKey] = valueParts.join("=").trim();
      }

      return result;
    }, {});
}

export function startCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
