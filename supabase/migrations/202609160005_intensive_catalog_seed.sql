-- Guidebook-backed packages.
insert into public.intensive_mentoring_packages(id,code,slug,name,description,competition_scope,sessions_per_month,pricing_mode,price_amount,reference_price_amount,sort_order,is_active) values
('98000000-0000-0000-0000-000000000001','INTENSIVE','intensive','Intensive','Paling sesuai untuk peserta yang membutuhkan pendampingan rutin setiap minggu dan waktu yang cukup untuk menerapkan feedback di antara sesi.','national',4,'fixed',1150000,1400000,1,true),
('98000000-0000-0000-0000-000000000002','SUPER_INTENSIVE','super-intensive','Super Intensive','Paling sesuai untuk peserta yang membutuhkan perkembangan lebih cepat, review yang lebih sering, atau persiapan dalam timeline yang lebih singkat.','national',8,'fixed',2200000,2800000,2,true),
('98000000-0000-0000-0000-000000000003','INTERNATIONAL_COMPETITION','international-competition','Kompetisi Internasional','Setiap kompetisi internasional membutuhkan pendekatan yang berbeda. Rencana mentoring disesuaikan setelah konsultasi awal.','international',null,'consultation',null,null,3,true);

insert into public.intensive_mentoring_package_features(id,package_id,text,sort_order,is_active) values
('98010000-0000-0000-0000-000000000001','98000000-0000-0000-0000-000000000001','Perkembangan mingguan',1,true),
('98010000-0000-0000-0000-000000000002','98000000-0000-0000-0000-000000000001','Review dan penyempurnaan rutin',2,true),
('98010000-0000-0000-0000-000000000003','98000000-0000-0000-0000-000000000001','Persiapan kompetisi secara bertahap',3,true),
('98010000-0000-0000-0000-000000000004','98000000-0000-0000-0000-000000000002','Mentoring dua kali seminggu',1,true),
('98010000-0000-0000-0000-000000000005','98000000-0000-0000-0000-000000000002','Siklus review lebih cepat',2,true),
('98010000-0000-0000-0000-000000000006','98000000-0000-0000-0000-000000000002','Persiapan kompetisi intensif',3,true),
('98010000-0000-0000-0000-000000000007','98000000-0000-0000-0000-000000000003','Rencana persiapan khusus kompetisi',1,true),
('98010000-0000-0000-0000-000000000008','98000000-0000-0000-0000-000000000003','Cakupan dan frekuensi sesi yang disesuaikan',2,true),
('98010000-0000-0000-0000-000000000009','98000000-0000-0000-0000-000000000003','Pemilihan mentor sesuai kebutuhan kompetisi',3,true),
('98010000-0000-0000-0000-000000000010','98000000-0000-0000-0000-000000000003','Pendampingan terarah sepanjang persiapan',4,true);

insert into public.intensive_mentoring_add_ons(id,code,slug,name,description,price_amount,terms_note,sort_order,is_active) values
('98100000-0000-0000-0000-000000000001','DETAILED_PERFORMANCE_REPORT','detailed-performance-report','Laporan Performa Terperinci','Paling sesuai untuk peserta yang menginginkan evaluasi terstruktur atas keterampilan, perkembangan, dan prioritas pengembangan mereka.',150000,null,1,true),
('98100000-0000-0000-0000-000000000002','JUDGING_SIMULATION','judging-simulation','Simulasi Penjurian','Paling sesuai untuk peserta yang ingin menguji kemampuan pitching dan tanya jawab dalam situasi kompetisi yang realistis bersama juri.',300000,null,2,true),
('98100000-0000-0000-0000-000000000003','WIN_GUARANTEE_PROTECTION','win-guarantee-protection','Win Guarantee Protection','Record administratif untuk perlindungan berbasis hasil. Belum disetujui untuk publik tanpa ketentuan legal final.',500000,'Belum untuk publik: syarat, ketentuan, dan asesmen kelayakan harus disetujui terlebih dahulu.',3,false);

insert into public.intensive_mentoring_add_on_features(id,add_on_id,text,sort_order,is_active) values
('98110000-0000-0000-0000-000000000001','98100000-0000-0000-0000-000000000001','Penilaian berdasarkan keterampilan',1,true),
('98110000-0000-0000-0000-000000000002','98100000-0000-0000-0000-000000000001','Kekuatan dan area peningkatan',2,true),
('98110000-0000-0000-0000-000000000003','98100000-0000-0000-0000-000000000001','Ringkasan perkembangan',3,true),
('98110000-0000-0000-0000-000000000004','98100000-0000-0000-0000-000000000001','Rekomendasi mentor',4,true),
('98110000-0000-0000-0000-000000000005','98100000-0000-0000-0000-000000000002','Simulasi pitching dengan waktu terbatas',1,true),
('98110000-0000-0000-0000-000000000006','98100000-0000-0000-0000-000000000002','Tanya jawab bergaya kompetisi',2,true),
('98110000-0000-0000-0000-000000000007','98100000-0000-0000-0000-000000000002','Feedback dari juri independen',3,true),
('98110000-0000-0000-0000-000000000008','98100000-0000-0000-0000-000000000002','Penilaian performa berdasarkan rubrik',4,true),
('98110000-0000-0000-0000-000000000009','98100000-0000-0000-0000-000000000003','Milestone hasil yang disepakati',1,true),
('98110000-0000-0000-0000-000000000010','98100000-0000-0000-0000-000000000003','Review kelayakan khusus kompetisi',2,true),
('98110000-0000-0000-0000-000000000011','98100000-0000-0000-0000-000000000003','Pemantauan perkembangan prioritas',3,true);

insert into public.intensive_mentoring_bundles(id,code,slug,name,description,price_amount,badge_text,sort_order,is_active) values
('98200000-0000-0000-0000-000000000001','SKILL_BUILDER','skill-builder','Bundel Skill Builder','Paling sesuai untuk peserta yang ingin membangun keterampilan dan memahami kebutuhan pengembangan mereka.',1250000,'MULAI DI SINI',1,true),
('98200000-0000-0000-0000-000000000002','COMPETITION_READY','competition-ready','Bundel Competition Ready','Paling sesuai untuk peserta yang membutuhkan persiapan intensif, evaluasi terperinci, dan latihan pitching yang realistis.',2500000,'KUOTA TERBATAS',2,true),
('98200000-0000-0000-0000-000000000003','COMPETITION_ASSURANCE','competition-assurance','Bundel Competition Assurance','Record administratif untuk bundel yang bergantung pada perlindungan hasil. Belum disetujui untuk publik tanpa ketentuan legal final.',3000000,'PALING DIREKOMENDASIKAN',3,false);

insert into public.intensive_mentoring_bundle_items(id,bundle_id,item_type,package_id,add_on_id,feature_text,sort_order,is_active) values
('98210000-0000-0000-0000-000000000001','98200000-0000-0000-0000-000000000001','package','98000000-0000-0000-0000-000000000001',null,null,1,true),
('98210000-0000-0000-0000-000000000002','98200000-0000-0000-0000-000000000001','add_on',null,'98100000-0000-0000-0000-000000000001',null,2,true),
('98210000-0000-0000-0000-000000000003','98200000-0000-0000-0000-000000000001','feature',null,null,'Roadmap Mentoring Personal',3,true),
('98210000-0000-0000-0000-000000000004','98200000-0000-0000-0000-000000000001','feature',null,null,'Pendampingan Persiapan Kompetisi',4,true),
('98210000-0000-0000-0000-000000000005','98200000-0000-0000-0000-000000000002','package','98000000-0000-0000-0000-000000000002',null,null,1,true),
('98210000-0000-0000-0000-000000000006','98200000-0000-0000-0000-000000000002','add_on',null,'98100000-0000-0000-0000-000000000001',null,2,true),
('98210000-0000-0000-0000-000000000007','98200000-0000-0000-0000-000000000002','add_on',null,'98100000-0000-0000-0000-000000000002',null,3,true),
('98210000-0000-0000-0000-000000000008','98200000-0000-0000-0000-000000000002','feature',null,null,'Pendampingan Tahap Akhir',4,true),
('98210000-0000-0000-0000-000000000009','98200000-0000-0000-0000-000000000003','package','98000000-0000-0000-0000-000000000002',null,null,1,true),
('98210000-0000-0000-0000-000000000010','98200000-0000-0000-0000-000000000003','add_on',null,'98100000-0000-0000-0000-000000000001',null,2,true),
('98210000-0000-0000-0000-000000000011','98200000-0000-0000-0000-000000000003','add_on',null,'98100000-0000-0000-0000-000000000002',null,3,true),
('98210000-0000-0000-0000-000000000012','98200000-0000-0000-0000-000000000003','add_on',null,'98100000-0000-0000-0000-000000000003',null,4,true);
