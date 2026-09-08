# Strativate asset and content status registry

Update this registry whenever Strativate supplies or approves an item. `Missing`
and `Demo only` entries must not be presented as production facts. Paths below
are intended final locations; temporary files belong under
`public/assets/placeholders/` and should also be represented by the typed asset
registry once it exists.

| Asset/content | Status | Expected source | Current fallback | Expected final file or record | Used in | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Primary horizontal logo | Missing — `REQUIRED` | Strativate SVG master + transparent PNG | CSS/text development placeholder | `public/assets/brand/strativate-logo-primary.svg` | Header, footer, auth, dashboards | P0 |
| Logo mark | Missing — `REQUIRED` | Strativate SVG master | CSS `S` development placeholder/generic icons | `public/assets/brand/strativate-logo-mark.svg` | Mobile header, favicon, sidebars, OG | P0 |
| Light/dark logo variants | `CONFIRMATION REQUIRED` | Strativate brand package | None | `public/assets/brand/strativate-logo-{light,dark}.svg` if official | Dark/light surfaces | P1 |
| Brand typography decision | `CONFIRMATION REQUIRED` | Written stakeholder approval | Plus Jakarta Sans in app; Poppins in guidebooks | Approved font name/license source in registry/docs | All UI | P0 |
| Brand color decision | `CONFIRMATION REQUIRED` | Official palette or written approval | Current orange/red/yellow/navy/off-white web palette | Approved token values | All UI | P0 |
| Favicon and Apple icon | Waiting on final mark — `REQUIRED` | Developer derivative of approved mark | Generic repository icons | `public/assets/brand/favicon.*`, `apple-touch-icon.png` | Metadata/browser UI | P1 |
| Mentor production roster | Missing — `REQUIRED` | Approved sheet/CSV/content master | Hardcoded demo names | Structured records keyed by stable mentor ID | Home, mentor directory, admin | P0 |
| Mentor portrait | Missing — `REQUIRED` | Original JPG/PNG + rights, ideally 1200×1200+ | Branded non-person placeholder | `public/assets/mentors/<mentor-id>/portrait.*` | Hero slot, cards, profile, dashboards | P0 |
| Mentor credentials and bio | Missing — `REQUIRED` / confirmation mixed | Approved mentor content master | Demo roles/universities/wins/ratings | Structured mentor records | Public mentor surfaces | P0 |
| Mentor publication consent | `CONFIRMATION REQUIRED` | Written stakeholder/mentor confirmation | No production assumption | Consent field/internal record | Public mentor surfaces | P0 |
| Homepage social-proof master | Missing — `REQUIRED` | Approved values, exact wording, and context | Unsupported/demo statistics should be omitted or labeled | Structured claim records | Hero/trust/achievement sections | P0 |
| Private Mentoring master approval | `CONFIRMATION REQUIRED` | Approved pricing/copy/CTA flow | Current guidebook-derived content | Approved content source record | Home, Explore, program detail | P0 |
| Intensive Mentoring master approval | `CONFIRMATION REQUIRED` | Approved packages/add-ons/bundles/copy | Current guidebook-derived content | Approved content source record | Home, Explore, program detail | P0 |
| Guarantee terms | Missing approval — `CONFIRMATION REQUIRED` | Business + legal approval | Conditional guidebook-derived copy | Approved policy/terms record | Intensive program detail | P0/P1 |
| Big Class content master | Missing — `REQUIRED`; source not provided | Approved cohort/program sheet | Conflicting demo classes | Structured Big Class records | Home, catalog, detail, admin, dashboard | P0 |
| Big Class cover | Conditional | Strativate master or approved developer composition | Branded aspect-ratio placeholder | `public/assets/programs/big-class/<program-id>/cover.*` | Catalog/detail/dashboard if visual | P1 |
| Digital Product master | Missing — `REQUIRED` | Approved product sheet | Conflicting demo products/prices | Structured product records | Home, catalog, admin, library | P0 |
| Digital Product cover | Missing — `REQUIRED` | Portrait master, ideally 1600×2400+ | Branded product placeholder | `public/assets/products/<product-id>/cover.*` | Home, catalog, library | P0 |
| Digital Product actual file | Missing — `REQUIRED` | Final PDF/PPTX/XLSX/ZIP/video/etc. | None | Controlled storage path + version record | Product delivery/library | P0 |
| Resource-library files | Missing/conditional on MVP | Final resource masters | None/demo listings | Controlled storage paths + access records | Mentee library | P0/P1 |
| Achievement image/certificate | Recommended if section is used | Original high-resolution file + rights | Neutral achievement slot | `public/assets/achievements/<achievement-id>/image.*` | Marketing/social proof | P1 |
| Achievement caption | Missing — required if used | Exact event/result/round/year/team metadata | None | Structured achievement record | Marketing/social proof | P1 |
| Testimonial master | Recommended | Approved quote, identity, context, consent | Omit section/neutral empty state | Structured testimonial record | Marketing pages | P1 |
| Testimonial portrait | Recommended if displayed | Original photo + consent | Branded portrait placeholder | `public/assets/testimonials/<testimonial-id>/portrait.*` | Testimonial cards | P1 |
| Institution logo | `CONFIRMATION REQUIRED` if displayed | Official SVG/transparent PNG + approved label | Text only/no logo | `public/assets/institutions/<institution-id>/logo.*` | Approved social-proof sections | P1 |
| Competition/student photography | Recommended | Curated original images + rights | CSS composition/neutral media slot | `public/assets/achievements/` or approved campaign folder | Achievement/storytelling sections | P1 |
| Contact and social master | Missing approval — `REQUIRED` | Approved WA, email, canonical domain, exact social URLs | Current source values are unconfirmed | Structured contact record | Header, footer, contact, program detail | P1 |
| About/company copy | Missing approval — `REQUIRED` | Official short description/story/legal name | Generic current copy | Approved content record | Home/About | P1 |
| FAQ master | Missing approval — `REQUIRED` | Policy-aligned Q&A | Generic current copy | Approved content record | FAQ | P1 |
| Legal documents | Missing — `REQUIRED` | Stakeholder/legal counsel | No final legal copy | Privacy, terms, refund, cancellation/reschedule, product and guarantee terms | Footer/legal routes | P1 |
| Default Open Graph image | Reserved; waiting on brand approval | Developer composition from approved brand assets | No fake final OG art | `public/assets/brand/og-default.png` (1200×630) | Social sharing metadata | P1 |
| Default user avatar | Developer-owned | Neutral generated fallback | Existing generic placeholder/initials | `public/assets/placeholders/avatar-default.*` | Authenticated UI only | P2 |

## Update procedure

1. Verify the file or decision comes from an approved source and has publication
   rights where relevant.
2. Resolve any matching entry in [`source-conflicts.md`](source-conflicts.md) in
   writing before changing factual public content.
3. Place final media in its semantic production folder; keep development
   fallbacks under `public/assets/placeholders/`.
4. Update the typed asset registry, alt text, status, and this table together.
5. Verify responsive rendering and metadata, then obtain factual review on
   staging before go-live.
