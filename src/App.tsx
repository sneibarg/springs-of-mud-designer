import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleDashed,
  Code2,
  DatabaseZap,
  FileJson,
  X,
  Menu,
  Plus,
  RotateCw,
  Save,
  Search,
  ServerCog,
} from "lucide-react";
import { apiResources, initialDraft, workQueue } from "./data";
import type { ApiHealth, AreaView, DesignerDraft, ExitView, FeatureKind, RoomView } from "./domain";
import {
  buildApiUrl,
  buildCreateRequest,
  checkApiHealth,
  readSavedApiBaseUrl,
  readSavedApiProxyEnabled,
  saveApiBaseUrl,
  saveApiProxyEnabled,
} from "./api";

const navItems = [
  { id: "settings" as FeatureKind, label: "Settings" },
  { id: "areas" as FeatureKind, label: "Areas" },
  { id: "rooms" as FeatureKind, label: "Rooms" },
  { id: "mobiles" as FeatureKind, label: "Mobiles" },
  { id: "items" as FeatureKind, label: "Items" },
  { id: "skills" as FeatureKind, label: "Skills" },
  { id: "spells" as FeatureKind, label: "Spells" },
  { id: "communication" as FeatureKind, label: "Comms" },
];

const emptyAreaDraft: AreaView = {
  author: "",
  name: "",
  vnum: "",
  suggestedLevelRange: "",
  rooms: [],
  mobiles: [],
  objects: [],
  shops: [],
  resets: [],
  specials: [],
};

const areaListFields = [
  "rooms",
  "mobiles",
  "objects",
  "shops",
  "resets",
  "specials",
] as const;

const emptyRoomDraft: RoomView = {
  areaId: "",
  vnum: "",
  name: "",
  description: "",
  extraDescription: "",
  pvp: false,
  spawn: false,
  spawnTimer: 0,
  spawnTime: 0,
  teleDelay: 0,
  roomFlags: 0,
  sectorType: 0,
  exits: [],
  mobiles: {},
};

const roomNumberFields = [
  "spawnTimer",
  "spawnTime",
  "teleDelay",
  "roomFlags",
  "sectorType",
] as const;

const directionNames = ["north", "east", "south", "west", "up", "down"];

export function App() {
  const [activeKind, setActiveKind] = useState<FeatureKind>("spells");
  const [draft, setDraft] = useState<DesignerDraft>(initialDraft);
  const [apiBaseUrl, setApiBaseUrl] = useState(readSavedApiBaseUrl);
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(apiBaseUrl);
  const [useDevProxy, setUseDevProxy] = useState(readSavedApiProxyEnabled);
  const [health, setHealth] = useState<ApiHealth>({
    state: "checking",
    detail: "Checking Java API",
  });
  const [areas, setAreas] = useState<AreaView[]>([]);
  const [areaDraft, setAreaDraft] = useState<AreaView>(emptyAreaDraft);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("new");
  const [areaStatus, setAreaStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [areaMessage, setAreaMessage] = useState("");
  const [areaRooms, setAreaRooms] = useState<RoomView[]>([]);
  const [areaRoomsStatus, setAreaRoomsStatus] = useState<"idle" | "loading">("idle");
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [roomDraft, setRoomDraft] = useState<RoomView>(emptyRoomDraft);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("new");
  const [newRoomDraft, setNewRoomDraft] = useState<RoomView>(emptyRoomDraft);
  const [isNewRoomModalOpen, setIsNewRoomModalOpen] = useState(false);
  const [roomStatus, setRoomStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [roomMessage, setRoomMessage] = useState("");

  const activeResource = useMemo(
    () => apiResources.find((resource) => resource.kind === activeKind) ?? apiResources[0],
    [activeKind],
  );
  const ActiveResourceIcon = activeResource.icon;
  const readyEditorCount = apiResources.filter((resource) => resource.status === "Ready").length;

  const createRequest = useMemo(
    () =>
      buildCreateRequest(apiBaseUrl, useDevProxy, activeResource, {
        name: draft.name,
        kind: draft.kind,
        areaId: draft.areaId,
        target: draft.target,
        level: draft.level,
        notes: draft.notes,
      }),
    [activeResource, apiBaseUrl, draft, useDevProxy],
  );

  useEffect(() => {
    setHealth({
      state: "checking",
      detail: `Checking ${apiBaseUrl}`,
    });
    checkApiHealth(apiBaseUrl, useDevProxy).then(setHealth);
  }, [apiBaseUrl, useDevProxy]);

  function updateDraft<Value extends keyof DesignerDraft>(key: Value, value: DesignerDraft[Value]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyApiBaseUrl() {
    const nextBaseUrl = saveApiBaseUrl(apiBaseUrlInput);
    setApiBaseUrl(nextBaseUrl);
    setApiBaseUrlInput(nextBaseUrl);
  }

  function testApiBaseUrl(value: string) {
    const nextBaseUrl = saveApiBaseUrl(value);
    setApiBaseUrl(nextBaseUrl);
    setApiBaseUrlInput(nextBaseUrl);
    setHealth({
      state: "checking",
      detail: `Checking ${nextBaseUrl}`,
    });
    checkApiHealth(nextBaseUrl, useDevProxy).then(setHealth);
  }

  function toggleDevProxy(value: boolean) {
    saveApiProxyEnabled(value);
    setUseDevProxy(value);
  }

  const loadAreas = useCallback(async () => {
    setAreaStatus("loading");
    setAreaMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, "/api/v1/areas"));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const loadedAreas = (await response.json()) as AreaView[];
      setAreas(loadedAreas);
      setAreaMessage(`Loaded ${loadedAreas.length} areas.`);

      if (selectedAreaId !== "new") {
        const selectedArea = loadedAreas.find((area) => area.id === selectedAreaId);
        if (selectedArea) {
          setAreaDraft(normalizeArea(selectedArea));
        }
      }
    } catch (error) {
      setAreaMessage(error instanceof Error ? `Could not load areas: ${error.message}` : "Could not load areas.");
    } finally {
      setAreaStatus("idle");
    }
  }, [apiBaseUrl, selectedAreaId, useDevProxy]);

  useEffect(() => {
    if (activeKind !== "areas") {
      return;
    }

    loadAreas();
  }, [activeKind, loadAreas]);

  const loadRooms = useCallback(async () => {
    setRoomStatus("loading");
    setRoomMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, "/api/v1/rooms"));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const loadedRooms = (await response.json()) as RoomView[];
      setRooms(loadedRooms);
      setRoomMessage(`Loaded ${loadedRooms.length} rooms.`);

      if (selectedRoomId !== "new") {
        const selectedRoom = loadedRooms.find((room) => room.id === selectedRoomId);
        if (selectedRoom) {
          setRoomDraft(normalizeRoom(selectedRoom));
        }
      }
    } catch (error) {
      setRoomMessage(error instanceof Error ? `Could not load rooms: ${error.message}` : "Could not load rooms.");
    } finally {
      setRoomStatus("idle");
    }
  }, [apiBaseUrl, selectedRoomId, useDevProxy]);

  const loadRoomsForArea = useCallback(
    async (areaId: string) => {
      if (!areaId) {
        setAreaRooms([]);
        return;
      }

      setAreaRoomsStatus("loading");

      try {
        const response = await fetch(
          buildApiUrl(apiBaseUrl, useDevProxy, `/api/v1/rooms/area/${areaId}`),
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const loadedRooms = ((await response.json()) as RoomView[]).map(normalizeRoom);
        setAreaRooms(loadedRooms);
      } catch (error) {
        setAreaRooms([]);
        setAreaMessage(
          error instanceof Error
            ? `Could not load area rooms: ${error.message}`
            : "Could not load area rooms.",
        );
      } finally {
        setAreaRoomsStatus("idle");
      }
    },
    [apiBaseUrl, useDevProxy],
  );

  useEffect(() => {
    if (activeKind !== "rooms") {
      return;
    }

    loadRooms();
  }, [activeKind, loadRooms]);

  function selectArea(areaId: string) {
    setSelectedAreaId(areaId);
    setAreaMessage("");

    if (areaId === "new") {
      setAreaDraft(emptyAreaDraft);
      setAreaRooms([]);
      return;
    }

    const selectedArea = areas.find((area) => area.id === areaId);
    if (selectedArea) {
      setAreaDraft(normalizeArea(selectedArea));
      loadRoomsForArea(areaId);
    }
  }

  function updateAreaDraft<Value extends keyof AreaView>(key: Value, value: AreaView[Value]) {
    setAreaDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveArea() {
    const payload = normalizeArea(areaDraft);
    const isExistingArea = selectedAreaId !== "new" && Boolean(payload.id);
    const endpoint = isExistingArea ? `/api/v1/areas/${payload.id}` : "/api/v1/areas";

    if (!payload.name.trim()) {
      setAreaMessage("Area name is required.");
      return;
    }

    setAreaStatus("saving");
    setAreaMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, endpoint), {
        method: isExistingArea ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedArea = normalizeArea((await response.json()) as AreaView);
      setAreaDraft(savedArea);
      setSelectedAreaId(savedArea.id ?? "new");
      setAreaMessage(isExistingArea ? "Area updated." : "Area created.");
      setAreas((currentAreas) => upsertArea(currentAreas, savedArea));
      if (savedArea.id) {
        loadRoomsForArea(savedArea.id);
      }
    } catch (error) {
      setAreaMessage(error instanceof Error ? `Could not save area: ${error.message}` : "Could not save area.");
    } finally {
      setAreaStatus("idle");
    }
  }

  function selectRoom(roomId: string) {
    setSelectedRoomId(roomId);
    setRoomMessage("");

    if (roomId === "new") {
      setRoomDraft(emptyRoomDraft);
      return;
    }

    const selectedRoom = rooms.find((room) => room.id === roomId);
    if (selectedRoom) {
      setRoomDraft(normalizeRoom(selectedRoom));
    }
  }

  function openNewRoomModal(areaId = "") {
    setNewRoomDraft({
      ...emptyRoomDraft,
      areaId: areaId || (selectedAreaId !== "new" ? selectedAreaId : roomDraft.areaId),
    });
    setRoomMessage("");
    setIsNewRoomModalOpen(true);
  }

  function updateNewRoomDraft<Value extends keyof RoomView>(key: Value, value: RoomView[Value]) {
    setNewRoomDraft((current) => ({ ...current, [key]: value }));
  }

  function updateRoomDraft<Value extends keyof RoomView>(key: Value, value: RoomView[Value]) {
    setRoomDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveRoom() {
    const payload = normalizeRoom(roomDraft);
    const endpoint = `/api/v1/rooms/${payload.id}`;

    if (selectedRoomId === "new" || !payload.id) {
      setRoomMessage("Select an existing room to update, or use New Room.");
      return;
    }

    const validationMessage = validateRoom(payload);

    if (validationMessage) {
      setRoomMessage(validationMessage);
      return;
    }

    setRoomStatus("saving");
    setRoomMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, endpoint), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedRoom = normalizeRoom((await response.json()) as RoomView);
      setRoomDraft(savedRoom);
      setSelectedRoomId(savedRoom.id ?? "new");
      setRoomMessage("Room updated.");
      setRooms((currentRooms) => upsertRoom(currentRooms, savedRoom));
      setAreaRooms((currentRooms) => upsertRoomIfSameArea(currentRooms, savedRoom, selectedAreaId));
    } catch (error) {
      setRoomMessage(error instanceof Error ? `Could not save room: ${error.message}` : "Could not save room.");
    } finally {
      setRoomStatus("idle");
    }
  }

  async function createRoomFromModal() {
    const payload = normalizeRoom(newRoomDraft);
    const validationMessage = validateRoom(payload);

    if (validationMessage) {
      setRoomMessage(validationMessage);
      return;
    }

    setRoomStatus("saving");
    setRoomMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, "/api/v1/rooms"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedRoom = normalizeRoom((await response.json()) as RoomView);
      setRooms((currentRooms) => upsertRoom(currentRooms, savedRoom));
      setAreaRooms((currentRooms) => upsertRoomIfSameArea(currentRooms, savedRoom, selectedAreaId));
      setRoomDraft(savedRoom);
      setSelectedRoomId(savedRoom.id ?? "new");
      setNewRoomDraft(emptyRoomDraft);
      setIsNewRoomModalOpen(false);
      setRoomMessage("Room created.");
    } catch (error) {
      setRoomMessage(error instanceof Error ? `Could not create room: ${error.message}` : "Could not create room.");
    } finally {
      setRoomStatus("idle");
    }
  }

  async function browseToExitDestination(exitView: ExitView) {
    const destinationRoom = findRoomForExit(rooms, exitView);

    if (destinationRoom?.id) {
      selectRoom(destinationRoom.id);
      setRoomMessage(`Opened ${destinationRoom.name || destinationRoom.vnum}.`);
      return;
    }

    const lookupEndpoint = exitView.to_room_id
      ? `/api/v1/rooms/${exitView.to_room_id}`
      : `/api/v1/rooms/vnum/${exitView.to_room_vnum}`;

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, lookupEndpoint));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const loadedRoom = normalizeRoom((await response.json()) as RoomView);
      setRooms((currentRooms) => upsertRoom(currentRooms, loadedRoom));
      setRoomDraft(loadedRoom);
      setSelectedRoomId(loadedRoom.id ?? "new");
      setRoomMessage(`Opened ${loadedRoom.name || loadedRoom.vnum}.`);
    } catch (error) {
      setRoomMessage(
        error instanceof Error
          ? `Could not open destination room: ${error.message}`
          : "Could not open destination room.",
      );
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">SoM</div>
          <div>
            <h1>Designer</h1>
            <span>Game feature workbench</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Feature sections">
          {navItems.map((item) => {
            const resource = apiResources.find((entry) => entry.kind === item.id);
            const Icon = resource?.icon ?? CircleDashed;
            const selected = item.id === activeKind;

            return (
              <button
                className={selected ? "nav-button active" : "nav-button"}
                key={item.id}
                onClick={() => {
                  setActiveKind(item.id);
                  updateDraft("kind", item.id);
                }}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-panel">
          <div className={`status-dot ${health.state}`} />
          <div>
            <strong>{health.state === "online" ? "API online" : "Draft mode"}</strong>
            <span>{health.detail}</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <label className="search-box">
            <Search size={18} />
            <input placeholder="Search features, vnums, areas, commands" />
          </label>
          <button className="ghost-button" type="button">
            <FileJson size={18} />
            Import JSON
          </button>
          <button className="primary-button" type="button">
            <Plus size={18} />
            New Draft
          </button>
        </header>

        <section className="overview-band">
          <div className="overview-copy">
            <div className="eyebrow">
              <Activity size={16} />
              Persistence-backed authoring
            </div>
            <h2>Design skills, spells, world content, and player communication in one place.</h2>
            <p>
              This starter maps the React UI to the Java modulith resources and keeps drafts shaped
              around the Python server concepts: registries, handlers, flags, rooms, and commands.
            </p>
          </div>
          <div className="overview-metrics" aria-label="Designer coverage">
            <Metric label="API resources" value={apiResources.length.toString()} />
            <Metric label="Ready editors" value={readyEditorCount.toString()} />
            <Metric label="Draft queue" value={workQueue.length.toString()} />
          </div>
        </section>

        <section className="content-grid">
          <div className="editor-surface">
            <div className="section-heading">
              <div>
                <span>{activeResource.endpoint}</span>
                <h3>{activeResource.label} Editor</h3>
              </div>
              <span className="pill">{activeResource.status}</span>
            </div>

            {activeKind === "settings" ? (
              <div className="settings-panel">
                <div className="resource-summary">
                  <ServerCog size={22} />
                  <p>
                    Point the designer at the Java persistence server. This is stored in your
                    browser and used for health checks and API request previews.
                  </p>
                </div>
                <div className="api-settings-form">
                  <label>
                    API Server
                    <input
                      value={apiBaseUrlInput}
                      onChange={(event) => setApiBaseUrlInput(event.target.value)}
                      placeholder="http://dragon:9080"
                    />
                  </label>
                  <button className="primary-button" type="button" onClick={applyApiBaseUrl}>
                    <Save size={18} />
                    Save Server
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => testApiBaseUrl(apiBaseUrlInput)}
                  >
                    <RotateCw size={18} />
                    Test
                  </button>
                </div>
                <label className="proxy-toggle">
                  <input
                    type="checkbox"
                    checked={useDevProxy}
                    onChange={(event) => toggleDevProxy(event.target.checked)}
                  />
                  <span>Use Vite dev proxy for browser requests</span>
                </label>
                <div className="settings-current">
                  <strong>Active server</strong>
                  <code>{apiBaseUrl}</code>
                </div>
              </div>
            ) : null}

            {activeKind === "areas" ? (
              <AreaDesigner
                areaDraft={areaDraft}
                areaMessage={areaMessage}
                areaRooms={areaRooms}
                areaRoomsStatus={areaRoomsStatus}
                areaStatus={areaStatus}
                areas={areas}
                onCreateRoomForArea={(areaId) => openNewRoomModal(areaId)}
                onCreateNew={() => selectArea("new")}
                onLoadAreas={loadAreas}
                onOpenRoom={(room) => {
                  setActiveKind("rooms");
                  setRooms((currentRooms) => mergeRooms(currentRooms, areaRooms));
                  setRoomDraft(normalizeRoom(room));
                  setSelectedRoomId(room.id ?? "new");
                }}
                onSaveArea={saveArea}
                onSelectArea={selectArea}
                onUpdateAreaDraft={updateAreaDraft}
                selectedAreaId={selectedAreaId}
              />
            ) : null}

            {activeKind === "rooms" ? (
              <RoomDesigner
                onCreateNew={() => openNewRoomModal()}
                onLoadRooms={loadRooms}
                onSaveRoom={saveRoom}
                onSelectRoom={selectRoom}
                onBrowseToExitDestination={browseToExitDestination}
                onUpdateRoomDraft={updateRoomDraft}
                roomDraft={roomDraft}
                roomMessage={roomMessage}
                roomStatus={roomStatus}
                rooms={rooms}
                selectedRoomId={selectedRoomId}
              />
            ) : null}

            {activeKind !== "areas" && activeKind !== "rooms" ? (
              <>
                <div className="resource-summary">
                  <ActiveResourceIcon size={22} />
                  <p>{activeResource.summary}</p>
                </div>

                <form className="draft-form">
                  <label>
                    Name
                    <input
                      value={draft.name}
                      onChange={(event) => updateDraft("name", event.target.value)}
                    />
                  </label>
                  <label>
                    Feature Kind
                    <select
                      value={draft.kind}
                      onChange={(event) => {
                        const nextKind = event.target.value as FeatureKind;
                        updateDraft("kind", nextKind);
                        setActiveKind(nextKind);
                      }}
                    >
                      {apiResources.map((resource) => (
                        <option key={resource.kind} value={resource.kind}>
                          {resource.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Area or Domain
                    <input
                      value={draft.areaId}
                      onChange={(event) => updateDraft("areaId", event.target.value)}
                    />
                  </label>
                  <label>
                    Target
                    <input
                      value={draft.target}
                      onChange={(event) => updateDraft("target", event.target.value)}
                    />
                  </label>
                  <label>
                    Level
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={draft.level}
                      onChange={(event) => updateDraft("level", Number(event.target.value))}
                    />
                  </label>
                  <label className="wide-field">
                    Design Notes
                    <textarea
                      value={draft.notes}
                      onChange={(event) => updateDraft("notes", event.target.value)}
                      rows={5}
                    />
                  </label>
                </form>

                <div className="field-list">
                  {activeResource.fields.map((field) => (
                    <span key={field}>{field}</span>
                  ))}
                </div>

                <div className="editor-actions">
                  <button className="secondary-button" type="button">
                    <Code2 size={18} />
                    Validate Shape
                  </button>
                  <button className="primary-button" type="button">
                    <Save size={18} />
                    Save Draft
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <aside className="inspector">
            <div className="section-heading compact">
              <div>
                <span>Request Preview</span>
                <h3>Java API Contract</h3>
              </div>
              <DatabaseZap size={20} />
            </div>
            <pre>{JSON.stringify(createRequest, null, 2)}</pre>
          </aside>
        </section>
        {isNewRoomModalOpen ? (
          <RoomCreateModal
            isSaving={roomStatus === "saving"}
            onClose={() => setIsNewRoomModalOpen(false)}
            onSubmit={createRoomFromModal}
            onUpdateRoomDraft={updateNewRoomDraft}
            roomDraft={newRoomDraft}
          />
        ) : null}

        <section className="resource-grid" aria-label="Resource coverage">
          {apiResources.map((resource) => {
            const Icon = resource.icon;
            return (
              <article className="resource-card" key={resource.kind}>
                <div className="resource-card-header">
                  <Icon size={20} />
                  <span>{resource.status}</span>
                </div>
                <h3>{resource.label}</h3>
                <p>{resource.summary}</p>
                <button type="button" onClick={() => setActiveKind(resource.kind)}>
                  Open
                  <ArrowRight size={16} />
                </button>
              </article>
            );
          })}
        </section>

        <section className="queue-band">
          <div className="section-heading">
            <div>
              <span>Authoring Flow</span>
              <h3>Draft Queue</h3>
            </div>
          </div>
          <div className="queue-table">
            {workQueue.map((item) => (
              <div className="queue-row" key={item.id}>
                <CheckCircle2 size={18} />
                <strong>{item.title}</strong>
                <span>{item.area}</span>
                <span>{item.owner}</span>
                <span className="pill muted">{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function AreaDesigner({
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
          <BookOpen size={22} />
          <p>
            Load existing areas from the Java API, edit their AreaView fields, or create a new
            area document through the same `/api/v1/areas` controller.
          </p>
        </div>
        <div className="area-toolbar-actions">
          <button className="secondary-button" type="button" onClick={onLoadAreas} disabled={isLoading}>
            <RotateCw size={18} />
            {isLoading ? "Loading" : "Reload"}
          </button>
          <button className="primary-button" type="button" onClick={onCreateNew}>
            <Plus size={18} />
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
            <input value={areaDraft.id ?? ""} disabled placeholder="Assigned by API" />
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
              <Plus size={18} />
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
                    <ArrowRight size={16} />
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
        {areaMessage ? <span className="area-message">{areaMessage}</span> : <span />}
        <button className="primary-button" type="button" onClick={onSaveArea} disabled={isSaving}>
          <Save size={18} />
          {isSaving ? "Saving" : selectedAreaId === "new" ? "Create Area" : "Update Area"}
        </button>
      </div>
    </div>
  );
}

function RoomDesigner({
  onBrowseToExitDestination,
  onCreateNew,
  onLoadRooms,
  onSaveRoom,
  onSelectRoom,
  onUpdateRoomDraft,
  roomDraft,
  roomMessage,
  roomStatus,
  rooms,
  selectedRoomId,
}: {
  onBrowseToExitDestination: (exitView: ExitView) => void;
  onCreateNew: () => void;
  onLoadRooms: () => void;
  onSaveRoom: () => void;
  onSelectRoom: (roomId: string) => void;
  onUpdateRoomDraft: <Value extends keyof RoomView>(key: Value, value: RoomView[Value]) => void;
  roomDraft: RoomView;
  roomMessage: string;
  roomStatus: "idle" | "loading" | "saving";
  rooms: RoomView[];
  selectedRoomId: string;
}) {
  const isSaving = roomStatus === "saving";
  const isLoading = roomStatus === "loading";
  const exitViews = roomDraft.exits.map(parseExitView);

  return (
    <div className="area-designer">
      <div className="area-toolbar">
        <div className="resource-summary">
          <BookOpen size={22} />
          <p>
            Load existing rooms from the Java API, edit their RoomView fields, or create a new
            room document through the `/api/v1/rooms` controller.
          </p>
        </div>
        <div className="area-toolbar-actions">
          <button className="secondary-button" type="button" onClick={onLoadRooms} disabled={isLoading}>
            <RotateCw size={18} />
            {isLoading ? "Loading" : "Reload"}
          </button>
          <button className="primary-button" type="button" onClick={onCreateNew}>
            <Plus size={18} />
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
            <BookOpen size={28} />
            <strong>Select a room to edit</strong>
            <span>Create uses the New Room popup so unsaved rooms do not live in the page form.</span>
            <button className="primary-button" type="button" onClick={onCreateNew}>
              <Plus size={18} />
              New Room
            </button>
          </div>
        ) : (
        <form className="area-form">
          <label>
            Id
            <input value={roomDraft.id ?? ""} disabled placeholder="Assigned by API" />
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

function RoomCreateModal({
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

function normalizeArea(area: AreaView): AreaView {
  return {
    id: area.id,
    author: area.author ?? "",
    name: area.name ?? "",
    vnum: area.vnum ?? "",
    suggestedLevelRange: area.suggestedLevelRange ?? "",
    rooms: area.rooms ?? [],
    mobiles: area.mobiles ?? [],
    objects: area.objects ?? [],
    shops: area.shops ?? [],
    resets: area.resets ?? [],
    specials: area.specials ?? [],
  };
}

function normalizeRoom(room: RoomView): RoomView {
  return {
    id: room.id,
    areaId: room.areaId ?? "",
    vnum: room.vnum ?? "",
    name: room.name ?? "",
    description: room.description ?? "",
    extraDescription: room.extraDescription ?? "",
    pvp: Boolean(room.pvp),
    spawn: Boolean(room.spawn),
    spawnTimer: Number(room.spawnTimer ?? 0),
    spawnTime: Number(room.spawnTime ?? 0),
    teleDelay: Number(room.teleDelay ?? 0),
    roomFlags: Number(room.roomFlags ?? 0),
    sectorType: Number(room.sectorType ?? 0),
    exits: room.exits ?? [],
    mobiles: room.mobiles ?? {},
  };
}

function parseExitView(rawExit: string): ExitView {
  try {
    const parsed = parseSerializedExit(rawExit);

    return {
      direction: Number(parsed.direction ?? -1),
      description: String(parsed.description ?? ""),
      keyword: String(parsed.keyword ?? ""),
      exit_flags: Number(parsed.exit_flags ?? 0),
      key: Number(parsed.key ?? 0),
      to_room_vnum: Number(parsed.to_room_vnum ?? 0),
      to_room_id: String(parsed.to_room_id ?? ""),
      room_id: String(parsed.room_id ?? ""),
      raw: rawExit,
    };
  } catch (error) {
    return {
      direction: -1,
      description: "",
      keyword: "",
      exit_flags: 0,
      key: 0,
      to_room_vnum: 0,
      to_room_id: "",
      room_id: "",
      raw: rawExit,
      parseError: error instanceof Error ? error.message : "Unable to parse exit.",
    };
  }
}

function parseSerializedExit(rawExit: string): Record<string, unknown> {
  try {
    return JSON.parse(rawExit) as Record<string, unknown>;
  } catch {
    const jsonLikeValue = rawExit
      .replace(/\bNone\b/g, "null")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value: string) => {
        return JSON.stringify(value.replace(/\\'/g, "'"));
      });

    return JSON.parse(jsonLikeValue) as Record<string, unknown>;
  }
}

function findRoomForExit(rooms: RoomView[], exitView: ExitView) {
  return rooms.find(
    (room) =>
      (exitView.to_room_id && room.id === exitView.to_room_id) ||
      (exitView.to_room_vnum && String(room.vnum) === String(exitView.to_room_vnum)),
  );
}

function directionLabel(direction: number) {
  return directionNames[direction] ?? `direction ${direction}`;
}

function upsertArea(areas: AreaView[], savedArea: AreaView) {
  const existingIndex = areas.findIndex((area) => area.id === savedArea.id);

  if (existingIndex === -1) {
    return [...areas, savedArea].sort(compareAreas);
  }

  return areas.map((area, index) => (index === existingIndex ? savedArea : area)).sort(compareAreas);
}

function upsertRoom(rooms: RoomView[], savedRoom: RoomView) {
  const existingIndex = rooms.findIndex((room) => room.id === savedRoom.id);

  if (existingIndex === -1) {
    return [...rooms, savedRoom].sort(compareRooms);
  }

  return rooms.map((room, index) => (index === existingIndex ? savedRoom : room)).sort(compareRooms);
}

function upsertRoomIfSameArea(rooms: RoomView[], savedRoom: RoomView, areaId: string) {
  if (areaId === "new" || savedRoom.areaId !== areaId) {
    return rooms;
  }

  return upsertRoom(rooms, savedRoom);
}

function mergeRooms(existingRooms: RoomView[], incomingRooms: RoomView[]) {
  return incomingRooms.reduce((mergedRooms, room) => upsertRoom(mergedRooms, room), existingRooms);
}

function validateRoom(room: RoomView) {
  if (!room.areaId.trim()) {
    return "Area id is required.";
  }

  if (!room.name.trim()) {
    return "Room name is required.";
  }

  return "";
}

function compareAreas(left: AreaView, right: AreaView) {
  return left.name.localeCompare(right.name);
}

function compareRooms(left: RoomView, right: RoomView) {
  return (left.vnum || left.name).localeCompare(right.vnum || right.name);
}

function listToText(value: string[]) {
  return value.join("\n");
}

function textToList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function textToLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapToText(value: Record<string, string>) {
  return Object.entries(value)
    .map(([key, mapValue]) => `${key}=${mapValue}`)
    .join("\n");
}

function textToMap(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, item) => {
      const [key, ...valueParts] = item.split("=");
      const trimmedKey = key.trim();

      if (trimmedKey) {
        result[trimmedKey] = valueParts.join("=").trim();
      }

      return result;
    }, {});
}

function startCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
