---
name: angular-code-reviewer
description: Review Angular and TypeScript code or changes for correctness, Angular compatibility, architecture, accessibility, and maintainability, and write a Markdown findings report. Use for requested Angular code reviews; review alone does not authorize implementation changes.
---

# Angular Code Reviewer

Review the requested Angular code and produce a saved Markdown report with actionable, evidence-backed findings. Preserve the requested scope; do not fix application code, migrate APIs, add dependencies, or reformat files as part of a review unless separately requested.

## Establish scope and context

Read repository instructions, package and lockfile versions, Angular and TypeScript configuration, relevant scripts, and nearby conventions. Determine the requested files, working-tree changes, commit range, or PR diff. Use the user's comparison base when supplied; do not invent a branch or revision.

If a change review has no stated base, inspect staged, unstaged, and relevant untracked source files without discarding any changes. State that scope in the report. For a general review without a target, begin with the application entry points and core user flows, and state coverage rather than claiming an exhaustive audit. Ask for clarification only if materially different interpretations would change the review.

Read affected code in context, including templates, styles, callers, services, domain types, and relevant tests. For change reviews, separate defects introduced or exposed by the change from unrelated pre-existing issues. Do not flag deleted code as a current defect unless its removal causes a demonstrated regression.

In this repository, verify these landmarks still apply:

- `src/app/`: standalone components, application template, shared resource editors, and API services.
- `src/domain/` and `src/types/`: game resource models, transformations, and validation.
- `src/api.ts`, `src/environments/`, and `proxy.conf.json`: runtime settings, environments, and development proxy behavior.
- `src/styles.css`: shared layout, theme, and interaction styling.

When uncertain about framework behavior, check installed package declarations or official Angular documentation for the installed version. If the sibling `angular-developer` skill is present, consult only the references relevant to the question; this reviewer remains usable without it. Distinguish existing application conventions from requirements, and avoid recommending newer APIs that the installed version does not support.

## Review relevant behavior

Use these lenses where the code warrants them, not as a requirement to find a problem in every category:

- **Angular integration:** standalone imports, template bindings, lifecycle timing, dependency injection scope, router behavior, and browser-only APIs under the application's actual rendering mode.
- **State and reactivity:** signal/computed/effect dependencies, duplicated or circular state, observable cancellation and cleanup, stale asynchronous responses, error recovery, and immutable updates where change detection or reference identity requires them. Do not assume every subscription needs manual cleanup or every mutable value is a defect.
- **Templates and forms:** stable list identity, control names and value types, validation, draft versus persisted objects, disabled controls, parsing failures, submit behavior, and input preservation after errors. Trace actual data flow rather than assuming a form strategy is inherently wrong.
- **API and domain contracts:** request payloads, response normalization, nullability, identifiers and relationships, duplicate writes, resource selection races, and consistency with existing domain validation. Do not infer server guarantees or game rules without evidence.
- **User-facing correctness and accessibility:** loading, empty and error states, keyboard operation, labels, focus behavior, semantic controls, status announcements, and observable layout or theme regressions. Distinguish markup-supported findings from issues requiring browser verification.
- **Security:** untrusted HTML or URL handling, sanitization bypasses, browser-exposed secrets, and unsafe use of storage. Client-side guards do not establish backend authorization; report an authorization defect only with evidence about the affected boundary.
- **Architecture and maintainability:** responsibility placement across components, services, and domain logic; coupling, hidden side effects, duplicated rules, and contracts that demonstrably complicate a current workflow. Suggest patterns only when they simplify a concrete problem. Do not prescribe wholesale state or forms migrations as review findings.
- **Performance and tests:** repeated expensive template work, unnecessary network traffic, unstable rendering identity, credible large-data behavior, and missing coverage for demonstrated regressions. Explain the relevant workload; do not label speculative micro-optimizations as defects.

## Validate findings

For each candidate issue, identify the trigger, execution path, observed or supported consequence, and smallest useful correction. Check callers and existing safeguards before retaining it. Prefer a focused reproduction or existing test when available; a reasoned trace is acceptable when labeled as static analysis.

Use appropriate existing checks when useful and permitted. Inspect scripts first: in this repository, `npm run lint` currently performs TypeScript checking, while `npm run build` also checks Angular templates and build budgets. A passing type check is not evidence that runtime behavior, visual layout, or accessibility passed.

Do not install tools, change tests, modify fixtures, or mutate live game resources merely to prove a finding without authorization. Record unavailable checks and unrelated baseline failures accurately. Do not claim tests ran when they were only inspected.

Keep distinct root causes separate and merge duplicate symptoms of the same cause. Exclude findings that depend on unsupported assumptions. Put unresolved questions in a separate section and say what evidence would resolve them.

Assign priority by demonstrated impact:

- **P0 — Critical:** immediate, broadly applicable failure such as severe data loss or a confirmed exploitable security defect; use sparingly and only with supporting evidence.
- **P1 — High:** a major workflow fails, data is corrupted, or a serious defect affects a supported scenario.
- **P2 — Medium:** a bounded correctness, accessibility, or reliability defect with a clear trigger and consequence.
- **P3 — Low:** a minor defect with limited impact.

Keep optional design and maintainability recommendations separate from confirmed defects; do not inflate their priority to manufacture findings.

## Write the Markdown report

Always save a UTF-8 `.md` report. Use the user's requested path. Otherwise use the existing review-report convention; if none exists, write `reports/angular-code-review-YYYY-MM-DD.md` under the repository using the user's local date. Create the directory if needed. If that name exists, append a numeric suffix rather than overwriting an earlier report unless the user asked to update it. Writing the report is part of the review; it does not authorize application changes.

Use this structure, omitting empty optional sections:

1. **Title and scope:** date, reviewed files or paths, comparison base and target when applicable, and any coverage limits.
2. **Summary:** concise assessment and counts of confirmed findings by priority. Avoid an unconditional approval when important checks or context are missing.
3. **Findings:** ordered by priority, each with a stable ID such as `ANG-001`, a concise title, priority, category, verified file and line location, evidence or reproduction, practical impact, and a specific suggested correction. Keep locations narrow and line numbers tied to the reviewed snapshot. Use relative Markdown file links from the report so they remain usable when the repository moves.
4. **Design and maintainability recommendations:** optional improvements with concrete rationale, separate from behavioral defects.
5. **Validation:** checks actually run and results, including failures and blockers; distinguish static analysis, automated checks, and manual browser verification.
6. **Open questions and limitations:** unresolved assumptions, missing dependencies or services, and relevant flows not exercised.

Include short code excerpts only when they clarify the evidence; do not dump large source blocks. If no confirmed issues are found, say so explicitly, preserve validation and coverage limits, and do not invent findings to fill the report.

Return a clickable link to the saved report and a brief account of the main findings or absence of findings. Do not present the review as an implementation change.
