import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { EditableValue } from "../../types/common";
import {
  createJsonNode, isJsonValue, jsonNodeValue, nodeIssues, validateJsonValue,
  type JsonEditorNode, type JsonEditorOptions, type JsonEditorRules, type JsonEditorState, type JsonEditorIssue,
} from "../../domain/json-editor";
import { JsonValueEditorComponent } from "../json-value-editor/json-value-editor.component";

let nextEditorId = 0;

@Component({
  selector: "som-json-payload-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, JsonValueEditorComponent],
  templateUrl: "./json-payload-editor.component.html",
  styleUrl: "./json-payload-editor.component.css",
})
export class JsonPayloadEditorComponent implements OnChanges {
  @Input({ required: true }) documentKey: string | number = "";
  @Input({ required: true }) value: unknown = null;
  @Input() label = "Payload";
  @Input() readonly = false;
  @Input() requireObject = false;
  @Input() readOnlyPaths: readonly string[] = [];
  @Input() rules: JsonEditorRules = {};
  @Input() sectionCard = false;
  @Output() stateChange = new EventEmitter<JsonEditorState>();
  @ViewChild(JsonValueEditorComponent) private rootEditor?: JsonValueEditorComponent;

  readonly editorId = `json-editor-${nextEditorId++}`;
  mode: "form" | "json" = "form";
  showTools = false;
  root?: JsonEditorNode;
  rawText = "";
  issues: readonly JsonEditorIssue[] = [];
  hasIncomingValue = false;
  private incomingValue: unknown;
  private baseline: EditableValue = null;
  private baselineJson = "null";
  private lastEmittedValue: unknown;
  private resetVersion = 0;

  get options(): JsonEditorOptions {
    return { requireObject: this.requireObject, readOnlyPaths: this.readOnlyPaths, rules: this.rules };
  }
  get dirty(): boolean {
    return this.issues.length > 0 || (this.root !== undefined && JSON.stringify(jsonNodeValue(this.root)) !== this.baselineJson)
      || (this.mode === "json" && this.rawText !== JSON.stringify(this.baseline, null, 2));
  }
  get invalid(): boolean { return this.issues.length > 0; }

  addSectionEntry(): void {
    if (this.readonly || this.hasIncomingValue) return;
    if (this.rules[""]?.itemEditor === "code") this.rootEditor?.addCodeEntry();
    else this.rootEditor?.startAdd();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["documentKey"] || !this.root) {
      this.reset(this.value);
    } else if (changes["value"] && this.value !== this.lastEmittedValue) {
      if (this.dirty) {
        this.incomingValue = this.value;
        this.hasIncomingValue = true;
        const version = ++this.resetVersion;
        queueMicrotask(() => { if (version === this.resetVersion) this.publish(); });
      } else this.reset(this.value);
    } else if (changes["rules"] || changes["readOnlyPaths"] || changes["requireObject"]) {
      this.refreshIssues();
      const version = ++this.resetVersion;
      queueMicrotask(() => { if (version === this.resetVersion) this.publish(); });
    }
  }

  private reset(value: unknown): void {
    const version = ++this.resetVersion;
    this.hasIncomingValue = false;
    this.mode = "form";
    this.root = undefined;
    this.issues = [];
    if (isJsonValue(value)) {
      this.baseline = structuredClone(value);
      this.baselineJson = JSON.stringify(value);
      this.root = createJsonNode(value);
      this.rawText = JSON.stringify(value, null, 2);
      this.refreshIssues();
    } else {
      this.issues = [{ path: "", message: "Provide JSON data containing only objects, arrays, strings, finite numbers, booleans, and null." }];
    }
    // Input initialization must not change the parent's checked bindings mid-pass.
    queueMicrotask(() => { if (version === this.resetVersion) this.publish(); });
  }

  edited(): void {
    if (this.readonly || !this.root) return;
    this.resetVersion++;
    this.refreshIssues();
    this.publish();
  }

  editRaw(text: string): void {
    if (this.readonly) return;
    this.resetVersion++;
    this.rawText = text;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isJsonValue(parsed)) throw new Error("Use finite numbers and valid JSON values.");
      const issues = validateJsonValue(parsed, this.baseline, this.options);
      this.issues = issues;
      if (issues.length === 0) this.root = createJsonNode(parsed);
    } catch (error) {
      this.issues = [{ path: "", message: error instanceof Error ? error.message : "Enter valid JSON." }];
    }
    this.publish();
  }

  switchMode(mode: "form" | "json"): void {
    if (this.invalid || this.hasIncomingValue || mode === this.mode || !this.root) return;
    this.rawText = JSON.stringify(jsonNodeValue(this.root), null, 2);
    this.mode = mode;
  }

  keepDraft(): void {
    this.hasIncomingValue = false;
    this.publish();
  }

  loadIncoming(): void {
    this.reset(this.incomingValue);
  }

  private refreshIssues(): void {
    if (!this.root) return;
    const issues = [...nodeIssues(this.root), ...validateJsonValue(jsonNodeValue(this.root), this.baseline, this.options)];
    this.issues = [...new Map(issues.map((issue) => [JSON.stringify([issue.path, issue.message]), issue])).values()];
  }

  private publish(): void {
    if (this.invalid || !this.root || this.hasIncomingValue) {
      this.stateChange.emit({ status: "invalid", dirty: this.dirty, issues: this.hasIncomingValue
        ? [...this.issues, { path: "", message: "Resolve the incoming update before saving." }] : this.issues });
      return;
    }
    const value = jsonNodeValue(this.root);
    this.lastEmittedValue = value;
    this.stateChange.emit({ status: "valid", dirty: this.dirty, value });
  }
}
