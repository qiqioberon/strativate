# Homepage Competition Recognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage hero background non-interactive, subtly animate the existing cloud lobes, and add an admin-managed competition-recognition logo wall immediately after the hero.

**Architecture:** Keep the hero canvas and cloud rendering in their current components/CSS, removing only Shape Grid pointer code and adding transform-only lobe keyframes. Add a dedicated `competition_recognitions` Supabase collection and an isolated server query/admin client following the existing marketing media patterns, then pass active ordered recognition views from the server page into the homepage.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5.7, Supabase/PostgreSQL/RLS/Storage, CSS animations, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-homepage-competition-recognition-design.md`

## Global Constraints

- Base all work on `d60b20781c105a98f5aa46d939dda6b28fd0bb4a` using branch `feat/homepage-recognition-and-cloud-motion`; never work on `main`.
- Preserve the current clean cloud styling, seven-lobe geometry, gallery overlap, stats, responsive fixes, `bottom: -4px`, and seam overlap; add motion only.
- Preserve the autonomous Shape Grid loop and reduced-motion behavior while removing all pointer, mouse, hover, trail, displacement, brightness, parallax, and touch equivalents.
- `.homepage-shape-grid` must use `pointer-events: none`.
- Use exact copy: `Our mentors and students are award-winning business competition finalists.`
- Competition logos keep original colors and aspect ratios, use `object-fit: contain`, wrap responsively, and have no cards, marquee, carousel, auto-scroll, or hover animation.
- If no active records exist, render the recognition statement and omit the logo wall.
- Use `competition_name` verbatim as logo image alt text.
- Reuse the `marketing-editorial` bucket under the restricted `recognition-logos/` prefix; allow JPG, PNG, and WebP up to 5 MB.
- Do not modify the existing competition-opportunity directory and do not seed fake recognition records.
- Add no dependencies and make no unrelated homepage, admin, commerce, mentoring, authentication, footer, or global-brand changes.
- Run and report unit tests, typecheck, lint, build, database tests where available, and browser validation at 390, 430, 768, 1440, and 1920 before the first push.
- Review the complete diff before pushing, use at most two pushes, open a PR to `main`, and do not merge it.

## Review Focus

- A database/storage error during logo replacement must not delete the old logo or leak a newly uploaded logo; test payload preservation and source-level reconciliation/cleanup ordering in Task 3.
- Reordering with stale, missing, duplicate, or incomplete IDs must fail atomically; test the RPC contract in Task 1 and exercise it in the database regression test.
- Long competition names and unusually wide/tall transparent logos must stay accessible and contained without overflow; test exact alt mapping in Task 2 and browser layout bounds in Task 5.
- Pointer movement over the canvas must not alter pixels or block the CTA/gallery; compare canvas samples before/after pointer movement and exercise underlying controls in Task 5.
- Cloud transform interpolation must never uncover the body seam, including reduced motion and mobile widths; assert bottom anchoring/static reduced motion in Task 4 and bounding/overflow behavior in Task 5.

---

### Task 1: Competition recognition schema, RLS, storage, and database types

**Files:**
- Create: `supabase/migrations/202609270001_competition_recognitions.sql`
- Create: `tests/competition-recognition-migration.test.ts`
- Create: `supabase/tests/competition_recognitions.sql`
- Modify: `scripts/test-database.ts:23`
- Modify: `lib/supabase/database.types.ts:12-16,75-80,135-137`

**Interfaces:**
- Produces: `CompetitionRecognition = { id; competition_name; logo_path; display_order; is_active; created_at; updated_at }`.
- Produces: typed `competition_recognitions` table and `reorder_competition_recognitions({ p_ids: string[] }): undefined` RPC.
- Produces: public read access to active records and safe `marketing-editorial/recognition-logos/*.{jpg,jpeg,png,webp}` objects; admin-only writes.

- [ ] **Step 1: Write failing migration contract tests**

Add tests named:

- `competition recognition migration creates an unseeded dedicated collection` asserting the table/columns, timestamp trigger, no `insert into public.competition_recognitions`, active ordering index, and safe `recognition-logos/` path constraint.
- `competition recognition security keeps public reads active-only and mutations admin-only` asserting RLS policies, grants, `public.is_admin()`, and the existing bucket rather than a new bucket.
- `recognition reorder requires the complete unique identity list` asserting lock, total/matched/distinct checks, admin guard, and contiguous `display_order = ordinality` updates.
- `recognition storage policies allow only safe recognition-logo paths` asserting the public/admin storage policy predicates reject traversal/double slash and permit only supported image extensions.

- [ ] **Step 2: Run the migration contract test to verify it fails**

Run: `pnpm exec tsx --test tests/competition-recognition-migration.test.ts`

Expected: FAIL because `202609270001_competition_recognitions.sql` does not exist.

- [ ] **Step 3: Implement the forward migration**

Create `public.competition_recognitions` with required trimmed `competition_name` (1–180), unique safe `logo_path`, `display_order` (0–100000), active flag, timestamps, public-active/admin RLS, column grants, service-role grants, trigger, and public-order index. Extend the hardened `marketing-editorial` storage policies by dropping/recreating those policy names with the existing `publications/`, `competitions/`, plus new `recognition-logos/` predicates. Do not create or seed rows.

- [ ] **Step 4: Implement typed declarations and database regression coverage**

Add the exact `CompetitionRecognition` type/table/RPC declarations. Add `supabase/tests/competition_recognitions.sql` to verify admin CRUD/reorder/storage writes, anon and non-admin active-only reads, denied mutations, rejected unsafe paths, and duplicate/incomplete reorder failure; register the file immediately after `editorial_content.sql` in `scripts/test-database.ts`.

- [ ] **Step 5: Run targeted tests**

Run: `pnpm exec tsx --test tests/competition-recognition-migration.test.ts`

Expected: PASS.

If `TEST_DATABASE_URL` points to an approved disposable `strativate_test_*` database, run: `pnpm test:db -- --bootstrap`

Expected: all migrations and database test files, including `competition_recognitions.sql`, pass. Otherwise record the missing safe database as a validation limitation rather than using any other database.

- [ ] **Step 6: Commit the schema deliverable**

```bash
git add supabase/migrations/202609270001_competition_recognitions.sql supabase/tests/competition_recognitions.sql scripts/test-database.ts lib/supabase/database.types.ts tests/competition-recognition-migration.test.ts
git commit -m "feat: add competition recognition content model"
```

### Task 2: Public recognition query and homepage section

**Files:**
- Create: `lib/marketing/competition-recognitions.ts`
- Create: `components/marketing/competition-recognition-section.tsx`
- Create: `tests/homepage-competition-recognition.test.ts`
- Modify: `app/page.tsx:3-28`
- Modify: `components/marketing/home-page.tsx:5-30,84-90`
- Modify: `app/marketing.css:1251-1461`

**Interfaces:**
- Consumes: `CompetitionRecognition` from Task 1 and public URL generation from the existing `marketing-editorial` bucket.
- Produces: `CompetitionRecognitionView = Pick<CompetitionRecognition, 'id' | 'competition_name' | 'display_order'> & { logoUrl: string }`.
- Produces: `listActiveCompetitionRecognitions(): Promise<CompetitionRecognitionView[]>` ordered by `display_order`, `created_at`, then `id`.
- Produces: `CompetitionRecognitionSection({ recognitions }: { recognitions: CompetitionRecognitionView[] })`.

- [ ] **Step 1: Write failing public-section tests**

Add tests asserting:

- `app/page.tsx` calls `listActiveCompetitionRecognitions()` inside the existing `Promise.all` and passes `recognitions` into `HomePage`;
- `HomePage` places `<CompetitionRecognitionSection>` after the closing hero section and before `homepage-who-we-are-section`;
- the component includes the exact approved sentence, uses `recognition.competition_name` as `alt`, and conditionally renders `homepage-recognition-logo-wall` only when `recognitions.length` is nonzero;
- the server query filters `.eq('is_active', true)`, applies deterministic ordering, maps `logo_path` through `marketing-editorial`, and returns `[]` on query error;
- CSS uses a warm sand/pale peach solid background, centered responsive copy, flex wrapping, `object-fit: contain`, and no logo hover/marquee/carousel rules.

- [ ] **Step 2: Run the public-section test to verify it fails**

Run: `pnpm exec tsx --test tests/homepage-competition-recognition.test.ts`

Expected: FAIL because the helper and section do not exist.

- [ ] **Step 3: Implement the server query and section component**

Use a server-only Supabase helper and return only active ordered records. Render a semantic section with `data-testid="homepage-recognition-section"`, heading ID, exact copy, and a conditional `data-testid="homepage-recognition-logo-wall"`. Use native lazy-loaded `<img>` elements for arbitrary Supabase public URLs, with `alt={competition_name}` and dimensions/CSS that prevent layout shift and preserve aspect ratio.

- [ ] **Step 4: Wire homepage data and styles**

Fetch recognitions in `app/page.tsx` with the other independent homepage queries, extend `HomePage` props, and insert the section immediately after the hero. Add only scoped `homepage-recognition*` CSS using a calm warm background and responsive spacing/type/logo heights; do not alter the existing “Who We Are” section or cloud styles in this task.

- [ ] **Step 5: Run targeted tests**

Run: `pnpm exec tsx --test tests/homepage-competition-recognition.test.ts tests/stakeholder-revision-contract.test.ts tests/hero-kinetic-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the public deliverable**

```bash
git add lib/marketing/competition-recognitions.ts components/marketing/competition-recognition-section.tsx app/page.tsx components/marketing/home-page.tsx app/marketing.css tests/homepage-competition-recognition.test.ts
git commit -m "feat: add homepage recognition section"
```

### Task 3: Admin competition recognition CRUD

**Files:**
- Create: `lib/marketing/competition-recognition-admin.ts`
- Create: `components/admin/competition-recognition-management.tsx`
- Create: `tests/competition-recognition-admin.test.ts`
- Modify: `app/admin/page.tsx:3-38,50-74,107-114,174-178`
- Modify: `app/globals.css:84-192`
- Modify: `docs/strativate/asset-status.md:31-37`

**Interfaces:**
- Consumes: `CompetitionRecognition` and `reorder_competition_recognitions` from Task 1.
- Produces: `validateCompetitionRecognitionDraft({ competitionName, position?, recognitionCount?, file, hasStoredLogo }): CompetitionRecognitionDraftErrors`.
- Produces: `buildCompetitionRecognitionPayload({ competitionName, logoPath, storedLogoPath, isActive })`.
- Produces: `getNextCompetitionRecognitionOrder(records)`, `moveCompetitionRecognitionIdToPosition(records, id, position)`, `reorderCompetitionRecognitionIds(records, index, direction)`, `safeCompetitionLogoFileName(name)`, and `isCompetitionRecognitionSetupRequired(error)`.
- Produces: `CompetitionRecognitionManagement()` mounted as Admin → Content → Competition Recognition.

- [ ] **Step 1: Write failing admin-domain tests**

Test blank/over-180 names, missing new logo, optional replacement while editing, GIF/SVG rejection, exact 5 MB acceptance and oversize rejection, valid/invalid positions, stored-path preservation, safe filenames, append order, move-to-position, up/down ordering, and setup detection limited to missing-schema errors.

Add source contract assertions that the admin component:

- uploads only under `recognition-logos/` to `marketing-editorial`;
- uses `competition_name` for image alt text;
- calls `reorder_competition_recognitions`;
- exposes add/edit/toggle/move/delete controls;
- cleans a new upload after a confirmed failed DB write;
- removes the old object only after a successful replacement mutation; and
- never references the existing `competitions` table.

- [ ] **Step 2: Run the admin test to verify it fails**

Run: `pnpm exec tsx --test tests/competition-recognition-admin.test.ts`

Expected: FAIL because the admin domain/component does not exist.

- [ ] **Step 3: Implement pure admin helpers**

Implement the named interfaces with the exact MIME/size/name/position rules. Keep all ordering transformations pure and return complete ID arrays for the protected RPC.

- [ ] **Step 4: Implement the management component**

Follow `HeroPosterManagement` behavior without modifying it: load all records ordered by `display_order`/`created_at`, show setup/load failures, add and edit via one form, preview with contained images, upload randomized safe paths, reorder by RPC, toggle `is_active`, and hard-delete after confirmation. Reconcile possible persisted uploads before cleanup and report partial Storage cleanup honestly.

- [ ] **Step 5: Add the admin navigation and scoped styles**

Add `Competition Recognition` to the existing Content group with an appropriate existing Lucide icon and render `CompetitionRecognitionManagement` for that section. Add scoped `.competition-recognition-admin*` styles in `app/globals.css`; keep controls responsive and contained without changing unrelated admin selectors.

Update `docs/strativate/asset-status.md` with one row documenting database-backed, admin-managed competition recognition logos in `public.competition_recognitions` and `marketing-editorial/recognition-logos/`, with no fake assets supplied.

- [ ] **Step 6: Run targeted tests**

Run: `pnpm exec tsx --test tests/competition-recognition-admin.test.ts tests/stakeholder-completion.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the admin deliverable**

```bash
git add lib/marketing/competition-recognition-admin.ts components/admin/competition-recognition-management.tsx app/admin/page.tsx app/globals.css docs/strativate/asset-status.md tests/competition-recognition-admin.test.ts
git commit -m "feat: manage competition recognition logos"
```

### Task 4: Remove Shape Grid interaction and add cloud breathing

**Files:**
- Modify: `tests/hero-kinetic-contract.test.ts:20-39`
- Modify: `components/marketing/hero-shape-grid.tsx:16-416,429-440`
- Modify: `app/marketing.css:1180-1190,1270-1364,1455-1461`

**Interfaces:**
- Preserves: `HeroShapeGrid()` and autonomous `ShapeGrid` canvas lifecycle.
- Removes: hover props/state/rendering/listeners and every mouse/pointer/touch input path.
- Produces: seven distinct CSS lobe animations with static reduced-motion fallback.

- [ ] **Step 1: Rewrite the contract tests to the new behavior**

Replace the old `hoverTrailAmount` expectation with assertions that Shape Grid retains `requestAnimationFrame(updateAnimation)`, visibility pausing, and `prefers-reduced-motion`, while source and CSS contain no `hoverFillColor`, `hoverTrailAmount`, `hoveredSquareRef`, `trailCells`, `cellOpacities`, `mousemove`, `mouseleave`, `pointermove`, or touch listener and CSS contains `.homepage-shape-grid { ... pointer-events: none; }`.

Add cloud assertions for unchanged paper/sketch tokens, all seven geometry declarations, exact `bottom: -4px`, unchanged static base transforms, seven distinct animation durations in the 7–13s range, alternate/ease-in-out looping, central-lobe smallest motion, and reduced-motion `animation: none`.

- [ ] **Step 2: Run the hero contract test to verify it fails**

Run: `pnpm exec tsx --test tests/hero-kinetic-contract.test.ts tests/homepage-testimonials.test.ts`

Expected: FAIL on current hover behavior and missing lobe animation.

- [ ] **Step 3: Remove actual Shape Grid interaction logic**

Delete the hover props, refs, opacity updates, conditional fills, cell key calculations used only for hover, event handlers, listener registration, and listener cleanup. Keep shape drawing, grid movement, gradient fade, resize, intersection/page visibility, reduced-motion static frame, and animation scheduling intact. Set the canvas CSS to `pointer-events: none`.

- [ ] **Step 4: Add subtle asynchronous lobe keyframes**

Add transform-only alternate `ease-in-out` animations with distinct durations approximately `7s`, `8.5s`, `10s`, `11.5s`, `13s`, plus two nonmatching durations within that range. Each keyframe repeats its lobe’s existing base transform and adds only bounded Y/scale/rotation variation. Do not change geometry, backgrounds, borders, shadows, texture, `transform-origin`, or `bottom: -4px`; give lobe 4 the smallest variation. Disable all lobe animation under reduced motion.

- [ ] **Step 5: Run targeted tests**

Run: `pnpm exec tsx --test tests/hero-kinetic-contract.test.ts tests/homepage-testimonials.test.ts tests/homepage-competition-recognition.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the motion deliverable**

```bash
git add components/marketing/hero-shape-grid.tsx app/marketing.css tests/hero-kinetic-contract.test.ts
git commit -m "feat: refine homepage ambient motion"
```

### Task 5: Browser coverage, responsive verification, and full validation

**Files:**
- Modify: `tests/browser/hero-kinetic.spec.ts:3-80`
- Modify: `tests/browser/marketing.spec.ts:11-34`
- Create: `tests/browser/homepage-recognition.spec.ts`

**Interfaces:**
- Consumes: public homepage/UI from Tasks 2 and 4.
- Produces: reproducible Playwright checks for pointer pass-through, autonomous/non-reactive canvas, reduced motion, seam safety, recognition empty state, and five viewport widths.

- [ ] **Step 1: Add browser assertions for pointer and reduced-motion behavior**

Update the existing Shape Grid expectation from `pointer-events: auto` to `none`. Assert the CTA click can be intercepted as a popup without the canvas blocking it and preserve the existing gallery pointer/popout checks. Capture a small canvas pixel sample after allowing ambient motion, verify it changes over time without pointer input, move the pointer over the same location, and verify no immediate hover-only change is introduced beyond the continuous ambient frame progression.

Under reduced motion, assert `data-motion="reduced"`, each cloud lobe has `animation-name: none`, CTA remains actionable, and no horizontal overflow exists.

- [ ] **Step 2: Add the five-width recognition/seam smoke test**

For widths `390`, `430`, `768`, `1440`, and `1920`:

- visit `/` and wait for the intro to clear;
- assert hero, cloud, stats, recognition section, exact sentence, and next “Who We Are” section are in document order;
- assert the current empty database state omits `homepage-recognition-logo-wall` without omitting the sentence;
- assert document width does not exceed viewport width;
- assert every lobe’s lower edge overlaps the cloud body top by at least 3px in both an initial and delayed sample; and
- assert recognition copy width stays within its section and the warm section touches the hero without a visible border rule.

Add a DOM-injected logo-wall layout probe using representative wide, square, and tall data-URL images only inside the browser test page (not application/DB fixtures); assert all image boxes remain inside the wall, retain `object-fit: contain`, wrap centered, and expose exact competition-name alt text.

- [ ] **Step 3: Build and run targeted browser tests**

Run: `pnpm build`

Expected: Next.js production build succeeds.

Run: `pnpm exec playwright test tests/browser/hero-kinetic.spec.ts tests/browser/marketing.spec.ts tests/browser/homepage-recognition.spec.ts`

Expected: all targeted Chromium tests pass at the specified widths and reduced-motion setting.

- [ ] **Step 4: Run the full validation suite**

Run independently and record each result:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Expected: all checks pass. Do not describe skipped checks as passed. If a failure occurs, reproduce it on exact base `d60b20781c105a98f5aa46d939dda6b28fd0bb4a` before classifying it as pre-existing.

- [ ] **Step 5: Review the complete diff and repository state**

Run:

```bash
git status --short
git diff --check d60b20781c105a98f5aa46d939dda6b28fd0bb4a...HEAD
git diff --stat d60b20781c105a98f5aa46d939dda6b28fd0bb4a...HEAD
git diff d60b20781c105a98f5aa46d939dda6b28fd0bb4a...HEAD
```

Confirm the diff checklist from the user request, no fake records/assets, no changes to `competitions`, no Graphify cache artifacts, and no unrelated changes.

- [ ] **Step 6: Commit browser coverage and any validation-only corrections**

```bash
git add tests/browser/hero-kinetic.spec.ts tests/browser/marketing.spec.ts tests/browser/homepage-recognition.spec.ts
git commit -m "test: verify homepage recognition experience"
```

### Task 6: Push once and open the unmerged pull request

**Files:**
- No product files; Git/GitHub metadata only.

**Interfaces:**
- Consumes: fully validated feature branch and complete diff from Task 5.
- Produces: one remote feature branch and an open PR targeting `main`.

- [ ] **Step 1: Verify the remote base has not moved unnoticed**

Run: `git fetch --prune origin main && git rev-parse origin/main`

Expected: compare and record the result. If `origin/main` moved from the recorded base, stop and assess/rebase safely before pushing; do not silently open against an unreviewed base.

- [ ] **Step 2: Push the feature branch once**

Run: `git push -u origin feat/homepage-recognition-and-cloud-motion`

Expected: successful first push; record push count as 1.

- [ ] **Step 3: Open the pull request without merging**

Use title `feat: add homepage competition recognition`. The body must summarize Shape Grid interaction removal/ambient preservation, asynchronous cloud breathing/reduced motion, warm recognition section, admin-managed logos/RLS/storage, exact files changed, responsive validation, each validation result, database-test limitations if any, and any unrelated CI failures. Target `main` and do not use auto-merge.

- [ ] **Step 4: Inspect PR checks and final state**

Record PR URL/state and each reported check accurately. Treat `Canceled by Ignored Build Step` as canceled, not a successful Vercel preview/build. Do not merge the PR.

- [ ] **Step 5: Report the requested audit details**

Report base main SHA, branch, every commit SHA, push count, PR URL/state, exact changed files, validations, limitations/pre-existing failures, and explicit `Merged: NO`.
