# Strativate asset and content status registry

Current as of 11 September 2026. Runtime asset metadata lives in
`lib/content/asset-registry.ts`; the full source receipt is in
[`frontend-handoff-receipt-2026-09-11.md`](frontend-handoff-receipt-2026-09-11.md).

| Asset/content | Status | Runtime location / behavior | Remaining action |
| --- | --- | --- | --- |
| Primary horizontal logo | Ready | `public/assets/brand/strativate-wordmark.png`; header, footer, auth, sidebars | Request SVG master if one exists |
| Standalone mark | Ready | `public/assets/brand/strativate-mark.png` | Request SVG master if one exists |
| Supplied logo sources | Archived | `strativate-logo-source.png`, `strativate-mark-inverse-source.png` | Retained for provenance |
| Typography | Ready | Poppins through `next/font/google` | None |
| Brand colors | Ready | Central CSS tokens from supplied palette | None |
| Browser and Apple icons | Ready | `app/icon.png`, `app/apple-icon.png` | Derived from supplied logo 4 |
| Default Open Graph image | Ready | `app/opengraph-image.png`, 1200×630 | Developer composition from supplied mark/palette |
| Mentor roster | Ready | 26 typed records in `lib/content/mentors.ts` | Confirm future roster changes through the workbook master |
| Mentor portraits | Partial | 19 optimized WebP files in `public/assets/mentors/`; 7 explicit brand-mark fallbacks | Supply originals for Ivonne Qiu, Fajri Alan, Deanna, Terry Kuron, Albert Lukas, Faluna A. Janitra, M. Sultan Perkasa |
| Mentor credentials/links | Ready with recorded conflicts | Public workbook columns only; internal notes excluded | Resolve cross-source discrepancies listed in `source-conflicts.md` |
| Mentor ratings | Intentionally absent | No real rating source | Connect only to production rating data |
| Social proof | Ready | 2500+ students, 15+ universities, 20+ high schools | No partnership wording or logos |
| Program overview | Ready | Eight services in `lib/content/services.ts`; actionable links are joined to published Product Master rows | Commercial details exist only for Private/Intensive |
| Private/Intensive commercial data | Ready via Product Master | Existing centralized catalog and program-detail pipeline | Preserve printed amounts; resolve named conflicts before changing catalog data |
| Big Class commercial master/cover | Missing | Public overview only; neutral placeholder registry slot | Supply cohort, schedule, price, outcomes, instructor and cover |
| Digital Product masters/covers/files | Missing | Honest empty/placeholder states | Supply approved product and delivery masters |
| Program/achievement photography | Missing | Hero uses approved brand composition; registry slots remain placeholders | Supply standalone originals and captions if desired |
| Testimonials and portraits | Missing | Not published | Supply approved quote, identity, context and consent |
| Institution logos | Missing / intentionally omitted | Text-only social-proof wording | Supply official files and approved usage language |
| Contact/social | Ready | Phone, WhatsApp, email, canonical site, Instagram | Keep current source master synchronized |
| About/FAQ | Ready | Source-backed public copy | Add policy answers only after policy approval |
| Legal documents | Missing | No invented legal copy or routes | Stakeholder/legal counsel must supply final text |
| Default user avatar | Developer-owned | Initials/neutral authenticated UI behavior | None |

## Status rules

- `ready` means the supplied file or approved text is integrated and visible.
- `missing` means the UI must use a clear fallback or omit the section.
- Embedded PDF imagery is reference-only and was not extracted into production.
- Runtime demo records remain confined to authenticated operational prototypes and
  are not treated as public marketing facts.
