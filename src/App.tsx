import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Code2,
  DatabaseZap,
  FileJson,
  Menu,
  Plus,
  Save,
  Search,
} from "lucide-react";
import { apiResources, initialDraft, workQueue } from "./data";
import type { ApiHealth, DesignerDraft, FeatureKind } from "./domain";
import { buildCreateRequest, checkApiHealth } from "./api";

const navItems = [
  { id: "skills" as FeatureKind, label: "Skills" },
  { id: "spells" as FeatureKind, label: "Spells" },
  { id: "settings" as FeatureKind, label: "Settings" },
  { id: "areas" as FeatureKind, label: "Areas" },
  { id: "rooms" as FeatureKind, label: "Rooms" },
  { id: "mobiles" as FeatureKind, label: "Mobiles" },
  { id: "items" as FeatureKind, label: "Items" },
  { id: "communication" as FeatureKind, label: "Comms" },
];

export function App() {
  const [activeKind, setActiveKind] = useState<FeatureKind>("spells");
  const [draft, setDraft] = useState<DesignerDraft>(initialDraft);
  const [health, setHealth] = useState<ApiHealth>({
    state: "checking",
    detail: "Checking Java API",
  });

  const activeResource = useMemo(
    () => apiResources.find((resource) => resource.kind === activeKind) ?? apiResources[0],
    [activeKind],
  );
  const ActiveResourceIcon = activeResource.icon;
  const readyEditorCount = apiResources.filter((resource) => resource.status === "Ready").length;

  const createRequest = useMemo(
    () =>
      buildCreateRequest(activeResource, {
        name: draft.name,
        kind: draft.kind,
        areaId: draft.areaId,
        target: draft.target,
        level: draft.level,
        notes: draft.notes,
      }),
    [activeResource, draft],
  );

  useEffect(() => {
    checkApiHealth().then(setHealth);
  }, []);

  function updateDraft<Value extends keyof DesignerDraft>(key: Value, value: DesignerDraft[Value]) {
    setDraft((current) => ({ ...current, [key]: value }));
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
