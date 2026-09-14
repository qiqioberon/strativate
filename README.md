# strativate

Authentication, onboarding, database migrations, and administration setup:
[Supabase setup guide](docs/supabase-setup.md).

Program/frontend data ownership and the retirement of the former generic Product Catalog Master:
[Program information guide](docs/program-information.md).

## Current architecture direction

The former generic Product Catalog Master is migration history and is no longer the runtime architecture. Each business/product type owns its own domain model. Shared commerce will later unify cart, checkout, order, and payment.

This cleanup intentionally does **not** implement the future Digital Product, Private Mentoring, or shared-commerce domains. Public program/product UI continues to use approved editorial content or honest unavailable/placeholder states until those domains are implemented.

For a fresh database, apply the versioned migrations in filename order. `202609090001_product_catalog_master.sql` remains in history because it may already have been applied; `202609140002_remove_legacy_product_catalog.sql` removes that legacy schema forward-only after the Mentor Domain and Hero Poster migrations. Do not delete or rewrite the historical Product Catalog migration.

The Product Catalog removal migration must be reviewed and applied deliberately to hosted Supabase. This repository does not imply that the destructive forward migration has already been run remotely.

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_JMBL7pe5InEaguDKNvE8uNB6Bjga)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [v0 Documentation](https://v0.app/docs)
