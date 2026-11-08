# Angular code review — 2026-11-07

## Scope

General review of the current working-tree application, focused on entry points and core content-authoring flows. No comparison base was supplied or invented. HEAD was `33e0959`; the checkout contains staged, unstaged, and untracked migration work. Findings describe the current Angular implementation, rather than claiming which historical revision introduced each defect. Existing changes were preserved.

Reviewed `src/main.ts`, `src/app/` (all five files), `src/api.ts`, `src/data.ts`, domain defaults/normalization/validation, shared and relevant view types, environment files, proxy configuration, shared responsive/theme styles, package/lockfile versions, and TypeScript/Angular configuration. This is not an exhaustive backend-contract, security, visual, or migration-parity audit.

Read the repository instructions and Angular reviewer/developer skills, including template-driven forms and HTTP references. The lockfile and installed core package identify Angular **21.2.18**; TypeScript is **5.9.3**.

## Summary

**9 confirmed findings: 3 P1, 6 P2; no P0 or P3.** The main risks are silently discarding edits, saving stale values, and applying asynchronous responses to another workspace. Compilation succeeds, but does not establish safe authoring behavior.

## Findings

### ANG-001 — Late requests overwrite the current workspace

- **Priority:** P1 — High
- **Category:** Asynchronous state / input preservation
- **Location:** [app.component.ts:212–222](../src/app/app.component.ts#L212), [app.component.ts:309–316](../src/app/app.component.ts#L309)
- **Evidence:** Start loading spells, switch to classes, and edit the new class draft before the spell response resolves. The continuation normalizes using the current `activeKind`, replaces the current list, and calls `selectResource`, replacing the class draft. A pending save similarly normalizes its response with the current kind and unconditionally replaces the current draft. Resource, area, document selection, server, and draft revision are not checked on completion. Navigation, New, selection, and editing remain available during these requests. A delayed load can also reset the shared status to idle during a save, re-enabling Save prematurely.
- **Validation:** Deferred-promise probes reproduced both a late spell list resetting a classes draft and a late spell save replacing a classes draft. No backend calls were made.
- **Impact:** Ordinary navigation or editing during a request loses newer input or mixes resource data; subsequent saves can target the wrong collection for the displayed data.
- **Suggested correction:** Capture request context and use request/workspace generations to reject stale success, error, and finally handlers. Normalize with the captured kind. Check draft revision before replacing edits made during a save. Track overlapping operations deliberately and guard duplicate writes in the save method.

### ANG-002 — Invalid structured JSON silently saves the previous value

- **Priority:** P1 — High
- **Category:** Forms / validation / persistence
- **Location:** [resource-form.component.ts:122–129](../src/app/resource-form.component.ts#L122)
- **Evidence:** Change a spell's payload field to `{broken`, blur, and save. `commitJson` catches the parse error and stores only field-local text. It emits neither an error nor a draft change. The parent still holds valid raw JSON containing the previous payload, so `saveActiveDocument` parses and submits that older value. The save button checks only saving status, not field JSON validity.
- **Validation:** A component-method probe retained `{broken` in the visible buffer while a mocked save received the previous `{old:true}` payload.
- **Impact:** Save can appear successful while persisting different content from what the field displays.
- **Suggested correction:** Expose field parse/pending state to the parent, show an associated validation message, and block saving until every structured JSON buffer is committed successfully. Ensure the save path includes all current editing buffers.

### ANG-003 — Structured edits erase changes made in raw JSON

- **Priority:** P1 — High
- **Category:** Draft synchronization
- **Location:** [app.component.html:250–255](../src/app/app.component.html#L250), [app.component.ts:267–269](../src/app/app.component.ts#L267)
- **Evidence:** Raw JSON binds only to `resourceDraftText`; it does not update `resourceDraft`. Change a spell's name in raw JSON, then adjust Beats or a guard in the structured editor. `updateResourceDraft` receives the older structured object and serializes it over the complete raw buffer, discarding the raw name change. Invalid raw input is also overwritten without warning by an unrelated structured edit.
- **Validation:** A probe changed the raw name to `raw change`, then updated structured Beats; the raw name reverted to `old`.
- **Impact:** Switching between the two simultaneously available editors silently loses unsaved work.
- **Suggested correction:** Establish an explicit synchronization boundary: parse valid raw changes into the canonical draft, and block conflicting structured changes while raw JSON is invalid or awaiting application. Preserve invalid text and explain how to resolve it.

### ANG-004 — Field JSON buffers leak into other documents

- **Priority:** P2 — Medium
- **Category:** Component lifecycle / draft isolation
- **Location:** [resource-form.component.ts:60](../src/app/resource-form.component.ts#L60), [resource-form.component.ts:98–103](../src/app/resource-form.component.ts#L98)
- **Evidence:** Enter invalid payload JSON in one spell, then select another spell. The same `som-resource-form` instance receives a new draft; its field-name-keyed map has no document reset. `jsonValue('payload')` returns the first spell's buffered text rather than the second spell's payload. Repairing and blurring that stale buffer commits it into the second draft.
- **Validation:** A probe replaced the form's draft and verified that its payload display still returned the previous `{broken` buffer. Parent/template tracing confirms that selecting a document reuses the component.
- **Impact:** The selected record displays another record's edits and can receive them accidentally.
- **Suggested correction:** Reset field buffers and validation when document/workspace identity changes, using a dedicated identity/reset input or equivalent lifecycle handling. Do not clear buffers for every ordinary immutable draft update, which would discard active edits.

### ANG-005 — Guard typing recreates every guard card

- **Priority:** P2 — Medium
- **Category:** Angular list identity / keyboard usability
- **Location:** [guard-list.component.ts:28](../src/app/guard-list.component.ts#L28), [guard-list.component.ts:205–206](../src/app/guard-list.component.ts#L205)
- **Evidence:** Each input event calls `updateGuardField`, then `emitGuards`, which clones every guard object. The parent immediately binds those new objects back to `guards`. `NgFor` has no `trackBy`, so its default object identity treats all cards as removed and inserted after every keystroke. This replaces the focused input DOM node, interrupting continuous typing; reordering also loses the focused card's identity.
- **Validation:** A method probe verified that a single field update changes every guard object's identity. Installed Angular common declarations explicitly document default object-identity tracking. Focus behavior is inferred from DOM replacement, not a browser observation.
- **Impact:** Guard predicates and messages cannot be edited reliably as continuous keyboard input.
- **Suggested correction:** Give draft guard rows stable editor-only keys preserved through edits/reordering, and track by those keys. Preserve or restore focus on removal. Keep editor keys out of persisted guard definitions.

### ANG-006 — Saving an area does not update the area selector cache

- **Priority:** P2 — Medium
- **Category:** Resource cache consistency
- **Location:** [app.component.ts:310–316](../src/app/app.component.ts#L310)
- **Evidence:** The area editor saves into `resourceDocuments` but never updates `areas`. Create an area, then navigate directly to Rooms. `loadAreasForFilter` returns early whenever the pre-existing cache is nonempty, so the new area is absent from the selector. Renamed areas likewise retain old names. Only explicitly reloading Areas refreshes this cache.
- **Validation:** A mocked successful area creation updated `resourceDocuments` while leaving `areas` unchanged.
- **Impact:** A newly created area cannot immediately be selected for child-content authoring through the normal flow.
- **Suggested correction:** Upsert successful area saves into `areas` with the existing normalization/sorting rules, or invalidate and refresh that cache before exposing the selector.

### ANG-007 — Area reassignment leaves records in the previous area's list

- **Priority:** P2 — Medium
- **Category:** Filtered list consistency
- **Location:** [app.component.ts:310–313](../src/app/app.component.ts#L310)
- **Evidence:** Load a room under area A, change its editable `areaId` to B, and save. The save continuation always inserts the returned document into the current list without comparing its area to the active filter. Existing domain helpers such as `upsertRoomForArea` already implement the necessary membership check but are not used here.
- **Validation:** A mocked save returning a room in B left that room in `resourceDocuments` while the selected filter remained A.
- **Impact:** The list misrepresents area ownership after a supported edit, until it is reloaded.
- **Suggested correction:** Remove the old record and reinsert the saved record only when it belongs to the active area filter. Apply this to all area-scoped resource kinds and define the resulting selection explicitly.

### ANG-008 — Changing servers reuses the previous server's area IDs

- **Priority:** P2 — Medium
- **Category:** Settings / server isolation
- **Location:** [app.component.ts:503–508](../src/app/app.component.ts#L503), [app.component.ts:388–390](../src/app/app.component.ts#L388)
- **Evidence:** In production with proxy routing disabled, load areas from server A, save server B in Settings, and navigate to Rooms. Applying settings changes the URL but retains both `areas` and `selectedResourceAreaId`. The nonempty-cache shortcut skips loading B's areas, and the list request uses an A area ID against B. No overlapping request is needed to trigger this issue.
- **Validation:** Static trace of settings application, navigation, cached area loading, and endpoint construction. This is distinct from ANG-001's late-response handling.
- **Impact:** The new server displays old server metadata and cannot reliably load its own area-scoped resources; requests use unrelated area identifiers.
- **Suggested correction:** Key cached data by effective server identity, or invalidate area metadata and selected IDs when that identity changes. Reload areas before building area-scoped requests and preserve any displaced unsaved drafts explicitly.

### ANG-009 — Proxy health messages identify a server the request did not test

- **Priority:** P2 — Medium
- **Category:** Environment / settings correctness
- **Location:** [api.service.ts:21](../src/app/api.service.ts#L21), [api.service.ts:33](../src/app/api.service.ts#L33)
- **Evidence:** In development, set the API Server input to a different host and click Test or Save. URL resolution forces a same-origin `/api` request, and `proxy.conf.json` still forwards it to `http://dragon:9080`. The health message nevertheless reports connection success/failure for the entered host. The settings page also labels that input as the active server. This is deterministically supported by both environment files, URL resolution, and static proxy configuration.
- **Impact:** Designers receive a false indication that they tested or switched to another persistence server.
- **Suggested correction:** Display the effective proxy target and explain that development proxy routing requires changing proxy configuration/restarting the dev server. Build health text from the effective route rather than the user-entered URL. Keep routing metadata consistent with forced proxy mode.

## Validation

- `npm run lint` — **passed**; TypeScript checking only, not ESLint.
- `npm run build` — **passed**; Angular/template compilation and production budgets. Initial bundle: 309.18 kB.
- `npm run build -- --configuration development` — **passed**; development environment replacement compiles.
- Eight focused, in-memory Node assertions — **passed**, reproducing invalid JSON saving an old payload, stale field buffers, raw-edit loss, late list replacement, late save replacement, area reassignment list drift, unchanged area cache after creation, and guard identity replacement. These probes transpiled the current TypeScript with the installed compiler and replaced Angular decorators/EventEmitter and persistence with minimal stubs. They validate component method/state behavior; they do **not** constitute Angular integration or browser tests. No test files, dependencies, or fixtures were added.
- Static review verified template bindings, request/response paths, editor lifetime, installed NgFor tracking documentation, environment routing, and cache behavior.
- No configured test script or Angular test target exists. No test-suite pass is claimed.
- No manual browser, accessibility, dark/light theme, or narrow-viewport verification was performed. No live backend calls or content writes were made.

## Open questions and limitations

- Backend persistence/runtime implementations were not audited. Findings do not assume undocumented schema fields, authorization guarantees, or response semantics. Endpoint support and gameplay compatibility require a separate contract review against the Java and Python consumers.
- Mocked persistence returns object-shaped successful saves; actual backend error/response formats were not exercised.
- Guard focus loss is supported by the identity trace and Angular's documented reconciliation behavior, but still merits browser confirmation alongside keyboard reordering/removal.
- Full migration equivalence, every resource variant, visual layout, and general security were outside this focused review. The only authored change is this report; existing staged/unstaged application work was preserved.
