# strativate

Authentication, onboarding, database migrations, and administration setup:
[Supabase setup guide](docs/supabase-setup.md).

Program/frontend data ownership and the retirement of the former generic Product Catalog Master:
[Program information guide](docs/program-information.md).

## Current architecture direction

The former generic Product Catalog Master is migration history and is no longer the runtime architecture. Each business/product type owns its own domain model. Shared commerce will later unify cart, checkout, order, and payment.

Digital Product is now the first standalone product domain. `public.digital_products` is its source of truth and `digital-product-images` is its dedicated private cover-image bucket. Admins can create, read, update, and delete Digital Products and their covers from the admin application.

This phase intentionally does **not** implement downloadable Digital Product files, public Digital Product records, cart, checkout, orders, payments, purchases, or entitlements. `featureFlags.digitalProducts` remains disabled, so the public storefront stays unavailable until a later phase deliberately connects it.

For a fresh database, apply the versioned migrations in filename order. `202609090001_product_catalog_master.sql` remains in history because it may already have been applied; `202609140002_remove_legacy_product_catalog.sql` removes that legacy schema forward-only, and `202609140003_digital_product_domain.sql` creates the independent Digital Product domain after the removal. Do not delete or rewrite the historical Product Catalog migration.

Hosted Supabase migrations must be reviewed and applied deliberately. Repository migrations do not imply that schema-changing or destructive migrations have already been run on the target project.

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
