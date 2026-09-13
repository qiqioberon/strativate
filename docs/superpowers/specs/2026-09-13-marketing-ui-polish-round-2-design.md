# Strativate Marketing UI/UX Polish Round 2 Design

Date: 2026-09-13

## Goal

Refine Strativate's public marketing and authentication experience without changing its approved product data, mentor domain, database schema, route protections, or content-governance boundaries. The result should feel warmer, more editorial, easier to scan, and more deliberate at every supported viewport while retaining the current orange, red, yellow, black, and off-white brand system.

## Source of truth and constraints

- Product Master remains the only commercial and pricing authority.
- The existing 26-mentor roster, 19 available photos, and seven explicit missing-photo states remain intact.
- Digital products remain feature-flagged off, `/explore` and retired product paths keep their current redirects, and no new database migration is introduced.
- Public copy is limited to approved repository sources. Missing stakeholder material, guarantees, partner claims, institutional logos, testimonials, and unpublished Big Class commercial details are not invented.
- The existing Supabase integration, auth guards, RLS, migrations, hero-poster storage/query path, admin mentor management, and mentor availability behavior remain unchanged unless a test proves a visual integration regression.
- Poppins is the sole application typeface. It is loaded once through `next/font/google`, self-hosted by Next.js, and exposed through the existing CSS font tokens.
- All interaction changes support keyboard users, touch input, reduced motion, visible focus, and honest empty/single/multiple data states.

## Architecture

The polish is implemented as a focused extension of existing shared components and CSS rather than a parallel UI layer.

1. `RootLayout`, global tokens, and `SiteHeader` establish the shared typography and true three-column header geometry.
2. `PageIntro` gains an explicit visual motif variant (`program`, `mentor`, `about`, or `faq`) so every editorial hero shares structure while retaining page identity.
3. Homepage-specific behavior stays in `HeroCarousel`, `MentorMarquee`, and `HomePage`. Carousel state transitions are isolated in a small pure helper so timer/index behavior can be tested without a browser-only test route.
4. Program hierarchy is represented semantically in the rendered grid: Private and Intensive share a primary treatment, Big Class receives a secondary treatment, and the five supporting services use a compact treatment. Product connectivity and content remain data-driven.
5. Mentor search/filter/reset and the modal remain client-side presentation over the existing static mentor source. The modal keeps LinkedIn where supplied and removes its mentor-specific WhatsApp action; page-level WhatsApp remains the consultation path.
6. FAQ content is expanded only with statements already supported by Product Master, public catalog presentation, mentor data, auth behavior, and approved contact information.
7. Auth keeps its current sign-in, registration, OAuth, and route behavior. Only shell composition, back-link placement, account-mode switch treatment, and the decorative right panel change.

## Visual system

### Typography

Poppins supplies body, heading, and utility/label typography. Body copy is generally 15–17px with comfortable line height; helper text is not allowed to shrink below a readable 12px unless it is purely decorative metadata. Large headings keep compact tracking but avoid the extreme letter-spacing and line-break pressure visible in the production baseline.

### Header

Desktop uses `grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)`. The brand is left-aligned, navigation occupies the actual center track, and actions are right-aligned. Tablet/mobile retain the existing collapsible menu, native links, active states, Escape handling, and focus visibility.

### Editorial page intros

Every intro keeps the shared eyebrow/title/description/action structure. A page-specific decorative motif occupies the hero background without becoming content: program uses modular blocks, mentor uses profile/orbit marks, about uses directional lines, and FAQ uses question/answer marks. Motifs are `aria-hidden`, restrained on mobile, and motionless under reduced-motion preferences.

### Buttons

Orange remains the primary product/navigation action. Contextual WhatsApp actions use a consistent green treatment with the WhatsApp/message icon, readable contrast, and exact page-specific messages. Hover motion is subtle and disabled when reduced motion is requested.

## Component behavior

### Homepage hero and social proof

The hero keeps Program and Mentor navigation and adds a green WhatsApp consultation action using exactly:

`Halo Strativate, saya ingin konsultasi untuk menentukan program yang paling sesuai dengan kebutuhan saya.`

Social proof is placed inside one structural container containing both its label and three proof cells. This removes the specificity-dependent margin hack that currently lets the label touch the viewport edge.

### Hero carousel

- Zero posters: show the existing branded fallback with no inactive controls.
- One poster: show the poster and optional destination without previous/next/dot controls or autoplay.
- Multiple posters: show previous and next buttons plus one labelled dot per poster.
- Autoplay advances after exactly 5000ms and restarts a full 5000ms after any manual previous, next, dot, keyboard, or swipe selection.
- Autoplay pauses while pointer hover, focus-within, or active pointer/touch interaction is present.
- Left and Right Arrow keys navigate when focus is within the carousel.
- Horizontal touch swipes navigate above a deliberate distance threshold.
- Reduced motion disables autoplay and non-essential transitions.
- Poster imagery uses a contained editorial presentation so artwork is not destructively cropped; the caption and scrim remain legible.

### Mentor marquee

The marquee runs on a 140-second cycle (within the approved 120–160 second range). Cards are larger and focusable. Hover/focus reveals a stable-width preview containing role, up to two sourced credentials, expertise tags, and a link to the mentor directory anchor. The repeated group is hidden from assistive technology and removed from the tab sequence. Hover/focus pauses animation. Reduced motion converts the first group into a horizontally scrollable snap list and hides the duplicate. Touch users can follow a card directly to its corresponding directory entry.

### Program page

The page intro action becomes a green WhatsApp link with exactly:

`Halo Strativate, saya ingin konsultasi untuk memilih program Strativate yang sesuai.`

Private Mentoring and Intensive Mentoring render as equal primary cards. Big Class follows as the single secondary card with its approved overview-only status. Consultation, Mock Competition, Proposal Review and Feedback, Workshop, and Community render in a smaller supporting-services grid. Existing connected program links and unavailable overview semantics remain unchanged.

### Mentor page and modal

The hero title is one intentional sentence and the page action becomes a green WhatsApp link using exactly:

`Halo Strativate, saya ingin konsultasi untuk memilih mentor yang sesuai dengan kebutuhan saya.`

The directory toolbar groups search, tier filters, reset, and live result count. Reset is visible only when filters are active. Cards keep sourced content and align polished profile/LinkedIn actions consistently. Each card exposes a stable anchor for touch navigation from the homepage.

The native dialog is explicitly centered with bounded viewport dimensions, internal scrolling, a responsive media/content grid, meaningful section icons, Escape/close/backdrop behavior, and reduced-motion-safe transitions. Its mentor-specific WhatsApp action is removed; LinkedIn remains when present.

### About and FAQ

About hero WhatsApp copy is exactly:

`Halo Strativate, saya ingin mengetahui lebih lanjut tentang layanan dan pendekatan Strativate.`

FAQ hero WhatsApp copy is exactly:

`Halo Strativate, saya masih memiliki pertanyaan tentang layanan Strativate. Bisa dibantu?`

The FAQ directory expands to 8–12 questions derived from existing approved sources, with useful Program, Mentor, Akun, and Dukungan categories. Search/filter/live count/empty-state behavior stays intact.

### Authentication

The back link moves directly below the brand and above the heading, includes `ArrowLeft`, and retains its destination. The login/register mode switch becomes a clear full-width secondary control. The right panel becomes a branded grid composition using CSS and existing brand marks only, with subtle ambient animation and a static reduced-motion state. Authentication handlers, field requirements, OAuth, and navigation destinations do not change.

## Testing and validation

Development follows red-green-refactor. Tests cover exact CTA messages, Poppins-only font setup, centered header geometry, social-proof containment, PageIntro variants, program hierarchy, FAQ count/content provenance, mentor filter/reset/modal behavior, auth composition, carousel zero/one/multiple rendering, carousel state helper behavior, and reduced-motion interaction rules.

End-to-end QA covers `/`, `/program`, `/mentor`, `/tentang-kami`, `/tanya-jawab`, and `/auth` at widths 360, 390, 768, 1024, 1280, 1440, and 1920. It also covers the mobile menu, mentor modal, hero-carousel states where testable without mutating hosted data, keyboard focus, and horizontal-overflow assertions. Production before screenshots and local after screenshots use matching 1440×1000 viewports for the five requested routes.

The completion gate runs unit tests, type checking, lint, production build, browser tests, secret scanning, changed-file/schema/migration audits, and a final code review. The feature branch is pushed and a PR is opened against `main`; it is not force-pushed or merged.
