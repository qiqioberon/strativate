# Strativate Frontend Handoff Integration Design

**Date:** 2026-09-11
**Status:** Approved by the supplied implementation brief
**Scope:** Brand, source-backed marketing content, mentor directory, program overview/details, shared navigation, auth/workspace branding, assets, and provenance documentation.

## Outcome

The existing Next.js 16 application receives the supplied Strativate frontend handoff without replacing Product Master. Brand identity is centralized in global tokens and a typed asset registry; mentor and public-service content live in typed modules; commercial program identity, availability, packages, and prices continue to come from Product Master.

## Source precedence

1. `Bahan FE 1/Brand Guideline.pdf`, `Logo Strativate/`, and `Color Palette.png` govern current visual identity.
2. `Data Mentor.xlsx` governs explicit mentor fields; guidebooks may fill a blank field only when they do not conflict.
3. `Program Page.pdf` governs the eight-service public overview and the Private/Intensive facts it repeats.
4. Private and Intensive guidebooks provide detailed program, testimonial, social-proof, contact, and mentor context.
5. Product Master remains authoritative for public commercial identities and prices.
6. Earlier audit/status documents are updated against this handoff rather than treated as current truth.

## Architecture

- `lib/content/brand.ts` owns approved palette and public contact values.
- `lib/content/mentors.ts` owns 26 normalized, stable-slug mentor records. Internal spreadsheet notes and row IDs are excluded. Conflicting tier/name evidence is recorded internally and conservative public labels are used.
- `lib/content/services.ts` owns the eight non-commercial service overview cards. Only Private and Intensive route to detail pages.
- `lib/content/asset-registry.ts` maps brand and per-mentor semantic keys to validated local assets or branded fallbacks.
- Product Master and `lib/program-information.ts` continue to compose commercial and editorial detail pages; source-backed CTA/contact and guidebook sections extend that presentation without duplicating prices.
- A reusable `BrandLogo` component replaces CSS/text marks in marketing, auth, loading, and workspace shells.

## Asset handling

PNG handoff files remain identified as official supplied PNG sources, never as SVG masters. Web derivatives are deterministic crops/resizes with preserved colors and geometry. Mentor Drive downloads are admitted only after MIME and image decoding validation; optimized WebP portraits are stored at `public/assets/mentors/<slug>.webp`.

## Content safety

The UI may publish the guidebook framing “Siswa kami berasal dari” and the guidebook counts for students, universities, and high schools because this new handoff is current stakeholder-provided source material. It must not call institutions partners, publish unsupported country counts, invent ratings, expose spreadsheet notes, or create missing Big Class/Digital Product/legal details. Guarantee language stays conditional and links to consultation rather than checkout.

## Verification

Pure content contracts are test-driven. Browser coverage asserts the eight-service overview, 26 mentor records, real branding/contact, responsive overflow, and preserved Product Master prices. Final verification runs lint, typecheck, unit tests, build, Playwright, and database tests when a disposable local PostgreSQL environment is available, followed by visual inspection at desktop and mobile widths.
