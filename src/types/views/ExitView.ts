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
