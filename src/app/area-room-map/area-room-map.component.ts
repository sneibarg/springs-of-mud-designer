import { afterNextRender, Component, ElementRef, EventEmitter, Injector, Input, OnChanges, Output, SimpleChanges, ViewChild } from "@angular/core";
import {
  buildRoomMap, layoutRoomMap, oppositeDirection, roomExitStub, roomLinkPath, roomTile, unsavedRoomId,
  type MapRoom, type RoomMapGraph, type RoomPosition,
} from "../../domain/room-map";

type MapLink = { key: string; path: string; twoWay?: boolean; stub?: boolean };
const emptyGraph: RoomMapGraph = new Map();

@Component({
  selector: "som-area-room-map",
  standalone: true,
  templateUrl: "./area-room-map.component.html",
  styleUrl: "./area-room-map.component.css",
})
export class AreaRoomMapComponent implements OnChanges {
  @Input({ required: true }) areaId = "";
  @Input() areaName = "";
  @Input() server = "";
  @Input() rooms: readonly unknown[] = [];
  @Input() draft?: unknown;
  @Input() newRoom?: Record<string, unknown>;
  @Input() newRoomPosition?: RoomPosition;
  @Input() draftInvalid = false;
  @Input() initialRoomId = "";
  @Input() loading = false;
  @Input() loadError = "";
  @Input() saving = false;
  @Output() editRoom = new EventEmitter<{ id: string; pointer?: boolean }>();
  @Output() editResets = new EventEmitter<string>();
  @Output() placeRoom = new EventEmitter<RoomPosition>();
  @Output() moveNewRoom = new EventEmitter<RoomPosition>();
  @ViewChild("viewport") private viewport?: ElementRef<HTMLElement>;
  @ViewChild("mapPlane") private mapPlane?: ElementRef<HTMLElement>;
  @ViewChild("mapRoot") private mapRoot?: ElementRef<HTMLElement>;

  readonly tile = roomTile;
  readonly unsavedRoomId = unsavedRoomId;
  graph = emptyGraph;
  roomOptions: MapRoom[] = [];
  selectedRoom?: MapRoom;
  positions = layoutRoomMap(emptyGraph, "");
  floors: number[] = [];
  floor = 0;
  shownRooms: MapRoom[] = [];
  links: MapLink[] = [];
  showAll = false;
  zoom = 1;
  panX = 0;
  panY = 0;
  drag?: { pointer: number; x: number; y: number; panX: number; panY: number };
  draggingRoom?: { id?: string };
  placementMessage = "";
  private manualPositions = new Map<string, RoomPosition>();
  private revealed = new Set<string>();

  constructor(private readonly injector: Injector) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["areaId"] || changes["server"]) {
      this.selectedRoom = undefined;
      this.manualPositions = this.readPlacements();
      this.positions = new Map(this.manualPositions);
      this.revealed.clear();
      this.showAll = false;
      this.zoom = 1;
      this.panX = this.panY = 0;
      this.drag = undefined;
      this.draggingRoom = undefined;
      this.placementMessage = "";
    }
    if (!changes["areaId"] && !changes["server"] && !changes["rooms"] && !changes["draft"]
      && !changes["initialRoomId"] && !changes["newRoom"] && !changes["newRoomPosition"]) return;

    this.graph = buildRoomMap(this.rooms, this.draft, this.newRoom);
    this.roomOptions = [...this.graph.values()];
    const initial = this.graph.get(this.initialRoomId);
    const current = this.selectedRoom && this.graph.get(this.selectedRoom.id);
    const next = (changes["initialRoomId"] || changes["newRoom"] ? initial : undefined) ?? current ?? initial ?? this.roomOptions[0];
    const positions = new Map(this.manualPositions);
    if (this.newRoomPosition) positions.set(unsavedRoomId, this.newRoomPosition);
    for (const [id, position] of this.positions) {
      if (!positions.has(id)) positions.set(id, position);
    }
    this.positions = layoutRoomMap(this.graph, next?.id ?? "", positions);
    this.floors = [...new Set([...this.positions.values()].map((position) => position.floor))].sort((a, b) => a - b);
    this.selectedRoom = next;
    this.floor = next ? this.positions.get(next.id)!.floor : 0;
    if (next && next.id !== current?.id) {
      this.revealNearby(next);
      if (!this.roomInView(next.id)) this.centerRoom();
    }
    this.refreshView();
  }

  get canPlace(): boolean {
    return !!this.areaId && !this.loading && !this.saving && !this.loadError;
  }

  private get layoutKey(): string {
    return "som-designer-room-layout:" + JSON.stringify([this.server, this.areaId]);
  }

  private readPlacements(): Map<string, RoomPosition> {
    try {
      const raw: unknown = JSON.parse(window.localStorage.getItem(this.layoutKey) ?? "[]");
      if (Array.isArray(raw)) {
        return new Map(raw.filter((entry): entry is [string, RoomPosition] =>
          Array.isArray(entry) && typeof entry[0] === "string" &&
          Number.isSafeInteger(entry[1]?.x) && Number.isSafeInteger(entry[1]?.y) && Number.isSafeInteger(entry[1]?.floor)));
      }
    } catch {
      // A blocked or malformed layout preference falls back to the automatic layout.
    }
    return new Map();
  }

  rememberPlacement(id: string, position: RoomPosition): void {
    this.manualPositions.set(id, position);
    try {
      window.localStorage.setItem(this.layoutKey, JSON.stringify([...this.manualPositions]));
      this.placementMessage = "Layout saved in this browser.";
    } catch {
      this.placementMessage = "Browser storage is unavailable. This layout lasts until you leave the canvas.";
    }
  }

  startRoomDrag(event: DragEvent, id?: string): void {
    if (!this.canPlace || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    this.draggingRoom = { id };
    event.dataTransfer.effectAllowed = id ? "move" : "copy";
    event.dataTransfer.setData("text/plain", id ? "Move room" : "New room");
  }

  allowRoomDrop(event: DragEvent): void {
    if (!this.canPlace || !this.draggingRoom || !event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = this.draggingRoom.id ? "move" : "copy";
  }

  dropRoom(event: DragEvent): void {
    const drag = this.draggingRoom;
    const plane = this.mapPlane?.nativeElement.getBoundingClientRect();
    this.draggingRoom = undefined;
    if (!this.canPlace || !drag || !plane?.width) return;
    event.preventDefault();
    const position = {
      x: Math.round((event.clientX - plane.left) / (plane.width * this.tile.stepX)),
      y: Math.round((event.clientY - plane.top) / (plane.height * this.tile.stepY)),
      floor: this.floor,
    };
    if (drag.id) this.moveRoom(drag.id, position);
    else this.addRoom(position);
  }

  addRoom(position?: RoomPosition): void {
    if (!this.canPlace) return;
    const center = {
      x: Math.round(-this.panX / (this.zoom * this.tile.stepX)),
      y: Math.round(-this.panY / (this.zoom * this.tile.stepY)),
      floor: this.floor,
    };
    if (!position) {
      while (this.isOccupied(center)) center.x++;
    }
    const target = position ?? center;
    if (this.isOccupied(target)) {
      this.placementMessage = "That spot already contains a room. Choose an empty spot.";
      return;
    }
    this.placementMessage = "";
    this.placeRoom.emit(target);
  }

  nudgeRoom(id: string, x: number, y: number): void {
    const position = this.positions.get(id);
    if (position) this.moveRoom(id, { ...position, x: position.x + x, y: position.y + y });
  }

  private isOccupied(position: RoomPosition, except?: string): boolean {
    return [...this.positions].some(([id, placed]) => id !== except &&
      placed.x === position.x && placed.y === position.y && placed.floor === position.floor);
  }

  private moveRoom(id: string, position: RoomPosition): void {
    if (!this.canPlace || !this.positions.has(id)) return;
    if (this.isOccupied(position, id)) {
      this.placementMessage = "That spot already contains a room. Choose an empty spot.";
      return;
    }
    this.positions.set(id, position);
    if (id === unsavedRoomId) this.moveNewRoom.emit(position);
    else this.rememberPlacement(id, position);
    this.selectRoom(id);
  }

  private revealNearby(room: MapRoom): void {
    this.revealed.add(room.id);
    for (const exit of room.exits) {
      if (exit.targetId && this.positions.get(exit.targetId)?.floor === this.floor) this.revealed.add(exit.targetId);
    }
  }

  clickRoomNode(id: string, event: MouseEvent): void {
    if (event.detail > 1) return;
    const pointer = event.detail > 0;
    this.selectRoom(id, false, !pointer);
    this.editRoom.emit({ id, pointer });
  }

  selectRoom(id: string, focus = false, center = true): void {
    const room = this.graph.get(id);
    const position = this.positions.get(id);
    if (!room || !position) return;
    const changedFloor = this.floor !== position.floor;
    this.selectedRoom = room;
    this.floor = position.floor;
    this.revealed.add(id);
    this.refreshView();
    if (center && (changedFloor || !this.roomInView(id))) this.centerRoom();
    if (focus) {
      afterNextRender(() => {
        this.mapRoot?.nativeElement.querySelector<HTMLButtonElement>(".room-node[aria-pressed='true']")?.focus({ preventScroll: true });
      }, { injector: this.injector });
    }
  }

  selectFloor(value: string): void {
    const floor = Number(value);
    if (this.floor === floor) return;
    const room = this.roomOptions.find(({ id }) => this.positions.get(id)?.floor === floor);
    if (room) this.selectRoom(room.id);
    if (this.showAll) this.fitView();
  }

  toggleAllRooms(): void {
    this.showAll = !this.showAll;
    if (!this.showAll && this.selectedRoom) {
      this.revealed.clear();
      this.revealNearby(this.selectedRoom);
    }
    this.refreshView();
    if (this.showAll) this.fitView();
    else {
      this.zoom = 1;
      this.centerRoom();
    }
  }

  private refreshView(): void {
    this.shownRooms = this.roomOptions.filter(({ id }) =>
      this.positions.get(id)?.floor === this.floor && (this.showAll || this.revealed.has(id)));
    const visible = new Set(this.shownRooms.map(({ id }) => id));
    const links: MapLink[] = [];
    const rendered = new Set<string>();
    for (const room of this.shownRooms) {
      const from = this.positions.get(room.id)!;
      for (const [index, exit] of room.exits.entries()) {
        const { direction, targetId } = exit;
        if (!direction) continue;
        const key = JSON.stringify([room.id, index]);
        if (rendered.has(key)) continue;
        const target = targetId ? this.graph.get(targetId) : undefined;
        const vertical = direction === "up" || direction === "down";
        if (!target || vertical || !visible.has(target.id)) {
          if (this.selectedRoom?.id === room.id) links.push({ key, path: roomExitStub(from, direction), stub: true });
          continue;
        }
        const reverse = oppositeDirection[direction];
        const reverseIndex = target.exits.findIndex((candidate, index) =>
          candidate.targetId === room.id && candidate.direction === reverse
          && !rendered.has(JSON.stringify([target.id, index])));
        if (reverseIndex >= 0) rendered.add(JSON.stringify([target.id, reverseIndex]));
        rendered.add(key);
        links.push({
          key, path: roomLinkPath(from, this.positions.get(target.id)!, direction),
          twoWay: reverseIndex >= 0,
        });
      }
    }
    this.links = links;
  }

  nodeX(id: string): number { return this.positions.get(id)!.x * this.tile.stepX; }
  nodeY(id: string): number { return this.positions.get(id)!.y * this.tile.stepY; }
  floorLabel(floor: number): string { return floor === 0 ? "Starting level" : `Level ${floor > 0 ? "+" : ""}${floor}`; }

  private roomInView(id: string): boolean {
    const view = this.viewport?.nativeElement;
    if (!view) return false;
    return Math.abs(this.nodeX(id) * this.zoom + this.panX) + this.tile.width * this.zoom / 2 + 12 <= view.clientWidth / 2
      && Math.abs(this.nodeY(id) * this.zoom + this.panY) + this.tile.height * this.zoom / 2 + 12 <= view.clientHeight / 2;
  }

  centerRoom(): void {
    if (!this.selectedRoom) return;
    this.panX = -this.nodeX(this.selectedRoom.id) * this.zoom;
    this.panY = -this.nodeY(this.selectedRoom.id) * this.zoom;
  }

  fitView(): void {
    const view = this.viewport?.nativeElement;
    if (!view || !this.shownRooms.length) return;
    const xs = this.shownRooms.map(({ id }) => this.nodeX(id));
    const ys = this.shownRooms.map(({ id }) => this.nodeY(id));
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    this.zoom = Math.min(1, (view.clientWidth - 32) / (right - left + this.tile.stepX),
      (view.clientHeight - 32) / (bottom - top + this.tile.stepY));
    this.panX = -(left + right) / 2 * this.zoom;
    this.panY = -(top + bottom) / 2 * this.zoom;
  }

  changeZoom(factor: number): void {
    const next = Math.min(1.6, Math.max(Math.min(.15, this.zoom), this.zoom * factor));
    this.panX *= next / this.zoom;
    this.panY *= next / this.zoom;
    this.zoom = next;
  }

  startPan(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    const surface = this.viewport?.nativeElement;
    if (!surface) return;
    surface.setPointerCapture(event.pointerId);
    this.drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, panX: this.panX, panY: this.panY };
  }

  movePan(event: PointerEvent): void {
    if (this.drag?.pointer !== event.pointerId) return;
    this.panX = this.drag.panX + event.clientX - this.drag.x;
    this.panY = this.drag.panY + event.clientY - this.drag.y;
  }

  stopPan(event: PointerEvent): void {
    if (this.drag?.pointer === event.pointerId) this.drag = undefined;
  }

  panByKey(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    switch (event.key) {
      case "ArrowLeft": this.panX += 60; break;
      case "ArrowRight": this.panX -= 60; break;
      case "ArrowUp": this.panY += 60; break;
      case "ArrowDown": this.panY -= 60; break;
      default: return;
    }
    event.preventDefault();
  }
}
