# Konfigurasi Supabase Strativate

Implementasi memakai Next.js App Router dan Supabase SSR cookies. Login bersama di `/auth`; callback di `/auth/callback`. Role berasal dari `public.profiles`, bukan user metadata. Dashboard tetap `/admin`, `/mentor`, `/dashboard`; mentee yang belum selesai diarahkan ke `/onboarding`, mentor baru ke `/auth/setup`.

## 1. Environment dan migrasi

Isi `.env` mengikuti `.env.example`, tanpa menimpa kredensial yang sudah ada:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET_KEY
APP_URL=http://localhost:3000
```

`SUPABASE_SECRET_KEY` hanya dipakai server action/admin/importer. Jangan beri prefix `NEXT_PUBLIC_` pada secret.

Untuk database baru, jalankan semua migration dalam urutan filename:

1. `202609060001_auth_onboarding.sql`
2. `202609060002_institution_import.sql`
3. `202609060003_invite_management_auth_ux.sql`
4. `202609090001_product_catalog_master.sql` — **history**; jangan edit/hapus karena dapat sudah diterapkan.
5. `202609120001_marketing_hero_posters.sql`
6. `202609130001_mentor_domain.sql`
7. `202609140001_marketing_hero_poster_natural_order.sql`
8. `202609140002_remove_legacy_product_catalog.sql` — forward cleanup yang membongkar Product Catalog Master lama.
9. `202609140003_digital_product_domain.sql` — domain Digital Product mandiri dan bucket cover admin-only.

Migration nomor 8 harus diterapkan secara terkontrol ke project hosted karena menghapus tabel/view/function/type Product Catalog lama. Migration nomor 9 kemudian membuat `public.digital_products` dan bucket private `digital-product-images`. Keduanya merupakan perubahan schema dan **tidak** boleh dijalankan otomatis terhadap production dari workflow ini. Pastikan backup/approval operasional tersedia sesuai prosedur deployment sebelum penerapan.

Arsitektur setelah Phase 2A: Digital Product sudah memiliki domain model sendiri; Private/Intensive/Big Class tetap terpisah dan shared commerce akan dibangun kemudian untuk cart, checkout, order, dan payment. Domain Digital Product saat ini tidak berisi file produk yang dapat diunduh, purchase, atau entitlement.

Contoh PostgreSQL CLI:

```powershell
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609060001_auth_onboarding.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609060002_institution_import.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609060003_invite_management_auth_ux.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609090001_product_catalog_master.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609120001_marketing_hero_posters.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609130001_mentor_domain.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609140001_marketing_hero_poster_natural_order.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609140002_remove_legacy_product_catalog.sql
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609140003_digital_product_domain.sql
```

`psql` tidak otomatis membaca `.env`. Jangan menjalankan ulang migration yang telah tercatat sebagai applied; sinkronkan migration history jika SQL Editor pernah dipakai sebelum beralih ke Supabase CLI.

## 2. Authentication URL dan email

Di **Authentication → URL Configuration**:

- Site URL: origin produksi, atau `http://localhost:3000` selama pengembangan.
- Redirect URLs: callback lokal dan produksi (`/auth/callback`).
- Hindari wildcard produksi.

Email template harus memakai token hash agar callback server dapat membentuk session cookie. Magic Link/Confirm Signup, Invite User, dan Recovery harus mengarah ke `.RedirectTo` dengan `token_hash` dan tipe yang sesuai. Gunakan SMTP produksi dengan domain terverifikasi dan password policy minimal 8 karakter.

## 3. Google OAuth

1. Buat Google OAuth Web Client dan consent screen/test users.
2. Authorized redirect URI provider adalah callback Supabase `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
3. Aktifkan Google provider di Supabase.
4. Tambahkan callback aplikasi lokal/produksi ke redirect allowlist Supabase.

OAuth menggunakan PKCE. Nama/avatar provider dapat diprefill; username tetap dipilih pengguna.

## 4. Bootstrap admin pertama

Buat user Auth secara tepercaya, lalu ubah `public.profiles.role` menjadi `admin` melalui SQL/admin tooling tepercaya. Jangan memakai user metadata sebagai sumber role dan jangan menyediakan registrasi admin publik.

## 5. Institution import

Dataset version-controlled berada di `supabase/seed/institutions_all.csv`. Gunakan:

```powershell
pnpm import:institutions --dry-run
pnpm import:institutions --dry-run --compare
pnpm import:institutions
```

Importer memakai batch dan RPC/service-only path; pengajuan pengguna tidak boleh ditimpa.

## 6. Mentor invitation dan Mentor Domain

`mentor_invites` adalah registry privat untuk alur invitation. Mentor Domain memakai `public.mentor_tiers` sebagai tier operasional canonical, bersama `mentor_profiles` dan `mentor_availability_rules`. Jangan memakai model `catalog_mentor_tiers` lama: tabel itu dihapus oleh cleanup migration Product Catalog.

Admin dapat mengelola invitation/tier/availability melalui boundary yang sudah ada. Auth/onboarding/Mentor Domain tidak boleh bergantung pada schema Product Catalog lama.

## 7. Hero Posters

`marketing_hero_posters` dan bucket `marketing-hero-posters` tetap domain terpisah. Migration Product Catalog cleanup tidak mengubah tabel, Storage bucket, policy, atau RPC Hero Poster. Migration natural-order 14 September harus tetap diterapkan sebelum cleanup Product Catalog.

## 8. Digital Products

`public.digital_products` menyimpan hanya nama, slug, deskripsi, object path cover, integer Rupiah, dan metadata teknis. Admin adalah satu-satunya browser role yang dapat SELECT/INSERT/UPDATE/DELETE melalui RLS `public.is_admin()`.

Bucket `digital-product-images` bersifat private dan hanya menyimpan JPG/PNG/WebP cover maksimal 5 MB di namespace `products/`. Admin dapat membaca, mengunggah, mengganti, dan menghapus object melalui Storage policy. Tabel menyimpan object path, bukan public URL; admin preview menggunakan signed URL sementara.

`featureFlags.digitalProducts` tetap `false`. Jangan membuka public read policy, storefront, file produk sebenarnya, cart, checkout, order, payment, atau entitlement dari setup ini.

## 9. Pengujian otomatis

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Untuk database uji benar-benar baru:

```powershell
createdb -h 127.0.0.1 -p 55439 -U postgres strativate_test_auth
$env:TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/strativate_test_auth'
pnpm test:db -- --bootstrap
```

Runner hanya menerima database bernama `strativate_test_*`. `--bootstrap` memasang harness dan seluruh migration dalam urutan filename, termasuk forward Product Catalog cleanup dan Digital Product Domain, lalu menjalankan suite SQL Auth, institution import, mentor invites, Hero Posters, Mentor Domain, `catalog_removal.sql`, dan `digital_products.sql`.

`catalog_removal.sql` harus membuktikan tidak ada tabel/view/function/type Product Catalog aktif lagi dan memastikan `mentor_tiers`, Auth/onboarding, institutions, serta Hero Posters tetap ada. `digital_products.sql` harus membuktikan schema/constraint, admin CRUD, role isolation, private cover Storage, dan bahwa schema katalog lama tidak muncul kembali.

## 10. Batas bukti hosted

Test lokal dan migration repository tidak membuktikan bahwa hosted Supabase sudah diperbarui. Setelah deployment migration yang disetujui, verifikasi migration history serta objek Auth/Mentor/Hero Poster/Digital Product pada target project. Jangan menganggap `202609140002_remove_legacy_product_catalog.sql` atau `202609140003_digital_product_domain.sql` telah diterapkan remote hanya karena file-nya ada di repository.

Referensi resmi: [SSR Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [template email](https://supabase.com/docs/guides/auth/auth-email-templates), [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [Admin invitations](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).
