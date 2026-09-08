# Strativate Homepage Redesign and Asset System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local-state marketing demo with a visibly redesigned,
route-native homepage and dedicated marketing pages backed by a safe typed asset
placeholder system.

**Architecture:** Public routes share a focused marketing shell; only the header
and mobile menu require client state. Homepage preview data and semantic media
assets are centralized, while the protected Mentor Dashboard moves to
`/mentor/dashboard` to free `/mentor` for public marketing.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind/CVA,
scoped global CSS, Lucide React, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-homepage-redesign-asset-system-design.md`

## Global Constraints

- Do not invent or promote unapproved mentor identities, ratings, achievements,
  university claims, country counts, testimonials, Big Class facts, Digital
  Product facts/prices, guarantees, or partnerships.
- Keep `/program/[slug]`, `/explore`, checkout, auth, admin, mentee dashboard, and
  onboarding working.
- Use only existing React/Next.js/CSS/Lucide/CVA dependencies.
- Keep temporary media under `public/assets/placeholders/`; do not create fake
  final assets in production folders.
- Use 15–17px navigation icons, restrained 150–250ms motion, visible focus, and
  `prefers-reduced-motion` support.
- Verify 1440, 1280, 768 and 390 layouts with no horizontal overflow.

---

### Task 1: Lock routing and content-safety behavior in tests

**Files:**
- Modify: `tests/auth.test.ts`
- Modify: `tests/browser/public-auth.spec.ts`
- Create: `tests/marketing-content.test.ts`
- Create: `tests/browser/marketing.spec.ts`

**Interfaces:**
- Consumes: existing `destinationFor()` and App Router pages.
- Produces: failing expectations for `/mentor/dashboard`, public marketing
  routes, semantic asset records, safe homepage claims and responsive nav.

- [ ] **Step 1: Write the failing mentor destination test**

```ts
assert.equal(
  destinationFor({ role: 'mentor', mentor_setup_completed_at: 'now' }, null),
  '/mentor/dashboard',
)
```

- [ ] **Step 2: Replace the anonymous protected-route case**

Change `/mentor` to `/mentor/dashboard` in the protected route matrix and add a
separate browser assertion that anonymous `/mentor` shows the public Mentor page.

- [ ] **Step 3: Add content/asset contract tests**

Import `assetRegistry` and homepage preview records, assert that every asset has
status, alt, priority and placeholder path, and assert serialized public-safe
content excludes `Alvin Haryanto`, `2.500+`, `Universitas mitra`, `15+ kemenangan`,
ratings, and conflicting Digital Product prices.

- [ ] **Step 4: Add marketing navigation browser tests**

Test all six real hrefs, active `aria-current="page"`, mobile menu expansion and
route navigation, homepage preview headings, program detail href preservation,
and 390px horizontal overflow.

- [ ] **Step 5: Run tests to verify expected failure**

Run: `pnpm test && pnpm exec playwright test tests/browser/marketing.spec.ts --project=chromium`

Expected: unit tests fail because the new registry/destination do not exist;
browser tests fail because dedicated pages and links do not exist.

### Task 2: Create the typed asset registry and safe marketing content

**Files:**
- Create: `lib/content/asset-registry.ts`
- Create: `lib/content/marketing-content.ts`
- Create: `public/assets/placeholders/logo-development.svg`
- Create: `public/assets/placeholders/portrait-development.svg`
- Create: `public/assets/placeholders/cover-development.svg`
- Create: `public/assets/placeholders/media-development.svg`
- Modify: `docs/strativate/asset-status.md`

**Interfaces:**
- Produces: `FrontendAsset`, `AssetStatus`, `assetRegistry`, `getAsset()`,
  `marketingNavigation`, `mentorPlaceholders`, `productPlaceholders`, and
  `faqPreview`.

- [ ] **Step 1: Define the asset contract**

```ts
export type FrontendAsset = {
  src: string
  placeholder: boolean
  status: 'placeholder' | 'missing' | 'ready'
  alt: string
  priority: 'P0' | 'P1' | 'P2'
  notes: string
}
```

- [ ] **Step 2: Add semantic registry branches**

Create typed branches for `brand.logo.primary`, `brand.logo.mark`, mentor
portraits, Private/Intensive/Big Class covers, product covers, achievement media,
testimonial portraits and institution logos. Point all interim files to
`/assets/placeholders/*` and mark them `placeholder: true`.

- [ ] **Step 3: Add neutral SVG placeholders**

Create simple branded SVGs with warm-neutral background, orange/red linework and
literal `DEVELOPMENT PLACEHOLDER` metadata/text. Do not include fabricated people,
institutions, awards or product titles.

- [ ] **Step 4: Centralize public-safe placeholder content**

Define navigation metadata and mentor/product placeholder arrays without names,
ratings, university affiliations, achievements, prices or availability claims.
Mark records with `contentStatus: 'placeholder'`.

- [ ] **Step 5: Run unit tests**

Run: `pnpm test`

Expected: registry/content tests pass; mentor destination still fails until Task
3.

### Task 3: Migrate the Mentor Dashboard and create native route boundaries

**Files:**
- Move: `app/mentor/page.tsx` to `app/mentor/dashboard/page.tsx`
- Create: `app/mentor/page.tsx`
- Create: `app/program/page.tsx`
- Create: `app/produk-digital/page.tsx`
- Create: `app/tentang-kami/page.tsx`
- Create: `app/tanya-jawab/page.tsx`
- Modify: `lib/auth/rules.ts`
- Modify: `proxy.ts`
- Modify: `tests/auth.test.ts`
- Modify: `tests/browser/public-auth.spec.ts`

**Interfaces:**
- Produces: public marketing route entry points and protected
  `/mentor/dashboard`.

- [ ] **Step 1: Move the existing Mentor Dashboard unchanged**

Relocate the current component source to `app/mentor/dashboard/page.tsx` without
visual edits.

- [ ] **Step 2: Update role destination and proxy protection**

Return `/mentor/dashboard` for completed mentor profiles. Protect
`/mentor/dashboard(?:/|$)` while allowing anonymous `/mentor`.

- [ ] **Step 3: Add route entry points**

Create thin server pages that render the shared marketing shell and their
dedicated content component. Preserve `/program/[slug]` untouched.

- [ ] **Step 4: Run unit and auth browser tests**

Run: `pnpm test && pnpm exec playwright test tests/browser/public-auth.spec.ts --project=chromium`

Expected: mentor destination and protected/public route expectations pass.

### Task 4: Evolve the shared button primitive

**Files:**
- Modify: `components/ui/button.tsx`

**Interfaces:**
- Produces: `buttonVariants()` variants `default`, `primary`, `secondary`,
  `outline`, `dark`, `ghost`, `destructive`, `text`, `link`; sizes `default`,
  `sm`, `lg`, `marketing`, `icon`, `icon-sm`, `icon-lg`.

- [ ] **Step 1: Update the CVA base styles**

Use a 12–14px radius, 200ms color/border/transform transitions, visible
focus-visible ring, one-pixel pressed movement, disabled opacity/pointer behavior,
and arrow-slot translation through `data-icon="arrow"`.

- [ ] **Step 2: Add marketing variants and size**

Keep `default` behavior compatible, add `primary` alias, dark/text options, and a
44–48px marketing size with balanced icon padding.

- [ ] **Step 3: Run typecheck and unit tests**

Run: `pnpm typecheck && pnpm test`

Expected: pass.

### Task 5: Build the marketing shell and asset-aware cards

**Files:**
- Create: `components/marketing/site-header.tsx`
- Create: `components/marketing/site-footer.tsx`
- Create: `components/marketing/marketing-shell.tsx`
- Create: `components/marketing/asset-media.tsx`
- Create: `components/marketing/program-card.tsx`
- Create: `components/marketing/mentor-card.tsx`
- Create: `components/marketing/marketing-page.tsx`

**Interfaces:**
- Consumes: `assetRegistry`, `marketingNavigation`, `buttonVariants`,
  `mentoringPrograms`.
- Produces: reusable public-site chrome, media slots, optional-field mentor cards,
  and program cards.

- [ ] **Step 1: Implement `SiteHeader` as the only navigation client boundary**

Use `usePathname`, real Links, 16px Lucide icons, `aria-current`, compact desktop
surface, accessible menu toggle, contained mobile panel, and distinct sign-in/CTA
actions.

- [ ] **Step 2: Implement `AssetMedia`**

Render `Image` in a fixed-aspect wrapper, preserve alt text, add a development
placeholder label when `placeholder` is true, and allow class/aspect overrides.

- [ ] **Step 3: Implement safe reusable cards**

Program cards accept program data plus placeholder state; Big Class omits price
and unsupported bullets. Mentor cards accept optional name, role, expertise,
university, achievement and rating and collapse absent rows without gaps.

- [ ] **Step 4: Implement footer and page primitives**

Use internal approved routes only. Do not add external contact/social hrefs.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`

Expected: pass.

### Task 6: Build the redesigned editorial homepage

**Files:**
- Replace: `app/page.tsx`
- Create: `components/marketing/home-page.tsx`
- Create: `app/marketing.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: marketing shell/cards/content/registry.
- Produces: redesigned `/` with Programs, Mentors, Digital Products, About and FAQ
  previews.

- [ ] **Step 1: Replace local-state page switching**

Make `app/page.tsx` a thin server entry point with no `view`, `go`, demo purchases,
toast, conditional pseudo-pages, or dashboard exports.

- [ ] **Step 2: Implement the hero and editorial support strip**

Use a controlled two-column layout, non-factual copy, registry-backed media slot,
shared Button variants and no claim/mentor floating cards.

- [ ] **Step 3: Implement five homepage previews**

Use varied section structures: asymmetric program grid, high-contrast statement,
portrait-ready mentor row, offset product-cover composition, split About/FAQ
closing section. Every preview links to its dedicated route.

- [ ] **Step 4: Add scoped marketing CSS**

Prefix selectors with `.marketing-site`, define responsive 1440/1280/768/390
layouts, focus/hover states, card variation, reduced-motion behavior, and avoid
global dashboard/auth selector changes.

- [ ] **Step 5: Import marketing CSS and remove v0 metadata marker**

Import `./marketing.css` from the root layout and remove `generator: 'v0.app'`.
Do not change the unresolved font family.

- [ ] **Step 6: Run focused browser test**

Run: `pnpm exec playwright test tests/browser/marketing.spec.ts --project=chromium`

Expected: homepage structure, hrefs, mobile menu and overflow assertions pass.

### Task 7: Implement the dedicated marketing pages

**Files:**
- Modify: `app/program/page.tsx`
- Modify: `app/mentor/page.tsx`
- Modify: `app/produk-digital/page.tsx`
- Modify: `app/tentang-kami/page.tsx`
- Modify: `app/tanya-jawab/page.tsx`

**Interfaces:**
- Consumes: marketing shell, cards, registry, safe content, and approved-source
  mentoring data.
- Produces: full public exploration destinations matching header links.

- [ ] **Step 1: Build `/program`**

Show Private and Intensive approved-source summaries linking to existing detail
pages, plus a clearly pending Big Class entry without price/facts.

- [ ] **Step 2: Build `/mentor`**

Show a roster-ready, photo-ready directory treatment using optional-field cards
and explicit placeholder status, with no fake identities or ratings.

- [ ] **Step 3: Build `/produk-digital`**

Show registry-backed cover slots and content-master pending states without
conflicting names/prices or purchase controls.

- [ ] **Step 4: Build `/tentang-kami` and `/tanya-jawab`**

Use non-factual brand philosophy and safe navigation/process answers; link to
program/auth routes without inventing contact or policy details.

- [ ] **Step 5: Run marketing and existing program browser suites**

Run: `pnpm exec playwright test tests/browser/marketing.spec.ts tests/browser/program-information.spec.ts --project=chromium`

Expected: pass.

### Task 8: Full verification and visual iteration

**Files:**
- Modify as needed: marketing components/CSS/tests only
- Create ignored artifacts: `output/playwright/homepage-redesign/*`

**Interfaces:**
- Produces: verified build and desktop/tablet/mobile screenshots.

- [ ] **Step 1: Run static and automated verification**

Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then
`pnpm exec playwright test --workers 3`.

- [ ] **Step 2: Start the production server and inspect with Playwright CLI**

Open `/` at 1440×1000, 1280×900, 768×900 and 390×844; capture screenshots and
console messages. Open/close the mobile menu and navigate through every header
item.

- [ ] **Step 3: Review and fix visible issues**

Check whitespace, headline wrapping, icon alignment, nav crowding, CTA balance,
card baselines, contrast, rounding repetition, media aspect ratios, mobile panel,
footer, focus states and overflow. Apply only scoped corrections.

- [ ] **Step 4: Re-run affected verification**

Repeat lint/typecheck/browser tests/build as required by each correction, and
re-capture final 1440 and 390 screenshots.

- [ ] **Step 5: Run final diff checks**

Run: `git diff --check && git status --short`.

Expected: no whitespace errors; only planned source/docs/assets/tests are changed.
