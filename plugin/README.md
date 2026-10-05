# Codeboard agent plugin

Kumpulan Agent Skills untuk mengoperasikan Codeboard, dengan paket plugin Codex/Claude Code dan pemasangan folder skill untuk host lain yang kompatibel. Setiap skill membantu agent memilih operasi, menjalankan pekerjaan, dan memeriksa hasil berdasarkan kemampuan engine. Paket membawa manual dan referensi API Codeboard 1.0.0, quickstart, serta source demo karakter. Agent tidak perlu mengakses repo atau internet untuk membacanya.

Versi plugin: **1.0.0**. Dasar desain, kepemilikan instruksi, serta audit panduan ada di [catatan desain](docs/design.md).

Engine dan CLI dipasang lewat npm: `npm install -g codeboard-studio`, dengan Node.js 22.22 atau lebih baru. Untuk dependency project, gunakan `npm install --save-exact codeboard-studio` dan jalankan `npx codeboard`. Pemasangan plugin mengikuti mekanisme host agent.

## Skill

| Skill | Pekerjaan |
| --- | --- |
| [codeboard](skills/codeboard/SKILL.md) | Menentukan konteks, memilih skill, dan mengerjakan brief sampai delivery |
| [codeboard-draw](skills/codeboard-draw/SKILL.md) | Gambar, vector, raster, pixel editing, layer, mask, komponen |
| [codeboard-brushes](skills/codeboard-brushes/SKILL.md) | Brush custom, import resource, swatch, dan revisi stroke |
| [codeboard-storyboard](skills/codeboard-storyboard/SKILL.md) | Beat cerita, scene, shot, panel, caption, kontinuitas |
| [codeboard-animate](skills/codeboard-animate/SKILL.md) | Pose, drawing substitutions, keyframe, hold, IK, retiming |
| [codeboard-camera](skills/codeboard-camera/SKILL.md) | Framing, camera move, multiplane parallax |
| [codeboard-audio](skills/codeboard-audio/SKILL.md) | Cue, trim, split, mix, dan sinkronisasi suara |
| [codeboard-revise](skills/codeboard-revise/SKILL.md) | Revisi terarah pada project tersimpan, checkpoint, konflik |
| [codeboard-review](skills/codeboard-review/SKILL.md) | Critique berbukti, pemeriksaan visual, ekspor, delivery |
| [codeboard-debug](skills/codeboard-debug/SKILL.md) | Diagnosis runtime, render, timing, persistence, dan export |

Skill spesialis bisa dipilih langsung; `codeboard` menetapkan konteks runtime/docs sekali per sesi. Referensi antar-skill memakai nama yang ditampilkan host, bukan path relatif. Instruksi keselamatan revisi dimiliki `codeboard-revise`, sedangkan bukti review dan delivery dimiliki `codeboard-review`.

## Pasang dan gunakan

[Panduan instalasi](skills/codeboard/references/engine/docs/agent-plugin.md) memuat jalur plugin dan folder skill, lokasi host yang didukung dokumentasinya, verifikasi, contoh brief, update, dan troubleshooting. Panduan yang sama tersedia di [website Codeboard](https://codeboard.nonom.xyz/docs/agent-plugin/). Salin seluruh sepuluh folder skill beserta referensinya untuk pemasangan portabel. Engine dipasang terpisah.

## Verifikasi

Dari root repo, `npm run check:plugin` memeriksa manifest, katalog, trigger, nama dependensi skill, duplikasi paragraf, target docs, dan kesesuaian bundle dengan dokumentasi sumber. Edit panduan hanya di `/docs`, lalu jalankan `npm run docs:generate` untuk memperbarui referensi API dan bundle beserta hash sumbernya. Jangan edit bundle manual. `npm run check` menolak hasil generate yang tertinggal; CI dan validasi rilis menjalankan perintah tersebut.

[Panduan eval](evals/README.md) menyediakan fixture, tugas agent, grader artefak, dan probe kemampuan/discovery. [Hasil eval](evals/results.md) memisahkan hasil baseline, kandidat, kegagalan yang ditemukan, dan keterbatasan. Hasil juga mencatat demo end-to-end yang sudah dibuat menggunakan plugin: proyek editable, film 48 detik, dan laporan verifikasi artefak. Tes ini tidak menjamin agent bebas halusinasi. Instalasi dan eksekusi paket terisolasi telah diuji di Codex; instalasi host lain dan pemilihan skill otomatis oleh sesi host bersih belum diverifikasi lewat pengujian yang setara.
