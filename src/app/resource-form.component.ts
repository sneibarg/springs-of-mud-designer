import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";

export type ResourceFormDocument = Record<string, unknown>;

@Component({
  selector: "som-resource-form",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="area-form resource-form" *ngIf="draft">
      <label *ngFor="let fieldName of fieldNames" [class.wide-field]="isComplexField(fieldName)">
        {{ startCase(fieldName) }}

        <input
          *ngIf="inputType(fieldName) === 'text'"
          [disabled]="fieldName === 'id'"
          [ngModel]="stringValue(fieldName)"
          [name]="fieldName"
          (ngModelChange)="updateString(fieldName, $event)"
        />

        <input
          *ngIf="inputType(fieldName) === 'number'"
          type="number"
          [ngModel]="numberValue(fieldName)"
          [name]="fieldName"
          (ngModelChange)="updateNumber(fieldName, $event)"
        />

        <label *ngIf="inputType(fieldName) === 'boolean'" class="proxy-toggle inline-toggle">
          <input
            type="checkbox"
            [ngModel]="booleanValue(fieldName)"
            [name]="fieldName"
            (ngModelChange)="updateBoolean(fieldName, $event)"
          />
          <span>{{ booleanValue(fieldName) ? 'Enabled' : 'Disabled' }}</span>
        </label>

        <textarea
          *ngIf="inputType(fieldName) === 'json'"
          [ngModel]="jsonValue(fieldName)"
          [name]="fieldName"
          rows="5"
          spellcheck="false"
          [attr.aria-invalid]="jsonErrors.has(fieldName) ? 'true' : null"
          [attr.aria-describedby]="jsonErrors.has(fieldName) ? 'field-error-' + fieldName : null"
          (ngModelChange)="updateJsonText(fieldName, $event)"
        ></textarea>
        <span *ngIf="jsonErrors.has(fieldName)" class="field-error" [id]="'field-error-' + fieldName" role="alert">
          {{ jsonErrors.get(fieldName) }}
        </span>
      </label>
    </form>
  `,
})
export class ResourceFormComponent implements OnChanges {
  @Input({ required: true }) draft: ResourceFormDocument = {};
  @Input({ required: true }) fieldNames: string[] = [];
  @Input() documentIdentity = 0;
  @Output() draftChange = new EventEmitter<ResourceFormDocument>();
  @Output() invalidJsonChange = new EventEmitter<boolean>();

  private jsonTextByField = new Map<string, string>();
  readonly jsonErrors = new Map<string, string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["documentIdentity"]) {
      this.jsonTextByField.clear();
      this.jsonErrors.clear();
    }
  }

  inputType(fieldName: string): "text" | "number" | "boolean" | "json" {
    const value = this.draft[fieldName];

    if (this.jsonTextByField.has(fieldName) || Array.isArray(value) || (typeof value === "object" && value !== null)) {
      return "json";
    }

    if (typeof value === "number") {
      return "number";
    }

    if (typeof value === "boolean") {
      return "boolean";
    }

    return "text";
  }

  isComplexField(fieldName: string): boolean {
    return this.inputType(fieldName) === "json" || /description|text|notes/i.test(fieldName);
  }

  stringValue(fieldName: string): string {
    const value = this.draft[fieldName];
    return value === undefined || value === null ? "" : String(value);
  }

  numberValue(fieldName: string): number {
    const value = this.draft[fieldName];
    return typeof value === "number" ? value : Number(value ?? 0);
  }

  booleanValue(fieldName: string): boolean {
    return Boolean(this.draft[fieldName]);
  }

  jsonValue(fieldName: string): string {
    if (this.jsonTextByField.has(fieldName)) {
      return this.jsonTextByField.get(fieldName) ?? "";
    }

    return JSON.stringify(this.draft[fieldName] ?? null, null, 2);
  }

  updateString(fieldName: string, value: string): void {
    this.updateDraft(fieldName, value);
  }

  updateNumber(fieldName: string, value: number | string): void {
    this.updateDraft(fieldName, Number(value ?? 0));
  }

  updateBoolean(fieldName: string, value: boolean): void {
    this.updateDraft(fieldName, value);
  }

  updateJsonText(fieldName: string, value: string): void {
    this.jsonTextByField.set(fieldName, value);
    try {
      const parsed = JSON.parse(value) as unknown;
      this.jsonErrors.delete(fieldName);
      this.invalidJsonChange.emit(this.jsonErrors.size > 0);
      this.updateDraft(fieldName, parsed);
    } catch (error) {
      this.jsonErrors.set(fieldName, error instanceof Error ? error.message : "Enter valid JSON.");
      this.invalidJsonChange.emit(true);
    }
  }

  startCase(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/^./, (character) => character.toUpperCase());
  }

  private updateDraft(fieldName: string, value: unknown): void {
    this.draftChange.emit({
      ...this.draft,
      [fieldName]: value,
    });
  }
}
