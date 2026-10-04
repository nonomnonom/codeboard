# LENGKAP

Film satire fiktif 15 detik. Enam scene × 60 frame pada 24 fps; 1920 × 1080.
Artwork berasal dari source TypeScript dan API publik Codeboard. Gambar referensi tidak dimasukkan ke film.

## Menjalankan

```powershell
$env:SKIA_CANVAS_THREADS='2'
# Bila FFmpeg belum berada di PATH, isi lokasi executable yang tersedia:
$env:FFMPEG_PATH='C:/path/to/ffmpeg.exe'
npm run example:lengkap:movie
npm run example:lengkap:verify
```

`example:lengkap:movie` sengaja mengganti proyek hasil generate. Salin proyek terlebih dahulu bila sudah diedit secara independen. Untuk mengekspor ulang proyek tersimpan tanpa authoring ulang:

```powershell
npx tsx examples/lengkap/render.ts --movie
```

Hasil ada di `examples/output/lengkap/`: `lengkap.mp4`, `lengkap-storyboard.png`, `lengkap-hero.png`, dan `lengkap.cboard`.

[Film hasil render](../../docs/media/lengkap.mp4) dan [storyboard](../../docs/media/lengkap-storyboard.png) tersedia untuk ditinjau. Jalankan verifikasi di atas untuk memeriksa timing dan isolasi revisi dari source saat ini.

## Source dan revisi

- `../lengkap.ts`: komposisi, enam scene, keyframe, exposure, dan timing.
- `art.ts`: enam jenis media procedural (tujuh preset). Artwork dasar tetap berupa massa tinta/dry brush. Layer bernama `Detail / …` menambahkan kontur pensil, aksen tepi arang, sapuan pastel pendek, detail jok/roda, sudut kertas, dan jejak tanah. Pena membentuk garis tegas; tinta cap tetap berpori. Tambahan merupakan stroke editable, bukan penggantian tekstur seluruh bidang. Tekanan serta lintasan bervariasi secara deterministik; finishing mengikuti timing scene. Motif motor konsisten. Siluet memakai batas vector editable sebagai mask untuk sapuan raster; bukan gambar tempelan.
- `sound.ts`: Foley original deterministik, CC0-1.0; tidak memakai rekaman pihak lain.
- `verify.ts`: durasi, saat cap muncul, tahanan penutup, integritas SQLite, serta revisi garis merah di scene 05. Membandingkan hash gambar dan struktur semua scene lain, menyimpan alternatif bernama `shorter-red-link-<hash>`, lalu undo ke versi film dan membuka ulang proyek. Suffix membedakan versi artwork tanpa menimpa revisi lama.

Referensi imagegen hanya digunakan saat pengembangan dan tidak menjadi dependensi film. Font: Arial dan Segoe Print dari sistem Windows; font tidak didistribusikan.

Penyimpanan `.cboard` memakai SQLite dan payload binary deduplicated. Tidak ada dump frame atau JSON monolitik.

## Dukungan engine

`rasterStroke(points, brush, { reveal: { startFrame, endFrame } })` menggambar urutan dab berdasarkan panjang lintasan. Frame bersifat global: kosong pada start, lengkap pada end. Timestamp titik tetap data input pena. Retiming dan reflow mengikuti range ini; capture component menyimpan artwork tanpa animasi. Seed, penempatan dab, dan taper memakai lintasan utuh sehingga bagian yang sudah terbentuk tetap stabil.

Cache raster mengikuti skala tampilan, dan menyimpan piksel yang telah dirender. Data artwork sumber tetap editable. Ini kemampuan umum, tanpa cabang renderer yang menyebut LENGKAP.
