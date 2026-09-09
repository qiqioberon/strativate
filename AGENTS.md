# Strativate coding-agent instructions

Before modifying public-facing content or frontend assets, read:

- `docs/strativate/frontend-content-asset-requirements.md`
- `docs/strativate/source-conflicts.md`
- `docs/strativate/asset-status.md`

Do not treat placeholders, hardcoded demo records, ratings, achievements,
institution labels, prices, or dashboard metrics as production facts. Do not
invent stakeholder data or resolve documented source conflicts by guessing.
Public pricing, claims, mentor credentials, partnership wording, contact details,
and legal/guarantee language must come from an approved source.

Use the typed central asset registry when present and keep temporary media under
`public/assets/placeholders/`; final assets belong in their semantic production
folders. Update the registry and `docs/strativate/asset-status.md` together when
assets are received or replaced.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
