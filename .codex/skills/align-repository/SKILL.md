---
name: align-repository
description: Align springs-of-mud-designer with changes in springs-of-mud-server or som-server-modulith by tracing content contracts and implementing affected Angular models, editors, validation, and API integration. Use for server-to-designer alignment requests, not general repository synchronization or ROM24 parity reviews.
---

# Align Repository

Align this designer with relevant changes in the Python runtime `springs-of-mud-server`, the Java persistence API `som-server-modulith`, or both. These are alignment reference targets; implementation remains in the designer unless the user explicitly requests backend changes. Preserve the product direction: ordinary game content should be designer-authored data backed by reusable runtime capabilities. Alignment means compatible authoring and persistence, not copying Python runtime behavior into Angular.

An alignment request authorizes focused implementation in this repository unless the user requests assessment only. Treat the server and persistence repositories as read-only references unless separately authorized to change them. Creating or editing this skill does not invoke alignment.

## Establish source and comparison scope

Select the reference target(s) from the user's request. If unspecified, inspect both repositories for relevant changes and state the resulting scope. Read this repository's `AGENTS.md`, each selected reference repository's `AGENTS.md` when present, and applicable nested instructions. Use supplied checkout paths first. Known local candidates are `C:/Users/scott/PycharmProjects/springs-of-mud-server` and `E:/IdeaProjects/som-server-modulith`; verify they contain source and Git metadata rather than only logs or resources. Do not assume these paths exist elsewhere or that repositories are siblings.

Inspect the designer and selected reference working trees without discarding changes. Use the user's commits, branch, or time range when supplied. Distinguish committed changes from staged, unstaged, and relevant untracked source; state which are included. Do not silently fetch, pull, switch branches, or reset any checkout.

Without an explicit base, look for an established alignment reference in project documentation or task context. If none exists, compare current reference contracts with the current designer and state that scope. Do not invent a recent-commit baseline or claim to identify all changes since an unknown last alignment. Ask for a path or revision only when missing evidence prevents meaningful progress.

Record each selected reference checkout, branch/HEAD, comparison base if known, and relevant local changes. Do not introduce a persistent alignment marker unless requested.

## Trace changes to designer impact

For Python runtime changes, start from changed models, deserializers, runtime consumers, tests, and content examples. For Java persistence changes, start from changed controllers, request/response DTOs, mappings, validation, persistence models, and API tests; trace endpoint paths, HTTP methods, response shapes, identifiers, defaults, and error behavior into frontend callers. Establish accepted serialized shapes, defaults, required fields, and semantics from code in context. Follow the Python server's collection-query skill before inspecting its collection snapshots; use targeted queries rather than dumping whole JSON collections.

Map each relevant change to its serialized contract, persistence support, affected designer paths, and required action. Classify changes as:

- **Designer change needed:** compatible authoring support is missing or incorrect.
- **Already supported:** existing editors preserve and save the data correctly through the complete workflow.
- **Backend-only:** runtime or persistence internals changed without an authoring or HTTP contract consequence; no frontend change is needed.
- **Persistence dependency or unresolved contract:** the actual API cannot yet preserve the expected data, or evidence is insufficient.

Keep this mapping in task notes or the final response unless a saved report is requested. Do not manufacture frontend edits for changes already supported.

The designer uses the Java persistence API in `som-server-modulith`, not Python gameplay classes directly. When Java is the selected target, its API contracts are the primary source for frontend integration. When Python is the selected target, confirm persistence support in relevant Java DTOs, controllers, mappings, or tests. Consult Python consumers for runtime semantics when Java content changes affect gameplay definitions; distinguish any backend-to-backend mismatch from work the frontend can resolve. Trace camelCase JSON to snake_case Python conversions rather than mechanically renaming fields. Collection examples alone do not prove an HTTP contract. If the persistence source is unavailable, identify what remains unverified instead of inventing endpoints or payloads.

For commands, skills, and spells, examine affected guards, payload/message keys, lambdas, handler IDs, class maps, targets, fight executors/plans, effects, and enum/flag representations. This is a search guide, not a fixed schema. Preserve ordered checks/actions, optional fields, unknown supported metadata, and identifiers according to current source evidence.

## Implement focused alignment

Follow the local [angular-developer skill](../angular-developer/SKILL.md) and its relevant references, using APIs supported by the installed Angular version.

Trace affected fields through the designer's current architecture:

- `src/types/views/` and `src/types/common.ts`: models and relevant exports.
- `src/data.ts`: resource metadata and endpoints.
- `src/domain/constants.ts` and `src/domain/logic.ts`: defaults, field lists, normalization, validation, and display helpers.
- `src/app/`: shared or dedicated editors, raw JSON editing, draft synchronization, selection, and save behavior.
- `src/app/api.service.ts` and `src/api.ts`: HTTP and URL behavior when contracts require changes.

Verify these landmarks still apply. Edit only what the alignment requires. Prefer structured controls when they materially help designers author a capability, retaining a lossless path for supported data. Adding a type or field label alone does not establish support.

Preserve round trips from API response to draft to edited payload to saved response, including nested values and unknown supported fields. Surface parsing errors and prevent silent saves of stale values. Do not execute Python lambda strings in the browser or replace runtime-provided enums with frontend constants.

Keep alignment focused: do not introduce incidental framework migrations, unrelated refactors, backend changes, deployment, or live data migrations. When persistence gaps block one capability, complete independent designer work and identify the exact remaining dependency.

## Validate and report

After Angular changes, run `npm run lint` and `npm run build`. Use focused behavioral checks or regression tests for changed serialization, validation, defaults, and editing. Exercise representative old and new documents to check compatibility and preservation, using fixtures or mocks rather than writing live game content. For UI changes, verify relevant keyboard and editing workflows when browser access is available.

Report each selected reference snapshot and comparison scope, implemented changes, relevant changes already supported or requiring no frontend work, checks actually performed, and unresolved dependencies. Cite source locations for non-obvious contract decisions. Do not claim full alignment while an identified required capability remains blocked or unverified. If no changes are needed, explain why with supporting paths and checks.
