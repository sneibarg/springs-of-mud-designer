import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Bot, Plus, RotateCw, Save, X } from "lucide-react";
import type {
  ApiResource,
  AreaView,
  EditableResourceDocument,
  EditableValue,
  ExitView,
  MobileView,
  RoomView,
} from "./types";
import {
  directionLabel,
  documentDisplayName,
  documentSecondaryLabel,
  editableResourceFieldNames,
  formatAreaOption,
  formatEditableValue,
  isComplexValue,
  listToText,
  mapToText,
  mobileFieldNames,
  parseExitView,
  singularResourceLabel,
  startCase,
  textToLines,
  textToList,
  textToMap,
} from "./logic";
import { areaListFields, roomNumberFields } from "./constants";
export function AreaDesigner({
                        areaDraft,
                        areaMessage,
                        areaRooms,
                        areaRoomsStatus,
                        areaStatus,
                        areas,
                        onCreateRoomForArea,
                        onCreateNew,
                        onLoadAreas,
                        onOpenRoom,
                        onSaveArea,
                        onSelectArea,
                        onUpdateAreaDraft,
                        selectedAreaId,
                      }: {
  areaDraft: AreaView;
  areaMessage: string;
  areaRooms: RoomView[];
  areaRoomsStatus: "idle" | "loading";
  areaStatus: "idle" | "loading" | "saving";
  areas: AreaView[];
  onCreateRoomForArea: (areaId: string) => void;
  onCreateNew: () => void;
  onLoadAreas: () => void;
  onOpenRoom: (room: RoomView) => void;
  onSaveArea: () => void;
  onSelectArea: (areaId: string) => void;
  onUpdateAreaDraft: <Value extends keyof AreaView>(key: Value, value: AreaView[Value]) => void;
  selectedAreaId: string;
}) {
  const isSaving = areaStatus === "saving";
  const isLoading = areaStatus === "loading";

  return (
      <div className="area-designer">
        <div className="area-toolbar">
          <div className="resource-summary">
            <BookOpen size={22}/>
            <p>
              Load existing areas from the Java API, edit their AreaView fields, or create a new
              area document through the same `/api/v1/areas` controller.
            </p>
          </div>
          <div className="area-toolbar-actions">
            <button className="secondary-button" type="button" onClick={onLoadAreas} disabled={isLoading}>
              <RotateCw size={18}/>
              {isLoading ? "Loading" : "Reload"}
            </button>
            <button className="primary-button" type="button" onClick={onCreateNew}>
              <Plus size={18}/>
              New Area
            </button>
          </div>
        </div>

        <div className="area-workspace">
          <aside className="area-list" aria-label="Existing areas">
            <div className="area-list-heading">
              <strong>Existing Areas</strong>
              <span>{areas.length}</span>
            </div>
            <button
                className={selectedAreaId === "new" ? "area-list-item active" : "area-list-item"}
                type="button"
                onClick={onCreateNew}
            >
              <strong>New area</strong>
              <span>Create a blank AreaDocument</span>
            </button>
            {areas.map((area) => (
                <button
                    className={selectedAreaId === area.id ? "area-list-item active" : "area-list-item"}
                    key={area.id ?? area.name}
                    type="button"
                    onClick={() => onSelectArea(area.id ?? "new")}
                >
                  <strong>{area.name || "Unnamed area"}</strong>
                  <span>{area.vnum || area.id || "No vnum"}</span>
                </button>
            ))}
          </aside>

          <form className="area-form">
            <label>
              Id
              <input value={areaDraft.id ?? ""} disabled placeholder="Assigned by API"/>
            </label>
            <label>
              Name
              <input
                  value={areaDraft.name}
                  onChange={(event) => onUpdateAreaDraft("name", event.target.value)}
                  placeholder="Midgaard"
              />
            </label>
            <label>
              Author
              <input
                  value={areaDraft.author}
                  onChange={(event) => onUpdateAreaDraft("author", event.target.value)}
                  placeholder="Builder name"
              />
            </label>
            <label>
              Vnum
              <input
                  value={areaDraft.vnum}
                  onChange={(event) => onUpdateAreaDraft("vnum", event.target.value)}
                  placeholder="3000-3999"
              />
            </label>
            <label className="wide-field">
              Suggested Level Range
              <input
                  value={areaDraft.suggestedLevelRange}
                  onChange={(event) => onUpdateAreaDraft("suggestedLevelRange", event.target.value)}
                  placeholder="1-15"
              />
            </label>

            {areaListFields.map((field) => (
                <label className="area-list-field" key={field}>
                  {startCase(field)}
                  <textarea
                      value={listToText(areaDraft[field])}
                      onChange={(event) => onUpdateAreaDraft(field, textToList(event.target.value))}
                      rows={4}
                      placeholder="One id or vnum per line"
                  />
                </label>
            ))}
          </form>
        </div>

        {selectedAreaId !== "new" ? (
            <section className="area-room-panel">
              <div className="area-room-panel-heading">
                <div>
                  <strong>Rooms In This Area</strong>
                  <span>
                {areaRoomsStatus === "loading" ? "Loading rooms" : `${areaRooms.length} rooms loaded`}
              </span>
                </div>
                <button
                    className="primary-button"
                    type="button"
                    onClick={() => onCreateRoomForArea(selectedAreaId)}
                >
                  <Plus size={18}/>
                  New Room
                </button>
              </div>
              {areaRooms.length > 0 ? (
                  <div className="area-room-grid">
                    {areaRooms.map((room) => (
                        <article className="area-room-card" key={room.id ?? room.vnum ?? room.name}>
                          <div>
                            <strong>{room.name || "Unnamed room"}</strong>
                            <span>{room.vnum || "No vnum"}</span>
                          </div>
                          <p>{room.description || "No description."}</p>
                          <button className="secondary-button" type="button" onClick={() => onOpenRoom(room)}>
                            <ArrowRight size={16}/>
                            Edit Room
                          </button>
                        </article>
                    ))}
                  </div>
              ) : (
                  <p className="empty-exits">No rooms returned for this area.</p>
              )}
            </section>
        ) : null}

        <div className="area-actions">
          {areaMessage ? <span className="area-message">{areaMessage}</span> : <span/>}
          <button className="primary-button" type="button" onClick={onSaveArea} disabled={isSaving}>
            <Save size={18}/>
            {isSaving ? "Saving" : selectedAreaId === "new" ? "Create Area" : "Update Area"}
          </button>
        </div>
      </div>
  );
}

export function RoomDesigner({
                        areas,
                        onBrowseToExitDestination,
                        onCreateNew,
                        onLoadRooms,
                        onSaveRoom,
                        onSelectRoomArea,
                        onSelectRoom,
                        onUpdateRoomDraft,
                        roomDraft,
                        roomMessage,
                        roomStatus,
                        rooms,
                        selectedRoomAreaId,
                        selectedRoomId,
                      }: {
  areas: AreaView[];
  onBrowseToExitDestination: (exitView: ExitView) => void;
  onCreateNew: () => void;
  onLoadRooms: () => void;
  onSaveRoom: () => void;
  onSelectRoomArea: (areaId: string) => void;
  onSelectRoom: (roomId: string) => void;
  onUpdateRoomDraft: <Value extends keyof RoomView>(key: Value, value: RoomView[Value]) => void;
  roomDraft: RoomView;
  roomMessage: string;
  roomStatus: "idle" | "loading" | "saving";
  rooms: RoomView[];
  selectedRoomAreaId: string;
  selectedRoomId: string;
}) {
  const isSaving = roomStatus === "saving";
  const isLoading = roomStatus === "loading";
  const exitViews = roomDraft.exits.map(parseExitView);

  return (
      <div className="area-designer">
        <div className="area-toolbar">
          <div className="resource-summary">
            <BookOpen size={22}/>
            <p>
              Load existing rooms from the Java API, edit their RoomView fields, or create a new
              room document through the `/api/v1/rooms` controller.
            </p>
          </div>
          <div className="area-toolbar-actions">
            <button className="secondary-button" type="button" onClick={onLoadRooms} disabled={isLoading}>
              <RotateCw size={18}/>
              {isLoading ? "Loading" : "Reload"}
            </button>
            <button className="primary-button" type="button" onClick={onCreateNew}>
              <Plus size={18}/>
              New Room
            </button>
          </div>
        </div>

        <div className="area-workspace">
          <aside className="area-list" aria-label="Existing rooms">
            <div className="area-list-heading">
              <strong>Existing Rooms</strong>
              <span>{rooms.length}</span>
            </div>
            <label className="area-filter">
              Area
              <select value={selectedRoomAreaId} onChange={(event) => onSelectRoomArea(event.target.value)}>
                <option value="">Select area</option>
                {areas.map((area) => (
                    <option key={area.id ?? area.vnum ?? area.name} value={area.id ?? ""}>
                      {formatAreaOption(area)}
                    </option>
                ))}
              </select>
            </label>
            {rooms.map((room) => (
                <button
                    className={selectedRoomId === room.id ? "area-list-item active" : "area-list-item"}
                    key={room.id ?? room.vnum ?? room.name}
                    type="button"
                    onClick={() => onSelectRoom(room.id ?? "new")}
                >
                  <strong>{room.name || "Unnamed room"}</strong>
                  <span>{room.vnum || room.areaId || room.id || "No vnum"}</span>
                </button>
            ))}
          </aside>

          {selectedRoomId === "new" ? (
              <div className="empty-editor-state">
                <BookOpen size={28}/>
                <strong>Select a room to edit</strong>
                <span>Create uses the New Room popup so unsaved rooms do not live in the page form.</span>
                <button className="primary-button" type="button" onClick={onCreateNew}>
                  <Plus size={18}/>
                  New Room
                </button>
              </div>
          ) : (
              <form className="area-form">
                <label>
                  Id
                  <input value={roomDraft.id ?? ""} disabled placeholder="Assigned by API"/>
                </label>
                <label>
                  Area Id
                  <input
                      value={roomDraft.areaId}
                      onChange={(event) => onUpdateRoomDraft("areaId", event.target.value)}
                      placeholder="Area document id"
                  />
                </label>
                <label>
                  Vnum
                  <input
                      value={roomDraft.vnum}
                      onChange={(event) => onUpdateRoomDraft("vnum", event.target.value)}
                      placeholder="3001"
                  />
                </label>
                <label>
                  Name
                  <input
                      value={roomDraft.name}
                      onChange={(event) => onUpdateRoomDraft("name", event.target.value)}
                      placeholder="Temple Square"
                  />
                </label>
                <label className="wide-field">
                  Description
                  <textarea
                      value={roomDraft.description}
                      onChange={(event) => onUpdateRoomDraft("description", event.target.value)}
                      rows={5}
                  />
                </label>
                <label className="wide-field">
                  Extra Description
                  <textarea
                      value={roomDraft.extraDescription}
                      onChange={(event) => onUpdateRoomDraft("extraDescription", event.target.value)}
                      rows={4}
                  />
                </label>

                <div className="room-toggle-row">
                  <label className="proxy-toggle">
                    <input
                        type="checkbox"
                        checked={roomDraft.pvp}
                        onChange={(event) => onUpdateRoomDraft("pvp", event.target.checked)}
                    />
                    <span>PVP</span>
                  </label>
                  <label className="proxy-toggle">
                    <input
                        type="checkbox"
                        checked={roomDraft.spawn}
                        onChange={(event) => onUpdateRoomDraft("spawn", event.target.checked)}
                    />
                    <span>Spawn</span>
                  </label>
                </div>

                {roomNumberFields.map((field) => (
                    <label key={field}>
                      {startCase(field)}
                      <input
                          type="number"
                          value={roomDraft[field]}
                          onChange={(event) => onUpdateRoomDraft(field, Number(event.target.value))}
                      />
                    </label>
                ))}

                <div className="exit-pane wide-field">
                  <div className="exit-pane-heading">
                    <div>
                      <strong>Exits</strong>
                      <span>{exitViews.length} directions</span>
                    </div>
                  </div>
                  {exitViews.length > 0 ? (
                      <div className="exit-grid">
                        {exitViews.map((exitView, index) => (
                  <article className="exit-card" key={`${exitView.direction}-${exitView.to_room_id}-${index}`}>
                    <div className="exit-card-heading">
                      <strong>{directionLabel(exitView.direction)}</strong>
                      <span>{exitView.to_room_vnum || "No vnum"}</span>
                    </div>
                    {exitView.parseError ? (
                      <p className="exit-error">{exitView.parseError}</p>
                    ) : (
                      <>
                        <dl>
                          <div>
                            <dt>Destination</dt>
                            <dd>{exitView.to_room_id || "None"}</dd>
                          </div>
                          <div>
                            <dt>Keyword</dt>
                            <dd>{exitView.keyword || "None"}</dd>
                          </div>
                          <div>
                            <dt>Flags</dt>
                            <dd>{exitView.exit_flags}</dd>
                          </div>
                          <div>
                            <dt>Key</dt>
                            <dd>{exitView.key}</dd>
                          </div>
                        </dl>
                        {exitView.description ? <p>{exitView.description}</p> : null}
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => onBrowseToExitDestination(exitView)}
                        >
                          <ArrowRight size={16} />
                          Open Destination
                        </button>
                      </>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-exits">No exits defined for this room.</p>
            )}
            <details className="raw-exits">
              <summary>Raw exit payload</summary>
              <textarea
                value={listToText(roomDraft.exits)}
                onChange={(event) => onUpdateRoomDraft("exits", textToLines(event.target.value))}
                rows={6}
                placeholder="One serialized Exit JSON object per line"
              />
            </details>
          </div>

          <label className="area-list-field">
            Mobiles
            <textarea
              value={mapToText(roomDraft.mobiles)}
              onChange={(event) => onUpdateRoomDraft("mobiles", textToMap(event.target.value))}
              rows={4}
              placeholder="mobileId=count, one per line"
            />
          </label>
        </form>
        )}
      </div>

      <div className="area-actions">
        {roomMessage ? <span className="area-message">{roomMessage}</span> : <span />}
        {selectedRoomId !== "new" ? (
          <button className="primary-button" type="button" onClick={onSaveRoom} disabled={isSaving}>
            <Save size={18} />
            {isSaving ? "Saving" : "Update Room"}
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onCreateNew}>
            <Plus size={18} />
            New Room
          </button>
        )}
      </div>
    </div>
  );
}

export function EditableResourceDesigner({
                                    areas,
                                    documents,
                                    documentDraft,
                                    message,
                                    onCreateNew,
                                    onLoadDocuments,
                                    onSaveDocument,
                                    onSelectArea,
                                    onSelectDocument,
                                    onUpdateDocumentDraft,
                                    resource,
                                    selectedAreaId,
                                    selectedDocumentId,
                                    status,
                                  }: {
  areas: AreaView[];
  documents: EditableResourceDocument[];
  documentDraft: EditableResourceDocument;
  message: string;
  onCreateNew: () => void;
  onLoadDocuments: () => void;
  onSaveDocument: () => void;
  onSelectArea: (areaId: string) => void;
  onSelectDocument: (documentId: string) => void;
  onUpdateDocumentDraft: (key: string, value: EditableValue | undefined) => void;
  resource: ApiResource;
  selectedAreaId: string;
  selectedDocumentId: string;
  status: "idle" | "loading" | "saving";
}) {
  const isLoading = status === "loading";
  const isSaving = status === "saving";
  const fieldNames = editableResourceFieldNames(resource.kind, documents, documentDraft);
  const ResourceIcon = resource.icon;
  const singularLabel = singularResourceLabel(resource.label);

  return (
      <div className="area-designer">
        <div className="area-toolbar">
          <div className="resource-summary">
            <ResourceIcon size={22}/>
            <p>{resource.summary}</p>
          </div>
          <div className="area-toolbar-actions">
            <button className="secondary-button" type="button" onClick={onLoadDocuments} disabled={isLoading}>
              <RotateCw size={18}/>
              {isLoading ? "Loading" : "Reload"}
            </button>
            <button className="primary-button" type="button" onClick={onCreateNew}>
              <Plus size={18}/>
              New {singularLabel}
            </button>
          </div>
        </div>

        <div className="area-workspace">
          <aside className="area-list" aria-label={`Existing ${resource.label.toLowerCase()}`}>
            <div className="area-list-heading">
              <strong>Existing {resource.label}</strong>
              <span>{documents.length}</span>
            </div>
            <label className="area-filter">
              Area
              <select value={selectedAreaId} onChange={(event) => onSelectArea(event.target.value)}>
                <option value="">Select area</option>
                {areas.map((area) => (
                    <option key={area.id ?? area.vnum ?? area.name} value={area.id ?? ""}>
                      {formatAreaOption(area)}
                    </option>
                ))}
              </select>
            </label>
            {documents.map((document) => (
                <button
                    className={selectedDocumentId === document.id ? "area-list-item active" : "area-list-item"}
                    key={document.id ?? document.vnum ?? document.name ?? documentDisplayName(document, resource.kind)}
                    type="button"
                    onClick={() => onSelectDocument(document.id ?? "new")}
                >
                  <strong>{documentDisplayName(document, resource.kind)}</strong>
                  <span>{documentSecondaryLabel(document, resource.kind)}</span>
                </button>
            ))}
          </aside>

          {selectedDocumentId === "new" ? (
              <div className="empty-editor-state">
                <ResourceIcon size={28}/>
                <strong>Select a {singularLabel.toLowerCase()} to edit</strong>
                <span>Create uses the New {singularLabel} popup so unsaved records do not live in the page form.</span>
                <button className="primary-button" type="button" onClick={onCreateNew}>
                  <Plus size={18}/>
                  New {singularLabel}
                </button>
              </div>
          ) : (
              <MobileForm
                  fieldNames={fieldNames}
                  mobileDraft={documentDraft}
                  onUpdateMobileDraft={onUpdateDocumentDraft}
              />
          )}
        </div>

        <div className="area-actions">
          {message ? <span className="area-message">{message}</span> : <span/>}
          {selectedDocumentId !== "new" ? (
              <button className="primary-button" type="button" onClick={onSaveDocument} disabled={isSaving}>
                <Save size={18}/>
                {isSaving ? "Saving" : `Update ${singularLabel}`}
              </button>
          ) : (
              <button className="primary-button" type="button" onClick={onCreateNew}>
                <Plus size={18}/>
                New {singularLabel}
              </button>
          )}
        </div>
      </div>
  );
}

export function TopLevelResourceDesigner({
                                           documents,
                                           documentDraft,
                                           message,
                                           onCreateNew,
                                           onLoadDocuments,
                                           onSaveDocument,
                                           onSelectDocument,
                                           onUpdateDocumentDraft,
                                           resource,
                                           selectedDocumentId,
                                           status,
                                         }: {
  documents: EditableResourceDocument[];
  documentDraft: EditableResourceDocument;
  message: string;
  onCreateNew: () => void;
  onLoadDocuments: () => void;
  onSaveDocument: () => void;
  onSelectDocument: (documentId: string) => void;
  onUpdateDocumentDraft: (key: string, value: EditableValue | undefined) => void;
  resource: ApiResource;
  selectedDocumentId: string;
  status: "idle" | "loading" | "saving";
}) {
  const fieldNames = editableResourceFieldNames(resource.kind, documents, documentDraft);
  const ResourceIcon = resource.icon;
  const singularLabel = singularResourceLabel(resource.label);
  const isLoading = status === "loading";
  const isSaving = status === "saving";

  return (
      <div className="area-designer">
        <div className="area-toolbar">
          <div className="resource-summary">
            <ResourceIcon size={22}/>
            <p>{resource.summary}</p>
          </div>
          <div className="area-toolbar-actions">
            <button className="secondary-button" type="button" onClick={onLoadDocuments} disabled={isLoading}>
              <RotateCw size={18}/>
              {isLoading ? "Loading" : "Reload"}
            </button>
            <button className="primary-button" type="button" onClick={onCreateNew}>
              <Plus size={18}/>
              New {singularLabel}
            </button>
          </div>
        </div>

        <div className="area-workspace">
          <aside className="area-list" aria-label={`Existing ${resource.label.toLowerCase()}`}>
            <div className="area-list-heading">
              <strong>Existing {resource.label}</strong>
              <span>{documents.length}</span>
            </div>
            <button
                className={selectedDocumentId === "new" ? "area-list-item active" : "area-list-item"}
                type="button"
                onClick={() => onSelectDocument("new")}
            >
              <strong>New {singularLabel.toLowerCase()}</strong>
              <span>Create a blank {singularLabel} document</span>
            </button>
            {documents.map((document) => (
                <button
                    className={selectedDocumentId === document.id ? "area-list-item active" : "area-list-item"}
                    key={document.id ?? documentDisplayName(document, resource.kind)}
                    type="button"
                    onClick={() => onSelectDocument(document.id ?? "new")}
                >
                  <strong>{documentDisplayName(document, resource.kind)}</strong>
                  <span>{documentSecondaryLabel(document, resource.kind)}</span>
                </button>
            ))}
          </aside>

          {selectedDocumentId === "new" ? (
              <div className="empty-editor-state">
                <ResourceIcon size={28}/>
                <strong>Select a {singularLabel.toLowerCase()} or create a new one.</strong>
                <span>Create uses the New {singularLabel} popup so unsaved documents do not live in the page form.</span>
                <button className="primary-button" type="button" onClick={onCreateNew}>
                  <Plus size={18}/>
                  New {singularLabel}
                </button>
              </div>
          ) : (
              <MobileForm
                  fieldNames={fieldNames}
                  mobileDraft={documentDraft}
                  onUpdateMobileDraft={onUpdateDocumentDraft}
              />
          )}
        </div>

        <div className="area-actions">
          {message ? <span className="area-message">{message}</span> : <span/>}
          {selectedDocumentId !== "new" ? (
              <button className="primary-button" type="button" onClick={onSaveDocument} disabled={isSaving}>
                <Save size={18}/>
                {isSaving ? "Saving" : `Update ${singularLabel}`}
              </button>
          ) : (
              <button className="primary-button" type="button" onClick={onCreateNew}>
                <Plus size={18}/>
                New {singularLabel}
              </button>
          )}
        </div>
      </div>
  );
}

export function EditableResourceCreateModal({
                                       documentDraft,
                                       fieldNames,
                                       isSaving,
                                       onClose,
                                       onSubmit,
                                       onUpdateDocumentDraft,
                                       resource,
                                     }: {
  documentDraft: EditableResourceDocument;
  fieldNames: string[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onUpdateDocumentDraft: (key: string, value: EditableValue | undefined) => void;
  resource: ApiResource;
}) {
  const singularLabel = singularResourceLabel(resource.label);

  return (
      <div className="modal-backdrop" role="presentation">
        <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="new-resource-title">
          <div className="modal-heading">
            <div>
              <span>{resource.endpoint}</span>
              <h3 id="new-resource-title">New {singularLabel}</h3>
            </div>
            <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close">
              <X size={20}/>
            </button>
          </div>

          <MobileForm
              fieldNames={fieldNames}
              mobileDraft={documentDraft}
              onUpdateMobileDraft={onUpdateDocumentDraft}
          />

          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="button" onClick={onSubmit} disabled={isSaving}>
              <Save size={18}/>
              {isSaving ? "Creating" : `Create ${singularLabel}`}
            </button>
          </div>
        </section>
      </div>
  );
}

export function MobileDesigner({
                          areas,
                          mobileDraft,
                          mobileMessage,
                          mobileStatus,
                          mobiles,
                          onCreateNew,
                          onLoadMobiles,
                          onSaveMobile,
                          onSelectMobile,
                          onSelectMobileArea,
                          onUpdateMobileDraft,
                          selectedMobileAreaId,
                          selectedMobileId,
                        }: {
  areas: AreaView[];
  mobileDraft: MobileView;
  mobileMessage: string;
  mobileStatus: "idle" | "loading" | "saving";
  mobiles: MobileView[];
  onCreateNew: () => void;
  onLoadMobiles: () => void;
  onSaveMobile: () => void;
  onSelectMobile: (mobileId: string) => void;
  onSelectMobileArea: (areaId: string) => void;
  onUpdateMobileDraft: (key: string, value: EditableValue | undefined) => void;
  selectedMobileAreaId: string;
  selectedMobileId: string;
}) {
  const isLoading = mobileStatus === "loading";
  const isSaving = mobileStatus === "saving";
  const fieldNames = mobileFieldNames(mobiles, mobileDraft);

  return (
      <div className="area-designer">
        <div className="area-toolbar">
          <div className="resource-summary">
            <ActiveMobileIcon/>
            <p>
              Load mobiles for a selected area, inspect every field returned by MobileView, and
              update existing NPC definitions through the mobiles API.
            </p>
          </div>
          <div className="area-toolbar-actions">
            <button className="secondary-button" type="button" onClick={onLoadMobiles} disabled={isLoading}>
              <RotateCw size={18}/>
              {isLoading ? "Loading" : "Reload"}
            </button>
            <button className="primary-button" type="button" onClick={onCreateNew}>
              <Plus size={18}/>
              New Mobile
            </button>
          </div>
        </div>

        <div className="area-workspace">
          <aside className="area-list" aria-label="Existing mobiles">
            <div className="area-list-heading">
              <strong>Existing Mobiles</strong>
              <span>{mobiles.length}</span>
            </div>
            <label className="area-filter">
              Area
              <select value={selectedMobileAreaId} onChange={(event) => onSelectMobileArea(event.target.value)}>
                <option value="">Select area</option>
                {areas.map((area) => (
                    <option key={area.id ?? area.vnum ?? area.name} value={area.id ?? ""}>
                      {formatAreaOption(area)}
                    </option>
                ))}
              </select>
            </label>
            {mobiles.map((mobile) => (
                <button
                    className={selectedMobileId === mobile.id ? "area-list-item active" : "area-list-item"}
                    key={mobile.id ?? mobile.vnum ?? mobile.name}
                    type="button"
                    onClick={() => onSelectMobile(mobile.id ?? "new")}
                >
                  <strong>{mobile.name || "Unnamed mobile"}</strong>
                  <span>{mobile.vnum ?? mobile.race ?? mobile.id ?? "No vnum"}</span>
                </button>
            ))}
          </aside>

          {selectedMobileId === "new" ? (
              <div className="empty-editor-state">
                <ActiveMobileIcon size={28}/>
                <strong>Select a mobile to edit</strong>
                <span>Create uses the New Mobile popup so unsaved mobiles do not live in the page form.</span>
                <button className="primary-button" type="button" onClick={onCreateNew}>
                  <Plus size={18}/>
                  New Mobile
                </button>
              </div>
          ) : (
              <MobileForm
                  fieldNames={fieldNames}
                  mobileDraft={mobileDraft}
                  onUpdateMobileDraft={onUpdateMobileDraft}
              />
          )}
        </div>

        <div className="area-actions">
          {mobileMessage ? <span className="area-message">{mobileMessage}</span> : <span/>}
          {selectedMobileId !== "new" ? (
              <button className="primary-button" type="button" onClick={onSaveMobile} disabled={isSaving}>
                <Save size={18}/>
                {isSaving ? "Saving" : "Update Mobile"}
              </button>
          ) : (
              <button className="primary-button" type="button" onClick={onCreateNew}>
                <Plus size={18}/>
                New Mobile
              </button>
          )}
        </div>
      </div>
  );
}

export function ActiveMobileIcon({size = 22}: { size?: number }) {
  return <Bot size={size}/>;
}

export function MobileCreateModal({
                             fieldNames,
                             isSaving,
                             mobileDraft,
                             onClose,
                             onSubmit,
                             onUpdateMobileDraft,
                           }: {
  fieldNames: string[];
  isSaving: boolean;
  mobileDraft: MobileView;
  onClose: () => void;
  onSubmit: () => void;
  onUpdateMobileDraft: (key: string, value: EditableValue | undefined) => void;
}) {
  return (
      <div className="modal-backdrop" role="presentation">
        <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="new-mobile-title">
          <div className="modal-heading">
            <div>
              <span>/api/v1/mobiles</span>
              <h3 id="new-mobile-title">New Mobile</h3>
            </div>
            <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close">
              <X size={20}/>
            </button>
          </div>

          <MobileForm
              fieldNames={fieldNames}
              mobileDraft={mobileDraft}
              onUpdateMobileDraft={onUpdateMobileDraft}
          />

          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="button" onClick={onSubmit} disabled={isSaving}>
              <Save size={18}/>
              {isSaving ? "Creating" : "Create Mobile"}
            </button>
          </div>
        </section>
      </div>
  );
}

export function MobileForm({
                      fieldNames,
                      mobileDraft,
                      onUpdateMobileDraft,
                    }: {
  fieldNames: string[];
  mobileDraft: MobileView;
  onUpdateMobileDraft: (key: string, value: EditableValue | undefined) => void;
}) {
  return (
      <form className="area-form">
        {fieldNames.map((fieldName) => (
            <MobileField
                fieldName={fieldName}
                key={fieldName}
                onUpdateMobileDraft={onUpdateMobileDraft}
                value={mobileDraft[fieldName]}
            />
        ))}
      </form>
  );
}

export function MobileField({
                       fieldName,
                       onUpdateMobileDraft,
                       value,
                     }: {
  fieldName: string;
  onUpdateMobileDraft: (key: string, value: EditableValue | undefined) => void;
  value: EditableValue | undefined;
}) {
  const isIdField = fieldName === "id";
  const isWide = isComplexValue(value) || /description|affect|flags|dice|parts|form|resist|immune|vulner/i.test(fieldName);

  if (typeof value === "boolean") {
    return (
        <label className="proxy-toggle mobile-boolean-field">
          <input
              checked={value}
              disabled={isIdField}
              type="checkbox"
              onChange={(event) => onUpdateMobileDraft(fieldName, event.target.checked)}
          />
          <span>{startCase(fieldName)}</span>
        </label>
    );
  }

  if (typeof value === "number") {
    return (
        <label>
          {startCase(fieldName)}
          <input
              disabled={isIdField}
              type="number"
              value={value}
              onChange={(event) => onUpdateMobileDraft(fieldName, Number(event.target.value))}
          />
        </label>
    );
  }

  if (isComplexValue(value)) {
    return (
        <JsonMobileField
            className={isWide ? "wide-field" : undefined}
            fieldName={fieldName}
            onUpdateMobileDraft={onUpdateMobileDraft}
            value={value}
        />
    );
  }

  return (
      <label className={isWide ? "wide-field" : undefined}>
        {startCase(fieldName)}
        <input
            disabled={isIdField}
            value={value == null ? "" : String(value)}
            onChange={(event) => onUpdateMobileDraft(fieldName, event.target.value)}
        />
      </label>
  );
}

export function JsonMobileField({
                           className,
                           fieldName,
                           onUpdateMobileDraft,
                           value,
                         }: {
  className?: string;
  fieldName: string;
  onUpdateMobileDraft: (key: string, value: EditableValue | undefined) => void;
  value: EditableValue | undefined;
}) {
  const [textValue, setTextValue] = useState(formatEditableValue(value));

  useEffect(() => {
    setTextValue(formatEditableValue(value));
  }, [value]);

  function commitJsonValue() {
    try {
      onUpdateMobileDraft(fieldName, JSON.parse(textValue) as EditableValue);
    } catch {
      onUpdateMobileDraft(fieldName, textValue);
    }
  }

  return (
      <label className={className}>
        {startCase(fieldName)}
        <textarea
            value={textValue}
            onBlur={commitJsonValue}
            onChange={(event) => setTextValue(event.target.value)}
            rows={5}
        />
      </label>
  );
}

export function RoomCreateModal({
  isSaving,
  onClose,
  onSubmit,
  onUpdateRoomDraft,
  roomDraft,
}: {
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onUpdateRoomDraft: <Value extends keyof RoomView>(key: Value, value: RoomView[Value]) => void;
  roomDraft: RoomView;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="new-room-title">
        <div className="modal-heading">
          <div>
            <span>/api/v1/rooms</span>
            <h3 id="new-room-title">New Room</h3>
          </div>
          <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form className="area-form modal-form">
          <label>
            Area Id
            <input
              value={roomDraft.areaId}
              onChange={(event) => onUpdateRoomDraft("areaId", event.target.value)}
              placeholder="Area document id"
            />
          </label>
          <label>
            Vnum
            <input
              value={roomDraft.vnum}
              onChange={(event) => onUpdateRoomDraft("vnum", event.target.value)}
              placeholder="3001"
            />
          </label>
          <label className="wide-field">
            Name
            <input
              value={roomDraft.name}
              onChange={(event) => onUpdateRoomDraft("name", event.target.value)}
              placeholder="Temple Square"
            />
          </label>
          <label className="wide-field">
            Description
            <textarea
              value={roomDraft.description}
              onChange={(event) => onUpdateRoomDraft("description", event.target.value)}
              rows={4}
            />
          </label>
          <label className="wide-field">
            Extra Description
            <textarea
              value={roomDraft.extraDescription}
              onChange={(event) => onUpdateRoomDraft("extraDescription", event.target.value)}
              rows={3}
            />
          </label>
          <div className="room-toggle-row">
            <label className="proxy-toggle">
              <input
                type="checkbox"
                checked={roomDraft.pvp}
                onChange={(event) => onUpdateRoomDraft("pvp", event.target.checked)}
              />
              <span>PVP</span>
            </label>
            <label className="proxy-toggle">
              <input
                type="checkbox"
                checked={roomDraft.spawn}
                onChange={(event) => onUpdateRoomDraft("spawn", event.target.checked)}
              />
              <span>Spawn</span>
            </label>
          </div>
          {roomNumberFields.map((field) => (
            <label key={field}>
              {startCase(field)}
              <input
                type="number"
                value={roomDraft[field]}
                onChange={(event) => onUpdateRoomDraft(field, Number(event.target.value))}
              />
            </label>
          ))}
        </form>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={onSubmit} disabled={isSaving}>
            <Save size={18} />
            {isSaving ? "Creating" : "Create Room"}
          </button>
        </div>
      </section>
    </div>
  );
}

