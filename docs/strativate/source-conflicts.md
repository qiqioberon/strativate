# Strativate source conflict register

## 14 September 2026 Phase 3 Private Mentoring resolution

The approved Phase 3 implementation brief resolves the remaining Private Mentoring commercial and operational conflicts for this phase:

- The canonical Top Student three-session package total is **Rp885.000**, with **Rp950.000** as the reference price. The displayed **Rp295.000/session** value is derived at runtime from the package total divided by the session count and is not stored as commercial truth.
- The Private Mentoring purchase path is **WhatsApp consultation → admin creates an intended-mentee Cart Link from existing Commerce Items → the mentee claims the link into the existing Shared Commerce cart → the existing checkout/payment flow continues unchanged**.
- Private Mentoring exposes only the six approved seeded session focuses. A free-text/custom focus is not part of Phase 3.
- The website does not expose self-service mentor selection or self-service scheduling. After payment creates the entitlement, the mentee chooses the focus for each session; an admin assigns a mentor from the purchased mentor tier and schedules each session separately.
- Guidebook references to customer-selected mentor/schedule and Zoom are treated as marketing/source context rather than Phase 3 runtime requirements where they conflict with the approved implementation brief.

These decisions apply to Private Mentoring only. Intensive Mentoring bundle naming, guarantee/refund wording, and other unresolved domains below remain blocked until separately approved.

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

- localized Intensive Mentoring bundle names conflict with guidebook English labels and require a future owner-approved domain decision;
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
| Private/Intensive wording | Private Mentoring is domain-owned; Intensive Mentoring remains approved static editorial information | Guidebooks contain source concepts with some different wording | Private Mentoring follows the approved Phase 3 brief; approve Intensive commercial entitlements separately. | Resolved/P1 |
| Private CTA/fulfilment flow | WhatsApp consultation → intended-mentee generic Cart Link → Shared Commerce cart/checkout | Guidebook/proposal context includes consultation and mentor/schedule marketing language | Resolved by the approved 14 September Phase 3 brief; no public direct-buy, self-service mentor, or self-service schedule flow. | Resolved |
| Intensive bundle 1 name | No current runtime bundle after legacy catalog removal | Guidebook: `Skill Builder`; legacy catalog used a localized name | Approve future domain-owned name and positioning. | P0 |
| Other Intensive bundle names | No current runtime bundles after legacy catalog removal | Guidebook: `Competition Ready`, `Competition Assurance`; legacy catalog used localized names | Approve final localization, especially any guarantee implication. | P0 |
| Guarantee/refund language | Not published as an active commercial entitlement | Guidebook describes Win Guarantee Protection and mentions refund or credit | Require written business and legal approval before marketing or commerce. | P0/P1 |
| Big Class | Public service overview only | No Big Class guidebook/source was provided; proposal includes Big Class in MVP scope | Treat class, price, cohort, capacity, outcome, and certificate details as unavailable until a production master/domain exists. | P0 |
| Case guide product price | No current runtime product price from the retired catalog; Digital Product domain owns approved records | Prior demo/catalog values conflicted and no supplied product pricing source exists | Enter only approved Digital Product facts in its domain. | P0 |
| Presentation kit name/price | No approved runtime price/name beyond the Digital Product domain | Prior demo/catalog values conflicted; no supplied product source | Confirm final name, format, description, and price before publication. | P0 |
| Competition workbook catalog status | No approved runtime product record | Prior demo content included it; no supplied product source | Confirm whether it exists and its final details before publication. | P0 |
| Mentor identities and proof | Public roster uses supplied workbook/handoff data; no ratings | Earlier demo identities/ratings were not production data | Continue using approved roster sources; ratings only if real system data exists. | Guardrail |
| Brand/hero quote | Current public copy follows approved handoff | Earlier finalist/win framing lacked approved production proof | Do not reintroduce unsupported factual badges/claims. | Guardrail |
| Contact master | Approved public contact record is centralized | Guidebooks also show phone/email/site/social context | Keep the centralized record synchronized with approved updates. | P1 |
| SEO metadata | Current canonical domain and metadata are implemented; final campaign OG copy may evolve | Guidebooks/proposal provide no complete SEO master | Keep factual metadata source-backed. | P1 |
| Institution logo use | No approved logo system for public proof | Guidebook visuals may show institutions, but attendance does not establish partnership | Confirm rights and wording before use. | P1/P0 for partnership claim |

## How to resolve an entry

Record the approving source, date, final value/wording, and responsible stakeholder in the relevant domain/content master or pull request. Then update this file by moving the resolved item to a dated decision record or clearly marking it resolved; also update [`asset-status.md`](asset-status.md), source data, and tests.
