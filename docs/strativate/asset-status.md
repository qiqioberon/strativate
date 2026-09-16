# Strativate asset and content status registry

Current as of 17 September 2026. Runtime asset metadata lives in
`lib/content/asset-registry.ts`; public mentor profile/content runtime data is
owned by the database-backed mentor public-profile domain introduced by
`202609170001_mentor_public_profiles_expertise.sql`. The full source receipt is in
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
| Mentor roster and public profiles | Database-backed; migration required before deploy | `public.mentor_public_profiles`, `public.mentor_public_achievements`, `public.mentor_public_profile_expertise`, and `list_public_mentors()` own production runtime public mentor data. The 26 approved legacy rows are seeded as published but deliberately unlinked to authenticated mentor accounts. `lib/content/mentors.ts` remains source/migration provenance only and is not a production runtime source. | Apply `202609170001_mentor_public_profiles_expertise.sql` to hosted Supabase before deploying the app revision; future ownership links must be explicit, never inferred from name/email |
| Mentor expertise | Database-backed; admin-manageable | `public.mentor_expertise` is seeded with the eight approved expertise labels and managed through Admin → Mentor Expertise; mentor profiles use the many-to-many junction | Maintain names/status/order through the mentor expertise admin domain |
| Mentor portraits | Partial | 19 optimized WebP files in `public/assets/mentors/`; 7 explicit brand-mark fallbacks. Public profiles retain `portrait_asset_key` compatibility and may optionally use `portrait_url`; the asset registry remains media metadata, not mentor profile truth | Supply originals for Ivonne Qiu, Fajri Alan, Deanna, Terry Kuron, Albert Lukas, Faluna A. Janitra, M. Sultan Perkasa; no upload subsystem exists in this phase |
| Mentor credentials/links | Database-backed with recorded conflicts | Migrated public workbook fields are stored in mentor public profiles/achievements; internal notes remain excluded | Resolve cross-source discrepancies listed in `source-conflicts.md` through approved profile updates |
| Mentor ratings | Intentionally absent | No real rating source | Connect only to production rating data |
| Social proof | Ready | 2500+ students, 15+ universities, 20+ high schools | No partnership wording or logos |
| Program overview | Ready | Eight static service overviews in `lib/content/services.ts`; Private Mentoring marketing copy remains source-owned | Keep static website copy separate from domain-owned business records |
| Private Mentoring marketing/editorial | Ready | Static source modules (`lib/program-information.ts`, `lib/content/services.ts`) own title, hero/detail, audience, highlights, journey and CTA composition; existing Program UI/cover assets are reused | No new image asset required; do not expose this copy as Admin/CMS data |
| Private Mentoring catalog | Ready | Database owns packages, Learning Paths, Session Topics / Focuses, and Competition Categories; public detail injects active catalog records into the existing Program design | Maintain catalog through Private Mentoring admin/domain only |
| Private Mentoring commercial data | Ready | Ten seeded domain-owned packages sync only thin identities to Shared Commerce; the public page shows package totals/reference prices plus derived per-session display | Maintain prices through the Private Mentoring admin/domain, never a generic catalog |
| Intensive Mentoring editorial information | Ready | `lib/program-information.ts` retains approved non-commercial detail, audience, highlights, and journey | Keep pricing/packages unavailable until its domain is deliberately rebuilt |
| Intensive Mentoring commercial data | Intentionally unavailable during rebuild | Legacy Product Catalog runtime removed; its detail page shows an honest unavailable/update state | Reintroduce only through a future domain-owned business model |
| Big Class commercial master/cover | Missing | Public overview only; neutral placeholder registry slot | Supply cohort, schedule, price, outcomes, instructor and cover |
| Digital Product domain and covers | Admin-ready; public rollout feature-controlled | `public.digital_products` plus private `digital-product-images` cover bucket; admin CRUD remains independent of the public feature flag | Enter only approved product facts/covers and control public exposure with the existing feature flag |
| Actual Digital Product files/delivery | Not implemented | No downloadable/viewable product content delivery model exists | Implement only in a later explicitly scoped phase |
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
- `intentionally unavailable during rebuild` means previous runtime business data was retired and must not be copied into a temporary source of truth.
- `admin-ready; public rollout feature-controlled` means the domain is real and admin-manageable while public exposure follows the existing feature flag.
- The mentor public-profile feature is deployment-order sensitive: hosted Supabase must receive `202609170001_mentor_public_profiles_expertise.sql` before an app version that calls the new RPCs is deployed.
- Embedded PDF imagery is reference-only and was not extracted into production.
- Runtime demo records remain confined to authenticated operational prototypes and are not treated as public marketing facts.
