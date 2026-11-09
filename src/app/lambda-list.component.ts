import { afterNextRender, Component, ElementRef, EventEmitter, Injector, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";

type LambdaRow = { source: string };

@Component({
  selector: "som-lambda-list",
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="structured-field" aria-label="Lambdas">
      <div class="structured-field-heading">
        <div><strong>Lambdas</strong><span>{{ rows.length }} ordered steps</span></div>
        <button class="secondary-button" type="button" (click)="add()" [disabled]="readonly">Add Lambda</button>
      </div>

      <div class="structured-list">
        @for (row of rows; track row; let index = $index) {
          <article class="guard-card" [draggable]="!readonly"
            (dragstart)="startDrag($event, row)" (dragend)="draggedRow = undefined"
            (dragover)="allowDrop($event)" (drop)="drop($event, index)">
            <div class="lambda-card-heading">
              <strong>Lambda {{ index + 1 }}</strong>
              <div class="guard-card-actions">
                <button class="secondary-button compact-button" type="button" (click)="move(row, index - 1)"
                  [disabled]="readonly || index === 0" [attr.aria-label]="'Move lambda ' + (index + 1) + ' up'">Move up</button>
                <button class="secondary-button compact-button" type="button" (click)="move(row, index + 1)"
                  [disabled]="readonly || index === rows.length - 1" [attr.aria-label]="'Move lambda ' + (index + 1) + ' down'">Move down</button>
                <button class="secondary-button compact-button" type="button" (click)="remove(index)"
                  [disabled]="readonly" [attr.aria-label]="'Remove lambda ' + (index + 1)">Remove</button>
              </div>
            </div>
            <div class="guard-card-fields single-field">
              <label>
                Python source for lambda {{ index + 1 }}
                <textarea [ngModel]="row.source" (ngModelChange)="updateSource(row, $event)" [disabled]="readonly"
                  rows="3" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
              </label>
            </div>
          </article>
        } @empty {
          <p class="structured-empty">No lambdas are configured for this command.</p>
        }
      </div>
    </section>
  `,
  styles: `
    .structured-field-heading span {
      display: block;
    }
    :host-context([data-theme="dark"]) .structured-field-heading span {
      color: #aebeb3;
    }
    .structured-field-heading button {
      white-space: nowrap;
    }
    .lambda-card-heading {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
  `,
})
export class LambdaListComponent implements OnChanges {
  @Input() lambdas: unknown;
  @Input() readonly = false;
  @Output() lambdasChange = new EventEmitter<string[]>();

  rows: LambdaRow[] = [];
  draggedRow?: LambdaRow;
  private emitted?: string[];

  constructor(private readonly host: ElementRef<HTMLElement>, private readonly injector: Injector) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes["lambdas"] || (this.emitted !== undefined && this.lambdas === this.emitted)) return;
    this.emitted = undefined;
    this.draggedRow = undefined;
    this.rows = Array.isArray(this.lambdas) && this.lambdas.every((source) => typeof source === "string")
      ? this.lambdas.map((source: string) => ({ source })) : [];
  }

  add(): void {
    if (this.readonly) return;
    this.rows.push({ source: "" });
    this.publish();
    this.focus(this.rows.length - 1);
  }

  updateSource(row: LambdaRow, source: string): void {
    if (this.readonly) return;
    row.source = source;
    this.publish();
  }

  remove(index: number): void {
    if (this.readonly) return;
    this.rows.splice(index, 1);
    this.publish();
    this.focus(Math.min(index, this.rows.length - 1));
  }

  move(row: LambdaRow, to: number): void {
    const from = this.rows.indexOf(row);
    if (this.readonly || from < 0 || to < 0 || to >= this.rows.length || from === to) return;
    this.rows.splice(from, 1);
    this.rows.splice(to, 0, row);
    this.publish();
    this.focus(to);
  }

  startDrag(event: DragEvent, row: LambdaRow): void {
    if (this.readonly) return;
    this.draggedRow = row;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-som-lambda-row", String(this.rows.indexOf(row)));
    }
  }

  allowDrop(event: DragEvent): void {
    if (this.readonly || !this.draggedRow) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  drop(event: DragEvent, index: number): void {
    if (!this.draggedRow) return;
    event.preventDefault();
    this.move(this.draggedRow, index);
    this.draggedRow = undefined;
  }

  private publish(): void {
    this.emitted = this.rows.map((row) => row.source);
    this.lambdasChange.emit(this.emitted);
  }

  private focus(index: number): void {
    afterNextRender(() => {
      const host = this.host.nativeElement;
      const target = index < 0 ? host.querySelector("button") : host.querySelectorAll("textarea")[index];
      target?.focus();
    }, { injector: this.injector });
  }
}
