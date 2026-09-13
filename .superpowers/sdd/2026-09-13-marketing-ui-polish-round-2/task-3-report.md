# Task 3 report — marketing hierarchy

## Status

Complete. The inherited WIP checkpoint `efd50fe` implements the approved editorial
intros, program hierarchy, and expanded source-backed FAQ. The follow-up commit
centralizes the contact FAQ answer on the approved public-contact record.

## Commits

- `efd50fe` — `wip: checkpoint marketing hierarchy task 3` (inherited checkpoint)
- `fix: finalize marketing hierarchy task 3` — central contact FAQ follow-up
  committed with this report (the final hash is included in the task handoff).

## Summary

- Program, Mentor, About, and FAQ call `PageIntro` with explicit `program`,
  `mentor`, `about`, and `faq` motifs and use the approved green WhatsApp CTA
  variant with exact page-specific messages.
- The Program page retains all eight supplied services: Private Mentoring and
  Intensive Mentoring are equal primary cards; Big Class is one overview-only
  secondary card; the other five services are compact supporting cards. Only the
  existing two Product Master-connected routes remain actionable.
- The FAQ now has nine entries across Program, Mentor, Akun, and Dukungan. The
  homepage explicitly renders `faqPreview.slice(0, 3)`.
- The contact FAQ derives its phone/email values from `publicContact` rather than
  duplicating literals.

## FAQ provenance

| Question | Runtime source tag | Approved source |
| --- | --- | --- |
| Di mana saya bisa membandingkan program? | `services` | `Program Page.pdf` eight-service overview; handoff receipt route summary. |
| Layanan apa saja yang tersedia di Strativate? | `services` | `Program Page.pdf` and `lib/content/services.ts` eight approved service records. |
| Program mana yang sudah memiliki halaman informasi? | `services` | Handoff receipt: only published Private/Intensive rows receive detail links; Big Class is overview-only. |
| Bagaimana memilih mentor? | `mentor-directory` | Public 26-mentor workbook/roster and existing searchable/filterable directory behavior. |
| Informasi apa yang tersedia pada profil mentor? | `mentor-directory` | Public mentor roster fields and existing public directory rendering; LinkedIn is conditional on a supplied link. |
| Bagaimana cara mendaftar? | `auth` | Existing `AuthForm` email verification-link registration flow. |
| Bagaimana cara masuk ke akun? | `auth` | Existing `AuthForm` email/password and Google OAuth controls. |
| Bagaimana menghubungi Strativate? | `public-contact` | Approved `publicContact` record (`lib/content/brand.ts`), sourced by the frontend handoff receipt. |
| Saya belum yakin memilih program. Apa yang bisa dilakukan? | `public-contact` | Approved public WhatsApp consultation path and contact record. |

No FAQ introduces a price, refund/guarantee, partnership, institution, mentor-rating,
or Big Class commercial claim.

## RED evidence

Inherited checkpoint evidence is reconstructable from the added tests and the
earlier Red run: the pre-Task-3 state had a three-entry FAQ and homepage full
`faqPreview.map`, so the FAQ-depth and `slice(0, 3)` assertions failed. The
pre-Task-3 pages used link-based intro actions and one flat service grid, so the
new exact-CTA/motif and hierarchy assertions had no matching DOM.

Follow-up RED, run against `efd50fe`:

```text
pnpm test
58 passed, 1 failed
FAQ contact answer reuses the approved public contact record
Expected duplicate phone literal to be absent; it was present.
```

The first assertion checked the rendered string rather than the duplicate source,
so it was corrected to assert the resolved `publicContact` output plus absence of
literals in `marketing-content.ts`. The focused content test then passed before
the final full suite.

## GREEN verification

| Command | Result |
| --- | --- |
| `pnpm test` | 59 passed, 0 failed. |
| `pnpm typecheck` | Exit 0. |
| `pnpm lint` | Exit 0. The full scan was slow but completed without diagnostics. |
| `pnpm build` | Exit 0; 22 routes generated. |
| `pnpm exec playwright test tests/browser/marketing.spec.ts tests/browser/program-information.spec.ts` | 21 passed. Public Supabase URL and publishable key were process-loaded from `..\\..\\.env` without being printed. |

The four editorial page intros were browser-checked at 1440px, 768px, and 390px;
all retained visible title/action structure and no horizontal overflow. Evidence
screenshots are under `output/playwright/task3-intro-*.png`.

## Files changed

Checkpoint Task 3 changes:

- `app/marketing.css`
- `app/program/page.tsx`
- `app/mentor/page.tsx`
- `app/tentang-kami/page.tsx`
- `app/tanya-jawab/page.tsx`
- `components/marketing/home-page.tsx`
- `components/marketing/service-card.tsx`
- `lib/content/marketing-content.ts`
- `tests/marketing-content.test.ts`
- `tests/browser/marketing.spec.ts`
- `tests/browser/program-information.spec.ts`

Follow-up changes:

- `lib/content/marketing-content.ts`
- `tests/marketing-content.test.ts`
- this report

## Self-review

- Confirmed exact approved hero WhatsApp messages and explicit motifs for all four pages.
- Confirmed 2 + 1 + 5 program grouping, eight total cards, compact supporting
  variants, and retained Private/Intensive information routes.
- Confirmed nine FAQ entries, allowed categories/source tags, and prohibited-
  content checks.
- Confirmed the contact answer now resolves from the canonical public-contact
  module, not duplicate literals.
- Confirmed no production changes to service data, catalog connectivity, mentor
  records, auth behavior, carousel behavior, or Supabase schema.

## Concerns

- The build and browser server print existing Node 20 deprecation notices from
  Supabase, and the browser fixture reports a slow filesystem. Neither caused a
  verification failure.
- One initial fully parallel browser run had a mobile-navigation timeout; the
  targeted reproduction and the final exact full rerun both passed. Header code
  is unchanged by Task 3.
