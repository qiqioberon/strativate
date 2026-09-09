# Product / Catalog Master

Product Master adalah sumber resmi identitas komersial, struktur penawaran, dan harga katalog Strativate. Implementasinya berada pada migration `202609090001_product_catalog_master.sql`, domain TypeScript di `lib/catalog/`, serta editor persisten “Katalog Produk” pada dashboard admin.

## Sumber data bisnis

Private Mentoring dan Intensive Mentoring di-bootstrap sebagai data aktif/dipublikasikan dari dua guidebook yang disediakan pemilik proyek pada 9 September 2026:

- `Private Mentoring Guidebook (English) (2).pdf`;
- `Intensive Program Guidebook (English).pdf`.

Nilai di guidebook disimpan apa adanya. Secara khusus, offering Top Student Mentor tiga sesi menyimpan harga per sesi Rp285.000, total paket Rp885.000, dan harga referensi Rp950.000. Nilai total tersebut tidak dihitung ulang atau “dikoreksi” dari sumber lain.

Bootstrap mencakup dua produk program, sepuluh offering Mentoring Privat, tiga offering Mentoring Intensif, tiga add-on, tiga bundle beserta komposisi relasionalnya, tier mentor, paket sesi, jalur belajar, fokus topik, benefit, durasi sesi, dan batas peserta. Tidak ada data Big Class atau Produk Digital yang di-bootstrap karena belum ada master produksi yang disetujui.

## Batas kepemilikan data

- `catalog_products` memiliki identitas program dan metadata katalog umum.
- `catalog_commercial_items` memberi UUID stabil kepada setiap offering, add-on berbayar, dan bundle.
- Benefit dan delivery option memiliki identitas stabil sendiri, tetapi bukan item komersial dan tidak dapat menjadi SKU.
- Product Master memiliki kode, label kanonis, ketersediaan, urutan, dan dukungan nilai khusus untuk jalur belajar/fokus topik.
- `lib/program-information.ts` hanya menyimpan penjelasan editorial yang dipetakan melalui kode stabil Product Master. File itu tidak memiliki daftar atau label operasional paralel.
- Metadata Produk Digital hanya menyatakan `pdf` atau `video`; upload, storage, URL, entitlement, dan delivery tidak dimodelkan.

## Lifecycle dan keamanan

`draft` berarti konfigurasi belum aktif, `published` berarti katalog aktif saat ini, dan `archived` berarti identitas yang tidak lagi ditawarkan. Harga, deskripsi, visibility, featured state, dan ordering dapat diperbarui. Perubahan makna komersial—misalnya jumlah sesi atau komposisi bundle—dibuat sebagai identitas draf baru lalu identitas lama diarsipkan.

Semua tabel katalog memakai RLS. Policy public mengulang seluruh jalur `published` + `is_public`, termasuk tabel child dan relationship. View `public_catalog_*` menggunakan `security_invoker = true`, kolom eksplisit, dan tetap tunduk pada RLS tabel dasar. Lifecycle hanya diubah melalui RPC admin. Suite SQL menguji pembacaan langsung yang terlalu luas dan membuktikan produk internal/draf/arsip tidak dapat bocor lewat UUID child.

## Integrasi aplikasi

- `/explore`, `/program/[slug]`, dan bagian program di homepage membaca view Product Master melalui `lib/catalog/public.ts`.
- Label dan urutan delivery option berasal dari database; editorial hanya menambah penjelasan berdasarkan kode.
- Big Class dan Produk Digital menampilkan keadaan kosong/“segera hadir” ketika tidak ada record published.
- Data demo `lib/catalog.ts` dan `programOptions`/`services` telah dihentikan.
- Checkout tetap simulasi dan di luar scope. Batas kompatibilitas hanya menerima product UUID, commercial-item UUID, dan fixed price dari Product Master; quotation item ditolak.

Saat browser test lokal memakai `TEST_DATABASE_URL`, adapter pengujian membaca view Product Master dari PostgreSQL disposable yang sama. Adapter tersebut tidak menyimpan fixture atau harga kedua.

## Verifikasi

```bash
pnpm test
pnpm test:db -- --bootstrap
pnpm typecheck
pnpm lint
pnpm exec playwright test --workers 3
pnpm build
```

Browser test Product Master lokal memerlukan PostgreSQL disposable dengan migration yang sudah di-bootstrap dan `TEST_DATABASE_URL` diteruskan ke proses Playwright.
