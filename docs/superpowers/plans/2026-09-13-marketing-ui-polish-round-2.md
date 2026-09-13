# Marketing UI/UX Polish Round 2 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Follow the red-green-refactor order inside every task and run a task-scoped review before advancing.

**Goal:** Polish Strativate's marketing and auth UI across all approved public routes while preserving Product Master, the mentor domain, Supabase behavior, route guards, feature flags, and source-backed content.

**Architecture:** Extend the existing shared marketing/auth components rather than building a parallel design layer. Put deterministic carousel transitions in a pure helper, keep page data sourced from the current catalog/content modules, express page hierarchy through component variants and semantic wrappers, and centralize visual behavior in the existing CSS files.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS, Lucide React, Node test runner through `tsx`, Playwright, Supabase.

**Spec:** `docs/superpowers/specs/2026-09-13-marketing-ui-polish-round-2-design.md`

## Global constraints

- Use Poppins only. Do not introduce another font family.
- Use the approved colors `#FF7A00`, `#DC0D16`, `#B3151C`, `#FFE79D`, black, and off-white; WhatsApp actions may use accessible WhatsApp green.
- Do not change Product Master pricing/commercial authority, the Digital Product feature flag, redirects, route guards, Supabase clients, RLS, SQL, migrations, backend workflows, mentor invitations/availability/admin behavior, or hero-poster persistence.
- Do not add a migration or mutate hosted Supabase.
- Preserve 26 mentors, 19 ready portrait assets, and seven honest missing-photo fallbacks.
- Do not fabricate testimonials, logos, partnerships, guarantees, prices, stakeholder copy, mentor details, or Big Class commercial details.
- Exact hero WhatsApp messages:
  - Home: `Halo Strativate, saya ingin konsultasi untuk menentukan program yang paling sesuai dengan kebutuhan saya.`
  - Program: `Halo Strativate, saya ingin konsultasi untuk memilih program Strativate yang sesuai.`
  - Mentor: `Halo Strativate, saya ingin konsultasi untuk memilih mentor yang sesuai dengan kebutuhan saya.`
  - About: `Halo Strativate, saya ingin mengetahui lebih lanjut tentang layanan dan pendekatan Strativate.`
  - FAQ: `Halo Strativate, saya masih memiliki pertanyaan tentang layanan Strativate. Bisa dibantu?`
- Hero carousel autoplay is exactly 5000ms, resets after every manual navigation, pauses for hover/focus/pointer interaction, supports ArrowLeft/ArrowRight and horizontal swipe, and does not autoplay under reduced motion.
- Mentor marquee animation duration is 140 seconds, pauses on hover/focus, exposes only the first group to accessibility/focus, and becomes a single scroll-snap list under reduced motion.
- Validate widths 360, 390, 768, 1024, 1280, 1440, and 1920 on `/`, `/program`, `/mentor`, `/tentang-kami`, `/tanya-jawab`, and `/auth`, including no horizontal document overflow.
- Preserve user work and use `apply_patch` for source/document edits. Do not commit screenshots, `.env`, Playwright transient output, or `.superpowers` artifacts.
- For commands that need public Supabase configuration, load only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the ignored repository-root `.env` into the process without printing their values. Use `pnpm ... --ignore-workspace` where installation or workspace discovery requires it.

### Task 1: Establish the shared typography, header, editorial intro, and WhatsApp action system

**Files:**
- Modify: `tests/marketing-content.test.ts`
- Modify: `tests/browser/marketing.spec.ts`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/marketing/site-header.tsx`
- Modify: `components/marketing/page-intro.tsx`
- Modify: `components/ui/button.tsx`
- Modify: `app/marketing.css`

**Step 1: Write failing tests**

Add source-level/unit assertions that the layout imports only Poppins, existing CSS font tokens resolve to Poppins, and no DM Sans, Outfit, or IBM Plex family remains. Add browser assertions for actual desktop header geometry at 1440px: navigation center differs from viewport center by no more than two CSS pixels, brand remains left, and actions remain right. Add PageIntro motif hooks and verify its decoration is hidden from accessibility.

**Step 2: Run tests to verify RED**

Run `pnpm test` and the focused marketing browser test after a local build. Confirm the new assertions fail for the expected existing typography/header/motif behavior.

**Step 3: Implement the minimal shared foundation**

Load Poppins once through `next/font/google` in `app/layout.tsx`, expose `--font-poppins`, and make sans/heading/mono CSS tokens all resolve to it. Replace the desktop flex header geometry with a true three-column grid without changing native links, active route logic, mobile menu, Escape behavior, or test IDs. Extend `PageIntro` with a required/explicitly defaulted motif union and render decorative `aria-hidden` elements. Add a reusable green WhatsApp-sized button variant/class without changing existing variants. Refine global meaningful typography sizes and focus-visible styles.

**Step 4: Verify GREEN and refactor**

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and the focused browser test. Inspect 1440px and 390px header/menu states. Commit as `feat: establish round 2 marketing foundation`.

### Task 2: Refine the homepage hero, social proof, carousel, and mentor marquee

**Files:**
- Create: `lib/marketing/carousel.ts`
- Create: `tests/marketing-carousel.test.ts`
- Modify: `tests/browser/marketing.spec.ts`
- Modify: `components/marketing/home-page.tsx`
- Modify: `components/marketing/hero-carousel.tsx`
- Modify: `components/marketing/mentor-marquee.tsx`
- Modify: `app/marketing.css`

**Step 1: Write failing tests**

Test the carousel's wrapped previous/next index transitions, the 5000ms constant, and the decision to disable scheduling for zero/one poster, paused state, or reduced motion. Render or browser-check zero/single/multiple poster structures so controls appear only for multiple posters. Add browser checks for the exact home WhatsApp message, social-proof wrapper containment, marquee accessible duplicate/tab sequence, its 140-second computed duration, hover/focus pause, reduced-motion layout, and touch-accessible directory links.

**Step 2: Run tests to verify RED**

Run `pnpm test` and the focused homepage browser tests. Confirm failures correspond to the missing CTA/controls/helper and current 6000ms/70s behavior.

**Step 3: Implement the minimal homepage behavior**

Add the green contextual WhatsApp hero CTA while keeping Program and Mentor links. Replace the social-proof margin workaround with one contained wrapper. Refactor the carousel to use timeout-based 5000ms scheduling that resets after manual previous/next/dot/keyboard/swipe selection; pause on hover, focus-within, and pointer/touch activity; honor reduced motion; provide labelled previous/next buttons and dots; keep honest zero/single/multiple states; and present poster art with contained editorial fitting. Refine the marquee into larger focusable cards with sourced preview content, 140-second travel, stable expansion, accessible duplicate handling, directory anchors, and reduced-motion scroll snapping.

**Step 4: Verify GREEN and refactor**

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and focused homepage browser tests. Manually inspect carousel keyboard/touch/pause behavior where multiple poster fixture coverage is available and inspect desktop/mobile marquee focus. Commit as `feat: refine homepage interactions and proof`.

### Task 3: Implement editorial page heroes, program hierarchy, and source-backed FAQ depth

**Files:**
- Modify: `tests/marketing-content.test.ts`
- Modify: `tests/browser/marketing.spec.ts`
- Modify: `tests/browser/program-information.spec.ts`
- Modify: `lib/content/marketing-content.ts`
- Modify: `components/marketing/service-card.tsx`
- Modify: `components/marketing/faq-directory.tsx`
- Modify: `app/program/page.tsx`
- Modify: `app/mentor/page.tsx`
- Modify: `app/tentang-kami/page.tsx`
- Modify: `app/tanya-jawab/page.tsx`
- Modify: `app/marketing.css`

**Step 1: Write failing tests**

Assert 8–12 FAQ entries with only approved Program, Mentor, Akun, and Dukungan facts and no unresolved claims. Browser-test each page's PageIntro motif and exact contextual hero WhatsApp message. Assert the program page renders two equal primary services, one secondary Big Class overview, and five compact supporting services while retaining exactly eight cards and both connected program links.

**Step 2: Run tests to verify RED**

Run `pnpm test` and focused marketing/program browser tests; confirm failures for the three-question FAQ, link-based hero actions, and flat service hierarchy.

**Step 3: Implement the minimal content/layout changes**

Expand FAQ data from existing public catalog, mentor, auth, and approved-contact sources only. Keep the homepage preview intentionally limited to its first three FAQ entries. Add ServiceCard visual variants without changing service data/connectivity. Render the program groups in semantic primary/secondary/supporting wrappers, with Private and Intensive equal, Big Class overview-only, and the remaining five compact. Apply page-specific PageIntro motifs and exact green hero WhatsApp messages to Program, Mentor, About, and FAQ. Keep existing lower-page consultation bands and use exact approved language where the same intent is represented.

**Step 4: Verify GREEN and refactor**

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and focused marketing/program browser tests. Inspect all four page intros at 1440px, 768px, and 390px. Commit as `feat: strengthen marketing page hierarchy`.

### Task 4: Polish mentor discovery and the centered mentor modal

**Files:**
- Modify: `tests/browser/marketing.spec.ts`
- Modify: `components/marketing/mentor-directory.tsx`
- Modify: `components/marketing/mentor-card.tsx`
- Modify: `components/marketing/mentor-detail-modal.tsx`
- Modify: `app/marketing.css`

**Step 1: Write failing tests**

Browser-test combined search/tier filtering, an active-filter reset control, result-count updates, stable card anchors, aligned profile/LinkedIn actions, modal center coordinates within two pixels of the viewport center, internal scroll bounds, Escape/close behavior, section headings/icons, LinkedIn preservation, and absence of the mentor-specific modal WhatsApp link. Test the 390px modal and missing-photo state without changing the mentor roster.

**Step 2: Run tests to verify RED**

Run the focused mentor browser tests and confirm expected failures for reset, centering/structure, anchors, and modal WhatsApp removal.

**Step 3: Implement the minimal mentor polish**

Group search, filters, live count, and conditional reset in a clear toolbar. Give directory cards stable `mentor-{slug}` anchors and polished bottom-aligned actions with accessible labels. Explicitly center and bound the native dialog, add a responsive media/content grid, internally scroll overflowing content, add meaningful decorative section icons, and preserve native Escape/close/backdrop semantics. Remove the mentor-specific WhatsApp action and keep LinkedIn when present. Add reduced-motion-safe dialog transitions.

**Step 4: Verify GREEN and refactor**

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and focused mentor browser tests. Inspect a ready-photo and missing-photo modal at 1440px and 390px. Commit as `feat: polish mentor discovery experience`.

### Task 5: Refine auth composition and complete responsive/browser verification

**Files:**
- Modify: `tests/browser/public-auth.spec.ts`
- Modify: `tests/browser/frontend-handoff.spec.ts`
- Modify: `tests/browser/marketing.spec.ts`
- Modify: `components/auth/auth-shell.tsx`
- Modify: `components/auth/auth-form.tsx`
- Modify: `app/auth/auth.css`
- Modify: `app/marketing.css` only if final responsive fixes are necessary

**Step 1: Write failing tests**

Assert the auth back link immediately follows the brand and precedes the heading, contains an ArrowLeft icon, and the login/register switch is a clear full-width secondary control. Assert the right panel contains a branded grid decoration hidden from accessibility, has animation in normal motion, and disables it under reduced motion. Add a responsive matrix over the six public routes at widths 360, 390, 768, 1024, 1280, 1440, and 1920; verify headings/actions, mobile-menu behavior, modal layout, focus operation, and no horizontal document overflow.

**Step 2: Run tests to verify RED**

Run focused auth/handoff tests and confirm failures match the old link order, plain switch, static panel, and any responsive issues.

**Step 3: Implement the minimal auth and responsive fixes**

Move the back link above the heading and add ArrowLeft. Restyle the mode switch without changing its accessible name or auth state behavior. Build the right-side panel from existing BrandLogo plus decorative CSS grid/orbit elements, mark decoration `aria-hidden`, and provide a static reduced-motion state. Fix only evidence-backed responsive problems found by the matrix; do not hide overflow as a substitute for correcting layout width.

**Step 4: Verify GREEN and refactor**

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, a clean `pnpm build`, and the complete `pnpm test:e2e`. Capture matching 1440×1000 local after screenshots for `/`, `/program`, `/mentor`, `/tanya-jawab`, and `/auth`, plus targeted mobile evidence. Inspect browser console/page errors and key focus/touch/reduced-motion states. Commit as `feat: refine auth and responsive polish`.

### Task 6: Complete repository, security, and delivery audits

**Files:**
- Review only unless a verified defect requires a new tested fix commit.

**Step 1: Run the full verification gate**

From a clean checkout state with public Supabase environment loaded securely, run:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test:e2e`
- `git diff --check origin/main...HEAD`

Record exact counts and any skipped/external checks.

**Step 2: Audit scope and secrets**

Inspect `git status --short`, `git diff --stat origin/main...HEAD`, `git diff --name-status origin/main...HEAD`, and the complete branch diff. Confirm no `.env`, secret, Playwright transient output, screenshot, generated workspace, SQL, migration, schema, lockfile, or unrelated backend change is committed. Search the diff for credential-like patterns and confirm the two existing migration files remain present and byte-unchanged relative to `origin/main`.

**Step 3: Run final review and remediate findings**

Use `superpowers:requesting-code-review` with a whole-branch review package. If findings exist, dispatch one fix implementer, rerun covering tests, and run one scoped re-review. Apply `vercel:react-best-practices` to the final TSX diff and resolve material issues through the same reviewed fix path.

**Step 4: Deliver without merging**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Push `feat/marketing-ui-polish-round-2` normally, open a PR to `main` titled `feat: polish Strativate marketing and auth experience`, and do not force-push or merge it. Confirm the remote branch and PR URL. Report branch, commit list, PR, screenshots/viewports, exact test results, audits, remaining issues, external/manual actions, and every ledger ruling.
