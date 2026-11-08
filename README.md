# Springs of Mud Designer

Angular front-end for designing Springs of Mud game features.

This repository is an Angular + TypeScript application aimed at the Java persistence API in `som-server-modulith` and the Python game server concepts in `springs-of-mud-server`.

## Feature Areas

- Skills and spells
- Skill and spell game settings
- Areas, rooms, mobiles, items, shops, resets, and specials
- Player communication through socials, commands, and help content

## Development

```bash
npm install
npm run dev
```

Angular defaults live in `src/environments`. Development builds use `src/environments/environment.development.ts`, which points to `http://dragon:9080` and forces API calls through the Angular dev-server proxy in `proxy.conf.json`. Production builds use `src/environments/environment.ts`.

Runtime overrides are stored in browser `localStorage` from the in-app Settings page. In development, stale browser settings cannot force direct cross-origin calls to `http://dragon:9080`; requests use same-origin `/api` and the dev-server proxy forwards them. Game data is read from `/api/v1/game`.

Database connection settings do not belong in the Angular app because Angular runs in the browser. Configure database host, database name, user, and password in the Java API/backend process instead.

Use the in-app Settings page to point the designer at another API server.

## Verification

```bash
npm run build
npm run lint
npm run test:editor
```

The editor regression checks use Node's built-in test runner with mocked transport
and minimal Angular decorator/event stubs. They cover draft protection, JSON
synchronization, guard identity, asynchronous responses, persistence previews, and
search. They are state-level tests; browser verification is still needed for layout,
focus, and accessibility behavior.

## JSON payload editor

Items, Mobiles, Rooms, Specials, and Game Data use `JsonPayloadEditorComponent` for their compact Form
and JSON editing modes.
The standalone component accepts a parsed JSON value (including scalar roots),
validates incoming data, and edits a private tree without mutating its input.

```html
<som-json-payload-editor
  [documentKey]="documentIdentity"
  [value]="draft"
  label="Item"
  [requireObject]="true"
  [readOnlyPaths]="['/id']"
  [rules]="itemRules"
  [readonly]="saving"
  (stateChange)="updateEditorState($event)"
/>
```

`stateChange` emits a `JsonEditorState`: valid states include the complete typed
value; invalid states include JSON Pointer paths and messages, with no savable
value. The parent must block persistence while invalid. Change `documentKey` when
opening/resetting a document, rather than on each edit. Feed emitted values back
as-is to preserve row identity and pending input. An unrelated incoming value
for the same dirty document requires an explicit Keep/Replace decision.

The Form mode supports nested objects, heterogeneous arrays, explicit type
changes, unique property names, keyboard reordering, and removal confirmation.
Scalar fields use compact label/value rows and multiple columns when space allows.
Nested collections start collapsed; their forms render on first expansion and remain
available afterward to preserve unfinished input when collapsed. Toggle
Field tools to show types, JSON paths, and add/rename/remove/reorder controls.
Invalid numeric/JSON text remains available for correction. Form/JSON switching
is blocked until it is valid. UI identities, expansion state, and input buffers
never enter the saved payload.

Optional `JsonEditorRules` specify types, nullable values, integer fields, and
array item and object property types by JSON Pointer. The Items adapter preserves the persistence
API's string fields, integer level/weight/cost fields, and string arrays for
`affectData` and `extraDescription`. It uses the existing area-scoped list and
POST/PUT save flow. Mobiles preserves string flags/dice definitions and the
structured `statusFlags` object. Rooms preserves boolean fields, integer timers
and flags, serialized string exits, and the string-valued `mobiles` map. Each
section protects its document ID and uses its own area-scoped list and collection.
Unknown properties are preserved by the editor; backend
acceptance and retention remain governed by the backend contract.

Each Room exit opens an embedded compact Form/JSON editor for its JSON object.
The adapter keeps the persistence format as a list of strings, preserves untouched
exit text exactly, and encodes edits back to strings. Newly inserted exits start
as `{}`. Malformed or non-object exit strings retain their original source for
explicit correction; saving is blocked until the entry is a valid JSON object.
Unrelated string fields are not interpreted as JSON.

Specials presents `specialFunction` as ordered Python lambda code rows with
multiline source editing and direct Add lambda, Move up/down, and Remove actions.
Source text and list order are preserved in the existing string-array payload.
The designer edits the source; execution belongs to the game runtime.

Game Data rulesets use collapsible sections for version metadata, enums, and tables.
The complete JSON document preview starts collapsed and scrolls within a bounded panel.
The current Game Data API supports reads only, so edits remain local and saving is
unavailable. Leaving a changed ruleset offers Stay or Discard.

`npm run test:editor` also covers JSON type round-trips, invalid buffers,
read-only paths, stable identities, external updates, and Items/Mobiles/Rooms/Specials persistence
integration with mocked transport.
