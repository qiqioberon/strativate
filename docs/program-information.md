# Program information — guidebook integration

The public Private Mentoring and Intensive Mentoring pages use the English guidebooks supplied by the project owner on 7 September 2026. This change publishes program information; it does not implement enrollment, scheduling, payments, mentor assignment, or program administration.

## Content sources

| Content | Guidebook and pages |
| --- | --- |
| Private overview and two learning paths | Private Mentoring Guidebook (English) (2), pp. 5–7 |
| Private topics, session journey, and benefits | Private guidebook, pp. 8–10 |
| Private pricing, 75-minute sessions, individual/team of 1–4 | Private guidebook, pp. 11–12 |
| Mentor tier descriptions | Private guidebook, pp. 13–14 |
| Intensive overview, audience, benefits, and journey | Intensive Program Guidebook (English), pp. 5–10 |
| Intensive / Super Intensive / international options | Intensive guidebook, p. 11 |
| Intensive add-ons and bundles | Intensive guidebook, pp. 12–13 |
| Supported competition categories | Both guidebooks, p. 4 |
| Contact information | Intensive p. 19; Private p. 18 |

The original PDFs remain outside the repository. Their content is presented as web text, cards, and tables; no large PDF downloads or embedded PDF viewers are added.

## Pricing decisions

- **Owner correction:** Top Student Mentor, 3 sessions, costs **Rp855.000** total at **Rp285.000 per session**. The original PDF's Rp885.000 total is superseded by the owner's clarification.
- Private totals are calculated from each package's session count and published per-session rate. Both mentor tiers offer 1, 3, 5, 7, and 10 sessions.
- Private crossed-out prices and savings labels are omitted because the original 3-session reference price is also inconsistent. No new discount promises are introduced.
- The Private starting price refers to the 1-session package, not the discounted per-session rate of a larger package.
- Intensive and Super Intensive retain the guidebook's listed package prices, session counts, and normal prices. International competition pricing remains consultation-based.
- Add-ons and bundles are informational. Win Guarantee Protection and the Competition Assurance Bundle both show the guidebook's conditions and eligibility caveat; no automatic win or unconditional refund is promised.
- No promotional expiry date or current seat availability is inferred from the guidebooks.

## Implementation and routing

`lib/program-information.ts` owns the shared mentoring content used by homepage program cards/overview, `lib/catalog.ts`, and the detail pages. Public detail routes are `/program/private-mentoring` and `/program/intensive-mentoring`.

Old program URLs resolve as follows:

| Previous slug | Canonical slug |
| --- | --- |
| `brandstorm-coaching`, `portfolio-direction` | `private-mentoring` |
| `business-case-intensive`, `interview-intensive` | `intensive-mentoring` |

The exact legacy and canonical `/checkout/<slug>` routes redirect to their public program pages before the authentication guard. This keeps bookmarked links out of the demo purchase flow. Other checkout routes retain their existing authentication requirement. Program CTAs lead to details or an on-page package section. Browsing prices does not write orders, credits, or enrollments.

Big Class, Digital Products, the existing mentor directory, and unrelated dashboard/demo content are outside this guidebook update. No database migration or new environment variable is required.

## Verification

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm exec playwright test --workers 3`.

The program browser suite checks homepage navigation, the corrected private price, intensive packages and conditions, category filtering, legacy/public checkout redirects, absence of purchase controls on the two program pages, and mobile overflow. Existing auth browser tests cover the protected routes that remain unchanged.
