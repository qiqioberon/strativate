# Digital Product Rating Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Digital Product rating and feedback presentation consistent, legible, and less privacy-forward without changing rating data or access behavior.

**Architecture:** Add a server-compatible aggregate rating presentation component that renders five yellow stars from the existing aggregate value. Reuse it in the public catalogue, product detail, and admin average card; retain `PeekRating` as the buyer's interactive input. Simplify only buyer-facing feedback copy and visual density.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS modules, Lucide React.

**Spec:** Conversation requirements dated 2026-10-06.

## Global Constraints

- Public catalogue rating text is white and its star is yellow.
- Product-detail rating has larger black text and five yellow stars filled according to the aggregate rating.
- Admin average-rating card uses a yellow star.
- Yellow star color is the buyer input star color: `#f5b400`.
- Simplify buyer feedback UI and de-emphasize private-language without altering review privacy behavior, API calls, validation, or access control.
- Do not add or modify test files for this visual-only revision.
- Keep the work on `fix/digital-product-rating-visuals`, based on `origin/main`, and create at most one commit and one push before opening an unmerged PR.

## Review Focus

- Aggregate values with decimal ratings must fill the five-star visual fractionally and remain accessible through an explicit text label.
- Products without ratings must continue to render no public rating aggregate.
- Catalogue overlay contrast must retain white rating text while showing a yellow rating star.
- Product-detail aggregate must not expose feedback text or buyer identities.
- Buyer feedback wording must remain truthful: it cannot imply public visibility or a change to admin-only handling.

---

### Task 1: Unify rating and feedback presentation

**Files:**
- Create: `components/digital-products/aggregate-rating.tsx`
- Modify: `components/digital-products/digital-product-directory.tsx`
- Modify: `app/produk-digital/[slug]/page.tsx`
- Modify: `components/admin/digital-product-rating-management.tsx`
- Modify: `components/digital-products/rating-feedback.tsx`
- Modify: `app/digital-product-commerce.css`
- Modify: `components/admin/digital-product-rating-management.module.css`

**Interfaces:**
- Produces: `AggregateRating({ averageRating, ratingCount, variant? })`, where `variant` is `'catalogue' | 'detail' | 'admin'`.
- Consumes: `PublicDigitalProduct.averageRating` and `PublicDigitalProduct.ratingCount`; admin's computed numeric `average` and `rows.length`.

- [ ] **Step 1: Establish the visual-verification baseline**

Run: `pnpm lint -- components/digital-products/digital-product-directory.tsx app/produk-digital/[slug]/page.tsx components/admin/digital-product-rating-management.tsx components/digital-products/rating-feedback.tsx`

Expected: the existing rating views lint cleanly before the visual-only change.

- [ ] **Step 2: Implement `AggregateRating` in `components/digital-products/aggregate-rating.tsx`**

Render the formatted numeric value, count, and exactly five decorative star glyphs. Use an inline fill percentage for each star, clamp values to `0..5`, and expose the full aggregate through one `aria-label`.

- [ ] **Step 3: Replace the public and admin aggregate string displays**

Use the component in catalogue, detail, and the admin Average rating metric. Preserve the existing conditional rendering for zero ratings and all database/API behavior.

- [ ] **Step 4: Apply the approved visual and copy refinements**

Set active star color to `#f5b400`; catalogue aggregate text white; product detail text black and larger; admin average star yellow. Remove the buyer form's prominent private kicker/claims and shorten its supporting copy, while retaining a concise truthful admin-only note beside the optional comment.

- [ ] **Step 5: Verify the implementation**

Run: `pnpm lint -- components/digital-products/aggregate-rating.tsx components/digital-products/digital-product-directory.tsx app/produk-digital/[slug]/page.tsx components/admin/digital-product-rating-management.tsx components/digital-products/rating-feedback.tsx && pnpm typecheck && git diff --check`

Expected: lint, TypeScript checks, and whitespace validation pass, or pre-existing repository failures are documented without being masked.

- [ ] **Step 6: Commit the cohesive visual refinement**

```bash
git add components/digital-products/aggregate-rating.tsx components/digital-products/digital-product-directory.tsx app/produk-digital/[slug]/page.tsx components/admin/digital-product-rating-management.tsx components/digital-products/rating-feedback.tsx app/digital-product-commerce.css components/admin/digital-product-rating-management.module.css docs/superpowers/plans/2026-10-06-digital-product-rating-visuals.md
git commit -m "fix: refine digital product rating visuals"
```
