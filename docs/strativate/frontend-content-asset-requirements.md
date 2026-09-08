# Strativate frontend content and asset requirements

This is the durable engineering reference derived from the 27-page
`Strativate_Frontend_Content_Asset_Requirements.pdf` dated September 2026. It
summarizes the document without treating the PDF's embedded images as production
assets. The PDF itself audited the repository plus the Private Mentoring and
Intensive Program guidebooks and the website/platform proposal.

## Source and decision rules

- Treat approved stakeholder source files and written content decisions as the
  source of truth for public facts, pricing, credentials, claims, policies, and
  brand use.
- The PDF and guidebooks are references, not permission to extract screenshots,
  logos, portraits, certificates, or other embedded media for production.
- If repository data, proposal copy, or guidebooks disagree, preserve the
  conflict in [`source-conflicts.md`](source-conflicts.md). Do not pick a value by
  inference or arithmetic.
- Existing hardcoded mentor, dashboard, order, schedule, revenue, Big Class, and
  Digital Product values are demo data unless an approved source explicitly
  confirms them.
- Track incoming assets and approvals in [`asset-status.md`](asset-status.md) and
  in the typed frontend asset registry once present.

Status terms used in the source document:

| Status | Meaning |
| --- | --- |
| `REQUIRED` | Needed for the corresponding production page or feature. |
| `CONFIRMATION REQUIRED` | Material may exist, but its final value, accuracy, rights, or use needs approval. |
| `OPTIONAL / RECOMMENDED` | Improves presentation but does not block the MVP. |
| `FUTURE` | Outside the present MVP requirement. |

| Priority | Meaning |
| --- | --- |
| `P0` | Production blocker or high misinformation risk. |
| `P1` | Required before go-live. |
| `P2` | Enhancement that may follow after launch. |

## Brand

- **Primary wordmark and logo mark — REQUIRED, P0.** Obtain original SVG masters
  plus transparent PNG exports. Request official light/dark variants only if
  they exist. A horizontal wordmark is required; stacked and monochrome versions
  are optional P2.
- **Current CSS `S` and files under the old generic placeholder set are not final
  branding.** Keep any interim mark explicitly identified as a development
  placeholder.
- **Typography — CONFIRMATION REQUIRED, P0.** The guidebooks use Poppins while
  the application uses Plus Jakarta Sans. Keep the web font configurable and do
  not silently switch or ship unlicensed font files.
- **Color palette — CONFIRMATION REQUIRED, P0.** The current web palette
  (`#FF6B00`, `#B91C1C`, `#FFC247`, `#27364A`, `#FFF9F3`) is a proposal until
  approved or replaced by official values.
- Button radius and broader component styling are developer-owned design choices
  subject to stakeholder art-direction approval (P1). The guidebook's 3D visual
  language is optional P2, not a required web icon system; functional UI icons
  may continue using Lucide.
- Establish a consistent mentor-photography direction before launch (P1).

## Homepage and marketing navigation

- Header requires the final logo plus approved navigation wording and URLs (P0).
- A CSS/card hero is acceptable for MVP. Real hero photography is not a blocker.
  If factual badges or mentor details appear, their data must be approved. This
  iteration deliberately uses a no-real-photo, placeholder-ready direction.
- Hero CTA wording and destinations require approval before go-live (P1).
- Social-proof values and labels require a final approved claim master (P0).
  Until then, do not prominently publish `2.500+`, `14+`, `15+`, partner/mitra
  language, `3` or `4` countries, or `100%` as verified statistics.
- Private and Intensive program previews may use the centralized program source,
  subject to final factual and pricing approval. Big Class needs its own approved
  production master before factual cards or pricing can be published.
- Mentor previews need the production roster, profiles, publication consent, and
  original photos (P0). Ratings are optional and appear only when backed by real
  system data.
- The current brand quote and “built by champions” framing require factual/copy
  approval (P1).
- Digital Product previews require an approved product master and final covers
  (P0). Do not reuse conflicting homepage/catalog/admin demo products as facts.
- About copy and FAQ answers require stakeholder approval (P1), especially where
  business policy or claims are involved.
- Footer requires final public contact/social URLs and copyright wording (P1).

## Mentor data and photography

Required P0 fields per production mentor:

- full name;
- current public title/role;
- expertise and competition expertise/categories;
- short factual bio;
- active/inactive status and eligible programs;
- publication consent;
- original profile photo.

Achievements or win claims are `CONFIRMATION REQUIRED` P0. University/education,
company/employer, judging experience, mentoring experience, and language are P1
confirmation/recommended fields. Long bio and social profile links are optional
P2. Availability is backend/user-managed, not marketing content. Rating is P2 and
must only appear if actual system data exists.

Photo handoff: request the best original JPG/PNG, ideally at least 1200×1200 for
a square-capable composition or 1200×1600 for portrait. Faces should be clear,
with usable headroom and consistent lighting. Strativate supplies the original,
correct identity/profile metadata, rights, and consent; developers create crops,
responsive sizes, WebP/AVIF derivatives, compression, filenames, and alt text.

## Social proof, achievements, and institutions

- Claims need exact approved values, wording, and context. Internal proof can be
  retained where appropriate but must not be invented by developers.
- Achievement items need competition name, placement/finalist status, round,
  year/date, subject/team where displayed, publication rights, and the selected
  original photo/certificate. Use exact captions; never infer missing metadata.
- Institution logos are P1 only if the approved design displays them. Request
  official SVG or transparent PNG sources and final institution names.
- Never describe an institution as a partner or “mitra” merely because a learner
  came from it. Prefer an approved formulation such as “Mentee berasal dari …”.
  A formal partnership section requires explicit P0 confirmation.
- Onboarding institution search does not require logos.

## Programs

### Private Mentoring

The repository and guidebook broadly align on flexible 75-minute sessions,
individual/team participation for 1–4 people, mentor tiers, learning paths,
topics, and most package rates. All factual copy and the consultation/CTA flow
still require approval. The three-session top-student total remains an explicit
source conflict; see [`source-conflicts.md`](source-conflicts.md).

### Intensive Mentoring

The repository and guidebook broadly align on the 4-session and 8-session
packages, international consultation, add-ons, and most pricing. Journey wording,
bundle names, and competition-category labels need approval. Any win-guarantee or
refund/credit language requires written business and legal approval.

### Big Class

No production source material was supplied. Current examples are demo-only. A P0
master needs: program/cohort name, positioning, description, outcomes, target
audience, instructor if shown, cohort dates if applicable, schedule, duration,
session count, and price. Registration status/capacity, syllabus, materials,
certificate terms, and a cover are P1 when the UI exposes them. Do not publish
`Laboratorium Kepemimpinan`, `Landasan Karier`, or `Kelas Besar Kasus Bisnis` as
final programs without approval.

## Digital Products and resource library

Each production product needs a P0 master containing name, type, short/long
description, price, access policy, final downloadable/viewable file, and final
cover. Include author/creator, version, release date, sample, rights, and program
association when relevant. The recommended portrait cover master is at least
1600×2400, or an editable/vector source. Developers may derive catalog thumbnails
and responsive formats.

Resource-library items need a title, category/type, actual file, program
association, and visibility/access rules. Cover/thumbnail is required only when
the final UI uses visual cards; description is recommended and version/preview
are optional. Operational dashboard icons, charts, statuses, and default user
avatars remain developer-owned.

## Testimonials

Testimonials are P1 recommended launch content. Require the approved quote,
publishable person/team name, relevant institution/program/competition/context,
original photo if displayed, and consent for both quote and image. Missing
identity or achievement details in a guidebook must stay missing rather than be
guessed.

## Contact, SEO, metadata, and legal

- Confirm the public WhatsApp number and click-to-chat URL, business/support
  email, canonical domain, Instagram URL/handle, and any other social channel
  actually intended for display (P1). The phone, Gmail address, and
  `strativate.id` visible in current sources are not automatically final.
- Website title, meta description, and default Open Graph message need approval
  (P1). Developers derive favicon/Apple icons from the final mark and may compose
  a 1200×630 default OG image from approved brand assets. Program-specific OG
  images are optional/future.
- Remove `generator: v0.app` from production metadata.
- Privacy Policy, Terms and Conditions, refund policy,
  cancellation/rescheduling policy, Digital Product terms, and guarantee terms
  are stakeholder-provided/approved P1 legal content. Developers implement the
  pages and links but do not author legal promises.

## Placeholder and asset-slot rules

- Keep temporary frontend files only in `public/assets/placeholders/`, never in
  final brand/mentor/program/product folders.
- Stable semantic registry keys should represent the role of an asset, not its
  temporary filename: e.g. `brand.logo.primary`, `brand.logo.mark`,
  `mentors.<id>.portrait`, `programs.private.cover`,
  `programs.intensive.cover`, `programs.bigClass.cover`,
  `products.<id>.cover`, `achievements.<id>.image`, and
  `institutions.<id>.logo`.
- Every tracked slot should record path/source, placeholder state, status, alt
  text, priority, usage, and notes. Final delivery should usually mean replacing
  a file or registry value rather than restructuring components.
- Preserve aspect ratio and dimensions to prevent layout shift. A small reusable
  media-slot component may render `next/image` for available assets and a branded
  fallback otherwise.
- Reserve slots for the primary logo, logo mark, mentor portraits, Big Class
  cover, Digital Product covers, achievements, testimonial portraits,
  institution logos, and default OG configuration. Do not generate fake “final”
  assets or use PDF screenshots.

Suggested production folders once assets arrive:

```text
public/assets/
├── brand/
├── mentors/
├── programs/
├── products/
├── achievements/
├── institutions/
└── placeholders/
```

Use descriptive filenames such as `mentor-navira-apriliani.jpg` and
`strativate-logo-primary.svg`, not camera export names or “final-final” variants.

## Responsibility split

Strativate provides approved brand masters, high-quality original media,
publication rights, factual metadata/captions, pricing/claims/credentials, and
program/product/content masters. Developers handle crop, optimization,
responsive derivatives, compression, `next/image`, filenames, alt text based on
approved context, favicon/OG derivatives, neutral fallback states, and Lucide UI
icons. Do not request user avatars, real dashboard records, secrets, duplicate
exports, PDF screenshots, or compressed social-media copies when originals
exist.

## Priority summary

### P0 — production blockers

- final logo package, font decision, and color decision;
- production mentor roster, factual profiles, photos, active/program status, and
  publication consent;
- approved Private/Intensive content, pricing, package/add-on/bundle names, and
  sensitive guarantee wording;
- final social-proof values/wording;
- Big Class production master;
- Digital Product master, covers, and actual files;
- removal or isolation of public dummy mentors, ratings, wins, institutions,
  social proof, products, and operational demo data.

### P1 — required before go-live

- final contact/social/canonical-domain master;
- About, FAQ, CTA, brand quote, and factual marketing-copy approval;
- selected testimonials and achievement captions/media if used;
- institution-logo and institution-wording approval if shown;
- legal/policy content;
- website title, meta description, favicon/Apple icons, and default OG image;
- consistent photography direction and conditional Big Class/resource covers.

### P2 — later enhancements

- additional lifestyle/student/founder photography;
- stacked/monochrome logo variants if needed;
- custom illustration/iconography and secondary decorative artwork;
- program-specific OG images, campaign banners, motion assets, and advanced
  testimonial/video media.
