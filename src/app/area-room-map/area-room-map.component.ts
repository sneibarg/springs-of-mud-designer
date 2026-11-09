import { afterNextRender, Component, ElementRef, EventEmitter, Injector, Input, OnChanges, Output, SimpleChanges, ViewChild } from "@angular/core";
import {
  buildRoomMap, layoutRoomMap, oppositeDirection, roomExitStub, roomLinkPath, roomTile,
  type MapRoom, type RoomMapGraph,
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
  @Input() rooms: readonly unknown[] = [];
  @Input() draft?: unknown;
  @Input() draftInvalid = false;
  @Input() initialRoomId = "";
  @Input() loading = false;
  @Input() loadError = "";
  @Input() saving = false;
  @Output() editRoom = new EventEmitter<string>();
  @ViewChild("viewport") private viewport?: ElementRef<HTMLElement>;
  @ViewChild("mapRoot") private mapRoot?: ElementRef<HTMLElement>;

  readonly tile = roomTile;
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
  private revealed = new Set<string>();

  constructor(private readonly injector: Injector) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["areaId"]) {
      this.selectedRoom = undefined;
      this.positions.clear();
      this.revealed.clear();
      this.showAll = false;
      this.zoom = 1;
      this.drag = undefined;
    }
    if (!changes["areaId"] && !changes["rooms"] && !changes["draft"] && !changes["initialRoomId"]) return;

    this.graph = buildRoomMap(this.rooms, this.draft);
    this.roomOptions = [...this.graph.values()];
    const initial = this.graph.get(this.initialRoomId);
    const current = this.selectedRoom && this.graph.get(this.selectedRoom.id);
    const next = (changes["initialRoomId"] ? initial : undefined) ?? current ?? initial ?? this.roomOptions[0];
    this.positions = layoutRoomMap(this.graph, next?.id ?? "", this.positions);
    this.floors = [...new Set([...this.positions.values()].map((position) => position.floor))].sort((a, b) => a - b);
    this.selectedRoom = next;
    this.floor = next ? this.positions.get(next.id)!.floor : 0;
    if (next && next.id !== current?.id) {
      this.revealNearby(next);
      this.centerRoom();
    }
    this.refreshView();
  }

  private revealNearby(room: MapRoom): void {
    this.revealed.add(room.id);
    for (const exit of room.exits) {
      if (exit.targetId && this.positions.get(exit.targetId)?.floor === this.floor) this.revealed.add(exit.targetId);
    }
  }

  selectRoom(id: string, focus = false): void {
    const room = this.graph.get(id);
    const position = this.positions.get(id);
    if (!room || !position) return;
    const changedFloor = this.floor !== position.floor;
    this.selectedRoom = room;
    this.floor = position.floor;
    this.revealed.add(id);
    this.refreshView();
    if (changedFloor || !this.roomInView(id)) this.centerRoom();
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
