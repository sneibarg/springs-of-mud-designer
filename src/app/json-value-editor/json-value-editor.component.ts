import { CommonModule } from "@angular/common";
import { afterNextRender, Component, ElementRef, EventEmitter, Injector, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { JsonStringEditorComponent } from "../json-string-editor/json-string-editor.component";
import {
  createJsonNode, emptyJsonValue, jsonPointer, jsonValueTypes, pathContainsReadOnly,
  pathIsReadOnly, setJsonNodeType, updateJsonScalar,
  type JsonEditorNode, type JsonEditorOptions, type JsonFieldRule, type JsonValueType,
} from "../../domain/json-editor";

@Component({
  selector: "som-json-value-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, JsonStringEditorComponent],
  templateUrl: "./json-value-editor.component.html",
  styleUrl: "./json-value-editor.component.css",
})
export class JsonValueEditorComponent {
  @Input({ required: true }) node!: JsonEditorNode;
  @Input() path = "";
  @Input() label = "Payload";
  @Input() options: JsonEditorOptions = {};
  @Input() rule?: JsonFieldRule;
  @Input() readonly = false;
  @Input() showTools = false;
  @Output() edited = new EventEmitter<void>();

  adding = false;
  newKey = "";
  newType: JsonValueType = "string";
  actionError = "";
  changingType = false;
  pendingType: JsonValueType = "string";
  renamingId: number | null = null;
  renameText = "";
  removingId: number | null = null;
  childrenRendered = false;

  constructor(private readonly host: ElementRef<HTMLElement>, private readonly injector: Injector) {}

  get isCollection(): boolean { return this.node.type === "array" || this.node.type === "object"; }
  get renderChildren(): boolean { return this.node.expanded || this.childrenRendered; }
  get embeddedJson(): boolean { return this.node.type === "string" && this.rule?.stringFormat === "json-object"; }
  get codeEditor(): boolean { return this.node.type === "string" && this.rule?.editor === "code"; }
  get locked(): boolean { return this.readonly || pathIsReadOnly(this.path, this.options.readOnlyPaths); }
  get structureLocked(): boolean {
    return this.locked || pathContainsReadOnly(this.path, this.options.readOnlyPaths) || (this.path === "" && !!this.options.requireObject);
  }
  get orderLocked(): boolean {
    return this.locked || pathContainsReadOnly(this.path, this.options.readOnlyPaths);
  }
  get types(): readonly JsonValueType[] {
    return this.rule ? this.rule.nullable ? [this.rule.type, "null"] : [this.rule.type] : jsonValueTypes;
  }
  get entryType(): JsonValueType | undefined { return this.node.type === "array" ? this.rule?.itemType : this.rule?.propertyType; }
  get addTypes(): readonly JsonValueType[] { return this.entryType ? [this.entryType] : jsonValueTypes; }
  get controlId(): string { return `json-value-${this.node.id}`; }
  get errorId(): string { return `json-error-${this.node.id}`; }
  get actionErrorId(): string { return `json-action-error-${this.node.id}`; }

  toggleExpanded(): void {
    // Render a branch on first use, then retain its controls and invalid buffers.
    this.childrenRendered = true;
    this.node.expanded = !this.node.expanded;
  }

  useMultiline(): void {
    this.node.multiline = true;
    this.focus(`#${this.controlId}`);
  }

  cancelAction(action: "type" | "add" | "rename" | "remove", child?: JsonEditorNode): void {
    if (action === "type") this.changingType = false;
    if (action === "add") this.adding = false;
    if (action === "rename") this.renamingId = null;
    if (action === "remove") this.removingId = null;
    this.actionError = "";
    this.focus(action === "add" ? `[data-add-button="${this.node.id}"]` : `#json-value-${child?.id ?? this.node.id}`);
  }

  childPath(child: JsonEditorNode, index: number): string {
    return jsonPointer(this.path, this.node.type === "array" ? index : child.key);
  }
  childLabel(child: JsonEditorNode, index: number): string {
    return this.node.type === "array" ? `${this.rule?.itemLabel ?? `${this.label} item`} ${index + 1}`
      : this.options.rules?.[this.childPath(child, index)]?.label ?? child.key;
  }
  childRule(child: JsonEditorNode, index: number): JsonFieldRule | undefined {
    return this.options.rules?.[this.childPath(child, index)] ?? (this.entryType ? {
      type: this.entryType,
      ...(this.node.type === "object" && this.rule?.propertyInteger ? { integer: true } : {}),
      ...(this.node.type === "array" && this.rule?.itemStringFormat ? { stringFormat: this.rule.itemStringFormat } : {}),
      ...(this.node.type === "array" && this.rule?.itemEditor ? { editor: this.rule.itemEditor } : {}),
    } : undefined);
  }
  childLocked(child: JsonEditorNode, index: number): boolean {
    return this.locked || (this.node.type === "array" && this.orderLocked)
      || pathContainsReadOnly(this.childPath(child, index), this.options.readOnlyPaths);
  }
  scalarChanged(text: string): void {
    if (this.locked) return;
    updateJsonScalar(this.node, text);
    if (!this.node.error && this.rule?.integer && !Number.isInteger(this.node.scalar)) {
      this.node.error = "Enter a whole number.";
    }
    this.edited.emit();
  }
  booleanChanged(value: boolean): void {
    if (this.locked) return;
    this.node.scalar = value;
    this.edited.emit();
  }
  startTypeChange(): void {
    this.pendingType = this.node.type;
    this.changingType = true;
    this.focus(`[data-type-for="${this.node.id}"]`);
  }
  applyType(): void {
    if (this.structureLocked || !this.types.includes(this.pendingType)) return;
    if (this.pendingType !== this.node.type) {
      setJsonNodeType(this.node, this.pendingType);
      this.edited.emit();
    }
    this.changingType = false;
    this.focus(`#${this.controlId}`);
  }
  startAdd(): void {
    this.adding = true;
    this.newKey = "";
    this.newType = this.entryType ?? "string";
    this.actionError = "";
    this.focus(`[data-add-for="${this.node.id}"]`);
  }
  addCodeEntry(): void {
    if (this.rule?.itemEditor !== "code" || this.node.type !== "array") return;
    this.newType = "string";
    this.add();
  }
  add(): void {
    if (this.locked || (this.node.type === "array" && this.orderLocked) || !this.addTypes.includes(this.newType)) return;
    const key = this.node.type === "object" ? this.newKey : "";
    if (this.node.type === "object" && this.node.children.some((child) => child.key === key)) {
      this.actionError = "A property with that exact name already exists.";
      return;
    }
    if (pathContainsReadOnly(jsonPointer(this.path, key), this.options.readOnlyPaths)) {
      this.actionError = "That property is read-only.";
      return;
    }
    const initialValue = this.node.type === "array" && this.rule?.itemStringFormat === "json-object" ? "{}" : emptyJsonValue(this.newType);
    const child = createJsonNode(initialValue, key);
    this.node.children.push(child);
    this.node.expanded = true;
    this.adding = false;
    this.actionError = "";
    this.edited.emit();
    this.focus(`#json-value-${child.id}`);
  }
  startRename(child: JsonEditorNode): void {
    this.renamingId = child.id;
    this.renameText = child.key;
    this.actionError = "";
    this.focus(`[data-rename-for="${child.id}"]`);
  }
  rename(child: JsonEditorNode, index: number): void {
    if (this.childLocked(child, index)) return;
    if (this.node.children.some((entry) => entry !== child && entry.key === this.renameText)) {
      this.actionError = "A property with that exact name already exists.";
      return;
    }
    if (pathContainsReadOnly(jsonPointer(this.path, this.renameText), this.options.readOnlyPaths)) {
      this.actionError = "That property is read-only.";
      return;
    }
    child.key = this.renameText;
    this.renamingId = null;
    this.actionError = "";
    this.edited.emit();
    this.focus(`#json-value-${child.id}`);
  }
  remove(child: JsonEditorNode, index: number): void {
    if (this.childLocked(child, index)) return;
    this.node.children.splice(index, 1);
    this.removingId = null;
    this.edited.emit();
    const next = this.node.children[Math.min(index, this.node.children.length - 1)];
    this.focus(next ? `#json-value-${next.id}` : `[data-add-button="${this.node.id}"]`);
  }
  move(index: number, offset: number): void {
    if (this.locked || this.node.type !== "array") return;
    const target = index + offset;
    if (target < 0 || target >= this.node.children.length) return;
    if (this.node.children.some((child, childIndex) => this.childLocked(child, childIndex))) return;
    const [child] = this.node.children.splice(index, 1);
    this.node.children.splice(target, 0, child);
    this.edited.emit();
    this.focus(`#json-value-${child.id}`);
  }
  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }
}
