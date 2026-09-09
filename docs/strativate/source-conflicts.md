# Strativate unresolved source conflicts

These conflicts come from the September 2026 frontend content/asset audit. They
are decisions for Strativate, not facts for developers to resolve. Until a
decision is recorded from an approved source, omit the affected claim where
possible or keep it explicitly marked as development/demo content.

| Topic | Repository/current implementation | Other supplied source | Required decision and guardrail | Priority |
| --- | --- | --- | --- | --- |
| Web typography | Plus Jakarta Sans | Private and Intensive guidebooks use Poppins; proposal has no font specification | Approve the final web font. Keep it configurable; do not switch by taste or distribute unlicensed font files. | P0 |
| Brand palette | CSS uses `#FF6B00`, `#B91C1C`, `#FFC247`, `#27364A`, `#FFF9F3` | Guidebooks show a red/orange/white family without exact codes; proposal has no palette | Approve the current web palette or supply official values. | P0 |
| Logo and mark | CSS `S`, generic `icon.svg`, and placeholder logos | Guidebooks visually show a Strativate wordmark/mark but do not provide a production master | Obtain original logo SVG/PNG and do not extract the PDF artwork or call the CSS mark final. | P0 |
| University claim and wording | `14+ Universitas mitra` | Guidebooks state `15+ Universitas` in a student-origin context, not partnership | Stakeholder must confirm the number and wording. Never infer partnership/“mitra” from attendee origin. | P0 |
| High-school claim | Not shown in the homepage trust bar | Guidebooks state `20+ SMA` | Confirm the current number and approved wording before use. | P0 if used |
| Country count | Homepage says `3` countries; hero says `di 4 negara` | No matching explicit primary claim was found in the supplied guidebook text | Confirm one exact, supportable claim or remove both. | P0 |
| `2.500+` audience label | Homepage says participants/peserta | Guidebooks refer to students/mentees | Confirm the current value and whether the approved label is siswa, mentee, or peserta. | P0 |
| `100% mendukung ambisimu` | Presented visually as a statistic | Not sourced as a measurable guidebook claim | Approve as marketing copy and redesign so it is not mistaken for a measured statistic, or remove it. | P0 |
| Private top-student three-session total | Repository calculates and tests `Rp855.000`, with a note describing an owner correction; rate shown is `Rp285.000/sesi` | Guidebook visual says `Rp885.000`, which conflicts with the per-session arithmetic | The PDF explicitly leaves this as `STAKEHOLDER DECISION REQUIRED`. Record one final master price in writing before production content freeze. | P0 |
| Private/Intensive wording | Repository uses localized/rephrased positioning, paths, journeys, benefits, tier names, and competition labels | Guidebooks contain the source concepts with different wording | Approve final Indonesian public copy and exact entitlements; alignment in intent is not final approval. | P0/P1 |
| Private CTA/fulfilment flow | Program page exposes information and contact details; legacy checkout URLs redirect to information pages | Proposal/guidebook context suggests consultation/WhatsApp for mentoring | Confirm the intended consultation, enquiry, or purchase route before final CTA wording. | P0 |
| Intensive bundle 1 name | `Paket Rintisan Tim` | Guidebook: `Skill Builder` | Approve final name and positioning. | P0 |
| Other Intensive bundle names | `Paket Siap Kompetisi`, `Paket Jaminan Kompetisi` | Guidebook: `Competition Ready`, `Competition Assurance` | Approve final localization, especially any guarantee implication. | P0 |
| Guarantee/refund language | `Perlindungan Jaminan Kemenangan` with conditions | Guidebook describes Win Guarantee Protection and mentions refund or credit; proposal does not define policy | Require written business and legal approval for eligibility, target, remedy, and terms before marketing. | P0/P1 |
| Big Class | `Laboratorium Kepemimpinan` (Rp450.000), `Landasan Karier` (Rp550.000), plus a separate demo `Kelas Besar Kasus Bisnis` | No Big Class guidebook/source was provided; proposal only includes Big Class in MVP scope | Treat every current class, price, cohort date, seat count, outcome, and certificate statement as demo until a production master arrives. | P0 |
| Case guide product price | Homepage/admin/demo: `Rp79.000` | Catalog: `Rp99.000`; no supplied product pricing source | Stakeholder must supply the production product master and final price. | P0 |
| Presentation kit name/price | Homepage/admin: business presentation starter at `Rp59.000` | Catalog: `Paket Awal Materi Presentasi` at `Rp79.000`; no supplied product source | Confirm final name, format, description, and price. | P0 |
| Competition workbook catalog status | Homepage/admin include `Buku Latihan Persiapan Kompetisi` at `Rp89.000` | Catalog omits it; no supplied product source | Confirm whether it exists, its final details, and whether it is active. | P0 |
| Mentor identities and proof | Homepage/directory hardcode Alvin Haryanto, Nadia Prameswari, Raka Adhitama, Dita Maharani, ratings, universities, and wins | PDF states these are not production data; guidebook roster/media cannot be assumed complete or approved for web | Replace with a production roster, factual metadata, photos, active/program status, and publication consent. Ratings only if real system data exists. | P0 |
| Brand/hero quote | Homepage says “Dibangun oleh para juara …” and uses finalist/win badges | Factual framing and badge data are not approved production claims | Approve the claim and exact wording or use non-factual visual language. | P0/P1 |
| Contact master | Repository/program detail includes `+62 851-8775-4671` and `strativateid@gmail.com`; footer is incomplete | Guidebooks also show phone/email/site/social context | Confirm final public number, click-to-chat URL, support email, `strativate.id` canonical domain, and exact social URLs. | P1 |
| SEO metadata | Repository hardcodes title/description and `generator: v0.app`; no final OG image | Guidebooks/proposal provide no SEO master | Approve title, meta description, canonical domain, and default OG message; remove the v0 generator for production. | P1 |
| Institution logo use | No approved logo system for public proof | Guidebook visuals may show institutions, but attendance does not establish partnership | Confirm which logos may appear, rights/source files, and whether wording denotes origin or formal partnership. | P1/P0 for partnership claim |

## How to resolve an entry

Record the approving source, date, final value/wording, and responsible
stakeholder in the relevant content master or pull request. Then update this file
by moving the resolved item to a dated decision record or clearly marking it
resolved; also update [`asset-status.md`](asset-status.md), source data, and tests.
