import { CommonModule } from "@angular/common";
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { EditableValue } from "../types/common";

type GuardRecord = Record<string, EditableValue>;

@Component({
  selector: "som-guard-list",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="structured-field guard-list-editor" #guardList>
      <div class="structured-field-heading">
        <div>
          <strong>Guards</strong>
          <span>{{ normalizedGuards.length }} ordered checks</span>
        </div>
        <button class="secondary-button" type="button" (click)="addGuard()">Add Guard</button>
      </div>

      <p *ngIf="normalizedGuards.length === 0" class="structured-empty">
        No guards are configured for this record.
      </p>

      <div class="structured-list">
        <article
          *ngFor="let guard of normalizedGuards; let guardIndex = index; trackBy: trackGuard"
          class="guard-card"
          [attr.data-guard-key]="trackGuard(guardIndex, guard)"
          draggable="true"
          (dragstart)="onDragStart(guardIndex)"
          (dragover)="onDragOver($event)"
          (drop)="onDrop(guardIndex)"
        >
          <div class="guard-card-heading">
            <div>
              <strong>Guard {{ guardIndex + 1 }}</strong>
              <span>{{ guardSummary(guard) }}</span>
            </div>
            <div class="guard-card-actions">
              <button
                class="secondary-button compact-button"
                type="button"
                (click)="moveGuard(guardIndex, guardIndex - 1)"
                [disabled]="guardIndex === 0"
              >
                Move up
              </button>
              <button
                class="secondary-button compact-button"
                type="button"
                (click)="moveGuard(guardIndex, guardIndex + 1)"
                [disabled]="guardIndex === normalizedGuards.length - 1"
              >
                Move down
              </button>
              <button class="secondary-button compact-button" type="button" (click)="removeGuard(guardIndex)">
                Remove
              </button>
            </div>
          </div>

          <div class="guard-card-fields">
            <label>
              Message key
              <input
                [ngModel]="textValue(guard, 'messageKey')"
                [name]="'guard-message-key-' + guardIndex"
                (ngModelChange)="updateGuardField(guardIndex, 'messageKey', $event, true)"
              />
            </label>
            <label>
              Token factory
              <input
                [ngModel]="textValue(guard, 'tokenFactory')"
                [name]="'guard-token-factory-' + guardIndex"
                (ngModelChange)="updateGuardField(guardIndex, 'tokenFactory', $event)"
              />
            </label>
          </div>

          <div class="guard-card-fields single-field">
            <label>
              Predicate
              <textarea
                [ngModel]="textValue(guard, 'predicate')"
                [name]="'guard-predicate-' + guardIndex"
                rows="3"
                spellcheck="false"
                (ngModelChange)="updateGuardField(guardIndex, 'predicate', $event, true)"
              ></textarea>
            </label>
          </div>

          <div *ngIf="extraFieldNames(guard).length > 0" class="guard-card-fields">
            <label *ngFor="let fieldName of extraFieldNames(guard)">
              {{ startCase(fieldName) }}
              <input
                [ngModel]="textValue(guard, fieldName)"
                [name]="'guard-' + fieldName + '-' + guardIndex"
                (ngModelChange)="updateGuardField(guardIndex, fieldName, $event)"
              />
            </label>
          </div>
        </article>
      </div>
    </section>
  `,
})
export class GuardListComponent {
  @Input() guards: unknown = [];
  @Output() guardsChange = new EventEmitter<GuardRecord[]>();
  @ViewChild("guardList") private guardList?: ElementRef<HTMLElement>;

  private draggedIndex: number | null = null;
  private nextKey = 0;
  private readonly keys = new WeakMap<GuardRecord, number>();

  trackGuard = (_index: number, guard: GuardRecord): number => {
    let key = this.keys.get(guard);
    if (key === undefined) {
      key = this.nextKey++;
      this.keys.set(guard, key);
    }
    return key;
  };

  private focusGuard(guard?: GuardRecord): void {
    const key = guard ? this.trackGuard(0, guard) : null;
    setTimeout(() => {
      const selector = key === null ? ".structured-field-heading button" : `[data-guard-key="${key}"] input`;
      this.guardList?.nativeElement.querySelector<HTMLElement>(selector)?.focus();
    });
  }

  get normalizedGuards(): GuardRecord[] {
    return Array.isArray(this.guards)
      ? this.guards.map((guard) => (this.isGuardRecord(guard) ? guard : {}))
      : [];
  }

  addGuard(): void {
    const guard = { predicate: "", messageKey: "" };
    this.emitGuards([...this.normalizedGuards, guard]);
    this.focusGuard(guard);
  }

  removeGuard(index: number): void {
    const remaining = this.normalizedGuards.filter((_guard, guardIndex) => guardIndex !== index);
    this.emitGuards(remaining);
    this.focusGuard(remaining[Math.min(index, remaining.length - 1)]);
  }

  moveGuard(fromIndex: number, toIndex: number): void {
    if (toIndex < 0 || toIndex >= this.normalizedGuards.length || fromIndex === toIndex) {
      return;
    }

    const nextGuards = [...this.normalizedGuards];
    const [movedGuard] = nextGuards.splice(fromIndex, 1);
    nextGuards.splice(toIndex, 0, movedGuard);
    this.emitGuards(nextGuards);
    this.focusGuard(movedGuard);
  }

  onDragStart(index: number): void {
    this.draggedIndex = index;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(index: number): void {
    if (this.draggedIndex === null) {
      return;
    }

    this.moveGuard(this.draggedIndex, index);
    this.draggedIndex = null;
  }

  updateGuardField(index: number, fieldName: string, value: string, keepWhenBlank = false): void {
    const nextGuards = this.normalizedGuards.map((guard, guardIndex) => {
      if (guardIndex !== index) {
        return guard;
      }

      const nextGuard = { ...guard };
      this.keys.set(nextGuard, this.trackGuard(guardIndex, guard));

      if (!keepWhenBlank && !value.trim()) {
        delete nextGuard[fieldName];
      } else {
        nextGuard[fieldName] = value;
      }

      return nextGuard;
    });

    this.emitGuards(nextGuards);
  }

  textValue(guard: GuardRecord, fieldName: string): string {
    const value = guard[fieldName];

    if (value === undefined || value === null) {
      return "";
    }

    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }

  extraFieldNames(guard: GuardRecord): string[] {
    return Object.keys(guard).filter(
      (fieldName) => fieldName !== "predicate" && fieldName !== "messageKey" && fieldName !== "tokenFactory",
    );
  }

  guardSummary(guard: GuardRecord): string {
    return String(guard.messageKey ?? guard.predicate ?? "New guard");
  }

  startCase(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/^./, (character) => character.toUpperCase());
  }

  private emitGuards(guards: GuardRecord[]): void {
    this.guardsChange.emit(guards);
  }

  private isGuardRecord(value: unknown): value is GuardRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
