# RYKA CORE 4.4 Compatibility, Security, and Accessibility Checklist

## Rafi HandMotion Modified compatibility

- [x] Camera can be enabled and disabled
- [x] Camera device can be selected
- [x] Camera quality can be selected
- [x] Maximum hands can be configured from 1–4
- [x] Skeleton connections can be toggled independently
- [x] Landmark points can be toggled independently
- [x] Visual effects can be toggled independently
- [x] Blur effect is available
- [x] Mosaic effect is available
- [x] Flip 180° effect is available
- [x] Automatic thumb/index effect behavior is preserved
- [x] Manual effect override is available
- [x] Single-hand and dual-hand effect regions are available
- [x] Camera mirror can be toggled
- [x] Composite camera view is available
- [x] Skeleton-only view is available
- [x] Clean-camera view is available
- [x] Settings persist locally
- [x] `/demo` route remains available

## RYKA CORE non-regression

- [x] Blue-cyan holographic orb remains available
- [x] One-hand pinch rotates the orb
- [x] Two-hand pinch zooms the orb
- [x] One Euro motion smoothing is active
- [x] Static gesture stabilization remains active
- [x] Release-required protection remains active
- [x] Dynamic swipe detection remains active
- [x] Confidence, hold, and cooldown controls remain available
- [x] Presentation, Media, and Custom profiles remain available
- [x] Action Mapper remains available
- [x] Action Log remains exportable to JSON and CSV
- [x] Windows Desktop Bridge remains allowlisted
- [x] Developer branding remains Muhammad Rafi Priyo


## Cybersecurity hardening

- [ ] Secure bridge creates a fresh session through the desktop launcher
- [ ] Signed health request succeeds
- [ ] Reused nonce is rejected
- [ ] Invalid Origin and Host are rejected
- [ ] Presentation permission can be disabled
- [ ] Media permission can be disabled
- [ ] Ctrl + Shift + F12 activates emergency lock
- [ ] Bridge can only be re-armed through explicit confirmation
- [ ] Security events are written without tokens or session secrets
- [ ] PowerShell ExecutionPolicy Bypass is absent
- [ ] All desktop actions remain allowlisted
- [ ] `npm run security:static` passes
- [ ] `npm run security:bridge-test` passes
- [ ] CodeQL and Dependency Review workflows are present


## RYKA Access 4.4

- [ ] Tombol ACCESS membuka suite komunikasi.
- [ ] `START_ACCESS.bat` membuka `?mode=access`.
- [ ] Quick Phrase Board dapat memilih dan membacakan pesan.
- [ ] Gesture-to-Text menggunakan mapping personal.
- [ ] Konfirmasi gestur dapat diaktifkan/dimatikan.
- [ ] Text-to-Speech dapat memilih bahasa, suara, kecepatan, dan volume.
- [ ] Live Caption menampilkan fallback saat browser tidak mendukung.
- [ ] Conversation Mode menampilkan caption dan jawaban.
- [ ] Visual Sound Alert menggunakan indikator mikrofon dan ambang batas.
- [ ] Emergency Communication menampilkan pesan besar.
- [ ] Riwayat dapat dimatikan dan dihapus.
- [ ] Profil gestur dapat diekspor dan diimpor.
- [ ] Teks besar, kontras tinggi, dan reduced motion bekerja.
- [ ] Tidak ada klaim penerjemah BISINDO/SIBI.
- [ ] Tidak ada koneksi NusaMind AI pada RYKA Access.

## Personal Access 4.4

- [ ] Personal Needs Setup dapat diselesaikan dan diulang
- [ ] Touch/mouse tetap tersedia
- [ ] Keyboard angka 1–9 memilih quick phrase
- [ ] Single-switch scanning dapat dipilih dengan Space/Enter
- [ ] Dwell selection bekerja tanpa klik
- [ ] Core vocabulary memiliki posisi tetap
- [ ] Partner Display dapat layar penuh dan diputar 180°
- [ ] Kartu komunikasi dapat dicetak atau diunduh
- [ ] Private Session tidak menyimpan riwayat
- [ ] Auto-delete riwayat bekerja
- [ ] Body map membentuk pesan kesehatan
