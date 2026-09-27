# Homepage Competition Recognition Design

## Goal

Revise the homepage without changing its existing hero content or layout:

- keep the React Bits Shape Grid ambient animation while removing all pointer-, mouse-, hover-, and touch-driven behavior;
- add very subtle asynchronous autonomous breathing to the existing clean hand-drawn cloud lobes;
- add a warm competition-recognition section immediately after the hero; and
- let administrators manage the recognition logos through the existing Supabase-backed content-management architecture.

The recognition statement is fixed approved copy:

> Our mentors and students are award-winning business competition finalists.

No recognition records or logos will be seeded. The statement remains visible when there are no active records, while the empty logo wall is omitted.

## Existing Boundaries

The current clean cloud styling, geometry, seven-lobe arrangement, gallery overlap, stats layout, `bottom: -4px` seam overlap, responsive fixes, and paper treatment are retained. The stronger rejected cloud texture is not reintroduced.

The existing `competitions` table remains the competition-opportunity directory. Recognition logos represent a different editorial concept and will not be stored in or coupled to that directory.

No hero copy, CTA behavior, testimonial content, gallery interaction, stats copy, header, downstream homepage section, footer, pricing, authentication, mentoring, or commerce behavior is changed.

## Public Homepage Architecture

### Shape Grid

`components/marketing/hero-shape-grid.tsx` will retain the canvas renderer, grid offset, viewport visibility handling, page visibility handling, autonomous `requestAnimationFrame` loop, resize handling, and reduced-motion behavior.

The pointer-reactive implementation will be removed rather than hidden:

- remove hover configuration props;
- remove hovered-cell, trail, and per-cell opacity state;
- remove hover-fill rendering branches;
- remove cursor-coordinate calculations; and
- remove mouse event registration and cleanup.

`app/marketing.css` will set `.homepage-shape-grid` to `pointer-events: none`, ensuring the canvas cannot intercept CTA, gallery, tap, drag, or other hero interactions.

### Cloud motion

The current cloud declarations remain visually unchanged except for animation properties and new keyframes. Each lobe receives a distinct duration in the approximately 7–13 second range and alternates with gentle `ease-in-out` timing. Motion uses only lightweight transforms with approximately:

- 1–3px vertical variation;
- 0.99–1.02 horizontal scale;
- 0.985–1.015 vertical scale; and
- no more than roughly 0.2–0.4 degrees additional rotation.

Keyframes preserve each lobe's existing base transform. The central/largest lobe receives the smallest variation. Every lobe remains bottom-anchored using the existing transform origin and `bottom: -4px`, so the cloud body overlap remains closed throughout motion.

Under `@media (prefers-reduced-motion: reduce)`, all lobe animation is disabled. The static cloud remains in its existing approved state.

### Recognition section

A dedicated recognition section is rendered immediately after the hero and before the existing “Who We Are” section. It uses a calm warm sand/pale peach background compatible with the existing palette, with no strong divider, outer card, gradient-heavy treatment, or shadow. Its top spacing/background visually continues from the cloud body.

The exact approved sentence is centered with existing marketing typography at a non-hero scale. Active logos render below it in a centered responsive wrapping layout. Each image:

- uses `competition_name` as its exact accessible `alt` text;
- retains original colors and aspect ratio;
- uses `object-fit: contain`;
- has normalized optical height; and
- has no hover effect, card, marquee, carousel, or auto-scroll behavior.

If no active recognition records exist, only the statement renders.

`app/page.tsx` loads active recognition records alongside existing homepage data. `components/marketing/home-page.tsx` receives the typed records as a prop and renders the section. Query failures degrade to an empty logo list while logging only the database error code, matching existing public marketing helpers.

## Data Model and Storage

A forward Supabase migration adds `public.competition_recognitions` with:

- `id uuid primary key`;
- `competition_name text not null` with trimmed length validation;
- `logo_path text not null` restricted to safe `recognition-logos/` JPG, PNG, or WebP paths;
- `display_order integer not null` with a bounded non-negative range;
- `is_active boolean not null default true`;
- `created_at timestamptz not null default now()`; and
- `updated_at timestamptz not null default now()` maintained by the existing `touch_updated_at()` trigger.

No records are seeded.

The existing public `marketing-editorial` bucket is reused. Storage policies are updated so `recognition-logos/` is an approved prefix under the same 5 MB and MIME restrictions. Anonymous/authenticated public reads are restricted to approved safe paths. Only authenticated administrators may insert, update, or delete recognition-logo objects.

Table RLS follows current marketing CMS conventions:

- anonymous and authenticated users may select only active rows;
- administrators may select all rows;
- only administrators may insert, update, or delete; and
- service-role access remains available.

An admin-only reorder RPC accepts the complete ordered ID list, validates authorization, rejects duplicate/missing/foreign IDs, locks the collection, and rewrites contiguous `display_order` values. This mirrors established marketing ordering behavior without allowing public writes.

The generated project database declarations gain a `CompetitionRecognition` type, table registration, and reorder RPC signature.

## Admin Experience

A dedicated `CompetitionRecognitionManagement` client component is added under the existing Admin → Content navigation. It follows the established marketing-media CRUD conventions and supports:

- add with required competition name and required logo;
- edit name, active state, and optional replacement logo;
- move up/down ordering plus position editing where consistent with the hero-poster pattern;
- immediate active/inactive toggle;
- hard delete after explicit confirmation, matching existing marketing content behavior; and
- replacement/deletion cleanup of owned Storage objects, with honest warnings when database and Storage cleanup cannot both be confirmed.

Uploads accept only JPG, PNG, and WebP up to 5 MB, write randomized safe filenames under `recognition-logos/`, and never store base64 data or external placeholder URLs. The competition name is the only alt-text source; no separate generic logo alt field is exposed.

The admin page has a graceful setup-required state when the migration has not been applied. No existing competition directory administration is modified.

## Validation and Error Handling

Validation covers required trimmed competition names, supported MIME types, maximum file size, safe Storage paths, valid display positions, active-only public selection, and complete-list reorder semantics.

An uploaded file is removed if its database write fails and persistence can be safely ruled out. A replaced or deleted logo is removed only after its corresponding database mutation succeeds. Any partial cleanup failure is surfaced to the administrator instead of falsely reporting complete success.

## Testing

Implementation follows test-driven development. Targeted tests will establish:

- the Shape Grid has no pointer listeners, hover state, trail state, or hover-fill branches while retaining ambient animation and reduced-motion handling;
- the canvas has `pointer-events: none`;
- cloud keyframes are asynchronous, subtle, bottom-anchored, and disabled for reduced motion without changing the approved styling/geometry;
- the recognition section follows the hero, uses the exact approved copy, omits an empty logo wall, and renders competition names as image alt text;
- recognition records are ordered and mapped to public Storage URLs;
- admin validation, payloads, ordering, toggle, edit, and delete behavior follow the intended contract;
- migration constraints, RLS, storage-prefix restrictions, and reorder authorization are present; and
- no seed/fake recognition records are introduced.

Before push, run the full unit suite, typecheck, lint, build, relevant database tests where local Supabase is available, and Playwright/browser smoke checks at approximately 390px, 430px, 768px, 1440px, and 1920px. Browser checks explicitly cover CTA/gallery pointer pass-through, non-reactive Shape Grid behavior, ambient animation, cloud seam/overflow, reduced motion, recognition wrapping, and empty-state behavior.

The complete diff will be reviewed before a minimal push. The pull request will target `main` and will not be merged.
