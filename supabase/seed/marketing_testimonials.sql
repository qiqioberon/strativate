-- Strativate homepage testimonial copy seed.
-- Images intentionally remain NULL. Upload the matching photos from Admin > Konten > Testimonials.
-- Nama kompetisi dan achievement dipertahankan sesuai sumber; narasi testimonial diterjemahkan ke Bahasa Indonesia.
-- Rows are published already, but public RLS/homepage queries expose them only after image_path is populated.

insert into public.marketing_testimonials
  (slug, competition_name, achievement, testimonial, image_path, sort_order, is_published)
values
  (
    'yed-universitas-indonesia-bcc',
    'YED Universitas Indonesia BCC',
    '1st Place · Best Presentation',
    'Kami ingin mengucapkan terima kasih yang sebesar-besarnya kepada Strativate atas bimbingan dan masukan berharga selama perjalanan ini. Dengan dukungan Strativate, ide-ide kami menjadi lebih terstruktur dan siap dipresentasikan sehingga kami jauh lebih percaya diri saat final presentation. Alhamdulillah, proses ini membawa kami meraih 1st Place dan Best Presentation Winner. Kami sangat bersyukur atas mentoring, dorongan, dan dukungan yang terus diberikan selama kompetisi hingga setelahnya.',
    null,
    1,
    true
  ),
  (
    'high-school-business-competition',
    'High School Business Competition',
    '1st Place',
    'Kami belajar sangat banyak hanya dalam tiga sesi mentoring. Masukan yang kami terima benar-benar membantu memperbaiki pitch deck dan strategi bisnis kami. Mentor Strativate membagikan framework bisnis yang praktis, tips menyusun presentation deck, serta strategi yang sangat berguna untuk tim kami. Mentornya juga sangat approachable sehingga setiap sesi mudah diikuti dan dipahami. Kami berharap suatu saat bisa mengikuti sesi mentoring offline bersama Strativate.',
    null,
    2,
    true
  ),
  (
    'undip-business-plan-competition',
    'UNDIP Business Plan Competition',
    '2nd Place',
    'Mentor Strativate membawakan setiap sesi secara terstruktur dan engaging. Penjelasannya jelas, ritmenya pas, dan mudah dipahami. Arahan mengenai referensi, analisis, dan struktur pitch deck sangat membantu meningkatkan kualitas pekerjaan kami hingga akhirnya berhasil meraih 2nd Place di Business Plan Competition. Mentornya juga ramah, rendah hati, dan selalu bersedia menjawab pertanyaan kami. Kami benar-benar berharap bisa mengikuti sesi mentoring bersama Strativate lagi di masa depan.',
    null,
    3,
    true
  ),
  (
    'prasmul-ecc-first-place',
    'Business Plan Competition Prasmul ECC',
    '1st Place',
    'Kami berlima sangat bersyukur bisa menjadi bagian dari Strativate. Melalui sesi mentoring, kami belajar bagaimana menyusun Business Model Canvas dan proposal dengan benar. Setiap kali kami merasa buntu atau membutuhkan ide baru, mentor Strativate selalu memberikan masukan yang jelas, detail, dan praktis. Hanya dengan enam sesi mentoring, kami berhasil memenangkan tiga kompetisi berbeda sekaligus mendapatkan banyak insight, rasa percaya diri, kerja sama tim, dan pengalaman belajar yang akan terus kami bawa ke depannya.',
    null,
    4,
    true
  ),
  (
    'business-case-competition-first-place',
    'Business Case Competition',
    '1st Place',
    'Kami sangat berterima kasih kepada Strativate karena sudah memberikan pengalaman mentoring yang luar biasa sepanjang perjalanan kompetisi bisnis kami. Terima kasih khusus untuk para mentor atas sesi-sesi yang sangat insightful. Setiap topik dijelaskan secara menyeluruh dengan masukan praktis sampai kami benar-benar paham. Ini adalah Business Case Competition pertama kami dan Alhamdulillah kami berhasil meraih 1st Place. Terima kasih banyak Strativate karena sudah mendorong tim kami untuk terus berkembang.',
    null,
    5,
    true
  ),
  (
    'economic-essay-competition-trisakti',
    'Economic Essay Competition Trisakti',
    '2nd Place',
    'Sejujurnya, di awal saya benar-benar buntu. Ide saya ke mana-mana dan saya tidak tahu bagaimana mengubahnya menjadi esai dan presentasi yang solid. Berkat mentor dari Strativate, semuanya akhirnya terasa lebih jelas. Saya bisa membangun argumen yang lebih kuat, menyusun Theory of Change dan solusi dengan lebih terarah, lalu Alhamdulillah berhasil meraih 2nd Place. Terima kasih atas bimbingan dan dukungannya yang luar biasa.',
    null,
    6,
    true
  ),
  (
    'business-case-competition-impact-ubm',
    'Business Case Competition IMPACT UBM',
    'Competition Awardee',
    'Di balik setiap solusi yang solid, ada proses mentoring yang sama berharganya. Mentor dari Strativate membantu tim kami memperbaiki cara berpikir, memperkuat narasi, dan menemukan berbagai gap yang sebelumnya tidak kami sadari. Setiap sesi feedback terasa praktis dan insightful. Berkat arahan serta dukungan yang diberikan, kami menjadi jauh lebih percaya diri dan berhasil memberikan performa terbaik kami di kompetisi.',
    null,
    7,
    true
  ),
  (
    'prasmul-ecc-third-place',
    'Business Plan Competition Prasmul ECC',
    '3rd Place',
    'Kami sangat bersyukur mendapat kesempatan belajar bersama Strativate. Sesi mentoring membantu kami memperkuat business plan, memperbaiki pitch deck, dan menyusun strategi yang lebih jelas. Setiap masukan terasa praktis, detail, dan mudah diterapkan. Berkat arahan serta dukungan yang terus diberikan, kami dengan bangga berhasil meraih 3rd Place dalam business plan competition pertama kami. Kami sangat merekomendasikan Strativate.',
    null,
    8,
    true
  )
on conflict (slug) do nothing;
