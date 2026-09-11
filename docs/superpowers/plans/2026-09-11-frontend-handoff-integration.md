# Frontend Handoff Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate every usable item in the September 2026 Strativate frontend handoff into the existing application with visible, source-backed UI changes.

**Architecture:** Extend the existing typed content and asset seams while preserving Product Master as the commercial authority. Normalize mentor/service/contact data in focused modules, generate validated web derivatives from supplied PNG/Drive sources, and consume them across marketing, auth, and workspace surfaces.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5.7, CSS, `next/font`, `next/image`, Node test runner, Playwright, PostgreSQL/Supabase.

**Spec:** `docs/superpowers/specs/2026-09-11-frontend-handoff-integration-design.md`

## Global Constraints

- Preserve the current local `main` working tree and Product Master architecture.
- Do not publish spreadsheet operational notes, raw row IDs, invented mentor fields, unsupported partnership/country claims, or missing product/legal facts.
- Use Poppins through `next/font/google` and exact colors sampled from `Color Palette.png`.
- Only Private and Intensive service overview cards receive detail links.
- Keep sensitive guarantee/refund language conditional and no stronger than the guidebook.
- Validate external photo responses as images before producing local derivatives.

---

### Task 1: Source-backed content contracts

**Files:**
- Create: `tests/frontend-handoff.test.ts`
- Create: `lib/content/brand.ts`
- Create: `lib/content/mentors.ts`
- Create: `lib/content/services.ts`
- Modify: `lib/content/marketing-content.ts`

**Interfaces:**
- Produces `brandPalette`, `publicContact`, `mentors`, `featuredMentors`, `serviceOverview`, and stable mentor slugs.

- [x] Write tests asserting 26 unique mentor slugs, 19 real portraits, 7 no-photo records, no internal notes/ratings, eight ordered services, only two detail routes, exact contact/palette values, and safe social-proof wording.
- [x] Run `pnpm exec tsx --test tests/frontend-handoff.test.ts` and verify RED because the modules do not exist.
- [x] Implement the smallest typed modules satisfying the source contracts.
- [x] Re-run the focused test and verify GREEN.

### Task 2: Brand and mentor production assets

**Files:**
- Create: `public/assets/brand/*`
- Create: `public/assets/mentors/<slug>.webp` for validated photos
- Modify: `lib/content/asset-registry.ts`
- Create: `components/brand/brand-logo.tsx`

**Interfaces:**
- Consumes supplied logo PNGs and 19 validated Drive downloads.
- Produces semantic ready assets plus branded fallbacks for seven mentors without photo sources.

- [x] Generate deterministic logo crops/favicon/Apple derivatives and optimized mentor WebP files.
- [x] Extend the registry with supplied brand records and stable per-mentor portrait keys.
- [x] Add the reusable real-logo component and verify asset tests.

### Task 3: Global visual identity and shared chrome

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`, `app/marketing.css`
- Modify: `components/marketing/site-header.tsx`, `components/marketing/site-footer.tsx`
- Modify: `components/auth/auth-shell.tsx`
- Modify: `app/dashboard/page.tsx`, `app/mentor/dashboard/page.tsx`, `app/admin/page.tsx`

**Interfaces:**
- Consumes `BrandLogo`, `brandPalette`, and `publicContact`.
- Produces Poppins typography, source palette, real brand marks, contact links, and branded metadata icons across public and authenticated UI.

- [x] Replace Plus Jakarta Sans with Poppins and source-derived metadata/icons.
- [x] Replace CSS/text `S` marks in auth/loading/workspace shells.
- [x] Update shared token values and responsive logo styling.

### Task 4: Mentor directory and homepage proof

**Files:**
- Modify: `components/marketing/mentor-card.tsx`, `components/marketing/home-page.tsx`, `app/mentor/page.tsx`, `app/marketing.css`

**Interfaces:**
- Consumes normalized `Mentor` records and per-mentor assets.
- Produces a searchable/filterable 26-record public directory and source-backed homepage mentor/social-proof sections.

- [x] Replace placeholder mentor cards with factual roles/expertise/bios, optional LinkedIn, real portraits, and honest missing-photo fallbacks.
- [x] Add accessible directory search/tier/expertise filtering in a small client component.
- [x] Render selected real mentors and “Siswa kami berasal dari” social proof on the homepage.

### Task 5: Eight-service Program overview and detail reconciliation

**Files:**
- Modify: `app/program/page.tsx`, `components/marketing/program-card.tsx`, `app/marketing.css`
- Modify: `lib/program-information.ts`, `components/programs/program-detail.tsx`, `app/program-information.css`

**Interfaces:**
- Consumes `serviceOverview`, Product Master summaries/details, and source-backed contact.
- Produces eight overview cards, two detail links, guidebook audience/outcomes/journeys, and contact CTAs without a second price catalog.

- [x] Render all eight Program Page services and remove the Big Class factual placeholder treatment.
- [x] Enrich Private/Intensive detail sections while keeping Product Master prices and conditions authoritative.
- [x] Add WhatsApp/email consultation actions and preserve no direct checkout for mentoring.

### Task 6: Documentation and automated/browser verification

**Files:**
- Modify: `docs/strativate/asset-status.md`, `docs/strativate/source-conflicts.md`, `docs/strativate/frontend-content-asset-requirements.md`
- Create: `docs/strativate/2026-09-11-frontend-handoff-receipt.md`
- Modify: browser/unit tests as required by the new source-backed behavior.

**Interfaces:**
- Produces an auditable source receipt, current gap status, and fresh verification evidence.

- [x] Update status/conflicts with exact resolving sources and unresolved mentor/content gaps.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`. Database tests were not applicable: no schema/catalog mutation was made and no disposable `TEST_DATABASE_URL` is configured.
- [x] Inspect public/auth routes at 1440×1000, 1024×768, and 390×844; verify protected workspace redirects and shared dashboard logo usage; fix visual defects and rerun affected checks.
- [x] Run a final placeholder/brand/fabrication scan and `git diff --check`.
