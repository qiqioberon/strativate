# Admin dashboard and payment receipt UI audit

Audit performed on 15–16 October 2026 against `main`.

## Implemented changes

- Mentoring Sessions: removed the redundant analytics backlink and permanent
  Intensive Refresh button. Initial loading, operational invalidation, mutation
  reloads, URL navigation, keyboard tabs, and analytics parameters remain intact.
  Failed catalog, enrollment, session, and engagement loads have explicit retry
  actions. Filters respond to panel width; tables have readable email wrapping,
  balanced columns, and mobile cards. Counts use “engagements”.
- Mentoring dialogs: constrained the workspace grid and header text so long
  identities cannot push the close control or session actions outside a 320px
  dialog. On short screens, the Intensive summary scrolls independently to leave
  session controls reachable.
- Overview: added restrained tinted metrics and semantic icons, consistent section
  headings, descriptive quick actions, and a recent-orders section. Large amounts
  wrap at numeric group boundaries and remain exposed to assistive technology.
  Loading and failed reports do not display fabricated zero totals.
- Overview periods: All Time remains the default; Today, Last 7 Days, and Last 30
  Days use inclusive WIB business dates with an exclusive next-midnight boundary.
  Revenue, order metrics, chart data, and recent orders share the same range.
  Operational user/mentor counts remain global, and session counts explicitly
  identify the Private Mentoring scope returned by the existing SQL. The daily
  chart retains the existing UTC buckets and labels them accordingly; commerce
  attribution remains purchase date, rather than changing to payment recognition.
- Revenue chart: added a value scale, order-count labels, focus/hover details, a
  meaningful empty state, and contained scrolling. Zero revenue has a zero-height
  bar. Overlapping report and order-detail responses cannot replace newer data.
- Receipt preview: enlarged the viewport-aware dialog, clarified its header and
  footer, and added a bilingual Open in New Tab action using the existing
  authenticated receipt endpoint. Download filenames and behavior are preserved.
  Nested Escape, focus restoration, background scroll locking, and error retries
  were exercised. Browser-native PDF controls are unchanged.
- PDF receipt: bundled licensed Poppins Semibold alongside Regular, with registry,
  asset-status, and deployment tracing updates. Added a branded paid header,
  compact customer/transaction columns, measured item columns, prominent totals,
  secondary payment references, continuation headings, and page numbering. The
  existing factual disclaimer remains. Canonical totals and validation are
  unchanged; indivisible historical unit amounts use an exact subtotal/quantity
  expression rather than inventing a rounded amount.
- Other Admin UI: corrected desktop flex bases becoming 260px/360px-tall mobile
  search fields in Mentors and Cart Link History. Existing visual fixtures now
  import the production global styles in the same order.

## Environment and evidence

Playwright used Chrome and the repository's existing local fixture, which renders
the actual dashboard components with an isolated account and synthetic responses.
No production business records were changed. Audit-only font and screen-reader
utility styles repaired fixture parity; these were not added to product flows.
Screenshots, scripts, PDFs, and layout measurements are outside Git under
`%TEMP%/strativate-admin-audit/`.

The attachment exposed only the pasted written brief. Screenshot A–G and the
referenced PDF files were unavailable, so their descriptions and live rendering
were used as the requested fallback.

## Rendered coverage

All 25 sidebar destinations, Profile, and `/admin/marketing` were inspected.
The broader 22-section initial-state matrix covered loading, empty, and failed
responses at 1440×900 and 390×844: 132 captures with no page-level horizontal
overflow. Populated states, tabs, dialogs, and safe confirmations received further
passes. Scrollable tables and calendar grids retain deliberate local scrolling.

| Area | Additional rendered states inspected |
| --- | --- |
| Overview and Orders | Periods, empty/error/retry, maximum safe IDR, sorting controls, search, recent orders, details, overlapping refreshes, disappearing selected order |
| Mentoring Sessions | Private and Intensive filters, pagination, both management dialogs, mentor/program editors, safely dismissed lifecycle confirmations, Sessions/Weekly Analytics keyboard tabs, deep links, Back navigation, retained analytics filters, independent load retries |
| Schedule and Zoom | Month/Week/Agenda, synthetic event details, room empty/filled cards, Add/Edit Zoom Link |
| Cart Links | Create, History, International Offers, offer form, mentee selection, Digital/Private catalogs and product details, new-enrollment/add-sessions modes, Intensive empty catalog |
| Notifications and Profile | Empty/filled notification history and popover, account popover, profile display/edit, avatar editor |
| Mentees and Mentors | Data/Analytics, distributions, mentee details, invitation form, mentor account table and management dialog, public-profile empty state |
| Private catalog | Learning Paths, Session Topics, Packages & Pricing; create/manage path/topic and package pricing dialogs |
| Intensive catalog | Packages, Add-ons, Bundles; create/manage forms for each |
| Competition Categories | Filled list, Add/Manage category |
| Digital Products | Filled list, Add/Manage product, Ratings & Reviews, nested feedback details |
| Discount Codes | Empty/filled list, create/edit, Analytics workspace |
| Testimonials | Filled list, Add/Manage testimonial |
| Publications and Competitions | Empty/filled editorial lists, create/edit, unconfirmed deletion, nested publication category management |
| Competition Recognition and Trusted Partners | Filled lists, create/manage, unconfirmed deletion, recognition image cropper |
| About Us Content | Three Who We Are photo editors, Story Image empty/filled slot, both fixed Featured Story editors |
| Reports | Summary, Analytics, Transactions & Export, transaction details, export dialog |
| Master data | Mentor Expertise, Institutions, Referral Sources, Competition Interests; create/edit, unconfirmed deletion, institution actions and merge dialog |
| Marketing route | Empty/filled/error hero-poster states and inline creation/edit form |
| Navigation | Mobile drawer top/footer, forward/backward keyboard focus wrap, Escape, restored trigger focus, main inertness and body scroll restoration |

Overview, Orders, receipt preview, and both mentoring workspaces were checked at
1920×1080, 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 375×812, and 320×700.
Additional 390×400 dialog checks exercised limited viewport height. Mentee receipt
use was checked at 1440px, 390px, and 320px, including Indonesian labels, repeated
opening/closing, unavailable receipts, and retry recovery.

The PDF itself was rendered with Playwright/pdfjs and in Chrome's native preview.
Synthetic fixtures covered ordinary discounted/multi-item receipts, historical
missing metadata, zero values, maximum safe IDR/quantity, fractional unit amounts,
60 items (six pages), extreme long metadata (20 pages), and a combined pagination
boundary case (nine pages). Visual page review and A4 margin checks found no
clipping in those fixtures.

## Validation and limits

- Playwright checks covered document/dialog bounds, reachable actions, keyboard
  focus, exact new-tab endpoint and download filename, true-zero bars, exposed
  metric values, and WIB ranges while the browser timezone was Los Angeles.
- `pnpm build` passed after the final UI changes, including TypeScript and route
  generation. The receipt build trace includes the logo and both bundled fonts.
- No unit, backend integration, database, or unrelated test suites were run.
- Actual authenticated `/admin` and `/admin/marketing` redirected to `/auth`;
  credentials were unavailable. Production-authenticated receipt access and
  provider-connected success flows were not verified through live accounts.
- OAuth, provider synchronization, actual scheduling, invitation delivery, saved
  uploads/crops, publication, activation, real Cart Link/offer writes, and export
  generation were not executed. Destructive confirmations were dismissed.
- Fixture response checks establish UI behavior, not backend correctness. Native
  PDF controls were visually checked in Chrome; other browser engines were not
  exercised. No remaining page-level overflow was observed in the final inspected
  states.

The detailed local evidence includes `critical-results.json`,
`edge-ui-results.json`, `mentoring/verification.json`, `mentoring/full-matrix.json`,
`mentoring/short-height-matrix.json`, `surface-states/audit.json`,
`final-surfaces/audit.json`, `surfaces-rich/audit.json`, and `pdf/` renders.
