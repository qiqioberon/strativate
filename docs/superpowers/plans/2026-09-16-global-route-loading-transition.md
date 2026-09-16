# Global Route Loading Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a truthful, accessible Strativate-branded full-screen loading boundary for genuinely pending Next.js App Router navigation.

**Architecture:** Use root `app/loading.tsx` as the sole visibility source. A reusable branded loader renders both approved logo forms, while a tiny client hydration marker sets `data-strativate-client-ready="true"` on `<html>` so CSS shows the wordmark before hydration and the standalone mark for later internal route loading. No click interception or forced duration is introduced.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-16-global-route-loading-transition-design.md`

## Global Constraints

- Reuse `components/brand/brand-logo.tsx`; do not hard-code a replacement logo asset.
- Initial pre-hydration pending state uses the approved horizontal wordmark.
- Post-hydration/internal pending state uses the approved standalone mark.
- Visibility follows App Router readiness; no artificial minimum delay, timeout, polling, or progress calculation.
- Route loading remains separate from mutation/action-specific pending UI.
- Reduced-motion users receive a static equivalent.
- Loader stacking must sit above existing `z-index: 9999` surfaces; use `z-index: 12000`.
- Preserve existing auth, commerce, mentoring, calendar, and database behavior.
- Batch implementation changes into one coherent feature commit after verification, per repository workflow preference.

---

### Task 1: Lock the route-loading contract with a source-level test

**Files:**
- Create: `tests/route-loading-ui.test.ts`

**Interfaces:**
- Consumes: repository source files only through `node:fs`.
- Produces: contract assertions for `app/loading.tsx`, `components/navigation/branded-route-loading.tsx`, `components/navigation/branded-route-loading.module.css`, `components/navigation/route-loading-mode.tsx`, and `app/layout.tsx`.

- [ ] **Step 1: Write the failing test**

Create a Node test that reads the planned source files and asserts all architectural requirements: root loading boundary, `BrandLogo` wordmark + mark usage, hydration marker, `role="status"`, fixed full-screen overlay, `z-index: 12000`, reduced-motion CSS, and absence of `setTimeout`, `setInterval`, or route click interception.

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

test('root App Router loading boundary owns branded route loading', () => {
  const loading = read('app/loading.tsx')
  const loader = read('components/navigation/branded-route-loading.tsx')
  assert.match(loading, /BrandedRouteLoading/)
  assert.match(loader, /BrandLogo/)
  assert.match(loader, /variant="wordmark"/)
  assert.match(loader, /variant="mark"/)
  assert.match(loader, /role="status"/)
})
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm exec node --import tsx --test tests/route-loading-ui.test.ts`

Expected: FAIL because the loading implementation files do not exist yet.

- [ ] **Step 3: Keep production code untouched until the RED failure is confirmed**

No production file is created in this task.

### Task 2: Add the reusable branded loading boundary

**Files:**
- Create: `app/loading.tsx`
- Create: `components/navigation/branded-route-loading.tsx`
- Create: `components/navigation/branded-route-loading.module.css`
- Test: `tests/route-loading-ui.test.ts`

**Interfaces:**
- Consumes: `BrandLogo({ variant: 'wordmark' | 'mark', className?, priority? })`.
- Produces: `BrandedRouteLoading(): JSX.Element` and root `Loading(): JSX.Element`.

- [ ] **Step 1: Implement the minimal branded loader**

`app/loading.tsx` delegates directly to `BrandedRouteLoading`. The component renders one `role="status"` full-screen overlay, visually hides an Indonesian loading label, and renders both approved `BrandLogo` variants inside an `aria-hidden` visual wrapper. Add `data-testid="route-loading-overlay"` and per-variant test IDs for browser coverage.

- [ ] **Step 2: Add focused CSS Module styling**

Use `position: fixed`, `inset: 0`, `min-height: 100dvh`, `z-index: 12000`, existing CSS custom properties, responsive `clamp()` sizing, a subtle non-rotating breath/ring treatment, and selectors keyed by `html[data-strativate-client-ready="true"]`. The default is wordmark visible / mark hidden; post-hydration reverses that. Under `prefers-reduced-motion: reduce`, all looping animation is disabled.

- [ ] **Step 3: Run the contract test**

Run: `pnpm exec node --import tsx --test tests/route-loading-ui.test.ts`

Expected: hydration-marker assertion still FAILS; loader-specific assertions PASS.

### Task 3: Add the hydration-only presentation marker

**Files:**
- Create: `components/navigation/route-loading-mode.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/route-loading-ui.test.ts`

**Interfaces:**
- Produces: `RouteLoadingMode(): null`.
- Side effect: after root hydration, sets `data-strativate-client-ready="true"` on `<html>`; cleanup removes it.

- [ ] **Step 1: Implement the client marker**

Use `'use client'` and one `useEffect`. Do not import router APIs, intercept clicks, observe pathname, schedule timers, or store route state.

- [ ] **Step 2: Mount the marker once from root layout**

Import `RouteLoadingMode` in `app/layout.tsx` and render it as the first body child before `ToastProvider`, leaving metadata, fonts, analytics, and existing global stylesheet imports unchanged.

- [ ] **Step 3: Run the contract test to verify GREEN**

Run: `pnpm exec node --import tsx --test tests/route-loading-ui.test.ts`

Expected: PASS.

### Task 4: Add real internal-navigation browser regression coverage

**Files:**
- Create: `tests/browser/route-loading.spec.ts`

**Interfaces:**
- Consumes: public marketing navigation `Navigasi utama` with the existing `Program` link to `/program`.
- Consumes: `data-testid="route-loading-overlay"`, `data-testid="route-loading-wordmark"`, and `data-testid="route-loading-mark"` from Task 2.

- [ ] **Step 1: Write the browser test**

Navigate to `/`, pause the first `/program` request carrying the Next.js `rsc: 1` request header, click the existing Program navigation link, assert the overlay + compact mark are visible while the response is held, release it, and verify the destination becomes interactive and the overlay disappears.

- [ ] **Step 2: Add reduced-motion browser coverage**

Emulate `reducedMotion: 'reduce'`, hold the same RSC request, click Program, and assert the loading mark has `animation-name: none` while the overlay remains functional.

- [ ] **Step 3: Run the focused browser spec**

Run: `pnpm exec playwright test tests/browser/route-loading.spec.ts --project=chromium`

Expected: PASS against a built local app server.

### Task 5: Full verification and one bulk feature commit

**Files:**
- Include all files from Tasks 1–4 plus this plan document.

- [ ] **Step 1: Run focused unit contract**

Run: `pnpm exec node --import tsx --test tests/route-loading-ui.test.ts`

Expected: PASS.

- [ ] **Step 2: Run focused browser test**

Run: `pnpm exec playwright test tests/browser/route-loading.spec.ts --project=chromium`

Expected: PASS.

- [ ] **Step 3: Run repository checks**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 4: Review diff for scope**

Confirm only the plan, route-loading test/spec, root loading boundary, route-loading components/styles, and root layout are changed. Confirm no migrations, auth code, business logic, dependencies, or lockfiles changed.

- [ ] **Step 5: Commit once as a coherent feature batch**

```bash
git add docs/superpowers/plans/2026-09-16-global-route-loading-transition.md \
  app/loading.tsx app/layout.tsx \
  components/navigation/branded-route-loading.tsx \
  components/navigation/branded-route-loading.module.css \
  components/navigation/route-loading-mode.tsx \
  tests/route-loading-ui.test.ts tests/browser/route-loading.spec.ts
git commit -m "feat: add branded route loading transition"
```
