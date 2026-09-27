# Homepage Recognition Logo Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split homepage competition recognition into a warm statement band and a white, autonomous logo-motion band that adapts to record count.

**Architecture:** Keep the existing server-side recognition query and view model. Compose deterministic rows and duplicated visual groups in the server component, then use responsive CSS transforms for motion and a static reduced-motion fallback.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, CSS, Node test runner, Playwright

**Spec:** `docs/superpowers/specs/2026-09-27-homepage-recognition-logo-motion-design.md`

## Global Constraints

- Preserve the exact recognition statement and existing admin-managed data order.
- One logo is static; two or more move autonomously with no user controls or pointer interaction.
- Use no fake production records, new runtime dependencies, database changes, or unrelated homepage changes.
- Preserve reduced-motion support and avoid visible empty edges or loop resets through 1920 pixels.
- Target `main`, push no more than twice, open a PR, and do not merge it.

## Review Focus

- Zero records must omit the logo band while retaining the statement.
- One record must be announced once, remain centered, and not animate.
- Two records must still fill the viewport continuously without an empty initial edge.
- Eight or more records must split predictably and move in opposite directions.
- Reduced motion must expose each real logo once without animation or manual scrolling.

---

### Task 1: Recognition structure and count behavior

**Files:**
- Modify: `components/marketing/competition-recognition-section.tsx`
- Modify: `tests/homepage-competition-recognition.test.ts`

**Interfaces:**
- Consumes: `CompetitionRecognitionView[]` in admin order.
- Produces: statement band plus optional static, one-row, or two-row logo band markup with hidden visual duplicate groups.

- [x] Add failing contract tests for zero, one, 2–7, and 8+ record structure; exact alt text; deterministic alternating two-row distribution; hidden duplicate groups; and no controls or links.
- [x] Run the focused unit test and confirm the new assertions fail.
- [x] Implement the minimal server-rendered row/group composition.
- [x] Run the focused unit test and confirm it passes.

### Task 2: Responsive motion and reduced-motion styling

**Files:**
- Modify: `app/marketing.css`
- Modify: `tests/homepage-competition-recognition.test.ts`

**Interfaces:**
- Consumes: the recognition classes and state modifiers from Task 1.
- Produces: warm statement band, white logo band, responsive optical slots, continuous opposite-direction transforms, pointer pass-through, and static reduced-motion wrapping.

- [x] Add failing CSS contract tests for solid palette-derived backgrounds, transform-only keyframes, direction modifiers, pointer pass-through, and reduced-motion behavior.
- [x] Run the focused unit test and confirm the new assertions fail.
- [x] Implement responsive CSS without hover, controls, cards, shadows, or gradients.
- [x] Run the focused unit test and confirm it passes.

### Task 3: Browser validation and visual tuning

**Files:**
- Modify: `tests/browser/homepage-recognition.spec.ts`
- Modify if validation requires tuning: `components/marketing/competition-recognition-section.tsx`
- Modify if validation requires tuning: `app/marketing.css`

**Interfaces:**
- Consumes: completed recognition markup and styles.
- Produces: regression coverage at 390, 430, 768, 1440, and 1920 pixels.

- [x] Add browser fixtures for zero, one, low, and high logo counts without production seeding.
- [x] Assert section backgrounds, no viewport overflow, filled initial edges, centered composition, cycle geometry, motion direction, opposite two-row transforms, accessible source logos, aspect ratios, and reduced-motion static layout.
- [x] Run focused Playwright tests, tune the threshold or visual values only if required, and rerun until passing.

### Task 4: Full verification and delivery

**Files:**
- Review: all files changed from `a8d2d0f132172d478cfe85307ca77ead2515638d`

**Interfaces:**
- Consumes: the complete implementation and test suite.
- Produces: one reviewed commit/push and an open unmerged PR targeting `main`.

- [x] Run unit tests, typecheck, lint, build, focused browser tests, and `git diff --check`.
- [x] Review the complete diff for scope, accessibility, data integrity, and generated/untracked files.
- [ ] Commit the focused change, push once, open the PR against `main`, inspect checks, and do not merge.
