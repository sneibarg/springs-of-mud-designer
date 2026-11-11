import { directionNames } from "./constants";
import { parseSerializedExit } from "./logic";

export type RoomDirection = typeof directionNames[number];
export type RoomPosition = { x: number; y: number; floor: number };
type Position = RoomPosition;
export const unsavedRoomId = "new";

const steps: Record<RoomDirection, Position> = {
  north: { x: 0, y: -1, floor: 0 }, east: { x: 1, y: 0, floor: 0 },
  south: { x: 0, y: 1, floor: 0 }, west: { x: -1, y: 0, floor: 0 },
  up: { x: 0, y: 0, floor: 1 }, down: { x: 0, y: 0, floor: -1 },
};
export const oppositeDirection: Record<RoomDirection, RoomDirection> = {
  north: "south", east: "west", south: "north", west: "east", up: "down", down: "up",
};

export type MapExit = {
  direction?: RoomDirection;
  targetId?: string;
  destination: string;
  problem?: "Invalid exit" | "Missing destination" | "Ambiguous destination" | "Outside loaded rooms";
};

export type MapRoom = { id: string; name: string; vnum: string; exits: MapExit[] };
export type RoomMapGraph = Map<string, MapRoom>;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function reference(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "";
}

export function buildRoomMap(records: readonly unknown[], draft?: unknown, newRoom?: Record<string, unknown>): RoomMapGraph {
  const rooms: RoomMapGraph = new Map();
  const exitLists = new Map<string, readonly unknown[]>();
  const vnums = new Map<string, string[]>();
  for (const saved of newRoom ? [...records, { ...newRoom, id: unsavedRoomId }] : records) {
    if (!record(saved) || typeof saved["id"] !== "string" || !saved["id"] || rooms.has(saved["id"])) continue;
    const id = saved["id"];
    const source = record(draft) && draft["id"] === id && draft["areaId"] === saved["areaId"] ? draft : saved;
    const vnum = reference(source["vnum"]);
    const name = typeof source["name"] === "string" ? source["name"].trim() : "";
    rooms.set(id, { id, name: name || "Unnamed room", vnum, exits: [] });
    if (vnum) {
      const matches = vnums.get(vnum) ?? [];
      matches.push(id);
      vnums.set(vnum, matches);
    }
    const exits = source["exits"];
    exitLists.set(id, Array.isArray(exits) ? exits : exits == null ? [] : [exits]);
  }

  for (const room of rooms.values()) {
    room.exits = (exitLists.get(room.id) ?? []).map((raw): MapExit => {
      const invalid: MapExit = { destination: "", problem: "Invalid exit" };
      if (typeof raw !== "string") return invalid;
      try {
        const parsed = parseSerializedExit(raw);
        if (!record(parsed)) return invalid;
        const direction = directionNames[Number(reference(parsed["direction"]) || -1)];
        if (!direction) return invalid;

        const id = typeof parsed["to_room_id"] === "string" ? parsed["to_room_id"].trim() : "";
        const vnum = reference(parsed["to_room_vnum"]);
        const destination = vnum ? `Room ${vnum}` : id ? `Room ID ${id}` : "";
        // An explicit ID takes precedence. A vnum fallback must identify exactly one room.
        const matches = id ? (rooms.has(id) ? [id] : []) : vnums.get(vnum) ?? [];
        if (matches.length === 1) return { direction, targetId: matches[0], destination };
        if (matches.length > 1) return { direction, destination, problem: "Ambiguous destination" };
        return { direction, destination, problem: destination ? "Outside loaded rooms" : "Missing destination" };
      } catch {
        return invalid;
      }
    });
  }
  return rooms;
}

export function layoutRoomMap(
  rooms: RoomMapGraph, anchor: string, previous: ReadonlyMap<string, Position> = new Map(),
): Map<string, Position> {
  const positions = new Map<string, Position>();
  const occupied = new Set<string>();
  const key = ({ x, y, floor }: Position) => `${x}/${y}/${floor}`;
  let right = 0;
  function place(id: string, position: Position) {
    positions.set(id, position);
    occupied.add(key(position));
    right = Math.max(right, position.x);
  }
  function available(position: Position): Position {
    if (!occupied.has(key(position))) return position;
    for (let distance = 1; ; distance++) {
      for (let dx = -distance; dx <= distance; dx++) {
        const dy = distance - Math.abs(dx);
        for (const y of dy === 0 ? [position.y] : [position.y + dy, position.y - dy]) {
          const candidate = { x: position.x + dx, y, floor: position.floor };
          if (!occupied.has(key(candidate))) return candidate;
        }
      }
    }
  }

  const neighbors = new Map([...rooms.keys()].map((id) => [id, [] as { id: string; direction: RoomDirection }[]]));
  for (const room of rooms.values()) {
    for (const { direction, targetId } of room.exits) {
      if (!direction || !targetId) continue;
      neighbors.get(room.id)?.push({ id: targetId, direction });
    }
  }
  // Use incoming exits to place neighbors, while leaving travel directed in the graph.
  for (const room of rooms.values()) {
    for (const { direction, targetId } of room.exits) {
      if (direction && targetId) neighbors.get(targetId)?.push({ id: room.id, direction: oppositeDirection[direction] });
    }
  }
  for (const [id, position] of previous) {
    if (rooms.has(id)) place(id, available(position));
  }
  const visited = new Set<string>();
  for (const seed of [...positions.keys(), anchor, ...rooms.keys()]) {
    if (visited.has(seed) || !rooms.has(seed)) continue;
    if (!positions.has(seed)) place(seed, { x: positions.size ? right + 2 : 0, y: 0, floor: 0 });
    const queue = [seed];
    visited.add(seed);
    for (let i = 0; i < queue.length; i++) {
      const position = positions.get(queue[i])!;
      for (const neighbor of neighbors.get(queue[i]) ?? []) {
        if (visited.has(neighbor.id)) continue;
        visited.add(neighbor.id);
        queue.push(neighbor.id);
        if (positions.has(neighbor.id)) continue;
        const step = steps[neighbor.direction];
        place(neighbor.id, available({ x: position.x + step.x, y: position.y + step.y, floor: position.floor + step.floor }));
      }
    }
  }
  return positions;
}

export const roomTile = { width: 132, height: 56, stepX: 180, stepY: 102 };
type Point = Pick<Position, "x" | "y">;
const portX = roomTile.width / 2 + 3;
const portY = roomTile.height / 2 + 3;
const laneX = roomTile.stepX / 2 - 1;
const laneY = roomTile.stepY / 2 - 2;

export function roomLinkPath(from: Point, to: Point, direction: RoomDirection): string {
  const step = steps[direction];
  const start = { x: from.x * roomTile.stepX, y: from.y * roomTile.stepY };
  const end = { x: to.x * roomTile.stepX, y: to.y * roomTile.stepY };
  if (direction === "up" || direction === "down") {
    const sign = direction === "up" ? -1 : 1;
    return `M ${start.x + roomTile.width / 4} ${start.y + sign * portY} v ${sign * 14}`;
  }
  const approach = steps[oppositeDirection[direction]];
  const startPort = { x: start.x + step.x * portX, y: start.y + step.y * portY };
  const endPort = { x: end.x + approach.x * portX, y: end.y + approach.y * portY };
  if (to.x === from.x + step.x && to.y === from.y + step.y) {
    return `M ${startPort.x} ${startPort.y} L ${endPort.x} ${endPort.y}`;
  }
  // Route through the gaps between columns and rows when an exit cannot be drawn straight.
  const out = { x: start.x + step.x * laneX, y: start.y + step.y * laneY };
  const into = { x: end.x + approach.x * laneX, y: end.y + approach.y * laneY };
  const gutterX = approach.x ? into.x : end.x + laneX;
  const gutterY = step.y ? out.y : start.y + laneY;
  const approachY = approach.y ? into.y : end.y + laneY;
  return `M ${startPort.x} ${startPort.y} L ${out.x} ${out.y} V ${gutterY} H ${gutterX} V ${approachY} H ${into.x} V ${into.y} L ${endPort.x} ${endPort.y}`;
}

export function roomExitStub(from: Point, direction: RoomDirection): string {
  if (direction === "up" || direction === "down") return roomLinkPath(from, from, direction);
  const step = steps[direction];
  return `M ${from.x * roomTile.stepX + step.x * portX} ${from.y * roomTile.stepY + step.y * portY} l ${step.x * 17} ${step.y * 17}`;
}
