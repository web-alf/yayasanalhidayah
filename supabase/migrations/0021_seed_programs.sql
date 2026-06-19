-- 0021_seed_programs.sql
-- Seed the 8 donation campaigns previously hardcoded in src/data/programs.ts.
-- Dollar-quoted text ($$...$$) avoids apostrophe escaping in Indonesian copy.
-- sort_order is newest-first (matches the old array order); created_at is staggered
-- by sort_order so `order by created_at desc limit 3` returns the 3 newest.
-- Idempotent: re-running is a no-op once slugs exist.

insert into public.programs
  (title, category, tag, slug, image, alt, description, donasi_url, sort_order, is_published, created_at)
values
  ($$Kewajiban Itu Tidak Hilang Meski Sudah Lama Berlalu$$,
   'Kafarat', 'Tebusan', 'kewajiban-itu-tidak-hilang-meski-sudah-lama-berlalu',
   '/program/program-kafarat-kewajiban.webp', $$Kewajiban Kafarat yang Tidak Hilang$$,
   $$Sumpah yang terlanjur terucap dan terlanggar tetap menjadi tanggungan, meski waktu telah lama berlalu. Tunaikan kafaratnya sekarang dan lepaskan beban yang selama ini menggelayuti hati.$$,
   'https://donasi.yayasanalhidayah.com/campaign/kewajiban-itu-tidak-hilang-meski-sudah-lama-berlalu',
   0, true, now() - interval '0 day'),
  ($$Dana Siaga Bencana: Siapkan Bantuan Sebelum Musibah Terjadi$$,
   'Kemanusiaan', 'Kemanusiaan', 'dana-siaga-bencana',
   '/program/program-dana-siaga-bencana.webp', $$Dana Siaga Bencana$$,
   $$Musibah datang tanpa aba-aba. Bersama Anda, kami siapkan dana siaga agar bantuan logistik, obat, dan kebutuhan pokok bisa bergerak cepat saat bencana terjadi.$$,
   'https://donasi.yayasanalhidayah.com/campaign/dana-siaga-bencana',
   1, true, now() - interval '1 day'),
  ($$Lunasi Hutang Puasamu, Bayar Fidyahmu!$$,
   'Fidyah', 'Tebusan', 'tunaikan-fidyah-bersama-alhidayah',
   '/program/program-fidyah.webp', $$Lunasi Hutang Puasamu, Bayar Fidyahmu!$$,
   $$Tidak mampu berpuasa karena sakit berkepanjangan atau usia lanjut? Tunaikan fidyah Anda — kami salurkan langsung kepada fakir miskin yang berhak menerimanya.$$,
   'https://donasi.yayasanalhidayah.com/campaign/tunaikan-fidyah-bersama-alhidayah',
   2, true, now() - interval '2 days'),
  ($$Allah Tidak Menutup Pintu Ampunan, Bahkan untuk Kesalahan yang Berat Sekalipun$$,
   'Kafarat', 'Tebusan', 'allah-tidak-menutup-ampunan',
   '/program/program-kafarat-ampunan.webp', $$Allah Tidak Menutup Pintu Ampunan$$,
   $$Sebesar apa pun kesalahan, pintu ampunan Allah selalu terbuka. Mulai langkah taubat dengan menunaikan kafarat, agar kembali suci di hadapan-Nya.$$,
   'https://donasi.yayasanalhidayah.com/campaign/allah-tidak-menutup-ampunan',
   3, true, now() - interval '3 days'),
  ($$Raih Ampunan & Rahmat dengan Bayar Kafarat$$,
   'Kafarat', 'Tebusan', 'raih-ampunan-dan-rahmat-dengan-bayar-kafarat',
   '/program/program-kafarat-rahmat.webp', $$Raih Ampunan dan Rahmat dengan Bayar Kafarat$$,
   $$Setiap kafarat yang ditunaikan adalah jalan meraih ampunan sekaligus rahmat — menebus diri, sekaligus menolong saudara sesama yang berhak menerima.$$,
   'https://donasi.yayasanalhidayah.com/campaign/raih-ampunan-dan-rahmat-dengan-bayar-kafarat',
   4, true, now() - interval '4 days'),
  ($$Jangan Biarkan Kafarat Sumpahmu Menggantung Hingga Hari Kiamat$$,
   'Kafarat', 'Tebusan', 'jangan-biarkan-kafarat-sumpahmu-menggantung-hingga-hari-kiamat',
   '/program/program-kafarat-sumpah.webp', $$Jangan Biarkan Kafarat Sumpahmu Menggantung$$,
   $$Sumpah yang belum ditebus terus menggantung sebagai tanggungan. Selesaikan sekarang juga, sebelum terlambat dan menanggung bebannya lebih lama.$$,
   'https://donasi.yayasanalhidayah.com/campaign/jangan-biarkan-kafarat-sumpahmu-menggantung-hingga-hari-kiamat',
   5, true, now() - interval '5 days'),
  ($$Tebus Sumpah yang Pernah Kamu Ucap$$,
   'Kafarat', 'Tebusan', 'tebus-sumpah-yang-pernah-kamu-ucap',
   '/program/program-kafarat-tebus.webp', $$Tebus Sumpah yang Pernah Kamu Ucap$$,
   $$Pernah bersumpah atas nama Allah lalu melanggarnya? Tebus dengan kafarat yang kami salurkan langsung kepada mereka yang berhak menerimanya.$$,
   'https://donasi.yayasanalhidayah.com/campaign/tebus-sumpah-yang-pernah-kamu-ucap',
   6, true, now() - interval '6 days'),
  ($$Sempurnakan Taubatmu, Tunaikan Kafarat$$,
   'Kafarat', 'Tebusan', 'sempurnakan-taubatmu-tunaikan-kafarat',
   '/program/program-kafarat.webp', $$Sempurnakan Taubatmu, Tunaikan Kafarat$$,
   $$Pernahkah mengucap sumpah atas nama Allah SWT dan melanggarnya? Atau melakukan jima' siang hari di bulan Ramadhan? Tunaikan Kafaratmu Segera...!! Jangan biarkan kesalahan masa lalu tetap menghantui — sekarang adalah waktu memperbaiki diri.$$,
   'https://donasi.yayasanalhidayah.com/campaign/sempurnakan-taubatmu-tunaikan-kafarat',
   7, true, now() - interval '7 days')
on conflict (slug) do nothing;

-- Seed a couple of rekening defaults so DonorCTA has data out of the box.
insert into public.rekening (bank, no, label, account_holder, sort_order, is_published)
values
  ('BCA', '0123456789', 'Zakat & Donasi', 'Yayasan Alhidayah', 0, true),
  ('BSI', '9876543210', 'Zakat & Donasi', 'Yayasan Alhidayah', 1, true)
on conflict do nothing;
