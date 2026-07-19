import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleDashed,
  Code2,
  DatabaseZap,
  FileJson,
  LogIn,
  LogOut,
  Menu,
  Plus,
  RotateCw,
  Save,
  Search,
  ServerCog,
} from "lucide-react";
import { apiResources, initialDraft, workQueue } from "./data";
import {
  AreaDesigner,
  EditableResourceCreateModal,
  EditableResourceDesigner,
  MobileCreateModal,
  MobileDesigner,
  RoomCreateModal,
  RoomDesigner,
  TopLevelResourceDesigner,
  areaScopedDraftKinds,
  compareAreas,
  compareEditableResourceDocuments,
  compareMobiles,
  compareRooms,
  editableResourceFieldNames,
  editableResourceKinds,
  emptyAreaDraft,
  emptyEditableResourceDrafts,
  emptyMobileDraft,
  emptyRoomDraft,
  findRoomForExit,
  getEmptyEditableResourceDraft,
  mergeRooms,
  mobileFieldNames,
  navItems,
  normalizeArea,
  normalizeEditableResourceDocument,
  normalizeMobile,
  normalizeRoom,
  singularResourceLabel,
  topLevelEditableResourceKinds,
  upsertArea,
  upsertEditableResourceDocument,
  upsertEditableResourceDocumentForArea,
  upsertMobileForArea,
  upsertRoom,
  upsertRoomForArea,
  validateEditableResourceDocument,
  validateMobile,
  validateRoom,
  type ApiHealth,
  type AreaView,
  type DesignerDraft,
  type EditableResourceDocument,
  type EditableValue,
  type ExitView,
  type FeatureKind,
  type MobileView,
  type RoomView,
} from "./domain";
import {
  buildApiUrl,
  buildCreateRequest,
  checkApiHealth,
  loadAuthSession,
  loadDesignerSettings,
  loginDesigner,
  logoutDesigner,
  readSavedApiBaseUrl,
  readSavedApiProxyEnabled,
  saveDesignerSettings,
} from "./api";
import type { AuthSession } from "./api";

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
  const [authSession, setAuthSession] = useState<AuthSession>({authenticated: false});
  const [authStatus, setAuthStatus] = useState<"checking" | "ready">("checking");
  const [loginStatus, setLoginStatus] = useState<"idle" | "submitting">("idle");
  const [loginMessage, setLoginMessage] = useState("");
  const [areas, setAreas] = useState<AreaView[]>([]);
  const [areaDraft, setAreaDraft] = useState<AreaView>(emptyAreaDraft);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("new");
  const [areaStatus, setAreaStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [areaMessage, setAreaMessage] = useState("");
  const [areaRooms, setAreaRooms] = useState<RoomView[]>([]);
  const [areaRoomsStatus, setAreaRoomsStatus] = useState<"idle" | "loading">("idle");
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [roomDraft, setRoomDraft] = useState<RoomView>(emptyRoomDraft);
  const [selectedRoomAreaId, setSelectedRoomAreaId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("new");
  const [newRoomDraft, setNewRoomDraft] = useState<RoomView>(emptyRoomDraft);
  const [isNewRoomModalOpen, setIsNewRoomModalOpen] = useState(false);
  const [roomStatus, setRoomStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [roomMessage, setRoomMessage] = useState("");
  const [mobiles, setMobiles] = useState<MobileView[]>([]);
  const [mobileDraft, setMobileDraft] = useState<MobileView>(emptyMobileDraft);
  const [selectedMobileAreaId, setSelectedMobileAreaId] = useState("");
  const [selectedMobileId, setSelectedMobileId] = useState<string>("new");
  const [newMobileDraft, setNewMobileDraft] = useState<MobileView>(emptyMobileDraft);
  const [isNewMobileModalOpen, setIsNewMobileModalOpen] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [mobileMessage, setMobileMessage] = useState("");
  const [editableDocuments, setEditableDocuments] = useState<EditableResourceDocument[]>([]);
  const [editableDocumentDraft, setEditableDocumentDraft] = useState<EditableResourceDocument>(emptyEditableResourceDrafts.items);
  const [selectedEditableAreaId, setSelectedEditableAreaId] = useState("");
  const [selectedEditableDocumentId, setSelectedEditableDocumentId] = useState<string>("new");
  const [newEditableDocumentDraft, setNewEditableDocumentDraft] =
      useState<EditableResourceDocument>(emptyEditableResourceDrafts.items);
  const [isNewEditableDocumentModalOpen, setIsNewEditableDocumentModalOpen] = useState(false);
  const [editableDocumentStatus, setEditableDocumentStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [editableDocumentMessage, setEditableDocumentMessage] = useState("");
  const [topLevelDocuments, setTopLevelDocuments] = useState<EditableResourceDocument[]>([]);
  const [topLevelDocumentDraft, setTopLevelDocumentDraft] =
      useState<EditableResourceDocument>(emptyEditableResourceDrafts.classes);
  const [selectedTopLevelDocumentId, setSelectedTopLevelDocumentId] = useState<string>("new");
  const [newTopLevelDocumentDraft, setNewTopLevelDocumentDraft] =
      useState<EditableResourceDocument>(emptyEditableResourceDrafts.classes);
  const [isNewTopLevelDocumentModalOpen, setIsNewTopLevelDocumentModalOpen] = useState(false);
  const [topLevelDocumentStatus, setTopLevelDocumentStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [topLevelDocumentMessage, setTopLevelDocumentMessage] = useState("");

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
    loadAuthSession().then((session) => {
      setAuthSession(session);
      setAuthStatus("ready");
    });
  }, []);

  useEffect(() => {
    if (!authSession.authenticated) {
      return;
    }

    loadDesignerSettings().then((settings) => {
      setApiBaseUrl(settings.apiBaseUrl);
      setApiBaseUrlInput(settings.apiBaseUrl);
      setUseDevProxy(settings.useDevProxy);
    });
  }, [authSession.authenticated]);

  useEffect(() => {
    if (!authSession.authenticated) {
      return;
    }

    setHealth({
      state: "checking",
      detail: `Checking ${apiBaseUrl}`,
    });
    checkApiHealth(apiBaseUrl, useDevProxy).then(setHealth);
  }, [apiBaseUrl, authSession.authenticated, useDevProxy]);

  function updateDraft<Value extends keyof DesignerDraft>(key: Value, value: DesignerDraft[Value]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function applyApiBaseUrl() {
    try {
      const settings = await saveDesignerSettings({
        apiBaseUrl: apiBaseUrlInput,
        useDevProxy,
      });
      setApiBaseUrl(settings.apiBaseUrl);
      setApiBaseUrlInput(settings.apiBaseUrl);
      setUseDevProxy(settings.useDevProxy);
    } catch (error) {
      setHealth({
        state: "offline",
        detail: error instanceof Error ? error.message : "Unable to save designer settings.",
      });
    }
  }

  async function testApiBaseUrl(value: string) {
    try {
      const settings = await saveDesignerSettings({
        apiBaseUrl: value,
        useDevProxy,
      });
      setApiBaseUrl(settings.apiBaseUrl);
      setApiBaseUrlInput(settings.apiBaseUrl);
      setUseDevProxy(settings.useDevProxy);
      setHealth({
        state: "checking",
        detail: `Checking ${settings.apiBaseUrl}`,
      });
      checkApiHealth(settings.apiBaseUrl, settings.useDevProxy).then(setHealth);
    } catch (error) {
      setHealth({
        state: "offline",
        detail: error instanceof Error ? error.message : "Unable to save designer settings.",
      });
    }
  }

  async function toggleDevProxy(value: boolean) {
    setUseDevProxy(value);
    try {
      const settings = await saveDesignerSettings({
        apiBaseUrl,
        useDevProxy: value,
      });
      setApiBaseUrl(settings.apiBaseUrl);
      setApiBaseUrlInput(settings.apiBaseUrl);
      setUseDevProxy(settings.useDevProxy);
    } catch (error) {
      setHealth({
        state: "offline",
        detail: error instanceof Error ? error.message : "Unable to save designer settings.",
      });
    }
  }

  async function submitLogin(username: string, password: string) {
    setLoginStatus("submitting");
    setLoginMessage("");

    try {
      const session = await loginDesigner(username, password);
      setAuthSession(session);
      setLoginMessage("");
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setLoginStatus("idle");
    }
  }

  async function submitLogout() {
    await logoutDesigner();
    setAuthSession({authenticated: false});
    setActiveKind("spells");
    setLoginMessage("");
  }

  const loadAreas = useCallback(async () => {
    setAreaStatus("loading");
    setAreaMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, "/api/v1/areas"));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const loadedAreas = ((await response.json()) as AreaView[]).map(normalizeArea).sort(compareAreas);
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
    if (!authSession.authenticated || !areaScopedDraftKinds.includes(activeKind)) {
      return;
    }

    loadAreas();
  }, [activeKind, authSession.authenticated, loadAreas]);

  const loadRooms = useCallback(async (areaId = selectedRoomAreaId) => {
    if (!areaId) {
      setRooms([]);
      setSelectedRoomId("new");
      setRoomDraft(emptyRoomDraft);
      setRoomMessage("Select an area to load rooms.");
      return;
    }

    setRoomStatus("loading");
    setRoomMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, `/api/v1/rooms/area/${areaId}`));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const loadedRooms = ((await response.json()) as RoomView[]).map(normalizeRoom).sort(compareRooms);
      setRooms(loadedRooms);
      setRoomMessage(`Loaded ${loadedRooms.length} rooms.`);

      if (selectedRoomId !== "new") {
        const selectedRoom = loadedRooms.find((room) => room.id === selectedRoomId);
        if (selectedRoom) {
          setRoomDraft(normalizeRoom(selectedRoom));
        } else {
          setSelectedRoomId("new");
          setRoomDraft(emptyRoomDraft);
        }
      }
    } catch (error) {
      setRoomMessage(error instanceof Error ? `Could not load rooms: ${error.message}` : "Could not load rooms.");
    } finally {
      setRoomStatus("idle");
    }
  }, [apiBaseUrl, selectedRoomAreaId, selectedRoomId, useDevProxy]);

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

          const loadedRooms = ((await response.json()) as RoomView[]).map(normalizeRoom).sort(compareRooms);
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
    if (!authSession.authenticated || activeKind !== "rooms") {
      return;
    }

    if (selectedRoomAreaId) {
      loadRooms(selectedRoomAreaId);
    } else {
      setRooms([]);
      setSelectedRoomId("new");
      setRoomDraft(emptyRoomDraft);
    }
  }, [activeKind, authSession.authenticated, loadRooms, selectedRoomAreaId]);

  const loadMobiles = useCallback(async (areaId = selectedMobileAreaId) => {
    if (!areaId) {
      setMobiles([]);
      setSelectedMobileId("new");
      setMobileDraft(emptyMobileDraft);
      setMobileMessage("Select an area to load mobiles.");
      return;
    }

    setMobileStatus("loading");
    setMobileMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, `/api/v1/mobiles/area/${areaId}`));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const loadedMobiles = ((await response.json()) as MobileView[]).map(normalizeMobile).sort(compareMobiles);
      setMobiles(loadedMobiles);
      setMobileMessage(`Loaded ${loadedMobiles.length} mobiles.`);

      if (selectedMobileId !== "new") {
        const selectedMobile = loadedMobiles.find((mobile) => mobile.id === selectedMobileId);
        if (selectedMobile) {
          setMobileDraft(normalizeMobile(selectedMobile));
        } else {
          setSelectedMobileId("new");
          setMobileDraft(emptyMobileDraft);
        }
      }
    } catch (error) {
      setMobileMessage(error instanceof Error ? `Could not load mobiles: ${error.message}` : "Could not load mobiles.");
    } finally {
      setMobileStatus("idle");
    }
  }, [apiBaseUrl, selectedMobileAreaId, selectedMobileId, useDevProxy]);

  useEffect(() => {
    if (!authSession.authenticated || activeKind !== "mobiles") {
      return;
    }

    if (selectedMobileAreaId) {
      loadMobiles(selectedMobileAreaId);
    } else {
      setMobiles([]);
      setSelectedMobileId("new");
      setMobileDraft(emptyMobileDraft);
    }
  }, [activeKind, authSession.authenticated, loadMobiles, selectedMobileAreaId]);

  const loadEditableDocuments = useCallback(
      async (kind: FeatureKind = activeKind, areaId = selectedEditableAreaId) => {
        const resource = apiResources.find((entry) => entry.kind === kind);

        if (!resource || !editableResourceKinds.includes(kind)) {
          setEditableDocuments([]);
          return;
        }

        if (!areaId) {
          setEditableDocuments([]);
          setSelectedEditableDocumentId("new");
          setEditableDocumentDraft(getEmptyEditableResourceDraft(kind));
          setEditableDocumentMessage(`Select an area to load ${resource.label.toLowerCase()}.`);
          return;
        }

        setEditableDocumentStatus("loading");
        setEditableDocumentMessage("");

        try {
          const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, `${resource.endpoint}/area/${areaId}`));

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const loadedDocuments = ((await response.json()) as EditableResourceDocument[])
              .map((document) => normalizeEditableResourceDocument(document, kind))
              .sort(compareEditableResourceDocuments);
          setEditableDocuments(loadedDocuments);
          setEditableDocumentMessage(`Loaded ${loadedDocuments.length} ${resource.label.toLowerCase()}.`);

          if (selectedEditableDocumentId !== "new") {
            const selectedDocument = loadedDocuments.find((document) => document.id === selectedEditableDocumentId);
            if (selectedDocument) {
              setEditableDocumentDraft(normalizeEditableResourceDocument(selectedDocument, kind));
            } else {
              setSelectedEditableDocumentId("new");
              setEditableDocumentDraft(getEmptyEditableResourceDraft(kind));
            }
          }
        } catch (error) {
          setEditableDocuments([]);
          setEditableDocumentMessage(
              error instanceof Error
                  ? `Could not load ${resource.label.toLowerCase()}: ${error.message}`
                  : `Could not load ${resource.label.toLowerCase()}.`,
          );
        } finally {
          setEditableDocumentStatus("idle");
        }
      },
      [activeKind, apiBaseUrl, selectedEditableAreaId, selectedEditableDocumentId, useDevProxy],
  );

  useEffect(() => {
    if (!authSession.authenticated || !editableResourceKinds.includes(activeKind)) {
      return;
    }

    setEditableDocumentDraft((currentDraft) =>
        selectedEditableDocumentId === "new" ? getEmptyEditableResourceDraft(activeKind) : currentDraft,
    );
    setNewEditableDocumentDraft(getEmptyEditableResourceDraft(activeKind));

    if (selectedEditableAreaId) {
      loadEditableDocuments(activeKind, selectedEditableAreaId);
    } else {
      setEditableDocuments([]);
      setSelectedEditableDocumentId("new");
      setEditableDocumentMessage(`Select an area to load ${activeResource.label.toLowerCase()}.`);
    }
  }, [
    activeKind,
    activeResource.label,
    authSession.authenticated,
    loadEditableDocuments,
    selectedEditableAreaId,
    selectedEditableDocumentId,
  ]);

  const loadTopLevelDocuments = useCallback(
      async (kind: FeatureKind = activeKind) => {
        const resource = apiResources.find((entry) => entry.kind === kind);

        if (!resource || !topLevelEditableResourceKinds.includes(kind)) {
          setTopLevelDocuments([]);
          return;
        }

        setTopLevelDocumentStatus("loading");
        setTopLevelDocumentMessage("");

        try {
          const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, resource.endpoint));

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const loadedDocuments = ((await response.json()) as EditableResourceDocument[])
              .map((document) => normalizeEditableResourceDocument(document, kind))
              .sort(compareEditableResourceDocuments);
          setTopLevelDocuments(loadedDocuments);
          setTopLevelDocumentMessage(`Loaded ${loadedDocuments.length} ${resource.label.toLowerCase()}.`);

          if (selectedTopLevelDocumentId !== "new") {
            const selectedDocument = loadedDocuments.find((document) => document.id === selectedTopLevelDocumentId);
            if (selectedDocument) {
              setTopLevelDocumentDraft(normalizeEditableResourceDocument(selectedDocument, kind));
            } else {
              setSelectedTopLevelDocumentId("new");
              setTopLevelDocumentDraft(getEmptyEditableResourceDraft(kind));
            }
          }
        } catch (error) {
          setTopLevelDocuments([]);
          setTopLevelDocumentMessage(
              error instanceof Error
                  ? `Could not load ${resource.label.toLowerCase()}: ${error.message}`
                  : `Could not load ${resource.label.toLowerCase()}.`,
          );
        } finally {
          setTopLevelDocumentStatus("idle");
        }
      },
      [activeKind, apiBaseUrl, selectedTopLevelDocumentId, useDevProxy],
  );

  useEffect(() => {
    if (!authSession.authenticated || !topLevelEditableResourceKinds.includes(activeKind)) {
      return;
    }

    setTopLevelDocumentDraft((currentDraft) =>
        selectedTopLevelDocumentId === "new" ? getEmptyEditableResourceDraft(activeKind) : currentDraft,
    );
    setNewTopLevelDocumentDraft(getEmptyEditableResourceDraft(activeKind));
    loadTopLevelDocuments(activeKind);
  }, [activeKind, authSession.authenticated, loadTopLevelDocuments, selectedTopLevelDocumentId]);

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

  function selectRoomArea(areaId: string) {
    setSelectedRoomAreaId(areaId);
    setSelectedRoomId("new");
    setRoomDraft(emptyRoomDraft);

    if (!areaId) {
      setRooms([]);
      setRoomMessage("Select an area to load rooms.");
    }
  }

  function selectMobileArea(areaId: string) {
    setSelectedMobileAreaId(areaId);
    setSelectedMobileId("new");
    setMobileDraft(emptyMobileDraft);

    if (!areaId) {
      setMobiles([]);
      setMobileMessage("Select an area to load mobiles.");
    }
  }

  function selectMobile(mobileId: string) {
    setSelectedMobileId(mobileId);
    setMobileMessage("");

    if (mobileId === "new") {
      setMobileDraft(emptyMobileDraft);
      return;
    }

    const selectedMobile = mobiles.find((mobile) => mobile.id === mobileId);
    if (selectedMobile) {
      setMobileDraft(normalizeMobile(selectedMobile));
    }
  }

  function openNewMobileModal() {
    setNewMobileDraft({
      ...emptyMobileDraft,
      areaId: selectedMobileAreaId || String(mobileDraft.areaId ?? ""),
    });
    setMobileMessage("");
    setIsNewMobileModalOpen(true);
  }

  function selectEditableArea(areaId: string) {
    setSelectedEditableAreaId(areaId);
    setSelectedEditableDocumentId("new");
    setEditableDocumentDraft(getEmptyEditableResourceDraft(activeKind));

    if (!areaId) {
      setEditableDocuments([]);
      setEditableDocumentMessage(`Select an area to load ${activeResource.label.toLowerCase()}.`);
    }
  }

  function selectEditableDocument(documentId: string) {
    setSelectedEditableDocumentId(documentId);
    setEditableDocumentMessage("");

    if (documentId === "new") {
      setEditableDocumentDraft(getEmptyEditableResourceDraft(activeKind));
      return;
    }

    const selectedDocument = editableDocuments.find((document) => document.id === documentId);
    if (selectedDocument) {
      setEditableDocumentDraft(normalizeEditableResourceDocument(selectedDocument, activeKind));
    }
  }

  function openNewEditableDocumentModal() {
    setNewEditableDocumentDraft({
      ...getEmptyEditableResourceDraft(activeKind),
      areaId: selectedEditableAreaId || String(editableDocumentDraft.areaId ?? ""),
    });
    setEditableDocumentMessage("");
    setIsNewEditableDocumentModalOpen(true);
  }

  function selectTopLevelDocument(documentId: string) {
    setSelectedTopLevelDocumentId(documentId);
    setTopLevelDocumentMessage("");

    if (documentId === "new") {
      setTopLevelDocumentDraft(getEmptyEditableResourceDraft(activeKind));
      return;
    }

    const selectedDocument = topLevelDocuments.find((document) => document.id === documentId);
    if (selectedDocument) {
      setTopLevelDocumentDraft(normalizeEditableResourceDocument(selectedDocument, activeKind));
    }
  }

  function openNewTopLevelDocumentModal() {
    setNewTopLevelDocumentDraft(getEmptyEditableResourceDraft(activeKind));
    setTopLevelDocumentMessage("");
    setIsNewTopLevelDocumentModalOpen(true);
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

  function updateMobileDraft(key: string, value: EditableValue | undefined) {
    setMobileDraft((current) => ({ ...current, [key]: value }));
  }

  function updateNewMobileDraft(key: string, value: EditableValue | undefined) {
    setNewMobileDraft((current) => ({ ...current, [key]: value }));
  }

  function updateEditableDocumentDraft(key: string, value: EditableValue | undefined) {
    setEditableDocumentDraft((current) => ({ ...current, [key]: value }));
  }

  function updateNewEditableDocumentDraft(key: string, value: EditableValue | undefined) {
    setNewEditableDocumentDraft((current) => ({ ...current, [key]: value }));
  }

  function updateTopLevelDocumentDraft(key: string, value: EditableValue | undefined) {
    setTopLevelDocumentDraft((current) => ({ ...current, [key]: value }));
  }

  function updateNewTopLevelDocumentDraft(key: string, value: EditableValue | undefined) {
    setNewTopLevelDocumentDraft((current) => ({ ...current, [key]: value }));
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
      setRooms((currentRooms) => upsertRoomForArea(currentRooms, savedRoom, selectedRoomAreaId));
      setAreaRooms((currentRooms) => upsertRoomForArea(currentRooms, savedRoom, selectedAreaId));
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
      setRooms((currentRooms) => upsertRoomForArea(currentRooms, savedRoom, selectedRoomAreaId));
      setAreaRooms((currentRooms) => upsertRoomForArea(currentRooms, savedRoom, selectedAreaId));
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

  async function saveMobile() {
    const payload = normalizeMobile(mobileDraft);

    if (selectedMobileId === "new" || !payload.id) {
      setMobileMessage("Select an existing mobile to update, or use New Mobile.");
      return;
    }

    const validationMessage = validateMobile(payload);

    if (validationMessage) {
      setMobileMessage(validationMessage);
      return;
    }

    setMobileStatus("saving");
    setMobileMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, `/api/v1/mobiles/${payload.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedMobile = normalizeMobile((await response.json()) as MobileView);
      setMobileDraft(savedMobile);
      setSelectedMobileId(savedMobile.id ?? "new");
      setMobileMessage("Mobile updated.");
      setMobiles((currentMobiles) => upsertMobileForArea(currentMobiles, savedMobile, selectedMobileAreaId));
    } catch (error) {
      setMobileMessage(error instanceof Error ? `Could not save mobile: ${error.message}` : "Could not save mobile.");
    } finally {
      setMobileStatus("idle");
    }
  }

  async function createMobileFromModal() {
    const payload = normalizeMobile(newMobileDraft);
    const validationMessage = validateMobile(payload);

    if (validationMessage) {
      setMobileMessage(validationMessage);
      return;
    }

    setMobileStatus("saving");
    setMobileMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, "/api/v1/mobiles"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedMobile = normalizeMobile((await response.json()) as MobileView);
      setMobiles((currentMobiles) => upsertMobileForArea(currentMobiles, savedMobile, selectedMobileAreaId));
      setMobileDraft(savedMobile);
      setSelectedMobileId(savedMobile.id ?? "new");
      setNewMobileDraft(emptyMobileDraft);
      setIsNewMobileModalOpen(false);
      setMobileMessage("Mobile created.");
    } catch (error) {
      setMobileMessage(error instanceof Error ? `Could not create mobile: ${error.message}` : "Could not create mobile.");
    } finally {
      setMobileStatus("idle");
    }
  }

  async function saveEditableDocument() {
    const resource = apiResources.find((entry) => entry.kind === activeKind);
    const payload = normalizeEditableResourceDocument(editableDocumentDraft, activeKind);

    if (!resource || !editableResourceKinds.includes(activeKind)) {
      return;
    }

    if (selectedEditableDocumentId === "new" || !payload.id) {
      setEditableDocumentMessage(`Select an existing ${resource.label.slice(0, -1).toLowerCase()} to update, or use New.`);
      return;
    }

    const validationMessage = validateEditableResourceDocument(payload, resource.label);

    if (validationMessage) {
      setEditableDocumentMessage(validationMessage);
      return;
    }

    setEditableDocumentStatus("saving");
    setEditableDocumentMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, `${resource.endpoint}/${payload.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedDocument = normalizeEditableResourceDocument((await response.json()) as EditableResourceDocument, activeKind);
      setEditableDocumentDraft(savedDocument);
      setSelectedEditableDocumentId(savedDocument.id ?? "new");
      setEditableDocumentMessage(`${singularResourceLabel(resource.label)} updated.`);
      setEditableDocuments((currentDocuments) =>
          upsertEditableResourceDocumentForArea(currentDocuments, savedDocument, selectedEditableAreaId),
      );
    } catch (error) {
      setEditableDocumentMessage(
          error instanceof Error
              ? `Could not save ${singularResourceLabel(resource.label).toLowerCase()}: ${error.message}`
              : `Could not save ${singularResourceLabel(resource.label).toLowerCase()}.`,
      );
    } finally {
      setEditableDocumentStatus("idle");
    }
  }

  async function createEditableDocumentFromModal() {
    const resource = apiResources.find((entry) => entry.kind === activeKind);
    const payload = normalizeEditableResourceDocument(newEditableDocumentDraft, activeKind);

    if (!resource || !editableResourceKinds.includes(activeKind)) {
      return;
    }

    const validationMessage = validateEditableResourceDocument(payload, resource.label);

    if (validationMessage) {
      setEditableDocumentMessage(validationMessage);
      return;
    }

    setEditableDocumentStatus("saving");
    setEditableDocumentMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, resource.endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedDocument = normalizeEditableResourceDocument((await response.json()) as EditableResourceDocument, activeKind);
      setEditableDocuments((currentDocuments) =>
          upsertEditableResourceDocumentForArea(currentDocuments, savedDocument, selectedEditableAreaId),
      );
      setEditableDocumentDraft(savedDocument);
      setSelectedEditableDocumentId(savedDocument.id ?? "new");
      setNewEditableDocumentDraft(getEmptyEditableResourceDraft(activeKind));
      setIsNewEditableDocumentModalOpen(false);
      setEditableDocumentMessage(`${singularResourceLabel(resource.label)} created.`);
    } catch (error) {
      setEditableDocumentMessage(
          error instanceof Error
              ? `Could not create ${singularResourceLabel(resource.label).toLowerCase()}: ${error.message}`
              : `Could not create ${singularResourceLabel(resource.label).toLowerCase()}.`,
      );
    } finally {
      setEditableDocumentStatus("idle");
    }
  }

  async function saveTopLevelDocument() {
    const resource = apiResources.find((entry) => entry.kind === activeKind);
    const payload = normalizeEditableResourceDocument(topLevelDocumentDraft, activeKind);

    if (!resource || !topLevelEditableResourceKinds.includes(activeKind)) {
      return;
    }

    if (selectedTopLevelDocumentId === "new" || !payload.id) {
      setTopLevelDocumentMessage(`Select an existing ${singularResourceLabel(resource.label).toLowerCase()} to update, or use New.`);
      return;
    }

    const validationMessage = validateEditableResourceDocument(payload, resource.label);

    if (validationMessage) {
      setTopLevelDocumentMessage(validationMessage);
      return;
    }

    setTopLevelDocumentStatus("saving");
    setTopLevelDocumentMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, `${resource.endpoint}/${payload.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedDocument = normalizeEditableResourceDocument((await response.json()) as EditableResourceDocument, activeKind);
      setTopLevelDocumentDraft(savedDocument);
      setSelectedTopLevelDocumentId(savedDocument.id ?? "new");
      setTopLevelDocumentMessage(`${singularResourceLabel(resource.label)} updated.`);
      setTopLevelDocuments((currentDocuments) => upsertEditableResourceDocument(currentDocuments, savedDocument));
    } catch (error) {
      setTopLevelDocumentMessage(
          error instanceof Error
              ? `Could not save ${singularResourceLabel(resource.label).toLowerCase()}: ${error.message}`
              : `Could not save ${singularResourceLabel(resource.label).toLowerCase()}.`,
      );
    } finally {
      setTopLevelDocumentStatus("idle");
    }
  }

  async function createTopLevelDocumentFromModal() {
    const resource = apiResources.find((entry) => entry.kind === activeKind);
    const payload = normalizeEditableResourceDocument(newTopLevelDocumentDraft, activeKind);

    if (!resource || !topLevelEditableResourceKinds.includes(activeKind)) {
      return;
    }

    const validationMessage = validateEditableResourceDocument(payload, resource.label);

    if (validationMessage) {
      setTopLevelDocumentMessage(validationMessage);
      return;
    }

    setTopLevelDocumentStatus("saving");
    setTopLevelDocumentMessage("");

    try {
      const response = await fetch(buildApiUrl(apiBaseUrl, useDevProxy, resource.endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedDocument = normalizeEditableResourceDocument((await response.json()) as EditableResourceDocument, activeKind);
      setTopLevelDocuments((currentDocuments) => upsertEditableResourceDocument(currentDocuments, savedDocument));
      setTopLevelDocumentDraft(savedDocument);
      setSelectedTopLevelDocumentId(savedDocument.id ?? "new");
      setNewTopLevelDocumentDraft(getEmptyEditableResourceDraft(activeKind));
      setIsNewTopLevelDocumentModalOpen(false);
      setTopLevelDocumentMessage(`${singularResourceLabel(resource.label)} created.`);
    } catch (error) {
      setTopLevelDocumentMessage(
          error instanceof Error
              ? `Could not create ${singularResourceLabel(resource.label).toLowerCase()}: ${error.message}`
              : `Could not create ${singularResourceLabel(resource.label).toLowerCase()}.`,
      );
    } finally {
      setTopLevelDocumentStatus("idle");
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

  if (authStatus === "checking") {
    return <AuthLoading />;
  }

  if (!authSession.authenticated) {
    return (
        <LoginPage
            isSubmitting={loginStatus === "submitting"}
            message={loginMessage}
            onSubmit={submitLogin}
        />
    );
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
                    <Icon size={18}/>
                    <span>{item.label}</span>
                  </button>
              );
            })}
          </nav>

          <div className="sidebar-panel">
            <div className={`status-dot ${health.state}`}/>
            <div>
              <strong>{health.state === "online" ? "API online" : "Draft mode"}</strong>
              <span>{health.detail}</span>
            </div>
          </div>
          <div className="sidebar-user">
            <div>
              <strong>{authSession.user?.username}</strong>
              <span>{authSession.user?.role}</span>
            </div>
            <button className="icon-button" type="button" onClick={submitLogout} aria-label="Sign out">
              <LogOut size={18}/>
            </button>
          </div>
        </aside>

        <main className="workspace">
          <header className={activeKind === "settings" ? "topbar settings-topbar" : "topbar"}>
            {activeKind !== "settings" ? (
                <>
                  <button className="icon-button mobile-menu" type="button" aria-label="Open navigation">
                    <Menu size={20}/>
                  </button>
                  <label className="search-box">
                    <Search size={18}/>
                    <input placeholder="Search features, vnums, areas, commands"/>
                  </label>
                  <button className="ghost-button" type="button">
                    <FileJson size={18}/>
                    Import JSON
                  </button>
                  <button className="primary-button" type="button">
                    <Plus size={18}/>
                    New Draft
                  </button>
                </>
            ) : (
                <span/>
            )}
            <button
                className={activeKind === "settings" ? "settings-button active" : "settings-button"}
                type="button"
                onClick={() => setActiveKind("settings")}
            >
              <ServerCog size={18}/>
              Settings
            </button>
          </header>

          {activeKind === "settings" ? (
              <section className="settings-only">
                <SettingsPanel
                    apiBaseUrl={apiBaseUrl}
                    apiBaseUrlInput={apiBaseUrlInput}
                    onApplyApiBaseUrl={applyApiBaseUrl}
                    onTestApiBaseUrl={() => testApiBaseUrl(apiBaseUrlInput)}
                    onToggleDevProxy={toggleDevProxy}
                    onUpdateApiBaseUrlInput={setApiBaseUrlInput}
                    useDevProxy={useDevProxy}
                />
              </section>
          ) : (
              <>
                <section className="overview-band">
                  <div className="overview-copy">
                    <div className="eyebrow">
                      <Activity size={16}/>
                      Persistence-backed authoring
                    </div>
                    <h2>Design skills, spells, world content, and player communication in one place.</h2>
                    <p>
                      This starter maps the React UI to the Java modulith resources and keeps drafts shaped
                      around the Python server concepts: registries, handlers, flags, rooms, and commands.
                    </p>
                  </div>
                  <div className="overview-metrics" aria-label="Designer coverage">
                    <Metric label="API resources" value={apiResources.length.toString()}/>
                    <Metric label="Ready editors" value={readyEditorCount.toString()}/>
                    <Metric label="Draft queue" value={workQueue.length.toString()}/>
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
                              setSelectedRoomAreaId(room.areaId || selectedAreaId);
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
                            onSelectRoomArea={selectRoomArea}
                            onSelectRoom={selectRoom}
                            onBrowseToExitDestination={browseToExitDestination}
                            onUpdateRoomDraft={updateRoomDraft}
                            areas={areas}
                            roomDraft={roomDraft}
                            roomMessage={roomMessage}
                            roomStatus={roomStatus}
                            rooms={rooms}
                            selectedRoomAreaId={selectedRoomAreaId}
                            selectedRoomId={selectedRoomId}
                        />
                    ) : null}

                    {activeKind === "mobiles" ? (
                        <MobileDesigner
                            areas={areas}
                            mobileDraft={mobileDraft}
                            mobileMessage={mobileMessage}
                            mobileStatus={mobileStatus}
                            mobiles={mobiles}
                            onCreateNew={openNewMobileModal}
                            onLoadMobiles={loadMobiles}
                            onSaveMobile={saveMobile}
                            onSelectMobile={selectMobile}
                            onSelectMobileArea={selectMobileArea}
                            onUpdateMobileDraft={updateMobileDraft}
                            selectedMobileAreaId={selectedMobileAreaId}
                            selectedMobileId={selectedMobileId}
                        />
                    ) : null}

                    {editableResourceKinds.includes(activeKind) ? (
                        <EditableResourceDesigner
                            areas={areas}
                            documents={editableDocuments}
                            documentDraft={editableDocumentDraft}
                            message={editableDocumentMessage}
                            onCreateNew={openNewEditableDocumentModal}
                            onLoadDocuments={() => loadEditableDocuments(activeKind, selectedEditableAreaId)}
                            onSaveDocument={saveEditableDocument}
                            onSelectArea={selectEditableArea}
                            onSelectDocument={selectEditableDocument}
                            onUpdateDocumentDraft={updateEditableDocumentDraft}
                            resource={activeResource}
                            selectedAreaId={selectedEditableAreaId}
                            selectedDocumentId={selectedEditableDocumentId}
                            status={editableDocumentStatus}
                        />
                    ) : null}

                    {topLevelEditableResourceKinds.includes(activeKind) ? (
                        <TopLevelResourceDesigner
                            documents={topLevelDocuments}
                            documentDraft={topLevelDocumentDraft}
                            message={topLevelDocumentMessage}
                            onCreateNew={openNewTopLevelDocumentModal}
                            onLoadDocuments={() => loadTopLevelDocuments(activeKind)}
                            onSaveDocument={saveTopLevelDocument}
                            onSelectDocument={selectTopLevelDocument}
                            onUpdateDocumentDraft={updateTopLevelDocumentDraft}
                            resource={activeResource}
                            selectedDocumentId={selectedTopLevelDocumentId}
                            status={topLevelDocumentStatus}
                        />
                    ) : null}

                    {activeKind !== "areas" &&
                    activeKind !== "rooms" &&
                    activeKind !== "mobiles" &&
                    !editableResourceKinds.includes(activeKind) &&
                    !topLevelEditableResourceKinds.includes(activeKind) ? (
                        <>
                          <div className="resource-summary">
                            <ActiveResourceIcon size={22}/>
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
                              <Code2 size={18}/>
                              Validate Shape
                            </button>
                            <button className="primary-button" type="button">
                              <Save size={18}/>
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
                      <DatabaseZap size={20}/>
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
                {isNewMobileModalOpen ? (
                    <MobileCreateModal
                        fieldNames={mobileFieldNames(mobiles, mobileDraft, newMobileDraft)}
                        isSaving={mobileStatus === "saving"}
                        mobileDraft={newMobileDraft}
                        onClose={() => setIsNewMobileModalOpen(false)}
                        onSubmit={createMobileFromModal}
                        onUpdateMobileDraft={updateNewMobileDraft}
                    />
                ) : null}
                {isNewEditableDocumentModalOpen ? (
                    <EditableResourceCreateModal
                        fieldNames={editableResourceFieldNames(activeKind, editableDocuments, editableDocumentDraft, newEditableDocumentDraft)}
                        isSaving={editableDocumentStatus === "saving"}
                        documentDraft={newEditableDocumentDraft}
                        onClose={() => setIsNewEditableDocumentModalOpen(false)}
                        onSubmit={createEditableDocumentFromModal}
                        onUpdateDocumentDraft={updateNewEditableDocumentDraft}
                        resource={activeResource}
                    />
                ) : null}
                {isNewTopLevelDocumentModalOpen ? (
                    <EditableResourceCreateModal
                        fieldNames={editableResourceFieldNames(
                            activeKind,
                            topLevelDocuments,
                            topLevelDocumentDraft,
                            newTopLevelDocumentDraft,
                        )}
                        isSaving={topLevelDocumentStatus === "saving"}
                        documentDraft={newTopLevelDocumentDraft}
                        onClose={() => setIsNewTopLevelDocumentModalOpen(false)}
                        onSubmit={createTopLevelDocumentFromModal}
                        onUpdateDocumentDraft={updateNewTopLevelDocumentDraft}
                        resource={activeResource}
                    />
                ) : null}

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
                          <CheckCircle2 size={18}/>
                          <strong>{item.title}</strong>
                          <span>{item.area}</span>
                          <span>{item.owner}</span>
                          <span className="pill muted">{item.status}</span>
                        </div>
                    ))}
                  </div>
                </section>
              </>
          )}
        </main>
      </div>
  );
}

function AuthLoading() {
  return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="brand-row login-brand">
            <div className="brand-mark">SoM</div>
            <div>
              <h1>Designer</h1>
              <span>Checking session</span>
            </div>
          </div>
        </section>
      </main>
  );
}

function LoginPage({
                     isSubmitting,
                     message,
                     onSubmit,
                   }: {
  isSubmitting: boolean;
  message: string;
  onSubmit: (username: string, password: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(username, password);
  }

  return (
      <main className="login-shell">
        <section className="login-panel" aria-labelledby="login-title">
          <div className="brand-row login-brand">
            <div className="brand-mark">SoM</div>
            <div>
              <h1 id="login-title">Designer</h1>
              <span>Builder access</span>
            </div>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              Username or Email
              <input
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {message ? <p className="login-message">{message}</p> : null}
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              <LogIn size={18}/>
              {isSubmitting ? "Signing in" : "Sign In"}
            </button>
          </form>
        </section>
      </main>
  );
}

function Metric({label, value}: { label: string; value: string }) {
  return (
      <div className="metric">
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
  );
}

function SettingsPanel({
                         apiBaseUrl,
                         apiBaseUrlInput,
                         onApplyApiBaseUrl,
                         onTestApiBaseUrl,
                         onToggleDevProxy,
                         onUpdateApiBaseUrlInput,
                         useDevProxy,
                       }: {
  apiBaseUrl: string;
  apiBaseUrlInput: string;
  onApplyApiBaseUrl: () => void;
  onTestApiBaseUrl: () => void;
  onToggleDevProxy: (value: boolean) => void;
  onUpdateApiBaseUrlInput: (value: string) => void;
  useDevProxy: boolean;
}) {
  return (
      <div className="settings-panel">
        <div className="section-heading">
          <div>
            <span>Designer Settings</span>
            <h3>API Server</h3>
          </div>
          <ServerCog size={22}/>
        </div>
        <div className="resource-summary">
          <ServerCog size={22}/>
          <p>
            Point the designer at the Java persistence server. This is stored in your browser and
            used for health checks and API request previews.
          </p>
        </div>
        <div className="api-settings-form">
          <label>
            API Server
            <input
                value={apiBaseUrlInput}
                onChange={(event) => onUpdateApiBaseUrlInput(event.target.value)}
                placeholder="http://localhost:9080"
            />
          </label>
          <button className="primary-button" type="button" onClick={onApplyApiBaseUrl}>
            <Save size={18}/>
            Save
          </button>
          <button className="secondary-button" type="button" onClick={onTestApiBaseUrl}>
            <RotateCw size={18}/>
            Test
          </button>
        </div>
        <label className="proxy-toggle">
          <input
              type="checkbox"
              checked={useDevProxy}
              onChange={(event) => onToggleDevProxy(event.target.checked)}
          />
          <span>Use Vite dev proxy for browser requests</span>
        </label>
        <div className="settings-current">
          <strong>Active server</strong>
          <code>{apiBaseUrl}</code>
        </div>
      </div>
  );
}

