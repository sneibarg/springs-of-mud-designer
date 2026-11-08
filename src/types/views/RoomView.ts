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

export function roomFullName(room: RoomView): string {
  return `${room.vnum} - ${room.name}`;
}

export function roomHasExits(room: RoomView): boolean {
  return room.exits.length > 0;
}

export function roomHasMobiles(room: RoomView): boolean {
  return Object.keys(room.mobiles).length > 0;
}
