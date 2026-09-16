# Strativate source conflict register

## 17 September 2026 mentor public-profile ownership resolution

The approved 26-row mentor roster remains the factual bootstrap source, but production runtime ownership now moves to the dedicated database-backed public mentor domain introduced by `202609170001_mentor_public_profiles_expertise.sql`. `public.mentor_public_profiles`, `public.mentor_public_achievements`, `public.mentor_expertise`, and `public.mentor_public_profile_expertise` own public mentor profile content and expertise relationships. Public pages consume only the safe `list_public_mentors()` RPC; `lib/content/mentors.ts` is retained for source/migration provenance and is no longer a production runtime source of truth.

This public-profile domain remains deliberately separate from the existing operational `public.mentor_profiles` table. Operational `mentor_profiles` continues to own authenticated mentor-account state such as tier linkage, timezone, active status, and availability. The public-profile table may optionally link to an operational mentor through `mentor_user_id`, but that relationship must be explicit.

All 26 approved legacy public roster records are migrated as published public profiles with `mentor_user_id = null`. **Ownership must never be inferred from display name, email, title, slug similarity, or any other identity guess.** A mentor account may create its own draft profile through the account-bound RPC, and an administrator may intentionally link an existing legacy public profile only when the ownership relationship is known. The current admin UI deliberately does not expose any name/email auto-link flow.

Portrait migration is staged rather than destructive. Existing approved/fallback media continue through `portrait_asset_key` and the asset registry; `portrait_url` is an optional future-compatible public URL. This phase adds no portrait upload subsystem and does not move or duplicate the existing 19 optimized portraits or seven explicit fallbacks.

Deployment order is mandatory: apply `supabase/migrations/202609170001_mentor_public_profiles_expertise.sql` to hosted Supabase **before** deploying an application revision that calls the new public/mentor/admin RPCs. Until that migration is applied, the previous application version should remain deployed.

## 16 September 2026 Intensive Mentoring catalog resolution

The current requester explicitly approved using the supplied 2026 Indonesian Intensive Mentoring guidebook as the business source for the domain-owned Intensive Mentoring catalog. The approved database-backed public catalog may therefore use the guidebook's package names and prices for **Intensive** (4 sessions/month, Rp1.150.000 with Rp1.400.000 reference), **Super Intensive** (8 sessions/month, Rp2.200.000 with Rp2.800.000 reference), the consultation-only international competition option, **Laporan Performa Terperinci** (+Rp150.000), **Simulasi Penjurian** (+Rp300.000), **Bundel Skill Builder** (Rp1.250.000), and **Bundel Competition Ready** (Rp2.500.000). Guidebook-backed package/add-on features and bundle composition may also be stored as domain catalog data.

The same request asks for Win Guarantee Protection and Competition Assurance to exist in the admin catalog, but it does **not** provide the separate written legal approval previously required for guarantee/refund promises. Those records may exist as admin-visible domain records, but they remain inactive for public display by default. Refund/credit promises and detailed guarantee terms must not be published until written business/legal approval is supplied. This resolution supersedes the earlier blocker on Intensive bundle naming/pricing, but does not remove the guarantee/refund guardrail.

## 14 September 2026 corrective Private Mentoring ownership resolution

A corrective architecture review after Phase 3 clarifies a boundary that the first implementation interpreted too broadly. **Private Mentoring website marketing/editorial content is static frontend content, not a database-managed CMS.** The canonical title, slug, homepage and `/program` marketing copy, short description, kicker, hero/detail copy, audience, marketing highlights, journey/how-it-works copy, CTA copy, section headings, and supporting explanatory copy live in the repository's static content modules.

The database remains authoritative only for genuine Private Mentoring business/domain data: packages and prices, Session Topics / Session Focuses, Learning Paths, Competition Categories, enrollments, sessions, mentor assignment/scheduling operations, and Shared Commerce references. Admin may manage those catalog/operational records, but it must not mutate the website's marketing copy.

The corrective forward migration removes the obsolete `private_mentoring_programs`, `private_mentoring_highlights`, and `private_mentoring_journey_steps` runtime/CMS objects after decoupling Shared Commerce from them. Historical migrations remain unchanged for migration provenance. The public Program UI follows the presentation established immediately before Phase 3 while injecting only the real database-backed catalog records where needed.

## 14 September 2026 Phase 3 Private Mentoring resolution

The approved Phase 3 implementation brief resolves the remaining Private Mentoring commercial and operational conflicts for this phase:

- The canonical Top Student three-session package total is **Rp885.000**, with **Rp950.000** as the reference price. The displayed **Rp295.000/session** value is derived at runtime from the package total divided by the session count and is not stored as commercial truth.
- The Private Mentoring purchase path is **WhatsApp consultation → admin creates an intended-mentee Cart Link from existing Commerce Items → the mentee claims the link into the existing Shared Commerce cart → the existing checkout/payment flow continues unchanged**.
- Private Mentoring exposes only the six approved seeded session focuses. A free-text/custom focus is not part of Phase 3.
- The website does not expose self-service mentor selection or self-service scheduling. After payment creates the entitlement, the mentee chooses the focus for each session; an admin assigns a mentor from the purchased mentor tier and schedules each session separately.
- Guidebook references to customer-selected mentor/schedule and Zoom are treated as marketing/source context rather than Phase 3 runtime requirements where they conflict with the approved implementation brief.

These decisions apply to Private Mentoring. Intensive Mentoring commercial naming/pricing is resolved separately by the 16 September 2026 decision above; guarantee/refund language remains blocked until separately approved.

## 14 September 2026 architecture update

The former generic Product Catalog Master has been retired from runtime architecture. Its 9 September migration and historical Superpowers documents remain provenance only. Pricing, bundle names, entitlements, and other commercial records from that legacy catalog are **not** copied into a new static or temporary source of truth during cleanup.

The unresolved items below still matter as stakeholder/source conflicts for future domain-owned implementations. Until a decision is recorded from an approved source, omit the affected production claim or keep the UI in an explicit unavailable/placeholder state.

## 11 September 2026 resolution update

The `Bahan FE 1` handoff resolved the earlier typography, palette, logo,
contact, social-proof wording, and mentor-roster gaps. The implementation uses
Poppins; `#FF7A00`, `#DC0D16`, `#B3151C`, `#FFE79D`, `#000000`, and `#FDFDFD`;
the supplied PNG logo family; `2500+ Siswa`, `15+ Universitas`, and `20+ Sekolah
Menengah Atas`; and all 26 spreadsheet mentor rows. It never calls institutions
partners and publishes no mentor ratings or internal workbook notes.

Still unresolved:

- guarantee/refund wording remains conditional and requires approved legal terms;
- Big Class is a sourced service overview only; no commercial detail was supplied;
- seven mentors have no linked photo; Navira, Fajri, M. Iqbal, and Lubna have cross-source name/tier/role differences recorded in the handoff receipt;
- country-count, partnership, institution-logo, and quantitative rating claims remain omitted.

The original audit table below is retained as historical provenance. Rows explicitly resolved above must not be treated as current blockers, and legacy Product Catalog values in the table must not be treated as an active runtime master.

These conflicts come from the September 2026 frontend content/asset audit. They are decisions for Strativate, not facts for developers to resolve.

| Topic | Repository/current implementation | Other supplied source | Required decision and guardrail | Priority |
| --- | --- | --- | --- | --- |
| Web typography | Poppins | Private and Intensive guidebooks use Poppins; proposal has no font specification | Resolved by 11 September handoff. | Resolved |
| Brand palette | Supplied palette is integrated | Guidebooks show a compatible red/orange/white family | Resolved by 11 September handoff. | Resolved |
| Logo and mark | Supplied PNG logo family integrated | Guidebooks visually show Strativate wordmark/mark | SVG master remains optional future improvement. | P2 |
| University claim and wording | `15+ Universitas` as student-origin proof | Guidebooks state `15+ Universitas` in a student-origin context, not partnership | Never infer partnership/“mitra” from attendee origin. | Guardrail |
| High-school claim | `20+ Sekolah Menengah Atas` | Guidebooks state `20+ SMA` | Keep origin wording, not partnership wording. | Guardrail |
| Country count | Omitted | No matching explicit primary claim was found | Keep omitted until approved. | P0 if used |
| `2.500+` audience label | `2500+ Siswa` | Guidebooks refer to students/mentees | Resolved by 11 September handoff. | Resolved |
| Private top-student three-session total | Domain-owned package is `Rp885.000` total with `Rp950.000` reference price; per-session display is derived only | Guidebook visual says `Rp885.000` while earlier stated per-session arithmetic conflicted | Resolved by the approved 14 September Phase 3 brief: total is authoritative and `Rp295.000/session` is runtime-derived. | Resolved |
| Private/Intensive wording | Private Mentoring and Intensive Mentoring marketing/editorial content remain source-owned; both programs use domain-owned catalog data where explicitly approved | Guidebooks contain source concepts with some different wording | Preserve static editorial ownership; Intensive commercial catalog is resolved by the 16 September request. | Resolved/P1 |
| Private CTA/fulfilment flow | WhatsApp consultation → intended-mentee generic Cart Link → Shared Commerce cart/checkout | Guidebook/proposal context includes consultation and mentor/schedule marketing language | Resolved by the approved 14 September Phase 3 brief; no public direct-buy, self-service mentor, or self-service schedule flow. | Resolved |
| Intensive bundle 1 name | Domain-owned Intensive catalog uses `Skill Builder` | Guidebook: `Skill Builder`; legacy catalog used a localized name | Resolved by 16 September requester approval. | Resolved |
| Other Intensive bundle names | Domain-owned catalog uses `Competition Ready`; `Competition Assurance` exists inactive pending legal guarantee approval | Guidebook: `Competition Ready`, `Competition Assurance`; legacy catalog used localized names | Naming/pricing resolved by 16 September request; guarantee-dependent public activation remains blocked. | Resolved/P0 legal |
| Guarantee/refund language | Guarantee-dependent records may exist inactive but are not published as active commercial entitlements | Guidebook describes Win Guarantee Protection and mentions refund or credit | Require written business and legal approval before active marketing/commerce or refund/credit wording. | P0/P1 |
| Big Class | Public service overview only | No Big Class guidebook/source was provided; proposal includes Big Class in MVP scope | Treat class, price, cohort, capacity, outcome, and certificate details as unavailable until a production master/domain exists. | P0 |
| Case guide product price | No current runtime product price from the retired catalog; Digital Product domain owns approved records | Prior demo/catalog values conflicted and no supplied product pricing source exists | Enter only approved Digital Product facts in its domain. | P0 |
| Presentation kit name/price | No approved runtime price/name beyond the Digital Product domain | Prior demo/catalog values conflicted; no supplied product source | Confirm final name, format, description, and price before publication. | P0 |
| Competition workbook catalog status | No approved runtime product record | Prior demo content included it; no supplied product source | Confirm whether it exists and its final details before publication. | P0 |
| Mentor identities and proof | Public runtime now uses the database-backed mentor public-profile domain seeded from the approved 26-row workbook/handoff roster; no ratings. Legacy rows remain deliberately unlinked to authenticated mentor accounts until ownership is explicitly known. | Earlier demo identities/ratings were not production data | Continue using approved profile facts only; never infer account ownership; ratings only if real system data exists. | Guardrail |
| Brand/hero quote | Current public copy follows approved handoff | Earlier finalist/win framing lacked approved production proof | Do not reintroduce unsupported factual badges/claims. | Guardrail |
| Contact master | Approved public contact record is centralized | Guidebooks also show phone/email/site/social context | Keep the centralized record synchronized with approved updates. | P1 |
| SEO metadata | Current canonical domain and metadata are implemented; final campaign OG copy may evolve | Guidebooks/proposal provide no complete SEO master | Keep factual metadata source-backed. | P1 |
| Institution logo use | No approved logo system for public proof | Guidebook visuals may show institutions, but attendance does not establish partnership | Confirm rights and wording before use. | P1/P0 for partnership claim |

## How to resolve an entry

Record the approving source, date, final value/wording, and responsible stakeholder in the relevant domain/content master or pull request. Then update this file by moving the resolved item to a dated decision record or clearly marking it resolved; also update [`asset-status.md`](asset-status.md), source data, and tests.
