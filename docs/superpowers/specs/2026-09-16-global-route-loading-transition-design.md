# Global Route Loading Transition Design

**Date:** 2026-09-16  
**Repository:** `qiqioberon/strativate`  
**Target branch:** `feat/global-route-loading-transition`  
**Design status:** Approved for specification; implementation has not started.

## 1. Purpose

Add a single, reusable Strativate-branded loading transition for App Router page navigation so slow route changes feel deliberate instead of appearing frozen, while preserving fast navigation when the next route is already available.

The loading UI must use the existing approved Strativate brand assets. It must not introduce a replacement logo, a new visual identity, or a forced minimum delay.

## 2. Current Repository Context

The application uses the Next.js App Router. The root `app/layout.tsx` owns global styling and wraps application content with `ToastProvider`. There is currently no root `loading.tsx` or `template.tsx`.

Approved brand assets are already centralized through `components/brand/brand-logo.tsx` and `lib/content/asset-registry.ts`. The registry exposes both:

- `brand.logo.primary` → horizontal Strativate wordmark
- `brand.logo.mark` → standalone Strativate mark

Protected surfaces such as `/admin`, `/dashboard`, and `/mentor/dashboard` execute server-side `requireAccount()` calls in their layouts. These are legitimate suspension points during navigation and are exactly the type of route work that should be covered by an App Router loading boundary.

The repository already contains a motion-accessibility precedent: marketing reveal effects become immediate when `prefers-reduced-motion: reduce` is enabled.

The existing UI also contains high stacking contexts, including UI at `z-index: 9999`, so the route-loading overlay must deliberately sit above all normal application surfaces.

## 3. Goals

1. Show clear feedback when an App Router route is genuinely pending.
2. Use the existing Strativate wordmark for the initial server-side loading state.
3. Use the compact Strativate mark for subsequent client-side/internal route loading states.
4. Cover public, auth, dashboard, mentor, admin, commerce, and other App Router pages without instrumenting every individual link.
5. Keep navigation completion tied to actual route readiness rather than arbitrary timeout values.
6. Preserve accessibility, reduced-motion behavior, responsive layout, and application interaction safety.
7. Add regression coverage for the route-loading contract.

## 4. Non-Goals

This change does not:

- add artificial delays so the animation can be seen;
- replace mutation-specific pending states, button spinners, checkout processing states, file-viewer loading states, or Midtrans UI;
- modify authentication, authorization, Supabase, commerce, mentoring, calendar, or other business rules;
- intercept external links;
- introduce a third-party progress/loading package;
- add page-transition animation that keeps the old page alive after the new page is ready;
- change the approved brand assets.

## 5. Approaches Considered

### A. Native App Router loading boundary — selected

Add a root `app/loading.tsx` backed by a reusable branded loading component.

**Advantages**

- lifecycle is controlled by Next.js route readiness;
- no need to modify every `Link` component;
- naturally covers server component and protected-layout suspension;
- automatically disappears when the route is ready;
- low coupling to business code;
- no fake progress percentage or guessed completion event.

**Trade-off**

A prefetched or immediately available route can complete without visibly showing the loader. This is intentional: the loader exists to communicate real waiting, not manufacture waiting.

### B. Global click/router interception — rejected as the primary mechanism

A client provider could listen to internal link clicks and attempt to show an overlay until `usePathname()` changes.

This is rejected because the repository contains both declarative links and programmatic navigation. A click interceptor would not reliably cover `router.push()`, `router.replace()`, redirects, browser history, or server-driven navigation without expanding into a fragile routing abstraction. It would also make completion detection approximate rather than framework-native.

### C. Fixed-duration branded splash — rejected

A splash could always display for a minimum duration on startup or navigation.

This is rejected because it would make already-fast routes slower, hide real performance characteristics, and create a timer-driven state unrelated to actual route readiness.

## 6. Chosen Architecture

The feature consists of four focused pieces.

### 6.1 `app/loading.tsx`

The root App Router loading boundary renders the branded route-loading component.

This is the source of truth for **visibility**. No client click handler is responsible for deciding when loading starts or ends.

### 6.2 `components/navigation/branded-route-loading.tsx`

A reusable presentational component renders a fixed, viewport-sized loading surface.

It renders both approved visual forms so CSS can select the appropriate presentation:

- horizontal wordmark for the initial pre-hydration loading mode;
- standalone mark for post-hydration/internal route loading mode.

The component must not fetch data or know about application business domains.

### 6.3 `components/navigation/route-loading-mode.tsx`

A tiny client-only marker is rendered once from the root layout. After the root application hydrates, it sets a stable data attribute on `<html>`, for example:

`data-strativate-client-ready="true"`

This marker does **not** show or hide the loader. It only allows the branded loading component to distinguish the pre-hydration boot state from subsequent client navigation.

Behavior is deterministic:

- before root hydration, the loading boundary presents the horizontal wordmark;
- after hydration, any later route-loading boundary presents the standalone mark.

If unusually slow initial server work outlives root hydration, the loading presentation may naturally move from the boot wordmark treatment to the compact mark treatment. This is acceptable because both communicate the same pending route and avoids adding timing state.

### 6.4 Dedicated styling

Use a focused CSS module next to the loading component rather than adding another broad global stylesheet.

The overlay must use existing design tokens from `globals.css`, primarily:

- `var(--background)` for the main surface;
- `var(--foreground)` where neutral contrast is needed;
- `var(--primary)` for restrained Strativate orange motion/accent.

The loader should use `position: fixed`, `inset: 0`, and a stacking level above the repository's existing `9999` layer. The proposed loader layer is `z-index: 12000`.

## 7. Visual Behavior

### Initial loading state

The visual center uses the approved horizontal Strativate wordmark. The surrounding treatment should remain minimal: clean background, subtle brand-colored ambient accent, and one restrained motion cue.

The screen should read as a deliberate brand entrance rather than a generic spinner.

### Internal route loading state

The compact standalone Strativate mark is centered in the same loading surface. Motion may use a subtle scale/breath or surrounding ring treatment, but the mark itself must remain visually recognizable and must not rotate like a generic spinner.

### Duration

There is no minimum display duration.

If a route is already available, the loading boundary may not visibly appear. If a route takes longer, it remains visible until Next.js resolves that route segment.

### Responsive behavior

Logo sizes should use `clamp()` or equivalent responsive constraints so the wordmark and mark remain balanced on mobile and desktop.

The loading surface must cover dynamic viewport height and must not depend on the dimensions of the current page.

## 8. Accessibility

The loading component should provide a live status message such as `Memuat halaman` for assistive technology.

Requirements:

- use an appropriate status semantic, such as `role="status"`;
- expose concise hidden text describing the pending page load;
- avoid announcing repeated decorative logo content;
- keep the overlay non-interactive except that it blocks interaction with stale page content underneath;
- support `prefers-reduced-motion: reduce` by disabling looping motion and showing a static branded state;
- do not use rapid flashing, large rotational animation, or motion that can create vestibular discomfort.

The visual logo can be treated as decorative inside the status component when the accessible loading label already identifies the state.

## 9. Interaction and Navigation Semantics

The feature does not take ownership of routing.

`Link`, `router.push()`, redirects, back/forward navigation, and server-side redirects continue to use existing application behavior. The App Router decides whether the loading boundary is needed.

This is important for the current repository because navigation is not exclusively link-based; several components use `useRouter()` and programmatic navigation.

External destinations remain normal browser navigation and are outside this transition subsystem.

## 10. Error Behavior

The loader is not an error screen.

If a route fails, the existing App Router error boundary remains responsible for rendering the error UI. Because visibility is tied to the Suspense/loading boundary rather than a custom global boolean, the loader cannot become permanently stuck because a client-side `finally` callback failed to run.

The implementation must not catch or suppress route errors merely to preserve the loading animation.

## 11. Performance Constraints

The implementation should remain lightweight:

- reuse existing PNG brand assets through `BrandLogo`;
- no extra animation dependency;
- CSS-based animation only;
- no polling;
- no interval;
- no route-progress calculation;
- no minimum timeout;
- no additional API request.

The root hydration marker performs one DOM attribute update and has no recurring work.

## 12. Proposed File Changes

Expected implementation files:

- **add** `app/loading.tsx`
- **modify** `app/layout.tsx`
- **add** `components/navigation/branded-route-loading.tsx`
- **add** `components/navigation/branded-route-loading.module.css`
- **add** `components/navigation/route-loading-mode.tsx`
- **add** `tests/route-loading-ui.test.ts`
- **add or update** a Playwright browser spec for a delayed internal App Router navigation

No database migrations are required.

## 13. Testing Strategy

### 13.1 Static/contract test

Add a fast Node test that verifies the feature's architectural contract, including:

- root `app/loading.tsx` exists and uses the reusable branded loader;
- the loader reuses `BrandLogo` rather than a newly hard-coded asset path;
- both approved `wordmark` and `mark` modes are represented;
- root layout mounts the client-ready mode marker;
- reduced-motion styling is present;
- the loader uses a stacking level above `9999`;
- implementation does not introduce a forced minimum loading timeout.

This protects the intended architecture against later simplification into ad-hoc route interception.

### 13.2 Browser regression test

Use Playwright to verify a deliberately delayed **internal** navigation. The preferred method is to delay the relevant App Router/RSC request in the test runner rather than add a production-only slow route.

The test should assert:

1. current page is interactive before navigation;
2. internal navigation begins;
3. branded loading overlay becomes visible while the route response is delayed;
4. post-hydration loading uses the compact mark presentation;
5. stale page interaction is covered while pending;
6. overlay disappears after the target route resolves;
7. target page becomes interactive;
8. reduced-motion emulation removes looping loader animation.

If delaying a real application RSC request proves nondeterministic because of prefetch behavior, the fallback is to add the slow-navigation test only to the existing browser test fixture, not to expose a synthetic slow route in the production application.

### 13.3 Regression suite

After implementation, run at minimum:

- the new route-loading contract test;
- the new browser loading test;
- existing public marketing/browser navigation tests;
- dashboard shared navigation tests;
- auth/public navigation tests;
- lint/type/build checks already used by the repository.

## 14. Acceptance Criteria

The feature is complete when all of the following are true:

1. A genuinely pending App Router navigation shows a full-viewport Strativate loading state.
2. Initial pre-hydration pending state uses the approved horizontal wordmark.
3. Post-hydration/internal pending state uses the approved standalone mark.
4. Fast routes are not delayed merely to show the transition.
5. The overlay disappears according to App Router readiness, not a custom timer.
6. The loader covers existing high-z-index application UI safely.
7. Reduced-motion users receive a static equivalent.
8. The feature works without changes to each individual navigation link.
9. Business logic, auth rules, and database behavior remain unchanged.
10. Automated contract and browser regression coverage passes.

## 15. Implementation Boundary

This specification deliberately keeps page loading separate from action loading. If a user submits a form, starts a payment, uploads content, synchronizes a calendar, or triggers another long-running action while staying on the same route, that operation should continue using its domain-specific pending UI.

The global route loader is exclusively for route-level waiting managed by Next.js App Router.