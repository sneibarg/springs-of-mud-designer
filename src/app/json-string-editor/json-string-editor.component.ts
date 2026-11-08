import { Component, EventEmitter, forwardRef, Input, OnChanges, OnDestroy, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { EditableValue } from "../../types/common";
import { parseJsonObjectString, type JsonEditorNode, type JsonEditorState } from "../../domain/json-editor";
import { JsonPayloadEditorComponent } from "../json-payload-editor/json-payload-editor.component";

@Component({
  selector: "som-json-string-editor",
  standalone: true,
  // The payload editor recursively renders value editors which embed this adapter.
  imports: [FormsModule, forwardRef(() => JsonPayloadEditorComponent)],
  templateUrl: "./json-string-editor.component.html",
  styleUrl: "./json-string-editor.component.css",
})
export class JsonStringEditorComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) node!: JsonEditorNode;
  @Input() label = "Entry";
  @Input() readonly = false;
  @Output() edited = new EventEmitter<void>();

  innerValue?: { [key: string]: EditableValue };
  sourceText = "";
  private baselineSource = "";
  private generation = 0;

  get sourceId(): string { return `json-string-source-${this.node.id}`; }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes["node"]) return;
    this.baselineSource = typeof this.node.scalar === "string" ? this.node.scalar : "";
    this.sourceText = this.baselineSource;
    this.innerValue = undefined;
    const generation = ++this.generation;
    try {
      this.innerValue = parseJsonObjectString(this.sourceText);
    } catch (error) {
      this.node.error = error instanceof Error ? error.message : "Enter a JSON object.";
      queueMicrotask(() => { if (generation === this.generation) this.edited.emit(); });
    }
  }

  ngOnDestroy(): void { this.generation++; }

  updateInner(state: JsonEditorState): void {
    if (this.readonly) return;
    if (state.status === "invalid") {
      this.node.error = state.issues.map((issue) => `${issue.path || '/'}: ${issue.message}`).join("; ");
      this.edited.emit();
      return;
    }
    if (!state.value || typeof state.value !== "object" || Array.isArray(state.value)) return;
    const text = state.dirty ? JSON.stringify(state.value) : this.baselineSource;
    const changed = text !== this.node.scalar || Boolean(this.node.error);
    this.innerValue = state.value;
    this.node.scalar = text;
    this.node.text = text;
    this.node.error = "";
    if (changed) this.edited.emit();
  }

  updateSource(text: string): void {
    if (this.readonly) return;
    this.sourceText = text;
    this.node.error = "Apply a valid JSON object before saving.";
    this.edited.emit();
  }

  applySource(): void {
    if (this.readonly) return;
    try {
      const value = parseJsonObjectString(this.sourceText);
      this.node.scalar = this.sourceText;
      this.node.text = this.sourceText;
      this.baselineSource = this.sourceText;
      this.node.error = "";
      this.innerValue = value;
    } catch (error) {
      this.node.error = error instanceof Error ? error.message : "Enter a JSON object.";
    }
    this.edited.emit();
  }
}
