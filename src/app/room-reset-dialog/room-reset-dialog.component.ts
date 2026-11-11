import { ChangeDetectorRef, Component, ElementRef, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { createContentDocumentId } from "../../api";
import {
  isResetForRoom, isRoomResetCommand, roomResetCommands, validateRoomReset,
  type ResetField, type RoomReset, type RoomResetTarget,
} from "../../domain/room-reset";
import { SomApiService } from "../api.service";

type ResetScope = RoomResetTarget & { server: string; proxy: boolean };
const resetEndpoint = "/api/v1/resets";

@Component({
  selector: "som-room-reset-dialog",
  imports: [FormsModule],
  templateUrl: "./room-reset-dialog.component.html",
  styleUrl: "./room-reset-dialog.component.css",
})
export class RoomResetDialogComponent {
  @ViewChild("dialog") private dialog?: ElementRef<HTMLDialogElement>;

  readonly commands = roomResetCommands;
  readonly commandOptions = ["M", "O", "D", "R"] as const;
  room?: ResetScope;
  resets: (RoomReset & { id: string })[] = [];
  draft?: RoomReset;
  loading = false;
  saving = false;
  loadError = "";
  saveError = "";
  status = "";
  private baseline?: RoomReset;
  private newId?: string;

  constructor(private readonly api: SomApiService, private readonly changeDetector: ChangeDetectorRef) {}

  get dirty(): boolean {
    return JSON.stringify(this.draft) !== JSON.stringify(this.baseline);
  }

  get fields(): readonly ResetField[] {
    return this.draft ? this.commands[this.draft.command].fields : [];
  }

  open(scope: ResetScope): void {
    if (this.room || !this.dialog) return;
    this.room = { ...scope };
    this.resets = [];
    this.dialog.nativeElement.showModal();
    void this.loadResets();
  }

  close(): void {
    if (this.saving) return;
    this.room = undefined;
    this.draft = this.baseline = undefined;
    this.dialog?.nativeElement.close();
  }

  cancel(event: Event): void {
    event.preventDefault();
    if (!this.dirty) this.close();
  }

  async loadResets(): Promise<void> {
    const room = this.room;
    if (!room) return;
    this.loading = true;
    this.loadError = "";
    try {
      const resets = await this.api.list<unknown>(room.server, room.proxy,
        `${resetEndpoint}/area/${encodeURIComponent(room.areaId)}`);
      if (room !== this.room) return;
      this.resets = resets.filter((reset) => isResetForRoom(reset, room));
      this.selectReset(this.resets[0]?.id ?? "");
    } catch {
      if (room === this.room) this.loadError = "Could not load the resets for this room.";
    } finally {
      if (room === this.room) {
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  selectReset(id: string): void {
    if (!this.room || this.saving || this.dirty) return;
    this.baseline = this.resets.find((reset) => reset.id === id) ?? {
      areaId: this.room.areaId, command: "M", arg1: "", arg2: "", arg3: this.room.vnum, arg4: "", comment: "",
    };
    this.newId = undefined;
    this.restoreDraft();
  }

  restoreDraft(): void {
    if (!this.baseline || this.saving) return;
    this.draft = { ...this.baseline };
    this.saveError = this.status = "";
  }

  changeCommand(command: unknown): void {
    if (!this.draft || !this.room || !isRoomResetCommand(command)) return;
    const oldTarget = this.commands[this.draft.command].target;
    const newTarget = this.commands[command].target;
    this.draft = { ...this.draft, command, [oldTarget]: "", [newTarget]: this.room.vnum };
  }

  async save(): Promise<void> {
    const room = this.room;
    const draft = this.draft;
    if (!room || !draft || this.saving || this.loading || this.loadError) return;
    this.status = "";
    this.saveError = validateRoomReset(draft);
    if (this.saveError) return;
    const existing = !!draft.id;
    const id = draft.id ?? (this.newId ??= createContentDocumentId());
    const endpoint = existing ? `${resetEndpoint}/${encodeURIComponent(id)}` : resetEndpoint;
    const payload = { ...draft, id, areaId: room.areaId, [this.commands[draft.command].target]: room.vnum };
    this.saving = true;
    try {
      const saved = await this.api.save<unknown>(room.server, room.proxy, endpoint, payload, existing);
      if (!isResetForRoom(saved, room) || saved.id !== id) throw new Error("Unexpected reset response.");
      this.resets = existing
        ? this.resets.map((reset) => reset.id === id ? saved : reset)
        : [...this.resets, saved];
      this.baseline = saved;
      this.draft = { ...saved };
      this.status = existing ? "Reset updated." : "Reset created.";
    } catch (error) {
      this.saveError = error instanceof Error ? `Could not save reset. ${error.message}` : "Could not save reset.";
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }
}
