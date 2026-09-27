# Homepage Recognition Logo Motion Design

## Intent

Split the homepage competition-recognition presentation into two visually distinct sections while preserving the existing admin-managed recognition data and all unrelated homepage behavior.

## Presentation

- Keep the exact statement, `Our mentors and students are award-winning business competition finalists.`, in a dedicated full-width section directly after the hero.
- Give the statement a solid, noticeably warmer orange background selected from the approved Strativate palette after visual validation. Do not use cards, shadows, strong gradients, or unrelated decoration.
- When active recognition records exist, render their logos in a separate white section immediately after the statement.
- Preserve original logo color and aspect ratio, consistent optical sizing, `object-fit: contain`, responsive behavior, and `competition_name` alt text.
- When no active records exist, retain only the statement and omit the logo section.

## Motion and count behavior

- One logo is static and centered.
- Two or more logos move autonomously in a straight horizontal direction. There is no drag, swipe, scrolling, hover behavior, pause control, or carousel control.
- Begin with one row for 2–7 logos and two rows for 8 or more. Treat this as a visual implementation threshold and adjust only if required by validation at 390, 430, 768, 1440, and 1920 pixels.
- In the two-row state, distribute records deterministically across rows while preserving admin order; the upper row moves left and the lower row moves right.
- Duplicate visual cycles as needed for a filled, centered initial composition and seamless looping. Duplicate content is hidden from assistive technology.
- Motion is slow, linear, CSS-transform-only, continuous, and non-interactive. The first frame must not expose a large empty edge, including at 1920 pixels.

## Reduced motion

Under `prefers-reduced-motion: reduce`, stop track animation, remove visual duplicate cycles, and present each real logo once in a centered wrapping layout. Do not introduce manual horizontal scrolling as a substitute.

## Architecture and scope

- Reuse `listActiveCompetitionRecognitions()` and `CompetitionRecognitionView`; do not change the database, storage, admin CRUD, or ordering behavior.
- Keep rendering server-side and use CSS animation rather than client JavaScript or an animation dependency.
- Do not add or seed fake production recognition records. Synthetic logos may be used only in tests and browser fixtures.
- Do not alter the hero, testimonial gallery, CTA, cloud, stats, downstream sections, or unrelated admin functionality.

## Validation

- Unit contracts cover exact copy, empty/single/one-row/two-row structures, deterministic row splitting, duplicate accessibility, non-interaction, and styling contracts.
- Browser coverage at 390, 430, 768, 1440, and 1920 pixels verifies section separation, responsive sizing, no page overflow, filled centered initial composition, straight transform-only motion, seamless cycle geometry, opposite row directions, logo aspect ratios, accessible names, and reduced motion.
- Complete repository checks include unit tests, typecheck, lint, build, focused browser tests, and `git diff --check`.
