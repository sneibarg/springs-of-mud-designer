# Angular UX Review — Springs of Mud Designer

Date: 2026-10-25  
Scope: current working repository, including uncommitted Angular application files; not a comparison against a historical revision. Reviewed the main editor, resource form, guard editor, API settings, shared CSS, and relevant resource metadata.

## Assessment

The application has a coherent visual language, recognizable resource labels, native form controls, and keyboard-accessible alternatives to dragging guards. However, the main authoring workflow is not yet dependable: drafts can disappear, two visible editors disagree about the same data, and guard typing loses focus.

**9 findings: 5 high priority (P1), 4 medium priority (P2).** Eight findings were reproduced or inspected in the running browser; the asynchronous-response finding is based on a source trace. No application fixes or backend writes were made.

## Findings

### UX-001 · P1 · Navigation silently discards unsaved work

**Locations:** [app.component.ts](../src/app/app.component.ts), lines 134–142, 234–252, 328–333, 368–374; [app.component.html](../src/app/app.component.html), lines 194–205.

**Reproduction:** Enter a name in a new spell, select Classes, then return to Spells. The name is blank, with no warning or recovery. Selecting another document, choosing New, changing area, or reloading also replaces the current draft.

**Impact:** Routine navigation can lose substantial editing work. Even selecting the current navigation item resets the workspace.

**Correction:** Track dirty state against a saved baseline, including raw and buffered complex-field edits. Before replacing a draft, offer Save / Discard / Stay or retain recoverable drafts by resource. Apply the same rule to Reload and repeated selection; consider a browser-exit guard for dirty work.

**Evidence:** Browser reproduction and source trace.

### UX-002 · P1 · Raw JSON and structured controls overwrite each other's work

**Locations:** [app.component.html](../src/app/app.component.html), lines 236–258; [app.component.ts](../src/app/app.component.ts), lines 267–269, 279–286.

**Reproduction:** Replace Raw JSON Payload with `{"name":"raw-only draft","kind":"spell"}`. The structured Name remains blank. Change the structured Target; the raw JSON is regenerated from the old structured draft and the raw-only name disappears.

**Impact:** Both surfaces appear to edit the same document, but Save reads the raw text while structured changes overwrite it. Users cannot reliably know which visible values will be persisted.

**Correction:** Establish one draft model with explicit parsing and validation boundaries. Either synchronize valid raw edits into the model or use mutually exclusive Form / JSON modes with an explicit apply transition. Preserve invalid text, explain the conflict, and prevent implicit overwrites.

**Evidence:** Browser reproduction. Save behavior verified in source without submitting a write.

### UX-003 · P1 · Guard inputs lose focus after the first character

**Locations:** [guard-list.component.ts](../src/app/guard-list.component.ts), lines 27–28, 158–175, 205–206.

**Reproduction:** Add a guard and type `abc` into Message key. Only `a` remains and focus leaves the input. Browser sequential typing stopped because the target changed or lost focus; a subsequent DOM inspection showed `value: "a"` and `focused: false`.

**Cause and impact:** Every edit emits fresh objects for all guards, while the list uses object identity with no stable tracking key. Angular recreates the input DOM. This interrupts ordinary typing and also threatens focus continuity during reordering.

**Correction:** Give guard editor rows stable UI identities that survive field edits and moves, and track rows by those identities. Keep UI keys out of the API payload. Preserve or explicitly restore appropriate focus after move/remove.

**Evidence:** Browser reproduction and source trace.

### UX-004 · P1 · Invalid complex-field text is silently ignored and leaks into another record

**Locations:** [resource-form.component.ts](../src/app/resource-form.component.ts), lines 60, 98–104, 118–130.

**Reproduction:** Enter `{invalid json` in Payload, then leave the field. No validation message appears. Select the loaded acid blast spell. Payload still displays the invalid text, while Raw JSON Payload contains the selected spell's actual payload object.

**Impact:** The text cache is keyed only by field name and is not reset on record changes. The UI can show one record's invalid edit over another record's data. Saving uses the previous valid model value rather than the invalid text the user sees.

**Correction:** Scope buffers to the document or reset them on document identity changes, coordinated with dirty-state handling. Expose parse errors next to the field, associate them with the control, and block saving while any complex field has unapplied invalid content.

**Evidence:** Browser reproduction; persistence path traced in source without saving.

### UX-005 · P1 · Late responses can replace the user's current editing context

**Locations:** [app.component.ts](../src/app/app.component.ts), lines 198–231, 301–319; [app.component.html](../src/app/app.component.html), lines 194–205, 268–270.

**Trigger:** Start loading or saving a resource, then switch resource kind or selected record before the response completes. Navigation and selection remain available while pending.

**Impact:** Load completion normalizes using the current `activeKind`, not necessarily the request's kind, then replaces the list and reselects a draft. Save completion also normalizes against current state and replaces the current draft and selection. A slow response can therefore display data in the wrong workspace or overwrite newer local edits.

**Correction:** Capture kind, area, selected record, and draft revision for each operation. Apply results only if their context is still current. Cancel obsolete reads where practical. For writes, allow completion but reconcile the result with its originating record; do not replace a newer draft.

**Evidence:** Static control-flow analysis. Delayed network timing and save completion were not exercised against the live backend.

### UX-006 · P2 · The mobile breakpoint creates a second column and pushes the editor off-screen

**Locations:** [styles.css](../src/styles.css), lines 817–823, 855–857, 1663–1674.

**Reproduction:** At a 390 × 844 viewport, measured document width was 820px. The structured editor began at x ≈ 412.6px, entirely beyond the visible right edge.

**Cause and impact:** The responsive rule sets the workspace to one column, but `.raw-json-field { grid-column: 2; }` remains active and creates an implicit second column. The structured editor is placed there too, requiring page-wide horizontal scrolling for the central task.

**Correction:** Reset raw JSON placement to `grid-column: 1 / -1` at the stacking breakpoint and verify all children have shrinkable minimum widths. Check 390px, 768px, and widths immediately above/below 1180px, plus zoom and long content.

**Evidence:** Browser layout measurements and screenshot inspection at 390px. Full breakpoint coverage remains outstanding.

### UX-007 · P2 · Request Preview describes a sample rather than the current operation

**Locations:** [app.component.ts](../src/app/app.component.ts), lines 118–128, 294–306; [api.ts](../src/api.ts), lines 60–83; [app.component.html](../src/app/app.component.html), lines 277–285.

**Reproduction:** Select acid blast or modify the spell draft. Java API Contract still shows the sample name `ember ward`, sample area `midgaard`, and unrelated fields. Its method remains POST even when the save path would use PUT for an existing document.

**Impact:** The preview undermines confidence in which record and payload will be saved and is actively misleading as a verification aid.

**Correction:** Generate preview and save from a shared operation builder using the same validated draft, method, endpoint, and effective proxy configuration. Show invalid/unapplied draft state instead of presenting stale data as current. Until connected, label it explicitly as an example or remove it from the authoring flow.

**Evidence:** Browser inspection and source trace.

### UX-008 · P2 · Search accepts queries but never searches

**Location:** [app.component.html](../src/app/app.component.html), lines 83–87.

**Reproduction:** With 97 spells loaded, enter `zz-no-matching-resource`. All 97 resource buttons remain; there are 98 list buttons including New document. The input has no binding or handler.

**Impact:** A prominent control promises resource, vnum, and script discovery but provides no result or feedback. This matters with a long, internally scrolling resource list.

**Correction:** Implement clearly scoped filtering or actual resource search, with result counts and no-results feedback. Give the input a persistent accessible label. If search is unfinished, remove or explicitly disable it with an explanation.

**Evidence:** Browser reproduction and template inspection.

### UX-009 · P2 · Save and validation feedback has no programmatic announcement

**Locations:** [app.component.html](../src/app/app.component.html), lines 72–79, 264–272; [resource-form.component.ts](../src/app/resource-form.component.ts), lines 12–50.

**Evidence:** The running document contains zero `aria-live`, `role="status"`, or `role="alert"` elements. Operation messages are plain text in `.area-message`, with no error-to-control association. Navigation and record selection use only visual active classes.

**Impact:** Users relying on assistive technology receive no explicit announcement channel for completed loads, saves, or validation failures and cannot programmatically identify the current resource section from its active styling.

**Correction:** Use a restrained polite status region for routine operation results, suitable alert/error treatment for validation failures, and associated field errors with `aria-describedby` and `aria-invalid`. Expose the current navigation context with appropriate semantics and manage focus when validation requires correction.

**Evidence:** Browser DOM/accessibility-tree inspection and source. No screen-reader session or full accessibility conformance audit was performed.

## Design recommendations

These are improvements rather than additional confirmed defects:

- Reduce duplicated overview/summary copy, endpoint labels, field-name chips, static coverage metrics, and the hardcoded Draft Queue in the core authoring flow. Prioritize resource selection, the editable document, save state, and validation.
- Use textareas for long descriptions, help text, and note bodies; the generic form currently widens these fields but still renders string values as single-line inputs. Use schema-aware controls for known enums and relationships where domain metadata supports them.
- Keep raw JSON and the API inspector available as advanced tools rather than equally prominent default tasks. Correct synchronization and preview semantics before changing presentation.
- Make the selected resource, area, dirty/saved state, and last operation easy to identify near the editor heading. Avoid treating a static Ready badge as evidence of connectivity or successful loading.
- Preserve the existing native controls and keyboard move buttons when addressing guard identity and layout.

## Verification and limits

- TypeScript check passed: `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit` (the operation used by the current lint script).
- Production Angular build passed: `node node_modules/@angular/cli/bin/ng.js build`, with no reported budget warnings.
- Browser review used a local Angular development server. The backend answered read requests; 97 spells were available. Only transient browser drafts were edited. No Save Document action, backend update, or deletion was performed.
- Verified draft loss, competing editor values, guard focus loss, complex-field cache leakage, search behavior, preview contents, accessible status markup, and 390px overflow.
- Initial sandbox networking prevented preview access; a local preview outside the sandbox enabled browser checks.
- No backend failure injection, delayed-response simulation, successful/failed persistence test, screen-reader session, exhaustive keyboard traversal, dark-theme review, or full responsive matrix was performed. No full UX or accessibility compliance claim is made.
- Application source files were not changed. This report is the review artifact.

## Suggested order

First stabilize draft ownership and invalid-input handling, then guard identity and asynchronous context handling. Repair the mobile grid next. Finally align the preview with saving and finish search and accessible feedback. These changes address reliability and discoverability before visual polish.
