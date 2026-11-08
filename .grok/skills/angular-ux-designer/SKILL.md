---
name: angular-ux-designer
description: Design, review, and implement Angular user experiences, including editor workflows, forms, navigation, responsive layouts, and accessible interaction states. Use for Angular UI/UX requests; exclude backend-only work and framework migrations unless explicitly requested.
---

# Angular UX Designer

Turn the user's task into a coherent Angular experience that fits the existing product. Match the requested mode: recommendations for design requests, findings for reviews, and working changes for implementation requests. A review alone does not authorize implementation.

## Establish context

Inspect repository instructions, installed Angular version, configuration, affected components and templates, shared styles, and data contracts. Check official Angular documentation when an API or version-specific behavior is uncertain; do not assume the newest syntax is supported.

Identify the user's main task, entry point, primary action, and completion or recovery path. Use supplied screenshots and design references. Reuse the product's visual language unless a redesign is requested. Make reasonable assumptions and state those that affect the result; clarify only when missing information changes scope or workflow.

In this repository, begin with these landmarks and verify they still apply:

- `src/app/`: standalone components, application template, shared resource forms, and API services.
- `src/styles.css`: shared styles and theme behavior.
- `src/domain/` and `src/types/`: resource definitions, validation, and typed view models.
- `src/api.ts` and `src/environments/`: browser settings and API configuration.
- `angular.json`: component defaults, stylesheet conventions, and build budgets.

Springs of Mud Designer serves builders editing interconnected game resources. Preserve domain terms, resource identity, area context, and relationships. Backend database credentials belong outside browser UI and storage.

## Design the workflow

Organize around the user's task rather than the API object shape. Group related fields, distinguish required information, and expose advanced details progressively. Keep a clear primary action and concise labels that explain consequences. Show identifiers alongside recognizable names when users must distinguish similar resources.

For editors, account for selection, creation, editing, validation, saving, and return to context. Make unsaved changes visible and prevent accidental loss when switching resources or leaving an edited view. Preserve input after failed saves. Use confirmation or undo proportional to the actual destructive action. Do not invent persistence behavior or game rules to support a visual design.

Design relevant loading, empty, no-results, populated, invalid, saving, success, and failure states. Distinguish failed requests from empty results. Keep feedback near the affected action, prevent duplicate submissions while pending, and provide recovery. A late request response must not overwrite the currently selected resource or its draft.

Keep display text, parsed values, and persisted data distinct in complex forms. Preserve invalid JSON or numeric input for correction rather than silently replacing it with defaults. Prefer structured controls for common tasks while retaining raw editing when needed. Explain which field failed and how to fix it.

## Shape the interface

Reuse existing spacing, typography, colors, borders, and components. Introduce shared CSS variables where repetition justifies them. Establish hierarchy and grouping before decoration. Preserve useful information density in working editors rather than hiding context behind oversized cards.

Adapt navigation, forms, and toolbars to narrow viewports and zoom. Let long names and errors wrap. Constrain wide tables or code editors locally instead of overflowing the page. Preserve essential actions when panels stack; ensure sticky elements do not obscure focused controls. Support existing themes and reduced-motion preferences.

Use native semantic controls first. Associate labels, help, and errors with inputs; placeholders are not labels. Name icon-only actions. Maintain logical headings, focus order, visible focus, keyboard operation, and meaning independent of color. Announce asynchronous status without making every update intrusive. For dialogs, handle initial focus, dismissal, and focus return using existing accessible primitives when available. Do not claim accessibility compliance from code inspection alone.

## Implement in Angular

Follow the installed version and nearby conventions for standalone components, template control flow, dependency injection, inputs/outputs, and forms. Do not migrate forms, state management, routing, or the framework for a focused UX change. Add a UI library only when warranted by the task and existing capabilities.

Keep presentation components focused on rendering and interaction through explicit data and event boundaries. Place transport and persistence in services and domain rules in the existing domain layer. Reuse validation instead of creating conflicting rules. Keep drafts separate from persisted or selected objects so cancel and failed saves work predictably.

Use a consistent state model for the affected feature. Where signals or observables are used, derive presentation state rather than duplicating it, and clean up subscriptions with supported lifecycle mechanisms. Check OnPush compatibility when updating input objects. Avoid expensive repeated template computations; use stable identity for editable lists so focus and control state survive updates.

Do not bypass Angular sanitization to obtain a visual effect. Keep browser-only APIs compatible with the application's rendering and testing environment.

## Verify and deliver

For implementation, run relevant repository checks. Here, `npm run lint` performs TypeScript checking and `npm run build` checks Angular compilation and build budgets; inspect scripts before relying on these meanings. Add focused behavior tests when interaction logic or regressions warrant them, using existing tooling rather than installing a test stack for styling alone.

When browser access is available, exercise the changed flow with realistic long content, keyboard navigation, narrow and wide layouts, applicable themes, and relevant error states. Inspect actual rendering as well as compilation. Use local fixtures or mocks for failure paths when available; do not save or delete live game data merely to demonstrate UI behavior. State unavailable visual verification explicitly.

For design-only requests, provide the flow, hierarchy, key states, and Angular component implications at the detail needed. For reviews, prioritize actionable findings with locations, user impact, and corrections. For implemented work, explain resulting behavior, verification, and remaining limitations. Keep deliverables within the requested scope.
