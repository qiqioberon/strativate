# Global Route Loading Transition Design

**Date:** 2026-09-16  
**Repository:** `qiqioberon/strativate`  
**Target branch:** `feat/global-route-loading-transition`  
**Design status:** Approved; revised after visual review of the first implementation.

## 1. Purpose

Provide two intentionally different Strativate loading experiences:

1. a short branded entrance when the document is first opened or hard-reloaded; and
2. a truthful compact loader only while a later Next.js App Router navigation is genuinely pending.

Both experiences reuse the approved brand assets. Internal route navigation must never be delayed merely to show branding.

## 2. Root Cause Behind the Revision

The first implementation rendered both the horizontal wordmark and standalone mark from the same `app/loading.tsx` fallback and switched them with `data-strativate-client-ready`. Once hydration finished, an initial pending fallback could switch into the same compact treatment used for internal navigation. The two experiences therefore shared one lifecycle and could look effectively identical.

The fix is architectural rather than cosmetic: hard-load branding and route-level pending feedback must have separate owners.

## 3. Final Architecture

### 3.1 `InitialBrandIntro`

`components/navigation/initial-brand-intro.tsx` is mounted once from the root layout. It server-renders visible, so the branded entrance is present on a hard document load before client effects run.

It uses the approved horizontal wordmark and has its own lifecycle:

- visible/entrance phase starts immediately;
- exit starts at 650 ms;
- the intro is removed at 900 ms;
- reduced-motion users receive a static wordmark and the intro is removed after 240 ms.

Because the root layout persists across App Router client navigation, this component does not replay when the user moves between pages. A full reload creates a new document and therefore replays the entrance.

### 3.2 Root `app/loading.tsx`

The root App Router loading boundary remains the source of truth for actual route pending state. It delegates to `BrandedRouteLoading` and owns no artificial minimum duration.

### 3.3 `BrandedRouteLoading`

The route loader renders only the approved standalone mark plus a restrained breath/ring treatment. It no longer contains the horizontal wordmark.

The overlay is hidden before hydration and becomes eligible to display only when `<html>` contains `data-strativate-client-ready="true"`. This prevents the App Router fallback from visually impersonating the hard-load brand entrance.

### 3.4 `RouteLoadingMode`

The existing hydration marker remains intentionally tiny. It sets `data-strativate-client-ready="true"` once after hydration and removes it on unmount. It does not intercept clicks, observe pathname, own timers, or control route completion.

### 3.5 Layering

- initial brand intro: `z-index: 12010`;
- internal route loader: `z-index: 12000`;
- existing application UI reaches `z-index: 9999`.

If initial page streaming continues after hydration, the compact route loader may exist underneath the intro. The intro remains visually dominant until its short entrance completes; if route work is still pending afterward, the truthful compact loader can remain until Next.js resolves it.

## 4. Visual Behavior

### Hard load / reload

Use the horizontal Strativate wordmark with a choreography distinct from the internal loader:

- a restrained orange sweep crosses the surface;
- the wordmark resolves from slight vertical offset/blur into a crisp lockup;
- a short orange accent line resolves below the wordmark;
- the full overlay fades out at the end of the entrance.

This is a brand entrance, not a spinner and not an indicator of route progress.

### Internal navigation

Use only the standalone Strativate mark with the existing subtle breathing mark and ring treatment. Do not rotate the mark and do not show the horizontal wordmark.

If a route is already prefetched/ready, this loader may never become visible. That is intentional.

## 5. Accessibility and Motion

The hard-load entrance is decorative and `aria-hidden`; it must not force assistive-technology users to wait for a visual flourish.

The internal route loader retains `role="status"`, `aria-live="polite"`, `aria-busy="true"`, and hidden text `Memuat halaman`.

Under `prefers-reduced-motion: reduce`:

- the hard-load entrance becomes static and short-lived;
- sweep, blur/transform entrance, and exit animation are disabled;
- internal mark/ring looping animation is disabled.

No rapid flashing or large rotational motion is allowed.

## 6. Performance and Routing Constraints

- Reuse `BrandLogo`; no new image assets.
- No third-party animation package.
- CSS handles visual animation.
- Only the hard-load brand entrance owns short timers.
- Internal route loading owns no timeout, interval, minimum delay, fake progress, click interception, or API request.
- Existing `Link`, `router.push()`, redirects, browser history, auth, commerce, mentoring, calendar, and database behavior remain unchanged.

## 7. Files

- `app/layout.tsx`
- `app/loading.tsx`
- `components/navigation/initial-brand-intro.tsx`
- `components/navigation/initial-brand-intro.module.css`
- `components/navigation/branded-route-loading.tsx`
- `components/navigation/branded-route-loading.module.css`
- `components/navigation/route-loading-mode.tsx`
- `tests/route-loading-ui.test.ts`
- `tests/browser/route-loading.spec.ts`

No database migration or dependency change is required.

## 8. Acceptance Criteria

1. Opening or hard-reloading the site shows the horizontal wordmark entrance, not the compact route-loader choreography.
2. The hard-load intro exits around 900 ms and does not replay during client-side page navigation.
3. Internal pending navigation shows only the compact standalone mark.
4. Internal route-loader visibility still follows real App Router pending state and has no forced minimum duration.
5. A fast/prefetched internal route is not slowed down to show animation.
6. The hard-load intro stays above the internal loader while both can coexist during unusually slow initial streaming.
7. Reduced-motion users receive static, shortened equivalents.
8. Business logic, auth, database behavior, and navigation APIs are unchanged.
