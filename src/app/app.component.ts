import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SomApiService } from "./api.service";
import { GuardListComponent } from "./guard-list.component";
import { AreaRoomMapComponent } from "./area-room-map/area-room-map.component";
import { LambdaListComponent } from "./lambda-list.component";
import { ResourceFormComponent, type ResourceFormDocument } from "./resource-form.component";
import { JsonPayloadEditorComponent } from "./json-payload-editor/json-payload-editor.component";
import { itemEditorRules } from "../domain/item-editor";
import { gameEditorRules } from "../domain/game-editor";
import { commandJsonFields, commandJsonRules, skillJsonFields, skillJsonRules } from "../domain/ability-editor";
import { mobileEditorRules, roomEditorRules, specialEditorRules } from "../domain/world-resource-editor";
import { isJsonValue, validateJsonValue, type JsonEditorRules, type JsonEditorState } from "../domain/json-editor";
import { apiResources, workQueue } from "../data";
import {
  buildApiUrl,
  resolveFetchBaseUrl,
  loadDesignerSettings,
  readSavedApiBaseUrl,
  readSavedApiProxyEnabled,
  readSavedTheme,
  saveDesignerSettings,
} from "../api";
import type { DesignerTheme } from "../api";
import type { ApiHealth, ApiResource, EditableValue, FeatureKind } from "../types/common";
import {
  abilitiesNavItem,
  abilityChildNavItems,
  areaChildNavItems,
  areaNavItem,
  editableResourceKinds,
  emptyAreaDraft,
  emptyMobileDraft,
  emptyRoomDraft,
  topLevelEditableResourceKinds,
  navItems,
} from "../domain/constants";
import type { AreaView, EditableResourceDocument, MobileView, RoomView } from "../domain/types";
import {
  compareAreas,
  compareEditableResourceDocuments,
  compareMobiles,
  compareRooms,
  documentDisplayName,
  documentSecondaryLabel,
  getEmptyEditableResourceDraft,
  normalizeArea,
  normalizeEditableResourceDocument,
  normalizeMobile,
  normalizeRoom,
  validateEditableResourceDocument,
  validateMobile,
  validateRoom,
} from "../domain/logic";

type ResourceDocument = Record<string, unknown> & {
  id?: string;
  areaId?: string;
  name?: string;
  vnum?: string | number;
};
type ResourceStatus = "idle" | "loading" | "saving";

@Component({
  selector: "som-root",
  standalone: true,
  imports: [CommonModule, FormsModule, GuardListComponent, LambdaListComponent, ResourceFormComponent, JsonPayloadEditorComponent, AreaRoomMapComponent],
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit {
  readonly payloadReadOnlyPaths = ["/id"];

  usesJsonPayloadEditor(): boolean {
    return this.activeKind === "items" || this.activeKind === "mobiles" || this.activeKind === "rooms" || this.activeKind === "specials" || this.activeKind === "game";
  }

  get payloadEditorRules(): JsonEditorRules {
    return this.activeKind === "game" ? gameEditorRules : this.activeKind === "specials" ? specialEditorRules
      : this.activeKind === "mobiles" ? mobileEditorRules : this.activeKind === "rooms" ? roomEditorRules : itemEditorRules;
  }

  get payloadEditorLabel(): string {
    return this.activeKind === "game" ? "Game Data" : this.activeKind === "specials" ? "Special"
      : this.activeKind === "mobiles" ? "Mobile" : this.activeKind === "rooms" ? "Room" : "Item";
  }
  readonly apiResources = apiResources;
  readonly workQueue = workQueue;
  readonly navItems = navItems;
  readonly areaNavItem = areaNavItem;
  readonly areaChildNavItems = areaChildNavItems;
  readonly abilitiesNavItem = abilitiesNavItem;
  readonly abilityChildNavItems = abilityChildNavItems;
  gamePreviewExpanded = false;
  areasNavExpanded = true;
  abilitiesNavExpanded = true;
  roomMapVisible = false;
  roomMapOpened = false;
  roomMapLoadError = "";

  activeKind: FeatureKind = "spells";
  apiBaseUrl = readSavedApiBaseUrl();
  apiBaseUrlInput = this.apiBaseUrl;
  useDevProxy = readSavedApiProxyEnabled();
  theme: DesignerTheme = readSavedTheme();
  health: ApiHealth = {
    state: "checking",
    detail: "Checking Java API",
  };
  areas: AreaView[] = [];
  resourceDocuments: ResourceDocument[] = [];
  resourceDraft: ResourceDocument = this.createEmptyDraft("spells");
  resourceDraftText = this.toPrettyJson(this.resourceDraft);
  resourceMessage = "";
  rawJsonError = "";
  private structuredFieldInvalid = false;
  private readonly invalidJsonFields = new Set<string>();
  private readonly emptyJsonField = {};
  searchQuery = "";
  editorIdentity = 0;
  private baseline = this.resourceDraftText;
  private draftRevision = 0;
  private workspaceVersion = 0;
  private loadVersion = 0;
  private loading = false;
  private saving = false;
  private serverIdentity = buildApiUrl(this.apiBaseUrl, this.useDevProxy, "");
  @ViewChild("unsavedDialog") private unsavedDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild("roomEditorTab") private roomEditorTab?: ElementRef<HTMLButtonElement>;
  private pendingDraftDecision?: (discard: boolean) => void;
  selectedResourceId = "new";
  selectedResourceAreaId = "";

  constructor(private readonly api: SomApiService, private readonly changeDetector: ChangeDetectorRef) {}

  get resourceStatus(): ResourceStatus {
    return this.saving ? "saving" : this.loading ? "loading" : "idle";
  }

  get isDirty(): boolean {
    return this.fieldJsonInvalid || this.resourceDraftText !== this.baseline;
  }

  get fieldJsonInvalid(): boolean {
    return this.structuredFieldInvalid || this.invalidJsonFields.size > 0;
  }

  get jsonEditorFields() {
    if (this.activeKind === "skills") return skillJsonFields;
    if (this.activeKind === "commands") return commandJsonFields;
    return [];
  }

  jsonFieldValue(key: string): unknown {
    return this.resourceDraft[key] ?? this.emptyJsonField;
  }

  get saveBlocked(): boolean {
    return this.activeKind === "game" || this.saving || this.loading || this.fieldJsonInvalid || Boolean(this.rawJsonError);
  }

  get filteredDocuments(): ResourceDocument[] {
    const query = this.searchQuery.trim().toLocaleLowerCase();
    return query ? this.resourceDocuments.filter((document) =>
      JSON.stringify(document).toLocaleLowerCase().includes(query)) : this.resourceDocuments;
  }

  get roomMapAreaName(): string {
    return this.areas.find((area) => area.id === this.selectedResourceAreaId)?.name ?? "";
  }

  get roomMapDraft(): ResourceDocument | undefined {
    return this.selectedResourceId !== "new" && this.isDirty && this.resourceDraft.areaId === this.selectedResourceAreaId
      ? this.resourceDraft : undefined;
  }

  openRoomMap(): void {
    this.roomMapOpened = true;
    this.roomMapVisible = true;
  }

  async editRoomFromMap(id: string): Promise<void> {
    await this.selectResource(id);
    if (this.activeKind === "rooms" && this.selectedResourceId === id) {
      this.roomMapVisible = false;
      this.changeDetector.markForCheck();
      this.roomEditorTab?.nativeElement.focus();
    }
  }

  @HostListener("window:beforeunload", ["$event"])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  }

  private async canReplaceDraft(): Promise<boolean> {
    if (!this.isDirty) return true;
    if (this.pendingDraftDecision) return false;
    return new Promise<boolean>((resolve) => {
      this.pendingDraftDecision = resolve;
      this.unsavedDialog?.nativeElement.showModal();
    });
  }

  finishDraftDecision(discard: boolean): void {
    this.unsavedDialog?.nativeElement.close();
    this.pendingDraftDecision?.(discard);
    this.pendingDraftDecision = undefined;
  }

  async saveAndContinue(): Promise<void> {
    await this.saveActiveDocument();
    if (!this.isDirty) this.finishDraftDecision(true);
  }

  private invalidateWorkspace(): void {
    this.workspaceVersion++;
    this.loadVersion++;
    this.loading = false;
  }

  private replaceDraft(document: ResourceDocument, selectedId = "new"): void {
    this.gamePreviewExpanded = false;
    this.resourceDraft = structuredClone(document);
    this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
    this.baseline = this.resourceDraftText;
    this.selectedResourceId = selectedId;
    this.rawJsonError = "";
    this.structuredFieldInvalid = false;
    this.invalidJsonFields.clear();
    this.editorIdentity++;
    this.draftRevision++;
  }

  updateRawJson(text: string): void {
    if (this.fieldJsonInvalid) return;
    this.resourceDraftText = text;
    this.draftRevision++;
    try {
      this.resourceDraft = this.parseDraft(text);
      this.rawJsonError = "";
      this.editorIdentity++;
    } catch (error) {
      this.rawJsonError = error instanceof Error ? error.message : "Invalid JSON.";
    }
  }

  updateFieldValidity(invalid: boolean): void {
    this.structuredFieldInvalid = invalid;
    this.draftRevision++;
  }

  updatePayloadEditor(state: JsonEditorState, documentKey: string | number = this.editorIdentity): void {
    if (!this.usesJsonPayloadEditor() || documentKey !== this.editorIdentity) return;
    this.structuredFieldInvalid = state.status === "invalid";
    if (state.status === "valid") {
      if (!state.value || typeof state.value !== "object" || Array.isArray(state.value)) {
        this.structuredFieldInvalid = true;
        return;
      }
      this.resourceDraft = state.value as ResourceDocument;
      this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
    }
    this.draftRevision++;
    this.changeDetector.markForCheck();
  }

  updateJsonField(key: string, state: JsonEditorState, documentKey: string | number): void {
    if (documentKey !== this.editorIdentity || this.rawJsonError || !this.jsonEditorFields.some((field) => field.key === key)) return;
    const wasInvalid = this.invalidJsonFields.has(key);
    if (state.status === "invalid") this.invalidJsonFields.add(key);
    else this.invalidJsonFields.delete(key);
    if (wasInvalid !== this.invalidJsonFields.has(key)) {
      this.draftRevision++;
      this.changeDetector.markForCheck();
    }
    // Opening a field preserves null or omitted values and raw text formatting.
    if (state.status === "valid" && JSON.stringify(state.value) !== JSON.stringify(this.jsonFieldValue(key))) {
      this.updateResourceDraft({ ...this.resourceDraft, [key]: state.value });
    }
  }

  get activeFieldNames(): string[] {
    const fieldNames = new Set(["id", ...this.activeResource.fields]);

    if (this.requiresAreaFilter() || "areaId" in this.resourceDraft) {
      fieldNames.add("areaId");
    }

    Object.keys(this.resourceDraft).forEach((fieldName) => fieldNames.add(fieldName));

    return [...fieldNames];
  }

  get structuredFieldNames(): string[] {
    const excludedFields = this.jsonEditorFields.map(({ key }) => key);
    if (this.usesGuardCards()) excludedFields.push("guards");
    if (this.activeKind === "commands") excludedFields.push("lambdas");
    return this.activeFieldNames.filter((fieldName) => !excludedFields.includes(fieldName));
  }

  get activeResource(): ApiResource {
    return this.apiResources.find((resource) => resource.kind === this.activeKind) ?? this.apiResources[0];
  }

  get readyEditorCount(): number {
    return this.apiResources.filter((resource) => resource.status === "Ready").length;
  }

  get createRequest(): unknown {
    try {
      const operation = this.buildSaveOperation();
      return {
        method: operation.isExistingDocument ? "PUT" : "POST",
        url: buildApiUrl(this.apiBaseUrl, this.useDevProxy, operation.endpoint),
        routing: resolveFetchBaseUrl(this.apiBaseUrl, this.useDevProxy) === ""
          ? "Same-origin /api; development target is configured in proxy.conf.json."
          : "Direct to configured API server",
        body: operation.payload,
      };
    } catch (error) {
      return { blocked: error instanceof Error ? error.message : "Correct the draft before saving." };
    }
  }

  ngOnInit(): void {
    this.applyTheme(this.theme);
    void this.loadSettings();
  }

  async setActiveKind(kind: FeatureKind): Promise<void> {
    if (kind === this.activeKind || !await this.canReplaceDraft()) return;
    this.invalidateWorkspace();
    this.activeKind = kind;
    this.searchQuery = "";
    this.resetResourceWorkspace();
    this.changeDetector.markForCheck();
    if (kind !== "settings") void this.loadActiveKindData();
  }

  async applyApiBaseUrl(): Promise<void> {
    try {
      const settings = await saveDesignerSettings({
        apiBaseUrl: this.apiBaseUrlInput,
        useDevProxy: this.useDevProxy,
        theme: this.theme,
      });
      this.applySettings(settings.apiBaseUrl, settings.useDevProxy, settings.theme);
      await this.refreshHealth();
    } catch (error) {
      this.health = {
        state: "offline",
        detail: error instanceof Error ? error.message : "Unable to save designer settings.",
      };
    }
  }

  async testApiBaseUrl(): Promise<void> {
    this.health = await this.api.checkHealth(this.apiBaseUrlInput, this.useDevProxy);
  }

  async toggleDevProxy(): Promise<void> {
    try {
      const settings = await saveDesignerSettings({
        apiBaseUrl: this.apiBaseUrl,
        useDevProxy: this.useDevProxy,
        theme: this.theme,
      });
      this.applySettings(settings.apiBaseUrl, settings.useDevProxy, settings.theme);
    } catch (error) {
      this.health = {
        state: "offline",
        detail: error instanceof Error ? error.message : "Unable to save designer settings.",
      };
    }
  }

  async toggleTheme(): Promise<void> {
    try {
      const settings = await saveDesignerSettings({
        apiBaseUrl: this.apiBaseUrl,
        useDevProxy: this.useDevProxy,
        theme: this.theme,
      });
      this.applySettings(settings.apiBaseUrl, settings.useDevProxy, settings.theme);
    } catch (error) {
      this.health = {
        state: "offline",
        detail: error instanceof Error ? error.message : "Unable to save designer settings.",
      };
    }
  }

  async loadActiveDocuments(confirmDiscard = true): Promise<void> {
    if (confirmDiscard && !await this.canReplaceDraft()) return;
    const resource = this.activeResource;
    if (resource.kind === "rooms") this.roomMapLoadError = "";
    const endpoint = this.buildListEndpoint(resource);
    const workspace = this.workspaceVersion;
    const request = ++this.loadVersion;
    const revision = this.draftRevision;
    const selection = this.selectedResourceId;
    const isCurrent = () => workspace === this.workspaceVersion && request === this.loadVersion;
    if (!endpoint) {
      this.resourceDocuments = [];
      this.resourceMessage = "Select an area to load " + resource.label.toLowerCase() + ".";
      this.changeDetector.markForCheck();
      return;
    }
    this.loading = true;
    this.resourceMessage = "Loading " + resource.label.toLowerCase() + "…";
    this.changeDetector.markForCheck();
    try {
      const payload = await this.api.list<unknown>(this.apiBaseUrl, this.useDevProxy, endpoint);
      if (!isCurrent()) return;
      this.resourceDocuments = payload
        .map((document) => this.normalizeDocument(document, resource.kind))
        .sort((left, right) => this.compareDocuments(left, right));
      if (resource.kind === "areas") this.areas = this.resourceDocuments.map((document) => normalizeArea(document as AreaView));
      this.resourceMessage = "Loaded " + this.resourceDocuments.length + " " + resource.label.toLowerCase() + ".";
      if (revision === this.draftRevision && (confirmDiscard || !this.isDirty)) this.openResource(selection);
    } catch (error) {
      if (!isCurrent()) return;
      this.resourceMessage = "Could not load " + resource.label.toLowerCase() + ": " + (error instanceof Error ? error.message : "Request failed.");
      if (resource.kind === "rooms") this.roomMapLoadError = this.resourceMessage;
    } finally {
      if (isCurrent()) {
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  async selectResource(documentId: string): Promise<void> {
    if (documentId === this.selectedResourceId || !await this.canReplaceDraft()) return;
    this.invalidateWorkspace();
    this.openResource(documentId);
    this.changeDetector.markForCheck();
  }

  private openResource(documentId: string): void {
    const selected = this.resourceDocuments.find((document) => document.id === documentId);
    this.replaceDraft(selected ?? this.newDraftForArea(), selected?.id ?? "new");
  }

  private newDraftForArea(): ResourceDocument {
    const draft = this.createEmptyDraft(this.activeKind);
    return this.requiresAreaFilter() ? { ...draft, areaId: this.selectedResourceAreaId } : draft;
  }

  async createNewResource(): Promise<void> {
    if (!await this.canReplaceDraft()) return;
    this.invalidateWorkspace();
    this.replaceDraft(this.newDraftForArea());
    this.roomMapVisible = false;
    this.changeDetector.markForCheck();
  }

  updateResourceDraft(nextDraft: ResourceFormDocument): void {
    if (this.rawJsonError) return;
    this.resourceDraft = nextDraft as ResourceDocument;
    this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
    this.draftRevision++;
  }

  updateResourceGuards(guards: Record<string, EditableValue>[]): void {
    this.updateResourceDraft({
      ...this.resourceDraft,
      guards,
    });
  }

  private buildSaveOperation(): { payload: ResourceDocument; endpoint: string; isExistingDocument: boolean } {
    if (this.activeKind === "game") throw new Error("The Game Data API supports loading only. Edits remain local.");
    if (this.fieldJsonInvalid) throw new Error("Correct invalid field JSON before saving.");
    if (this.rawJsonError) throw new Error(this.rawJsonError);
    const payload = this.normalizeDocument(this.parseDraft(this.resourceDraftText), this.activeKind);
    if (this.selectedResourceId !== "new") payload.id = this.selectedResourceId;
    const message = this.validateDocument(payload, this.activeResource);
    if (message) throw new Error(message);
    const isExistingDocument = Boolean(payload.id);
    return {
      payload,
      isExistingDocument,
      endpoint: isExistingDocument ? this.activeResource.endpoint + "/" + payload.id : this.activeResource.endpoint,
    };
  }

  async saveActiveDocument(): Promise<void> {
    if (this.saving || this.loading) return;
    let operation: ReturnType<AppComponent["buildSaveOperation"]>;
    try {
      operation = this.buildSaveOperation();
    } catch (error) {
      this.resourceMessage = error instanceof Error ? error.message : "Correct the draft before saving.";
      return;
    }
    const { payload, endpoint, isExistingDocument } = operation;
    const resource = this.activeResource;
    const workspace = this.workspaceVersion;
    const revision = this.draftRevision;
    this.saving = true;
    this.resourceMessage = "Saving document…";
    try {
      const response = await this.api.save<unknown>(this.apiBaseUrl, this.useDevProxy, endpoint, payload, isExistingDocument);
      const saved = this.normalizeDocument(response, resource.kind);
      if (workspace !== this.workspaceVersion) return;
      this.resourceDocuments = this.resourceDocuments.filter((document) => document.id !== saved.id);
      if (!this.requiresAreaFilter(resource.kind) || saved.areaId === this.selectedResourceAreaId) {
        this.resourceDocuments = [...this.resourceDocuments, saved].sort((left, right) => this.compareDocuments(left, right));
      }
      if (resource.kind === "areas") {
        this.areas = [...this.areas.filter((area) => area.id !== saved.id), normalizeArea(saved as AreaView)].sort(compareAreas);
      }
      if (revision === this.draftRevision) {
        this.replaceDraft(saved, saved.id ?? "new");
      } else {
        // Attach a server-assigned identity without replacing newer edits.
        this.resourceDraft = { ...this.resourceDraft, id: saved.id };
        try {
          const newer = this.parseDraft(this.resourceDraftText);
          this.resourceDraftText = this.toPrettyJson({ ...newer, id: saved.id });
        } catch {
          // Preserve invalid raw text verbatim; keep the identity separately.
        }
        this.selectedResourceId = saved.id ?? "new";
        this.baseline = this.toPrettyJson(saved);
      }
      this.resourceMessage = (isExistingDocument ? "Updated" : "Created") + " document." + (this.isDirty ? " Newer edits remain unsaved." : "");
    } catch (error) {
      if (workspace === this.workspaceVersion) this.resourceMessage = "Could not save " + resource.label.toLowerCase() + ": " + (error instanceof Error ? error.message : "Request failed.");
    } finally {
      this.saving = false;
      this.changeDetector.markForCheck();
    }
  }

  async onAreaFilterChange(areaId: string, select?: HTMLSelectElement): Promise<void> {
    if (areaId === this.selectedResourceAreaId) return;
    if (!await this.canReplaceDraft()) {
      if (select) select.value = this.selectedResourceAreaId;
      return;
    }
    this.invalidateWorkspace();
    this.selectedResourceAreaId = areaId;
    this.resourceDocuments = [];
    this.replaceDraft(this.newDraftForArea());
    void this.loadActiveDocuments(false);
  }

  resourceLabel(document: ResourceDocument): string {
    if (this.activeKind === "areas") {
      return document.name || String(document.vnum ?? document.id ?? "Unnamed area");
    }

    if (this.activeKind === "rooms" || this.activeKind === "mobiles") {
      return String(document.name ?? document.vnum ?? document.id ?? "Unnamed document");
    }

    return documentDisplayName(document as EditableResourceDocument, this.activeKind);
  }

  resourceSecondaryLabel(document: ResourceDocument): string {
    if (this.activeKind === "areas") {
      return String(document.vnum ?? document.id ?? "No vnum");
    }

    if (this.activeKind === "rooms" || this.activeKind === "mobiles") {
      return String(document.vnum ?? document.areaId ?? document.id ?? "No vnum");
    }

    return documentSecondaryLabel(document as EditableResourceDocument, this.activeKind);
  }

  requiresAreaFilter(kind = this.activeKind): boolean {
    return ["rooms", "mobiles", ...editableResourceKinds].includes(kind) && kind !== "areas";
  }

  usesGuardCards(kind = this.activeKind): boolean {
    return kind === "commands" || kind === "spells" || kind === "skills";
  }

  private resetResourceWorkspace(): void {
    this.roomMapVisible = false;
    this.roomMapOpened = false;
    this.roomMapLoadError = "";
    this.resourceDocuments = [];
    this.replaceDraft(this.newDraftForArea());
    this.resourceMessage = "";
  }

  private async loadActiveKindData(): Promise<void> {
    const workspace = this.workspaceVersion;
    if (this.requiresAreaFilter()) {
      await this.loadAreasForFilter();
      if (workspace !== this.workspaceVersion) return;
      if (!this.selectedResourceAreaId) this.selectedResourceAreaId = this.areas.find((area) => area.id)?.id ?? "";
      if (!this.isDirty) this.replaceDraft(this.newDraftForArea());
    }
    if (workspace === this.workspaceVersion) await this.loadActiveDocuments(false);
  }

  private async loadAreasForFilter(): Promise<void> {
    if (this.areas.length > 0) return;
    const server = this.apiBaseUrl;
    const proxy = this.useDevProxy;
    try {
      const areas = (await this.api.getAreas(server, proxy)).map(normalizeArea).sort(compareAreas);
      if (server === this.apiBaseUrl && proxy === this.useDevProxy) this.areas = areas;
    } catch {
      if (server === this.apiBaseUrl && proxy === this.useDevProxy) this.areas = [];
    }
  }

  private buildListEndpoint(resource: ApiResource): string {
    if (this.requiresAreaFilter(resource.kind)) {
      return this.selectedResourceAreaId ? `${resource.endpoint}/area/${this.selectedResourceAreaId}` : "";
    }

    return resource.endpoint;
  }

  private createEmptyDraft(kind: FeatureKind): ResourceDocument {
    if (kind === "areas") {
      return structuredClone(emptyAreaDraft) as ResourceDocument;
    }

    if (kind === "rooms") {
      return structuredClone(emptyRoomDraft) as unknown as ResourceDocument;
    }

    if (kind === "mobiles") {
      return structuredClone(emptyMobileDraft) as ResourceDocument;
    }

    return structuredClone(getEmptyEditableResourceDraft(kind)) as ResourceDocument;
  }

  private normalizeDocument(document: unknown, kind: FeatureKind): ResourceDocument {
    if (kind === "areas") {
      return normalizeArea(document as AreaView) as unknown as ResourceDocument;
    }

    if (kind === "rooms") {
      return normalizeRoom(document as RoomView) as unknown as ResourceDocument;
    }

    if (kind === "mobiles") {
      return normalizeMobile(document as MobileView) as ResourceDocument;
    }

    return normalizeEditableResourceDocument(document as EditableResourceDocument, kind) as ResourceDocument;
  }

  private compareDocuments(left: ResourceDocument, right: ResourceDocument): number {
    if (this.activeKind === "areas") {
      return compareAreas(left as unknown as AreaView, right as unknown as AreaView);
    }

    if (this.activeKind === "rooms") {
      return compareRooms(left as unknown as RoomView, right as unknown as RoomView);
    }

    if (this.activeKind === "mobiles") {
      return compareMobiles(left as MobileView, right as MobileView);
    }

    return compareEditableResourceDocuments(left as EditableResourceDocument, right as EditableResourceDocument);
  }

  private validateDocument(document: ResourceDocument, resource: ApiResource): string {
    if (this.activeKind === "areas" && !String(document.name ?? "").trim()) {
      return "Area name is required.";
    }

    if (this.activeKind === "rooms") {
      return validateRoom(document as unknown as RoomView);
    }

    if (this.activeKind === "mobiles") {
      return validateMobile(document as MobileView);
    }

    if (editableResourceKinds.includes(this.activeKind) || topLevelEditableResourceKinds.includes(this.activeKind)) {
      return validateEditableResourceDocument(document as EditableResourceDocument, resource.label);
    }

    return "";
  }

  private parseDraft(text: string): ResourceDocument {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Draft must be a JSON object.");
    const rules = this.activeKind === "skills" ? skillJsonRules : this.activeKind === "commands" ? commandJsonRules : undefined;
    if (rules) {
      if (!isJsonValue(parsed)) throw new Error("Use finite numbers and valid JSON values.");
      const [issue] = validateJsonValue(parsed, parsed, { rules });
      if (issue) throw new Error(`${issue.path} — ${issue.message}`);
    }
    return parsed as ResourceDocument;
  }

  private toPrettyJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  private async loadSettings(): Promise<void> {
    const settings = await loadDesignerSettings();
    this.applySettings(settings.apiBaseUrl, settings.useDevProxy, settings.theme);
    const workspace = this.workspaceVersion;
    await this.refreshHealth();
    if (workspace === this.workspaceVersion && this.activeKind !== "settings") await this.loadActiveKindData();
  }

  private applySettings(apiBaseUrl: string, useDevProxy: boolean, theme: DesignerTheme): void {
    const serverIdentity = buildApiUrl(apiBaseUrl, useDevProxy, "");
    if (this.serverIdentity !== serverIdentity) {
      this.invalidateWorkspace();
      this.areas = [];
      this.selectedResourceAreaId = "";
      this.resetResourceWorkspace();
    }
    this.serverIdentity = serverIdentity;
    this.apiBaseUrl = apiBaseUrl;
    this.apiBaseUrlInput = apiBaseUrl;
    this.useDevProxy = useDevProxy;
    this.theme = theme;
    this.applyTheme(theme);
  }

  private applyTheme(theme: DesignerTheme): void {
    document.documentElement.dataset["theme"] = theme;
  }

  private async refreshHealth(): Promise<void> {
    this.health = {
      state: "checking",
      detail: `Checking ${this.apiBaseUrl}`,
    };
    this.health = await this.api.checkHealth(this.apiBaseUrl, this.useDevProxy);
  }
}
