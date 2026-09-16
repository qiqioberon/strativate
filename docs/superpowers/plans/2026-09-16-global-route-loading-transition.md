# Global Route Loading Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Strativate's hard-load brand entrance from its truthful App Router pending loader so opening the site and changing pages have visibly different motion systems.

**Architecture:** Mount a timed `InitialBrandIntro` once from the persistent root layout for document-entry branding. Keep root `app/loading.tsx` exclusively responsible for genuine route pending state, with a compact standalone mark hidden before hydration and enabled afterward by `RouteLoadingMode`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-16-global-route-loading-transition-design.md`

## Global Constraints

- Reuse `BrandLogo`; do not introduce replacement logo assets.
- Hard load/reload uses horizontal wordmark choreography and exits at 900 ms.
- Internal route loading uses only the standalone mark and follows real App Router readiness.
- Only the hard-load intro may own timing; the route loader must remain timeout-free.
- `prefers-reduced-motion: reduce` receives static/shortened behavior.
- Intro layer is `12010`; route loader layer remains `12000`.
- Do not alter auth, commerce, mentoring, calendar, database, routing APIs, dependencies, or migrations.
- Ship the revision as one coherent batch commit.

---

### Task 1: Reproduce and lock the visual-lifecycle bug

**Files:**
- Modify: `tests/route-loading-ui.test.ts`

- [x] Add source-contract assertions that `InitialBrandIntro` exists, uses `variant="wordmark"`, and is mounted from the root layout.
- [x] Assert `BrandedRouteLoading` still uses `variant="mark"` but no longer contains `variant="wordmark"`.
- [x] Assert route-loader CSS is hidden by default and becomes visible only after `data-strativate-client-ready="true"`.
- [x] Confirm the revised contract fails against the first implementation for the expected reasons.

### Task 2: Add a dedicated hard-load brand entrance

**Files:**
- Create: `components/navigation/initial-brand-intro.tsx`
- Create: `components/navigation/initial-brand-intro.module.css`
- Modify: `app/layout.tsx`

- [x] Server-render the intro visible from the persistent root layout.
- [x] Use the approved horizontal `BrandLogo` wordmark.
- [x] Use separate sweep, wordmark reveal, accent-line, and overlay-exit choreography.
- [x] Start exit at 650 ms and remove the overlay at 900 ms.
- [x] For reduced motion, render a static wordmark and remove it after 240 ms.
- [x] Place the intro above the route loader at `z-index: 12010`.

### Task 3: Make the App Router fallback internal-navigation-only

**Files:**
- Modify: `components/navigation/branded-route-loading.tsx`
- Modify: `components/navigation/branded-route-loading.module.css`
- Keep: `app/loading.tsx`
- Keep: `components/navigation/route-loading-mode.tsx`

- [x] Remove the horizontal wordmark from `BrandedRouteLoading`.
- [x] Keep only the compact mark + ring/breath treatment.
- [x] Hide the route overlay before client hydration.
- [x] Enable it only under `html[data-strativate-client-ready="true"]`.
- [x] Keep `role="status"`, `aria-live`, `aria-busy`, and `Memuat halaman`.
- [x] Keep internal route loading free of timers and click/router interception.

### Task 4: Update browser regression coverage

**Files:**
- Modify: `tests/browser/route-loading.spec.ts`

- [x] Add a hard-load test that freezes the clock, verifies the wordmark intro, advances to the leaving phase at 650 ms, and verifies removal at 900 ms.
- [x] Update internal navigation coverage so it waits for the intro to finish, then asserts only the compact mark during a delayed RSC request.
- [x] Retain reduced-motion coverage for the compact route loader.

### Task 5: Verification and batch commit

- [x] Run a mirrored source-contract RED/GREEN cycle against the fetched branch sources: revised contract fails before the fix and passes 4/4 after the fix.
- [ ] Run repository `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and focused Playwright when a dependency-complete checkout/CI environment is available.
- [ ] Review the Git diff to confirm no unrelated code, migration, dependency, auth, or business-logic changes.
- [ ] Commit the full revision once as a coherent batch.
