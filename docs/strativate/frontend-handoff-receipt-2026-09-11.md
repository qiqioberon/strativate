# Frontend handoff receipt — 11 September 2026

This is the implementation receipt for `Bahan FE 1`. All PDFs were reviewed in
full, including visual page inspection. The workbook was inspected at cell and
hyperlink level. Linked Drive portraits were downloaded, MIME/decoding checked,
visually matched, and converted to responsive WebP derivatives. No PDF screenshot
or embedded PDF media is used as a production asset.

## Source inventory and disposition

| Source | Classification | Implementation |
| --- | --- | --- |
| `Brand Guideline.pdf` (6 pages) | Brand specification | Poppins, logo hierarchy, palette family, contact identity, orange/red/yellow visual direction |
| `Color Palette.png` | Exact color master | `#FF7A00`, `#DC0D16`, `#B3151C`, `#FFE79D`, `#000000`, `#FDFDFD` centralized in content/CSS tokens |
| `Data Mentor.xlsx` | Public mentor content plus private internal notes | 26 public profiles; columns A and H omitted; 19 external photos integrated; no ratings invented |
| `Program Page.pdf` (4 pages) | Public service overview | Eight service cards; only Private and Intensive receive detail links |
| `Private Mentoring Guidebook (Indo).pdf` (19 pages) | Program/editorial reference | Private detail, learning paths, topics, journey, categories and contact reconciled through Product Master |
| `Intensive Program Guidebook (Indonesia).pdf` (20 pages) | Program/editorial reference | Intensive detail, journey, packages, add-ons, bundles, categories and conditional claims reconciled through Product Master |
| `Logo Strativate/1.png` | Approved stacked red logo | Used to derive transparent standalone mark |
| `Logo Strativate/2.png` | Approved stacked inverse logo on gradient | Audited; retained in source folder, not duplicated in runtime |
| `Logo Strativate/3.png` | Approved black/orange alternate | Audited; not selected for primary placement |
| `Logo Strativate/4.png` | Approved inverse mark on gradient | Source for favicon and Apple icon |
| `Logo Strativate/5.png` | Alternate folded-ribbon logo | Audited; not selected because it is outside the guideline’s primary set |
| `Logo Strativate/6.png` | Approved horizontal orange wordmark | Primary header/footer/auth/dashboard source |

The prior 27-page `Strativate_Frontend_Content_Asset_Requirements.pdf` was also
reviewed as an audit reference; its pre-handoff “missing” statuses are superseded
by this receipt where files are now supplied.

## Generated brand derivatives

| Output | Source / transformation | Placement |
| --- | --- | --- |
| `public/assets/brand/strativate-wordmark.png` | Logo 6; background removed, tightly cropped, aspect ratio preserved, max width 720 | Header, footer, auth, dashboards |
| `public/assets/brand/strativate-mark.png` | Logo 1; mark isolated, background removed, aspect ratio preserved | Missing-photo fallback and loading state |
| `public/assets/brand/strativate-logo-source.png` | Lossless copy of Logo 6 | Provenance only |
| `public/assets/brand/strativate-mark-inverse-source.png` | Lossless copy of Logo 4 | Provenance only |
| `app/icon.png` | Logo 4 resized to 512×512 | Next.js file-based browser icon |
| `app/apple-icon.png` | Logo 4 resized to 180×180 | Next.js file-based Apple icon |
| `app/opengraph-image.png` | 1200×630 composition using supplied primary logo and palette | Default Open Graph image |

The handoff contains raster PNG logos, not an SVG master. The derivatives are
therefore correctly documented as PNG-derived rather than described as official SVGs.

## Mentor portrait mapping

| Mentor | Spreadsheet-linked source | Runtime output | Status |
| --- | --- | --- | --- |
| Navira Putri | `https://drive.google.com/file/d/1-7kzRmI-nUxsnWQD57zz9GFWsBMKgaoR/view` | `navira-putri.webp` | Ready |
| Safira Aulia | `https://drive.google.com/file/d/1skTq5hRfqX0CB5E_cx3_GtGYrgC9nM8w/view` | `safira-aulia.webp` | Ready |
| Aqil Drajat | `https://drive.google.com/file/d/1ozr8hMkFDfNzi_HQ2LkQ7p7bJ1tL9Vdc/view` | `aqil-drajat.webp` | Ready |
| Ilham Hakim | `https://drive.google.com/file/d/110rSe6HblHYN-IpiLkJKKd5m2hCrOivn/view` | `ilham-hakim.webp` | Ready |
| Rohananda Devi | `https://drive.google.com/file/d/18R_VccCM-wv_NPTr4K-8FY1vNq1Ted4/view` | `rohananda-devi.webp` | Ready |
| Ratna Puspa | `https://drive.google.com/file/d/1xnMHNU3U88FRLsNoGGGEpxKl_2O2PN8s/view` | `ratna-puspa.webp` | Ready |
| Cherien Stevie | `https://drive.google.com/file/d/194DemUhQZAtGzV7fIVtFwgo0rZjHCEZU/view` | `cherien-stevie.webp` | Ready |
| M. Iqbal Banoza | `https://drive.google.com/file/d/1QOP1sV3NfabxgQq4uB-HUXHSaJrrf8fY/view` | `m-iqbal-banoza.webp` | Ready |
| Akmal Faqih | `https://drive.google.com/file/d/1J2enTpUPlmq2NNNXs1l7InbGBSRai0S1/view` | `akmal-faqih.webp` | Ready |
| Syona Hana | `https://drive.google.com/file/d/1YYS7cRv3Hcb8r7L2vUE8KeP76zXRQSjA/view` | `syona-hana.webp` | Ready |
| Lubna Qumilaila | `https://drive.google.com/file/d/1puGGKBT4R1ySH3wwxVHanmuJdMzFM3fk/view` | `lubna-qumilaila.webp` | Ready |
| Ruth Debora | `https://drive.google.com/file/d/1fedSpSZTIpnlFZWNAqFU03_Dq7DCKaAc/view` | `ruth-debora.webp` | Ready |
| Muhammad Harits | `https://drive.google.com/file/d/17ICATHk3wHDqKV22hXV5MkCXyeO_tHvI/view` | `muhammad-harits.webp` | Ready |
| Rafi Aurelian | `https://drive.google.com/file/d/1xFByfNsn-w0y4ppDi3A9kT3j1HvGsgXU/view` | `rafi-aurelian.webp` | Ready |
| Ratu Hanifa | `https://drive.google.com/file/d/1ZMFgw2FL7-jOGMMKOAsEEdkh4G-m1f2g/view` | `ratu-hanifa.webp` | Ready |
| William Philip | `https://drive.google.com/file/d/1QJ1MjS6UZNoNOsPRw2BSLZqp0BXJB9TE/view` | `william-philip.webp` | Ready |
| Alvaro Zhafran | `https://drive.google.com/file/d/1om0oRENxPlC9mFqmKAtUUNhpjjAba658/view` | `alvaro-zhafran.webp` | Ready |
| Adrian Nicholas | `https://drive.google.com/file/d/1_yBHvoSYs9ZFlAsujY9DfktXivCgGsZp/view` | `adrian-nicholas.webp` | Ready; source is lower resolution |
| Naura Tsabita Wibowo | `https://drive.google.com/file/d/1QzdMdDsg05vNM1-ocVMODkm7jX3qvge8/view` | `naura-tsabita-wibowo.webp` | Ready |

The workbook supplies no photo link for Ivonne Qiu, Fajri Alan, Deanna, Terry
Kuron, Albert Lukas, Faluna A. Janitra, or M. Sultan Perkasa. Their cards use the
approved mark and visibly say “Foto belum tersedia”; no synthetic portrait is used.

## Data handling and conflict decisions

- Spreadsheet names and tiers are the primary mentor authority. Display slugs are
  deterministic lowercase/hyphen derivatives. Internal numeric IDs and column H
  notes are never included in runtime content.
- Navira appears as Navira Putri / Navira Apriliani / Navira Aprilliani across
  sources; the workbook display name `Navira Putri` is used.
- Safira’s workbook employer differs from the guidebook; the workbook role at Grab
  is used.
- Fajri Alan is used instead of the conflicting guidebook `Fajri Ghazali`.
- M. Iqbal Banoza and Lubna Qumilaila use workbook name/tier even where filenames
  or guidebook groupings differ. Faluna and Sultan retain a null tier because the
  workbook does not supply one.
- Expertise labels are mechanical public expansions of workbook abbreviations;
  operational preferences such as “prefer” and teaching-language notes are omitted.
- The Product Master remains the sole commercial authority for prices and bundles.
  The eight-service overview does not invent prices or detail routes.
- Institutional counts describe student origin/reach, never partnership. Country
  counts, mentor ratings, unavailable institution marks, and unsupported media are omitted.

## Placement summary

- `/`: real brand artwork, three approved proof values, source-backed mentor preview,
  Product Master program cards, and honest digital-product states.
- `/program`: all eight supplied services; detail links only appear when the matching
  Private/Intensive Product Master row is published.
- `/mentor`: 26 searchable/filterable profiles with 19 real portraits and 7 fallbacks.
- `/program/private-mentoring` and `/program/intensive-mentoring`: Product Master
  prices/offerings plus guidebook editorial and official contact actions.
- `/tentang-kami`, `/tanya-jawab`, footer, metadata, auth, mentee dashboard, mentor
  dashboard, and admin: updated source-backed brand/contact presentation.

## Remaining stakeholder inputs

Seven mentor portraits; SVG logo masters if available; Big Class commercial master;
Digital Product masters/covers/files; standalone program, achievement, testimonial,
and institution media with rights; testimonial identity/consent; and final legal,
guarantee, cancellation, refund, privacy, and terms documents.
