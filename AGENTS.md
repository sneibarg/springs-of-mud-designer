# Repository Guidelines

## Project Direction

This repository is the Angular frontend for Springs of MUD content design. Game designers should define and tune ordinary game content here through data, without requiring backend source edits. Prefer editors for reusable runtime capabilities and data contracts over hard-coded gameplay behavior in the frontend.

The Java persistence API in `som-server-modulith` stores content; the Python `springs-of-mud-server` consumes it at runtime. Keep these responsibilities distinct. Verify relevant backend contracts before changing endpoints, field names, value types, or game semantics. Do not infer server guarantees from TypeScript interfaces or UI resource status labels.

## Architecture Map

- `src/main.ts` bootstraps the standalone Angular application with Zone.js, event coalescing, and `HttpClient`.
- `src/app/app.component.ts` and `.html` own navigation, resource selection, area filtering, drafts, settings, and load/save workflows. Navigation currently uses component state rather than router configuration.
- `src/app/api.service.ts` owns HTTP requests, list-response checks, health checks, and POST/PUT persistence through `SomApiService`.
- `src/app/resource-form.component.ts` provides shared scalar and JSON field editing. `src/app/guard-list.component.ts` edits ordered guard definitions.
- `src/api.ts` owns API URL construction and browser-persisted designer settings.
- `src/data.ts` describes API resources, endpoints, field lists, status labels, and sample planning data. Sample work queues and request previews are not persisted content.
- `src/types/common.ts`, `src/types/views/`, and `src/types/icons.ts` define shared types, service view models, and icons. `src/domain/types.ts` re-exports the model surface.
- `src/domain/constants.ts` defines navigation, draft defaults, and preferred field lists; `src/domain/logic.ts` contains normalization, validation, sorting, parsing, and display helpers.
- `src/environments/`, `proxy.conf.json`, and `angular.json` configure build environments and development routing. `src/styles.css` supplies shared styles and themes.
- `resources/mysql/` contains database setup scripts, not browser runtime configuration. Do not execute them as part of frontend verification.

## Coding Standards

Use the repository's [angular-developer skill](.codex/skills/angular-developer/SKILL.md), cloned from the Angular GitHub repository, as the primary reference for Angular and TypeScript coding standards. Read its `SKILL.md` and the references relevant to the task before implementing or reviewing Angular code. Tools without native skill discovery should read these Markdown files directly.

Apply the skill's guidance for component design, naming, reactivity, forms, dependency injection, HTTP communication, templates, styling, accessibility, and testing. Check the installed Angular version before adopting an API or recommendation; the skill also covers versions newer than this application. Use the existing repository build commands to validate generated code.

### Repository Conventions and Compatibility

The project currently targets Angular 21 and TypeScript 5.9, with strict TypeScript and Angular template checking. Check `package.json`, `package-lock.json`, and installed declarations when version-specific behavior matters.

- Use standalone Angular components and explicit template imports. Keep HTTP behavior in the API service and reusable content transformations in domain helpers.
- Preserve strict typing. Narrow external values at boundaries; a type assertion does not validate an API response or parsed JSON document.
- The current components use template-driven forms, decorator inputs/outputs, and ordinary component properties. Follow nearby conventions for focused changes. Angular CLI component defaults specify standalone components, CSS, and OnPush; existing components do not explicitly set OnPush. Assess state updates and asynchronous rendering when introducing it.
- Do not introduce a wholesale signals, forms, routing, or change-detection migration as an incidental cleanup.
- Keep domain view types, draft defaults, resource metadata, validation, and editor behavior consistent when adding or changing resource fields.
- Preserve the established formatting and naming in edited files. Avoid unrelated rewrites.

## Content and Editor Contracts

- Treat identifiers, vnums, area relationships, flags, enums, guard definitions, payloads, lambdas, and action plans as contract data. Preserve their names, types, ordering, and optionality according to the actual persistence and runtime consumers.
- Skills, spells, and commands support data-driven behavior in the Python runtime. The designer should author those definitions, not execute their Python lambda strings in the browser or replace them with frontend game rules.
- Keep guard ordering and unknown supported fields intact. For structured values, preserve arrays, objects, booleans, numbers, nulls, and strings through editing and saving.
- Keep persisted records separate from editable drafts. A failed load, parse, validation, or save must not silently discard edits or submit an older value while presenting newer text.
- Keep raw JSON and structured editors synchronized deliberately. Surface invalid field JSON, prevent saving inconsistent drafts, and reset field-local editing buffers when switching documents.
- Capture the resource kind, area, server, and selected document associated with an asynchronous request. Prevent late responses from replacing a different workspace or applying the wrong normalization rules. Handle loading and saving state for overlapping requests deliberately.
- Keep area-filtered lists consistent after creation, updates, and area reassignment. Verify whether a resource is area-scoped or top-level before selecting its list endpoint.
- Preserve the create/update contract in `SomApiService`: new documents use POST to the collection endpoint; existing documents use PUT to the document endpoint. Verify backend support before extending persistence behavior.

## API Settings and Environment Behavior

Designer settings and theme preferences are stored in browser `localStorage` by `src/api.ts`, including legacy settings keys. Preserve compatibility when changing storage formats and handle malformed or unavailable storage gracefully.

Development builds replace `environment.ts` with `environment.development.ts`. Development currently forces same-origin `/api` requests through the Angular dev-server proxy, whose target is `http://dragon:9080`. Changing the in-app API URL does not reconfigure that static proxy target. Keep settings text, health messages, and request previews consistent with the route actually used.

Production defaults to `http://localhost:9080` with proxy routing disabled. Check both build configurations when changing URL resolution or settings. Browser bundles and localStorage are not places for database credentials or backend secrets; configure database access in the backend process.

## User Experience and Accessibility

- Provide clear loading, empty, validation, success, and failure states. Preserve user input on recoverable failures and prevent duplicate writes.
- Use semantic controls with associated labels, accessible names, and visible focus. Keep all editing and navigation operations usable with the keyboard.
- Preserve keyboard alternatives to drag-and-drop, including guard reordering buttons. Maintain logical focus when list entries are edited, reordered, or removed.
- Verify shared styling in both light and dark themes and at narrow viewport widths. Automated compilation does not verify layout or accessibility.

## Verification

Use the existing scripts from the repository root:

```powershell
npm run lint
npm run build
```

`npm run lint` currently runs TypeScript checking with `tsc`; it does not run ESLint. `npm run build` checks Angular templates and production build budgets in addition to compiling the application. There is currently no test script or configured Angular test target; do not claim a test suite passed based on these commands.

For environment-sensitive changes, also use `npm run build -- --configuration development`. For user-visible changes, exercise the relevant flow with `npm run dev`, using local or mock data where practical. Check resource selection, area changes, new/existing drafts, structured and raw JSON editing, error recovery, and settings as applicable. Use focused regression tests when a behavioral change warrants them; do not introduce a test framework solely for a documentation or cosmetic edit.

Report which checks actually ran and their results. Distinguish static analysis, compilation, browser verification, and live backend behavior. Do not mutate live game content just to validate a frontend change without authorization.

## Shared AI Skills and Change Discipline

Repository skills live under `.codex/skills`, with corresponding copies under `.claude/skills` and `.grok/skills`. Use the relevant Angular development, UX, or review skill for the task. When changing shared skill instructions, keep matching copies in sync.

Use [align-repository](.codex/skills/align-repository/SKILL.md) when aligning this designer with changes in `springs-of-mud-server`, `som-server-modulith`, or both. It traces runtime content and persistence API changes to the affected designer models, API integration, and editing workflows.

- Preserve existing working-tree changes, including staged changes and migration work. Inspect the current checkout rather than assuming historical React/Vite files still describe the application.
- Keep edits focused on the requested behavior. Do not modify generated `dist/`, `.angular/`, or installed `node_modules/` output as source changes.
- Keep frontend contracts compatible with designer-authored content and backend consumers. Coordinate schema changes explicitly rather than silently dropping fields or inventing runtime rules.
- Review requests alone do not authorize application fixes. Follow the user's requested deliverable and scope; do not create additional reports when the user requests a single artifact.
