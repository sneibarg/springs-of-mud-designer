type ResetArgument = "arg1" | "arg2" | "arg3" | "arg4";
export type ResetField = { argument: ResetArgument; label: string; integer?: boolean };

// The runtime reads the target room vnum from a different argument for each command.
export const roomResetCommands = {
  M: { label: "Load mobile", target: "arg3", fields: [
    { argument: "arg1", label: "Mobile vnum" },
    { argument: "arg2", label: "Global mobile limit", integer: true },
    { argument: "arg4", label: "Room mobile limit", integer: true },
  ] },
  O: { label: "Load item", target: "arg3", fields: [
    { argument: "arg1", label: "Item vnum" },
  ] },
  D: { label: "Set door state", target: "arg1", fields: [
    { argument: "arg2", label: "Exit direction (0 north, 1 east, 2 south, 3 west, 4 up, 5 down)", integer: true },
    { argument: "arg3", label: "Door state (0 open, 1 closed, 2 locked)", integer: true },
  ] },
  R: { label: "Randomize exits", target: "arg1", fields: [
    { argument: "arg2", label: "Number of direction slots", integer: true },
  ] },
} satisfies Record<string, { label: string; target: ResetArgument; fields: ResetField[] }>;

export type RoomResetCommand = keyof typeof roomResetCommands;
export type RoomReset = {
  id?: string;
  areaId: string;
  command: RoomResetCommand;
  comment?: string | null;
} & Partial<Record<ResetArgument, string | null>>;
export type RoomResetTarget = { areaId: string; vnum: string; name: string };

export function isRoomResetCommand(command: unknown): command is RoomResetCommand {
  return typeof command === "string" && Object.prototype.hasOwnProperty.call(roomResetCommands, command);
}

export function isResetForRoom(value: unknown, room: RoomResetTarget): value is RoomReset & { id: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const reset = value as Record<string, unknown>;
  const command = reset["command"];
  return typeof reset["id"] === "string" && !!reset["id"] && reset["areaId"] === room.areaId
    && isRoomResetCommand(command) && reset[roomResetCommands[command].target] === room.vnum
    && ["arg1", "arg2", "arg3", "arg4", "comment"].every((key) =>
      reset[key] == null || typeof reset[key] === "string");
}

export function validateRoomReset(reset: RoomReset): string {
  const fields: readonly ResetField[] = roomResetCommands[reset.command].fields;
  for (const { argument, integer, label } of fields) {
    const value = reset[argument]?.trim() ?? "";
    if (integer && !/^[+-]?\d+$/.test(value)) return `${label} must be a whole number.`;
    if (!value) return `${label} is required.`;
  }
  if (reset.command === "D") {
    const direction = Number(reset.arg2);
    const state = Number(reset.arg3);
    if (direction < 0 || direction > 5) return "Exit direction must be from 0 to 5.";
    if (state < 0 || state > 2) return "Door state must be from 0 to 2.";
  }
  return "";
}
