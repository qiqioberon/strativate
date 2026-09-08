# Homepage redesign and durable asset system design

**Date:** 2026-09-09  
**Status:** Approved for implementation  
**Scope:** Public marketing homepage, marketing navigation/routes, shared button
primitive, and placeholder-ready frontend assets

## Outcome

Strativate will move from a client-side, local-state marketing demo to a
route-native Next.js marketing site. The homepage will remain an editorial
overview with previews, while `/program`, `/mentor`, `/produk-digital`,
`/tentang-kami`, and `/tanya-jawab` provide dedicated destinations. The visual
system will retain the warm off-white and orange/red/yellow identity but replace
the current pill-heavy, repeated-card composition with stronger type scale,
asymmetric rhythm, restrained surfaces, and asset-ready media slots.

## Existing-state findings

- `app/page.tsx` is a client component that owns six simulated marketing views,
  demo mentor/product data, toast/purchase behavior, and unused dashboard demo
  components. Navigation changes React state without changing the URL.
- The header is a text row with orange-only active state; at 1024px it fits but
  is tightly packed. The mobile menu is a plain full-width stack without icon or
  CTA hierarchy.
- The hero's strongest element is its editorial type, but its organic blob,
  floating claim cards, initials, ratings, names, and country/win claims make it
  feel synthetic and create factual risk.
- Homepage cards repeat similar pastel rectangles, radii, and grid structure.
  Program content for Private/Intensive is centralized, but Big Class, mentors,
  products, and social proof are unapproved demo data.
- `components/ui/button.tsx` already provides a CVA-based shared primitive, but
  the marketing UI bypasses it with global `.button` classes.
- `/mentor` currently hosts the protected Mentor Dashboard. To fulfill the
  approved public route architecture without breaking the workspace, that
  dashboard moves to `/mentor/dashboard` and auth/proxy references change with
  it.

## Architecture

### Marketing shell and routes

Each public marketing route renders a shared `MarketingShell` containing
`SiteHeader` and `SiteFooter`. The header is a small client boundary using
`usePathname()` for active state and local state only for the mobile menu. Page
content remains server-renderable. Navigation uses real `Link` elements:

| Label | Route | Icon |
| --- | --- | --- |
| Beranda | `/` | `House` |
| Program | `/program` | `Compass` |
| Mentor | `/mentor` | `UsersRound` |
| Produk Digital | `/produk-digital` | `Library` |
| Tentang Kami | `/tentang-kami` | `Sparkles` |
| Tanya Jawab | `/tanya-jawab` | `CircleHelp` |

Desktop navigation lives on one restrained bordered surface. Individual items
use compact icon/label alignment and a subtle active background without becoming
large pills. The CTA is visually separate. On mobile, a contained panel presents
numbered/icon-led rows, a clear sign-in action and primary CTA, closes after
navigation, and uses accessible expanded/control state.

### Homepage composition

The hero uses a deliberate two-column editorial grid. The left side gets a
controlled headline lockup, narrower supporting copy, and two shared-system CTAs.
The right side becomes a framed “preparation canvas”: a stable media aspect ratio,
graphic grid/line details, and a non-factual branded placeholder rather than
floating ratings, credentials, or achievement badges. It can later swap to a
real key visual or mentor photograph through the asset registry.

The homepage sequence is:

1. header and hero;
2. a non-statistical “how Strativate supports preparation” editorial strip;
3. three-program preview with Private/Intensive approved-source content and an
   explicitly pending Big Class card without invented price/facts;
4. a high-contrast brand statement with no unsupported champion claim;
5. a mentor preview designed around optional profile fields and branded
   placeholders;
6. an offset Digital Product preview that shows replaceable cover slots without
   names/prices from conflicting demo catalogs;
7. concise About and FAQ previews linking to their dedicated routes;
8. a fuller internal-link footer with no invented external contact links.

Section width, background, grid and spacing vary intentionally: not every block
is a card and not every card shares the same radius. Interaction is limited to
150–250ms color, border, elevation and small arrow transforms, disabled under
`prefers-reduced-motion`.

### Shared button system

`components/ui/button.tsx` remains the source of button classes. It gains a
coherent marketing-capable set while retaining compatibility aliases used by
other consumers: primary/default, secondary, outline, dark, ghost, text/link,
and icon sizes. Base radius is 12–14px; marketing actions are 44–48px high. Focus,
pressed, disabled, and arrow-slot motion are defined once. Marketing Links use
`buttonVariants()` rather than a disconnected `.button` implementation.

### Asset registry and media slots

`lib/content/asset-registry.ts` defines typed `FrontendAsset` records with
`src`, `placeholder`, `status`, `alt`, `priority`, and `notes`. It exposes semantic
keys for brand, mentor portraits, program covers, product covers, achievement
images, testimonial portraits and institution logos. Placeholder SVGs live only
under `public/assets/placeholders/`.

`AssetMedia` consumes a registry record and renders `next/image` when a real file
is available or a branded placeholder treatment when `placeholder` is true. Its
aspect-ratio wrapper prevents layout shift. Replacing a future asset should
normally require placing the final file in its production directory and changing
one registry record.

### Content safety

Homepage content does not display unsupported participant counts, university
partnerships, country counts, wins, ratings, mentor identities, testimonials,
Digital Product prices, or Big Class details. Private and Intensive previews
continue to consume `lib/program-information.ts` without modifying their facts.
Placeholder records are centralized in `lib/content/marketing-content.ts` and
carry explicit source status. Dedicated pages use safe, non-factual explanatory
copy until approved content masters arrive.

## Component boundaries

- `components/marketing/site-header.tsx`: pathname-aware responsive navigation.
- `components/marketing/site-footer.tsx`: internal marketing sitemap and brand
  placeholder.
- `components/marketing/marketing-shell.tsx`: shared page chrome.
- `components/marketing/asset-media.tsx`: registry-backed media slot.
- `components/marketing/program-card.tsx`: differentiated program preview.
- `components/marketing/mentor-card.tsx`: optional-field mentor presentation.
- `components/marketing/home-page.tsx`: homepage section composition.
- `components/marketing/marketing-page.tsx`: shared dedicated-page heading/layout
  primitives where they reduce repetition.
- `lib/content/asset-registry.ts`: semantic asset source of truth.
- `lib/content/marketing-content.ts`: public-safe placeholder and preview data.

## Routing compatibility

- `/program/[slug]`, `/explore`, auth, checkout, mentee dashboard, admin dashboard,
  and onboarding remain behaviorally unchanged.
- Protected Mentor Dashboard moves from `/mentor` to `/mentor/dashboard`.
  `destinationFor`, proxy protection, and auth tests update to the new route.
- The public `/mentor` page must remain accessible anonymously, while
  `/mentor/dashboard` redirects anonymous users to `/auth`.

## Testing and acceptance

- Node tests validate the mentor destination change, registry shape/status, and
  absence of disallowed production claims in homepage source data.
- Playwright tests validate every marketing route, real link destinations,
  pathname-aware active navigation, mobile-menu behavior, preserved program
  detail links, anonymous public `/mentor`, protected `/mentor/dashboard`, and
  horizontal overflow.
- Run lint, typecheck, unit tests, production build, and browser tests.
- Manually inspect screenshots at 1440, 1280, 768 and 390 widths, including the
  mobile menu and browser console. Fix visible crowding, wrapping, rhythm,
  placeholder ratio, and card-height issues before completion.
