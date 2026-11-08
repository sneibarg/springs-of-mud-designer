import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SomApiService } from "./api.service";
import { GuardListComponent } from "./guard-list.component";
import { ResourceFormComponent, type ResourceFormDocument } from "./resource-form.component";
import { apiResources, initialDraft, workQueue } from "../data";
import {
  buildCreateRequest,
  loadDesignerSettings,
  readSavedApiBaseUrl,
  readSavedApiProxyEnabled,
  readSavedTheme,
  saveDesignerSettings,
} from "../api";
import type { DesignerTheme } from "../api";
import type { ApiHealth, ApiResource, DesignerDraft, EditableValue, FeatureKind } from "../types/common";
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
  mobileChildNavItems,
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
  imports: [CommonModule, FormsModule, GuardListComponent, ResourceFormComponent],
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit {
  readonly apiResources = apiResources;
  readonly workQueue = workQueue;
  readonly navItems = navItems;
  readonly areaNavItem = areaNavItem;
  readonly areaChildNavItems = areaChildNavItems;
  readonly mobileChildNavItems = mobileChildNavItems;
  readonly abilitiesNavItem = abilitiesNavItem;
  readonly abilityChildNavItems = abilityChildNavItems;

  activeKind: FeatureKind = "spells";
  draft: DesignerDraft = { ...initialDraft };
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
  resourceStatus: ResourceStatus = "idle";
  selectedResourceId = "new";
  selectedResourceAreaId = "";

  constructor(private readonly api: SomApiService) {}

  get activeFieldNames(): string[] {
    const fieldNames = new Set(["id", ...this.activeResource.fields]);

    if (this.requiresAreaFilter() || "areaId" in this.resourceDraft) {
      fieldNames.add("areaId");
    }

    Object.keys(this.resourceDraft).forEach((fieldName) => fieldNames.add(fieldName));

    return [...fieldNames];
  }

  get structuredFieldNames(): string[] {
    return this.usesGuardCards() ? this.activeFieldNames.filter((fieldName) => fieldName !== "guards") : this.activeFieldNames;
  }

  get activeResource(): ApiResource {
    return this.apiResources.find((resource) => resource.kind === this.activeKind) ?? this.apiResources[0];
  }

  get readyEditorCount(): number {
    return this.apiResources.filter((resource) => resource.status === "Ready").length;
  }

  get createRequest(): unknown {
    return buildCreateRequest(this.apiBaseUrl, this.useDevProxy, this.activeResource, {
      name: this.draft.name,
      kind: this.draft.kind,
      areaId: this.draft.areaId,
      target: this.draft.target,
      level: this.draft.level,
      notes: this.draft.notes,
    });
  }

  ngOnInit(): void {
    this.applyTheme(this.theme);
    void this.loadSettings();
  }

  setActiveKind(kind: FeatureKind): void {
    this.activeKind = kind;
    this.draft = {
      ...this.draft,
      kind,
    };
    this.resetResourceWorkspace();
    void this.loadActiveKindData();
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
    this.apiBaseUrl = this.apiBaseUrlInput;
    await this.refreshHealth();
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

  async loadActiveDocuments(): Promise<void> {
    const resource = this.activeResource;
    const endpoint = this.buildListEndpoint(resource);

    if (!endpoint) {
      this.resourceDocuments = [];
      this.resourceMessage = `Select an area to load ${resource.label.toLowerCase()}.`;
      return;
    }

    this.resourceStatus = "loading";
    this.resourceMessage = "";

    try {
      const payload = await this.api.list<unknown>(this.apiBaseUrl, this.useDevProxy, endpoint);
      this.resourceDocuments = payload
        .map((document) => this.normalizeDocument(document, this.activeKind))
        .sort((left, right) => this.compareDocuments(left, right));

      if (this.activeKind === "areas") {
        this.areas = this.resourceDocuments.map((document) => normalizeArea(document as AreaView));
      }

      this.resourceMessage = `Loaded ${this.resourceDocuments.length} ${resource.label.toLowerCase()}.`;
      this.selectResource(this.selectedResourceId === "new" ? "new" : this.selectedResourceId);
    } catch (error) {
      this.resourceDocuments = [];
      this.resourceMessage =
        error instanceof Error
          ? `Could not load ${resource.label.toLowerCase()}: ${error.message}`
          : `Could not load ${resource.label.toLowerCase()}.`;
    } finally {
      this.resourceStatus = "idle";
    }
  }

  selectResource(documentId: string): void {
    this.selectedResourceId = documentId;

    if (documentId === "new") {
      this.resourceDraft = this.createEmptyDraft(this.activeKind);
      this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
      return;
    }

    const selectedDocument = this.resourceDocuments.find((document) => document.id === documentId);

    if (!selectedDocument) {
      this.selectedResourceId = "new";
      this.resourceDraft = this.createEmptyDraft(this.activeKind);
    } else {
      this.resourceDraft = structuredClone(selectedDocument);
    }

    this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
  }

  createNewResource(): void {
    this.selectResource("new");

    if (this.requiresAreaFilter(this.activeKind) && this.selectedResourceAreaId) {
      this.resourceDraft = {
        ...this.resourceDraft,
        areaId: this.selectedResourceAreaId,
      };
      this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
    }
  }

  updateResourceDraft(nextDraft: ResourceFormDocument): void {
    this.resourceDraft = nextDraft as ResourceDocument;
    this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
  }

  updateResourceGuards(guards: Record<string, EditableValue>[]): void {
    this.updateResourceDraft({
      ...this.resourceDraft,
      guards,
    });
  }

  async saveActiveDocument(): Promise<void> {
    const resource = this.activeResource;
    const parsedDraft = this.parseDraftText();

    if (!parsedDraft) {
      return;
    }

    const payload = this.normalizeDocument(parsedDraft, this.activeKind);
    const validationMessage = this.validateDocument(payload, resource);

    if (validationMessage) {
      this.resourceMessage = validationMessage;
      return;
    }

    const isExistingDocument = Boolean(payload.id);
    const endpoint = isExistingDocument ? `${resource.endpoint}/${payload.id}` : resource.endpoint;

    this.resourceStatus = "saving";
    this.resourceMessage = "";

    try {
      const savedPayload = await this.api.save<unknown>(
        this.apiBaseUrl,
        this.useDevProxy,
        endpoint,
        payload,
        isExistingDocument,
      );
      const savedDocument = this.normalizeDocument(savedPayload, this.activeKind);
      this.resourceDocuments = [
        ...this.resourceDocuments.filter((document) => document.id !== savedDocument.id),
        savedDocument,
      ].sort((left, right) => this.compareDocuments(left, right));
      this.resourceDraft = structuredClone(savedDocument);
      this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
      this.selectedResourceId = savedDocument.id ?? "new";
      this.resourceMessage = `${isExistingDocument ? "Updated" : "Created"} ${this.resourceLabel(savedDocument)}.`;
    } catch (error) {
      this.resourceMessage =
        error instanceof Error
          ? `Could not save ${resource.label.toLowerCase()}: ${error.message}`
          : `Could not save ${resource.label.toLowerCase()}.`;
    } finally {
      this.resourceStatus = "idle";
    }
  }

  onAreaFilterChange(areaId: string): void {
    this.selectedResourceAreaId = areaId;
    this.selectedResourceId = "new";
    this.resourceDraft = this.createEmptyDraft(this.activeKind);
    this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
    void this.loadActiveDocuments();
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
    this.resourceDocuments = [];
    this.selectedResourceId = "new";
    this.resourceDraft = this.createEmptyDraft(this.activeKind);
    this.resourceDraftText = this.toPrettyJson(this.resourceDraft);
    this.resourceMessage = "";
  }

  private async loadActiveKindData(): Promise<void> {
    if (this.requiresAreaFilter()) {
      await this.loadAreasForFilter();

      if (!this.selectedResourceAreaId) {
        this.selectedResourceAreaId = this.areas.find((area) => area.id)?.id ?? "";
      }
    }

    await this.loadActiveDocuments();
  }

  private async loadAreasForFilter(): Promise<void> {
    if (this.areas.length > 0) {
      return;
    }

    try {
      this.areas = (await this.api.getAreas(this.apiBaseUrl, this.useDevProxy)).map(normalizeArea).sort(compareAreas);
    } catch {
      this.areas = [];
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

  private parseDraftText(): ResourceDocument | null {
    try {
      const parsed = JSON.parse(this.resourceDraftText) as ResourceDocument;

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Draft must be a JSON object.");
      }

      return parsed;
    } catch (error) {
      this.resourceMessage = error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON draft.";
      return null;
    }
  }

  private toPrettyJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  private async loadSettings(): Promise<void> {
    const settings = await loadDesignerSettings();
    this.applySettings(settings.apiBaseUrl, settings.useDevProxy, settings.theme);
    await this.refreshHealth();
    await this.loadAreasForFilter();
    await this.loadActiveKindData();
  }

  private applySettings(apiBaseUrl: string, useDevProxy: boolean, theme: DesignerTheme): void {
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
