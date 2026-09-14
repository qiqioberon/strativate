# Konfigurasi Supabase dan Shared Commerce Strativate

Implementasi memakai Next.js App Router, Supabase SSR cookies, dan Shared Commerce yang tetap terpisah dari business domain. Login bersama berada di `/auth`; role canonical berasal dari `public.profiles`, bukan user metadata. Dashboard tetap `/admin`, `/mentor`, dan `/dashboard`; Mentee yang belum selesai onboarding diarahkan ke `/onboarding`.

## 1. Environment

Isi `.env` mengikuti `.env.example` tanpa menaruh secret di client bundle:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET_KEY
APP_URL=http://localhost:3000

FEATURE_DIGITAL_PRODUCTS=false
MIDTRANS_ENV=sandbox
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=YOUR_MIDTRANS_CLIENT_KEY
MIDTRANS_SERVER_KEY=YOUR_MIDTRANS_SERVER_KEY
```

`SUPABASE_SECRET_KEY` dan `MIDTRANS_SERVER_KEY` adalah **server-only**. Jangan beri prefix `NEXT_PUBLIC_`, jangan kirim melalui API response, dan jangan log nilainya. `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` memang public dan dipakai Snap.js di browser.

`FEATURE_DIGITAL_PRODUCTS` adalah satu-satunya keputusan runtime untuk membuka storefront/cart/checkout Digital Product. Safe default adalah `false`.

## 2. Urutan migration

Untuk database baru, jalankan semua migration sesuai filename. Riwayat penting terbaru adalah:

1. `202609140001_marketing_hero_poster_natural_order.sql`
2. `202609140002_remove_legacy_product_catalog.sql`
3. `202609140003_digital_product_domain.sql`
4. `202609140004_mentor_account_status_weekly_availability.sql`
5. `202609140005_fix_managed_mentor_listing.sql`
6. `202609140006_shared_commerce.sql`
7. `202609140007_midtrans_payment_attempts.sql`

Migration lama `202609090001_product_catalog_master.sql` tetap history dan tidak boleh dihapus, tetapi `202609140002_remove_legacy_product_catalog.sql` membongkar runtime Product Catalog Master lama. Jangan membuat kembali `catalog_*` atau `public_catalog_*` sebagai fondasi commerce.

### Catatan branch development lama

Sebelum branch Phase 2 disinkronkan dengan `main`, Shared Commerce sempat memakai filename `202609140005_shared_commerce.sql` dan Payment Attempts memakai `202609140006_midtrans_payment_attempts.sql`. Setelah `main` membawa migration mentor `202609140005_fix_managed_mentor_listing.sql`, file Shared Commerce/Payment Attempts dipindah nomor menjadi `006`/`007` agar urutan history tidak bentrok.

Jika database development persisten **pernah** menerapkan filename lama dari feature branch, jangan langsung menjalankan history baru secara buta. Periksa migration history dan lakukan rekonsiliasi/reset development yang disengaja terlebih dahulu. Repository tidak mengasumsikan bahwa migration branch lama sudah atau belum diterapkan ke hosted Supabase.

## 3. Arsitektur Phase 2

Arsitektur commerce saat ini:

```text
Digital Product Domain
        ↓
Commerce Item
        ↓
Shared Cart
        ↓
Shared Checkout
        ↓
Order + immutable Order Item snapshots
        ↓
Payment Attempt
        ↓
Midtrans Snap Embedded
```

Private Mentoring, Intensive Mentoring, dan Big Class belum dihubungkan ke Shared Commerce pada Phase 2 ini. Desain `commerce_items` sengaja reusable supaya business domain tersebut dapat masuk ke Cart/Order yang sama pada fase berikutnya tanpa membuat Cart/Order khusus Digital Product.

## 4. Digital Product dan cover security

`public.digital_products` menyimpan nama, slug, deskripsi, object path cover, integer Rupiah, dan metadata teknis. Actual paid file/content **belum ada** di Phase 2.

Bucket `digital-product-images` berisi cover yang merupakan **public marketing assets**. Public/anonymous user boleh membaca cover dan record Digital Product untuk storefront. Hanya admin yang boleh upload, replace, atau delete object. Jangan menambahkan public write policy.

Tidak ada PDF/video/downloadable asset, signed paid-file URL, content viewer, DRM, atau course progress pada fase ini.

## 5. Cart, Order, dan ownership

Mentee yang sudah menyelesaikan onboarding memakai satu active Shared Cart. Browser tidak mengirim harga atau total authoritative; `create_order_from_cart` menghitung ulang dari Commerce Item resolver di PostgreSQL dan membuat immutable `order_items` snapshots.

Digital Product dianggap dimiliki hanya bila terdapat:

```text
paid Order
+ Order Item
+ item_kind_snapshot = digital_product
```

Dashboard `Produk Digital` menggunakan `list_owned_digital_products()`. Nama, tanggal pembelian, dan harga berasal dari snapshot/history; cover boleh memakai cover produk saat ini jika source record masih ada. Tidak ada action download/open karena file produk belum ada.

## 6. Midtrans

Provider module memilih endpoint berdasarkan `MIDTRANS_ENV`:

- sandbox Snap: `https://app.sandbox.midtrans.com/snap/v1/transactions`
- production Snap: `https://app.midtrans.com/snap/v1/transactions`
- sandbox status: `https://api.sandbox.midtrans.com/v2/{id}/status`
- production status: `https://api.midtrans.com/v2/{id}/status`
- sandbox Snap.js: `https://app.sandbox.midtrans.com/snap/snap.js`
- production Snap.js: `https://app.midtrans.com/snap/snap.js`

Server membuat transaksi Midtrans hanya dari trusted `orders.total_amount` dan immutable `order_items`. Jumlah `item_details` diverifikasi sama dengan total Order sebelum request dikirim.

Checkout memakai official Snap Embedded:

```js
window.snap.embed(token, {
  embedId: 'midtrans-snap-container',
  onSuccess,
  onPending,
  onError,
  onClose,
})
```

`onSuccess` bukan bukti pembayaran. Browser meminta `/api/checkout/status`, backend mengambil status Midtrans menggunakan Server Key, lalu state diterapkan melalui transition database yang sama dengan webhook. `onClose` tidak menandai gagal dan pending Order dapat dilanjutkan.

## 7. Midtrans Dashboard webhook

Set **Payment Notification URL** menjadi:

```text
<APP_URL>/api/payments/midtrans/webhook
```

Production wajib memakai HTTPS.

Webhook tidak memerlukan session pengguna karena dipanggil oleh Midtrans. Backend memverifikasi `provider_order_id`, signature SHA-512, gross amount, transaction status, dan fraud status yang relevan sebelum menerapkan state.

Signature dihitung dari exact notification strings:

```text
SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
```

Jangan mengubah `gross_amount` ke floating point sebelum signature verification.

Status `paid` bersifat monotonic: notification `pending` yang datang terlambat tidak boleh menurunkan Order yang sudah `paid`, duplicate notification harus idempotent, dan `paid_at` harus tetap stabil.

## 8. Sandbox → production

Sebelum production:

1. gunakan Midtrans production Server Key dan Client Key;
2. set `MIDTRANS_ENV=production`;
3. pastikan `APP_URL` menggunakan origin HTTPS production;
4. konfigurasi Payment Notification URL production;
5. pastikan secret hanya tersedia di server environment;
6. lakukan transaksi sandbox nyata secara manual sebelum cutover, lalu transaksi production yang terkendali sesuai prosedur operasional.

Automated test **tidak** boleh bergantung pada jaringan Midtrans atau kredensial nyata.

## 9. Authentication dan Google OAuth

Di **Authentication → URL Configuration**, atur Site URL dan callback `/auth/callback` untuk local/production. Hindari wildcard production. Google OAuth menggunakan callback Supabase `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`; tambahkan callback aplikasi ke allowlist Supabase.

Role berasal dari database. Admin pertama harus dibuat melalui tooling tepercaya; tidak ada registrasi admin publik.

## 10. Verification

Verifikasi Phase 2 menjalankan:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:db -- --bootstrap
pnpm test:e2e
```

Build harus terbukti dengan `FEATURE_DIGITAL_PRODUCTS=false`; feature-enabled path juga diuji dalam konfigurasi terkontrol. Automated tests memakai key dummy dan tidak menghubungi Midtrans asli.

Database test runner hanya boleh diarahkan ke disposable database `strativate_test_*`. SQL suites memverifikasi RLS/ownership, active Cart uniqueness, duplicate Cart Item, authoritative pricing, immutable snapshots, deletion history, paid ownership, service-role Payment Attempts, retry/monotonic payment state, dan stabilitas `paid_at`.

## 11. Batas bukti hosted

Keberadaan migration dan test repository tidak membuktikan hosted Supabase sudah diperbarui. Setelah deployment yang disetujui, periksa migration history target dan terapkan migration yang belum ada secara berurutan. Jangan mengklaim transaksi Midtrans sandbox nyata telah diuji kecuali transaksi tersebut memang dilakukan dan diverifikasi di dashboard/provider.
