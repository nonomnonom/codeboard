# Audit A–Z kandidat rilis Codeboard

Keputusan pengguna setelah audit: target peluncuran **v1.0.0**. Pilihan versi
sudah tetap; scope dukungan dan kelulusan gates tetap ditentukan oleh bukti di bawah.

Tanggal: 6 Oktober 2026, WIB. Tujuan audit: menentukan pekerjaan penutup rilis dari
implementasi dan bukti, sebelum menghapus dokumentasi atau menetapkan klaim siap produksi.
[Cutoff awal](RELEASE-CUTOFF.md) adalah hipotesis scope; temuan di sini mendahului
keputusan pelaksanaannya. Tidak ada fitur baru, build, tes runtime, version bump,
commit, push, atau deployment yang dilakukan pada putaran audit ini.

## 1. Snapshot dan metode

- HEAD lokal dan remote main saat diperiksa: `c666f4df8984ad0af55b555f190126b25b86b046`.
  Perubahan kandidat ada di working tree, bukan pada commit tersebut.
- Inventaris: 367 berkas TypeScript engine, 91 berkas tes, 38 halaman Markdown
  publik, 28 keluarga capability, 174 changeset, tujuh paket contoh.
- Git melaporkan 757 entri status: 247 modified, 54 deleted, 456 untracked.
  Entri status bukan hitungan fitur atau jumlah versi; direktori untracked dapat
  mewakili beberapa berkas. Penghapusan direktori demo lama perlu dinilai bersama
  source penggantinya di examples/, bukan otomatis dianggap kehilangan fitur.
- Telusur dilakukan dari public export, facade/command, validasi, pemilik perubahan,
  persistence, evaluasi/render, sampai konsumen dan tes. Nama tes dibaca bersama
  implementasi jalur kritis; keberadaan tes tidak dinyatakan sebagai hasil lulus baru.
- Inventaris seluruh berkas tidak sama dengan review baris demi baris seluruh engine.
  Audit ini menelusuri semua domain produk dan jalur kritis lintas-domain; tidak
  mengklaim membuktikan semua kombinasi geometri, media, OS, atau skala produksi.
- Bukti lokal: `.preview/release-audit/inventory.json`, `capabilities.json`,
  `downloads.json`, `bundled-engine.json`, `changesets.json`, `source-hashes.json`.
  Direktori ini ignored. Laporan ini menyimpan hasil penting agar tidak bergantung
  pada file sementara tersebut.
- Hash inventaris isi 515 berkas source/test/docs/scripts/workflows:
  `5717d31492124a4117a031172d3744aa894c37c51600729d58c24514f2d569a2`.
  Perubahan sesudah snapshot ini membutuhkan penilaian ulang bukti yang terdampak.

Arti status dalam laporan: **implementasi** berarti jalurnya ditemukan;
**tes tersedia** berarti assertion ada di source; **studi** berarti ada konsumen
contoh yang memeriksa hasil; **historis** berarti ada log eksekusi lama;
**terverifikasi sekarang** hanya untuk pemeriksaan yang benar-benar dijalankan.
Tidak ada persentase kelengkapan atau persentase parity yang diturunkan dari hitungan ini.

## 2. Temuan yang konkret

### F01. Sinkronisasi versi website tidak bekerja pada source saat ini

`scripts/sync-release-version.mjs:21` mencari deklarasi dengan petik tunggal.
`website/lib/shared.ts:6` menggunakan petik ganda. Pemeriksaan regex di memori
menghasilkan `false`. Script tetap dapat mencetak sukses walau versi website tidak
berubah. Ini defect release tooling yang terkonfirmasi secara statis.

Penutupan: gunakan pembaruan yang cocok dengan format source dan wajib gagal jika
target tidak ditemukan; buktikan engine, lockfile, plugin dan website setuju pada
versi kandidat. Tidak perlu sistem versioning baru.

### F02. CLI review terbaru belum ada di artefak distribusi

`src/cli/inspection.ts` mendaftarkan `review-verify`; source command sudah ada.
Command belum didokumentasikan di `docs/cli.md`. Engine dalam `studies.zip` tidak
memiliki `dist/src/cli/review-verify.js`. Isi engine ZIP cocok dengan dist lokal,
jadi pemeriksaan kesamaan ZIP versus dist saja tidak menangkap ketertinggalan ini.

Tujuh ZIP memiliki source contoh/README yang cocok dengan checkout: 162 berkas
dibandingkan, tidak ada mismatch atau berkas hilang. Semua menyertakan engine
0.3.0 yang sama. Ini bukti keselarasan source contoh, bukan kesegaran build engine.

Penutupan: lengkapi dokumentasi/kontrak command, lalu build dan regenerate paket
setelah source dibekukan. Uji command dari tarball yang akan diterbitkan, bukan
hanya command dari checkout. Perbaikan lazy import dari putaran sebelumnya sudah
lolos arsitektur, tetapi belum membuktikan perilaku runtime command ini.

### F03. Release gate dapat melewati studi media

`test/studies-assets.test.ts:131` mengaktifkan video hanya jika `FFMPEG_PATH` dan
`FFPROBE_PATH` keduanya terisi. `.github/workflows/release.yml` hanya menetapkan
`FFMPEG_PATH`; job source-examples menjalankan studies tanpa `--video`.
Menginstal executable ffprobe melalui apt tidak memenuhi kondisi environment itu.

Akibatnya, studi `media: true`, termasuk audio-delivery dan konversi audio board,
tidak otomatis terbukti oleh release gate tersebut. Ini bukan berarti seluruh
tes audio tidak berjalan: `studio-example.test.ts` mencari kedua executable di
PATH dan memiliki pemeriksaan 240 frame, sepuluh detik, stream AAC dan posisi cue.

Penutupan: jadikan jalur studi media wajib di satu gate release yang menyediakan
kedua executable. Kegagalan menemukan dependency pada gate itu harus gagal,
bukan berubah menjadi skip yang tetap dianggap lolos.

### F04. Panduan publik saling bertentangan

- `docs/cli.md:128` menyebut migrasi ke schema 4; model saat ini schema 5,
  container 3. `docs/projects.md` sudah menjelaskan format baru dengan benar.
- `docs/animation.md:166` masih menyebut editorial audio dan full-board conform
  pending, walau `planBoardCapture`, mixer dan exporter sudah diimplementasikan.
- `docs/agent-workflow.md:207` menyatakan editorial audio pending; paragraf studio
  audio berikutnya juga mengarahkan pembaca ke status mixer yang lama.
- `CONTRIBUTING.md`, bagian Local workspaces, menyebut setiap contoh memiliki
  manifest dan `file:../..`; actual workspace sudah satu examples/package.json
  dengan `file:..`.
- Guide CLI tidak menyebut `controller-data` atau `review-verify`. Hasil pencarian
  sederhana juga menandai `create`/`read`, tetapi itu subcommand bertingkat dan
  tidak boleh otomatis dilaporkan sebagai command hilang.

Penutupan: konsolidasi instruksi aktual. Jangan sekadar menghapus semua kata
pending: beberapa memang menunjuk kekurangan pembuktian yang masih nyata.

### F05. Capability report mencampur batas produk dan catatan kerja lama

`src/runtime/capability-catalog.ts:156` masih menyatakan font binary lock tidak ada
dan recovery belum qualified. Source memiliki `frame-job-fonts.ts`, font-file
pinning, serta tes subprocess font dan frame-job recovery. Klaim itu perlu
dipecah: checksum-pinned font bytes tersedia; glyph coverage, semua native
dependency, semua filesystem dan power-loss tidak otomatis terjamin.

Masalah serupa ada pada status rig, effects, dan compositing graph. Sebagian
punya tes terarah atau studi, sebagian perubahan terbaru belum masuk log lama.
Capability report merupakan data yang digunakan agent untuk memilih operasi;
ketidakakuratan di sini memengaruhi workflow, bukan hanya tampilan dokumentasi.

### F06. Bukti historis tidak mencakup seluruh snapshot sekarang

Log `.preview/production-check-20261006.log` selesai pukul 17:21:24 UTC, 5 Oktober.
`review-decision.ts` berubah pukul 17:37:30; `review-verify.ts` pukul 17:48:52.
Log tersebut mencatat 397 tes/90 suite, sedangkan inventaris sekarang 91 file tes.
Timestamp mendukung adanya perubahan setelah check; bukan bukti tes sekarang gagal.

Pencarian langsung tidak menemukan nama API review-decision/verify-review,
retimeShotAnimation, rescaleLipSync, atau planBoardCapture pada tes regresi khusus;
konsumen tersedia di studies. Studies non-media dijalankan oleh tes ZIP dan job
source-examples, sehingga tidak tepat menyatakan API itu sama sekali tidak diuji.
Yang belum dibuktikan adalah cakupan kegagalan/adversarial dan snapshot final.

### F07. Plugin packaging lolos pemeriksaan struktur, evaluasi perilaku masih lama

`plugin/evals/results.md` mencatat engine 0.2.1 dengan tugas hold, retime panel,
dan brush. Evaluasi tersebut jujur membatasi klaim aktivasi host, isolasi dan
jumlah sampel. Itu tidak membuktikan agent baru mampu menjalankan editorial,
deformer, review decision dan handoff versi kandidat.

Bundle saat ini mencakup 195 file dan sepuluh skill; pemeriksaan sinkronisasi
menguji kesamaan source, bukan kebenaran prose atau keberhasilan workflow agent.
Penutupan yang proporsional adalah satu alur studio dan satu revisi saved-state
dari paket terpasang dengan docs yang cocok. Tidak perlu mengulang semua riset
atau mengejar statistik evaluasi besar untuk rilis ini.

### F08. Deployment website tidak menunggu kesiapan engine release

Website workflow merespons push main dan melakukan deploy setelah website build.
Ia tidak bergantung pada CI engine ataupun publikasi npm. Sebuah panduan baru
dapat tampil sebelum paket yang implementasinya dijelaskan tersedia.

Penutupan: tentukan urutan publikasi atau version binding yang eksplisit. Website
harus menunjuk paket yang tersedia dan contoh yang cocok. Tidak harus mengganti
provider hosting atau membangun layanan deployment baru.

### F09. Kandidat bukan patch kecil menurut konfigurasi release aktual

`changeset status --output ...` menghasilkan release plan **0.3.0 → 1.0.0**, type
major, dari 174 changeset. Tidak ada version bump yang dilakukan. Tool juga
mencetak warning dependency `file:..` pada dua workspace private walau exit 0.
Warning ini harus ditinjau saat rehearsal versioning; belum dibuktikan sebagai
kerusakan install atau alasan mengganti struktur workspace.

Beberapa changeset adalah catatan refactor dan ada deskripsi schema 4 yang
disusul schema 5. Release notes harus menjelaskan kontrak final dan migrasi, bukan
174 potongan sejarah yang berpotensi bertentangan. Jangan mengubah major menjadi
patch hanya agar angka terlihat kecil.

### F10. Sebagian pemeriksaan punya cakupan lebih sempit daripada namanya

- `check:docs` memeriksa generated references dan target file Markdown, tidak
  memeriksa semua anchor atau URL eksternal. Website build memiliki checker
  anchor HTML terpisah.
- `test:package` menguji tarball engine tetapi secara default memakai dependency
  checkout lewat symlink. `test:install` benar-benar melakukan npm install.
- `test:studies:install` menyediakan fresh dependency install untuk ZIP studies,
  tetapi tidak dipanggil oleh workflow release yang diperiksa.
- `npm run check` tidak memanggil website build; workflow website terpisah.
- Lint dan root TypeScript tidak membuktikan kesegaran ZIP, pixels, audio atau
  keberhasilan install native addon pada mesin lain.

Penutupan: tulis bukti dan gate sesuai cakupannya. Tidak perlu menambah banyak
tes yang mengulang implementasi; tutup batas distribusi/media yang belum wajib.

## 3. Peta kemampuan A–Z

Semua 28 keluarga capability diperiksa bersama domain operasional terkait.
Kolom bukti adalah lokasi pembuktian yang tersedia, bukan klaim baru bahwa tes
tersebut telah dijalankan atau seluruh keluarga telah qualified.

| Area | Jalur implementasi dan invariant | Bukti yang tersedia | Keputusan yang dapat dipertanggungjawabkan |
| --- | --- | --- | --- |
| Project/configuration | `core/project/configuration.ts`: draft, parse, FPS policy; canvas resize tidak menskalakan artwork | `project-config.test.ts`, `transactions.test.ts` | Pertahankan konfigurasi yang mempunyai efek; jelaskan board versus shot config; tidak perlu preferences service |
| Storyboard/hierarchy | `model/board-hierarchy.ts`, `core/production/`: sequence/scene/shot/panel dengan identitas stabil | `production.test.ts`, `timing.test.ts`, `transitions.test.ts` | Dasar storyboard ada; cukup periksa regression saat penutupan |
| Script/captions | CSV strict, FDX subset; ID binding dan loss policy; script-board menghasilkan panel kosong | `caption-import`, `script`, `script-board` tests; FDX study | Dokumentasikan FDX sebagai subset; tambah proof input negatif FDX bila API ini dijanjikan, bukan format baru |
| Drawing/vector | Public path/geometry/stroke API; validasi input, transform dan editable elements | vector-input, path-geometry, path-split, stroke-outline tests | Pertahankan; tidak perlu vectorizer otomatis |
| Raster/brush | Pixel edits/selection; brush dynamics; resource imports memiliki byte/decompression bounds | pixels, pixel-selection, brush-engine, resources tests | Native brush behavior tidak sama dengan aplikasi asal; jangan mengklaim KPP parity |
| Color | `drawing/pixel-codec.ts`: decode menuju sRGB RGBA8; render Canvas 8-bit | color-backend, pixel-color-import, color-validation tests | Tetapkan batas 8-bit; high-precision/OCIO merupakan perluasan besar terpisah |
| Palettes | Shared solid swatches, explicit bindings, local override, merge plan | palettes tests dan study | Cukup untuk solid-color workflow; gradient-stop/pixel recolor bukan syarat baru |
| Layers/masks/clipping | Layer compositor mempertahankan mask, placement, sibling clipping dan opacity order | masks, clipping, element-transform, raster-parity tests | Audit pixels pada kombinasi yang dipakai contoh produksi; hindari refactor visual tanpa defect |
| Exposures/curves | Sparse channels, drawing holds, range replacement; board/global dan shot/local dibedakan | drawing-sequence, animation-channels, evaluation tests | Pertahankan, docs harus menonjolkan domain waktu |
| Rational timing/retime | Exact/floor/nearest mapping; collision reject; shot retimer memetakan frame collections, audio policy eksplisit | timing tests; shot-retime study | Bukti whole-shot retime terbaru perlu diperkuat untuk collision/rollback; tidak menambah time stretching |
| Shot/editorial | Separate source shot dan clip placement; resolver menolak triple overlap/out-of-range | studio-workflow, studio-agent tests | Tidak sama dengan full NLE; source range dan transition contract harus konsisten |
| Board capture | Identity-remapped panel capture; full-board plan memakai incoming picture hold dan audio convert/omit | studio-workflow baseline; board-transition dan board-capture studies | Tutup parity boundary termasuk split dalam hold, handles dan save/reopen; tidak perlu automatic cinematic re-edit |
| Camera/coordinates | Pan/zoom/rotation, depth plane, world/local conversions; finite/nonsingular constraints | camera-channels, camera-resolution, coordinates, plane-depth tests | 2D/multiplane cukup; native 3D bukan fitur nanggung yang wajib ditambahkan |
| IK/rig/rest | Explicit two-bone solve, reach policy, rest capture/apply | ik tests, rig-rest study | Jangan mengklaim auto-rig; cek persisted pose pada alur terpilih |
| Mesh/curve/envelope/skin | One binding per layer; explicit weights; CPU warp menjaga shared-edge alpha dan membatasi coverage work | deformation, mesh-render tests; deformer-resolution study | Implementasi ada; belum ada jaminan performa semua karakter/resolusi |
| Controllers/performance | Ordered controller stack di atas base keys; capture/transfer/performance dengan explicit mappings | controllers tests; controller-exchange dan mesh-warp studies | Numeric pose package bukan rig/dependency asset lengkap; rapikan klaim dan proof paket |
| Lip sync | Supplied cues/mouth drawings menjadi exposure, correction dan rescale eksplisit | lip-sync tests; rescale pada lip-sync study | Tidak perlu speech recognition; buktikan rescale tidak merusak correction boundary |
| Board audio | Tracks/clips, trim, split, gain/fades, asset checksums | audio-tracks, audio-split, movie tests | Pertahankan; tidak perlu DAW/preferences tambahan |
| Studio audio | Source samples, rational placement, conform/mix, range/stems; hold menunda source-shot sound | studio-audio tests; audio-delivery dan board-capture studies | Studi media wajib dijalankan; explicit sum/linear/omit harus tetap ada |
| Components/upgrades | Baseline dan three-way merge; explicit new IDs/conflict resolutions; refresh berbeda dari upgrade | component-origins, component-upgrade, component-validation tests | Sudah ada jalur menghindari hilangnya override; jangan mengganti dengan destructive refresh diam-diam |
| Worker handoff/merge | Native subset, provenance dan resource compatibility; plan merge tidak otomatis mengimpor dependency lain | shot-merge tests dan study, publish tests | Studio kolaboratif sederhana memungkinkan; arbitrary cross-project import adalah batas, bukan default yang boleh diasumsikan |
| Effects/composite graph | Ordered effects, source/effects/blend/mask DAG, keyed values; budget surfaces/passes | clipping/mesh tests dan frame-jobs study | Tutup pixel/seek/persistence proof yang relevan; tidak perlu memperbesar node catalog |
| Fonts | Availability preflight; checksum-pinned external bytes untuk job/publish; fallback policy | fonts, font-files, project-publish-fonts tests | Koreksi catalog; binary pin bukan glyph/OS-render guarantee |
| Discovery | Detached bounded pages, metadata SQL; cursor/version checks | object-query, storage-query, inspection-pages, studio-agent tests | Response bound bukan memory bound. `editorial-query.ts` masih parse studio tree dan decode editorial collection |
| Agent plans/errors | Strict command schema, isolated dry run, base version/hash, durable receipt | edit-plan tests termasuk concurrent retry/process death | Jalur utama layak dipertahankan; plain Error/Zod masih bisa menjadi OPERATION_FAILED, dokumentasikan recovery aktual |
| Storage/history/migration | SQLite immediate transactions, FULL sync, content hashes, revisions; schema 3/4 read-only, migrate ke new file | migration authentic fixtures, project-recovery, persistence, revisions tests | Jangan hapus legacy fixture atau source lama; process-kill test tidak membuktikan power failure semua OS |
| Review/decision | Snapshot manifest, hash/decode checks, unsigned declaration bound ke evidence; optional source/revision match | studio-workflow export tests; review-tools study | Decision checksum bukan autentikasi/approval otomatis. Command serta negative-path proof masih pekerjaan penutup |
| Render jobs/delivery | Pinned source+renderer; atomic per-frame storage/resume; PNG sequence, PDF, H.264/stems | frame-job-recovery, project-publish, movie, studio-example tests/studies | Buktikan paket akhir dan media gate; scheduler/farm bukan keharusan |
| Interchange | OTIO satu cut track; PSD RGB8 subset; unsupported visual features reject | otio fixtures/tests, psd fixtures/tests | Jangan menyebut full Photoshop/NLE/Harmony interchange; format baru ditunda |
| Preview | Loopback, host check, GET-only; board endpoints pada `preview/server.ts` | Source trace; bukan bukti studio-preview lengkap | Shot/editorial bisa direview melalui export; tidak perlu membangun UI baru untuk menutup rilis |
| Architecture | Domain helpers dan import rules; facade transaction/storage tetap pemilik lifecycle | check-architecture, strict TS | Modularisasi sudah substantif; ukuran facade sendiri tidak cukup menjadi alasan refactor besar lagi |
| Docs/examples/plugin | docs menjadi sumber website dan bundled refs; tujuh contoh satu workspace | generated checks, ZIP byte comparisons, historical plugin eval | Tutup kontradiksi dan fresh installed workflow; jangan menulis manual kedua yang akan drift lagi |
| Release/operations | Validated tarball → install matrix → npm OIDC; Pages workflow terpisah | Config trace dan remote read | F01/F03/F08/F09 harus ditutup sebelum publish; sukses release lama bukan bukti kandidat |

## 4. Batas skala yang memengaruhi penggunaan

- Pixel surfaces dibatasi 32 Mi pixel. Cache board default 128 MiB; itu bukan
  batas RSS proses total. Graph membatasi 256 Mi pixel-passes, bukan seluruh
  nested layer allocation. Mesh membatasi coverage sample work.
- Review package: maksimum 120 frame dan 128 MiB PNG. Gunakan review terpilih,
  bukan menjadikan review package sebagai arsip setiap frame film panjang.
- Query output dibatasi 256 KiB dan halaman sampai 200 record. Beberapa API masih
  memuat snapshot atau collection di balik halaman itu. Klaim constant-memory
  untuk semua discovery belum punya dasar.
- Studio mix mempunyai maksimum 16,777,216 sample per channel. Pada 48 kHz itu
  sekitar 349.5 detik per range; direct mixed movie bukan pipeline audio panjang
  tanpa batas. Range/stem dan per-shot export adalah jalur yang ada.
- Frame-job default storage budget 512 MiB, manifest membatasi sampai 1 GiB.
  Budget yang ada perlu ditampilkan sebagai batas operasi, bukan ditambah setting
  spekulatif untuk semua kemungkinan produksi.
- Render repeatability dipengaruhi runtime/native renderer/font. Source sudah
  memeriksa identities dan font pins pada jalur tertentu. Itu belum membuktikan
  pixel-identical lintas semua OS atau native build.

Implikasi: pilih workload acceptance yang jelas dan bisa direproduksi. Jangan
memakai istilah production-ready sebagai janji film sepanjang apa pun, semua
format, atau semua karakter/resolusi. Mengukur alur yang akan dipakai lebih
bernilai daripada mengurangi jumlah file sampai terlihat kecil.

## 5. Struktur, docs dan penghapusan yang selektif

Core sekarang terdiri dari 72 module, model 86, animation 41, export 37, render 29,
drawing 28, storage 22. `core/project.ts` masih 1,146 baris, `storage/store.ts` 450,
`core/production.ts` 434. Facade project memang besar, tetapi banyak operasi
mendelegasikan ke pemilik domain dan lifecycle state sengaja terpusat.
Tidak ditemukan alasan dari ukuran saja untuk memecahnya lagi sebelum rilis.

| Material | Tindakan setelah audit | Alasan |
| --- | --- | --- |
| `docs/index`, fundamentals, concepts, production-workflow, install, quickstart, typescript | Pertahankan, sederhanakan jalur masuk dan cocokkan kontrak akhir | Fondasi onboarding sudah ada |
| `docs/animation.md` (1,235 baris) | Pisahkan panduan board/shot, timing/editorial, rig/controller; pertahankan/migrasikan anchor | Terlalu banyak tambahan kronologis dan status lama bercampur |
| `docs/export.md` (557 baris) | Susun per target/output, audio policy, job dan batas; pindahkan catatan implementasi lama | Pengguna perlu memilih alur, bukan membaca sejarah pengerjaan |
| `docs/cli`, agent-workflow, audio, projects | Rewrite bagian usang berdasarkan implementasi final | Kontradiksi schema/audio/command dapat membuat agent salah mengambil langkah |
| Enam `docs/api-*.md` | Tetap generated | Jangan duplikasi signature manual |
| `docs/rig-workflow.md` | Jadikan route belajar yang terlihat; sekarang tidak tercantum dalam docs/meta.json | Guide ada tetapi jalur navigasinya tidak setara dengan area lain |
| Dokumen perencanaan terdahulu | Sudah dihapus; design/studio hanya memuat konteks v1 dan ownership aktual | Scope kerja ditentukan gate v1 |
| Root roadmap | Ringkas menjadi index scope/evidence, tanpa daftar kemampuan lama yang sudah salah | Satu kontrak rilis, bukan dua backlog bersaing |
| `plugin/.../references/engine` | Regenerate setelah docs/source stabil | Bukan target hand-edit atau selective delete manual |
| `examples/` | Pilih quickstart, studio-timing, agent-revision sebagai tiga pintu masuk; studies tetap proof, tiga showcase opsional | Tidak perlu contoh kedelapan atau framework baru |
| Legacy schema/OTIO/PSD fixtures, licenses/NOTICE | Pertahankan | Diperlukan untuk compat, proof dan hak distribusi |
| Ignore rules dan paths demo lama | Hapus hanya setelah pencarian memastikan tidak ada consumer | Bersihkan sisa perpindahan tanpa menghapus source/artefak yang masih diperlukan |

Pembersihan konteks perencanaan selesai: 25 file dihapus, index dan ownership
ditulis ulang, serta provenance fixture migrasi dipertahankan pada README fixture.
Rewrite panduan penggunaan pada baris lain masih pekerjaan penutup v1. Temuan
teknis audit ini tetap terbuka sampai bukti perbaikannya tersedia.

## 6. Pemeriksaan yang benar-benar dijalankan

| Pemeriksaan | Hasil | Batas bukti |
| --- | --- | --- |
| Whole-repo Biome lint | Exit 0, 670 files; 16 warning | 11 CSS specificity, 4 important styles, 1 img element; tidak ada error |
| Whole-repo format check | Exit 0, 670 files | Tidak memeriksa pixels/audio |
| Git diff whitespace check | Tidak ada whitespace error; warning LF/CRLF | Tidak menyatakan working tree clean |
| Inventory/AST capability extraction | 367 modules, 28 families | Inventaris bukan persentase completeness |
| ZIP source/README byte comparison | 162 file cocok di tujuh ZIP | Tidak membuktikan fresh dependencies terinstall |
| Bundled engine versus dist | Semua entry dist yang diperiksa cocok; review-verify tidak ada | Dist dapat stale terhadap source |
| Version-sync regex reproduction | Tidak cocok dengan declaration aktual | Defect F01; script tidak dijalankan untuk mengubah versi |
| Changesets status | Exit 0, rencana 1.0.0; warning file dependencies | Tidak mengubah version atau consume changeset |
| Remote main/npm/site | main sama dengan local HEAD; npm latest 0.3.0; homepage/docs HTTP 200 | Kandidat working tree belum published |

Putaran audit sebelumnya juga menjalankan root TypeScript, architecture
(367 modules/1,171 edges setelah perbaikan lazy import), workspace resolution,
generated API reference, Markdown links, dan plugin bundle sync. Itu bukti static
pada source tersebut, bukan pengganti fresh runtime check kandidat.

Lingkungan saat ini Node 22.22.0/npm 10.9.4. FFmpeg/ffprobe tidak ditemukan di PATH,
dan kedua environment override kosong pada shell audit. Sebelum verifikasi media,
gunakan executable yang terverifikasi dan konfigurasi eksplisit. Tidak ada klaim
movie test dijalankan dalam putaran ini.

Remote dibaca tanpa mutasi: Pages terkonfigurasi workflow ke
[codeboard.nonom.xyz](https://codeboard.nonom.xyz/),
[npm latest metadata](https://registry.npmjs.org/codeboard-studio/latest) melaporkan
0.3.0. [Release workflow terakhir yang tercatat sukses](https://github.com/nonomnonom/codeboard/actions/runs/37246225454)
berasal dari commit `676d1f5`, bukan working tree kandidat. Tidak diperiksa ulang
konfigurasi npm trusted publisher melalui akun npm; sukses historis tidak menjamin
pengaturan tersebut tidak berubah.

## 7. Stop line setelah mempertimbangkan bukti

Scope yang masuk akal adalah **rilis workflow editable 2D melalui kode dengan
batas eksplisit**, bukan sebuah klaim bahwa semua fitur existing otomatis qualified.
Tidak ada bukti audit yang mengharuskan menambah capability family baru agar alur
inti bisa ditutup. Tetapi juga belum ada bukti cukup untuk langsung deploy sekarang.

Urutan penutupan yang terbatas:

1. **Kontrak final:** selesaikan F01–F05, dokumentasikan limits dan breaking
   schema/review manifest untuk target v1.0.0 yang disepakati. Konsolidasi release notes.
2. **Distribusi konsisten:** build setelah source freeze; generate API/plugin dan
   tujuh ZIP dari build yang sama. Buktikan command baru ada pada tarball akhir.
3. **Proof data:** jalankan regression existing dan tambah hanya proof yang hilang
   untuk review corruption/source binding, timing/holds/capture dan bounded saved
   reads. Wajib mempertahankan rollback, conflict, retry dan legacy migration.
4. **Proof penggunaan:** jalankan tiga onboarding workflows dari paket terpasang;
   pastikan targeted revision bertahan sesudah reopen. Jalankan studi media dengan
   FFmpeg/ffprobe, periksa exported duration, frames dan audio placement. Review
   gambar/motion/suara tetap aktivitas terpisah dari assertion teknis.
5. **Proof delivery:** fresh install candidate, website build/links, plugin matching
   reference, cross-platform release install matrix; pastikan skip tidak disalahartikan
   sebagai pass. Pilih urutan npm/website yang menutup F08.
6. **Release:** review diff, commit kandidat, publish artefak yang diuji, deploy docs
   yang cocok, verifikasi public install dan catat tag/commit/version. Baru tandai done.

Stop setelah enam hasil itu terbukti. Jika satu existing advanced operation gagal,
perbaiki defect pada pemiliknya atau turunkan klaim dukungannya secara eksplisit;
jangan menambahkan fitur lain untuk menutupi kegagalan. Deferred work tetap HDR,
full vendor interoperability, automatic speech/rigging, scheduler/GUI, dan
qualification skala studio yang melampaui workload rilis yang dinyatakan.

Audit ini menghasilkan scope bersyarat dan daftar pembuktian. Ia tidak mengubah
hasil statis menjadi klaim siap produksi, tidak menjanjikan selesai hari ini tanpa
menjalankan gates, dan tidak memberi angka persentase yang tidak punya denominator.
