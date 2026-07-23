# RYKA CORE 4.4 — Personal Access & Partner Communication

RYKA Access adalah modul komunikasi lokal di dalam RYKA CORE. Versi ini berdiri sendiri dan **tidak terhubung ke NusaMind AI**. Fokus 4.4 adalah personalisasi metode akses, komunikasi dengan lawan bicara, serta fallback ketika kamera atau mikrofon tidak dapat digunakan.

> RYKA Access adalah prototipe teknologi bantu. Bukan penerjemah BISINDO/SIBI, perangkat medis, alat diagnosis, atau pengganti tenaga profesional.

## Fitur baru 4.4

### Personal Needs Setup

Pengguna dapat memilih:

- Sulit berbicara / nonverbal
- Sulit mendengar
- Keterbatasan gerak
- Komunikasi darurat
- Kebutuhan teks besar atau visual jelas
- Tangan dominan
- Lingkungan penggunaan
- Dukungan baca teks, simbol, atau gabungan
- User, Caregiver, atau Professional Mode

### Alternative Input

- Touch / mouse
- Keyboard: angka 1–9 memilih quick phrase aktif
- Single-switch scanning: sorotan otomatis, pilih dengan Space/Enter
- Dwell selection: arahkan pointer dan tahan tanpa klik
- Gesture-to-Text

Shortcut:

- `Alt + S`: membacakan pesan
- `Alt + P`: membuka Partner Display
- `Escape`: menutup layar penuh atau dialog

### Stable Core Vocabulary

Kosakata inti ditampilkan pada posisi tetap. Kata dapat dirangkai menjadi kalimat sederhana, misalnya:

```text
Saya + ingin + minum
```

Tersedia kontrol hapus kata terakhir, tanda titik, tanda tanya, dan status “Mohon tunggu”.

### Partner Display

- Tampilan pesan layar penuh
- Putar 180° untuk penggunaan di meja
- Tombol Ya / Tidak
- Status sedang menyusun jawaban
- Teks caption terakhir dapat ikut ditampilkan
- Panduan mitra komunikasi

### Low-Tech Fallback

- Cetak kartu komunikasi
- Simpan kartu sebagai PDF melalui dialog print browser
- Download kartu komunikasi TXT
- Backup profil JSON

### Live Caption Pro Foundation

- Label pembicara manual
- Confidence indicator bila tersedia dari browser
- Ukuran caption dapat diatur
- Export transkrip TXT
- Caption dapat dipakai sebagai pesan

### Health & Emergency Pack

- Kalimat kesehatan siap pakai
- Body map sederhana untuk menunjukkan bagian yang sakit
- Emergency Communication layar penuh

### Privacy Center

- Private Session tanpa riwayat
- Auto-delete riwayat 5 menit, 15 menit, 1 jam, atau 24 jam
- Hapus riwayat dan caption secara terpisah
- Kamera dan mikrofon tidak merekam atau menyimpan audio/video secara default

## Fitur yang tetap dipertahankan

- Gesture-to-Text
- Quick Phrase Board
- Text-to-Speech
- Live Caption
- Conversation Mode
- Visual Sound Alert berbasis level suara
- Personal gesture profile
- Favorit dan riwayat lokal
- Teks besar, kontras tinggi, reduced motion
- Secure Desktop Bridge dan seluruh fitur RYKA CORE sebelumnya

## Cara menjalankan

Klik:

```text
START_ACCESS.bat
```

Atau:

```powershell
npm install
npm run dev
```

Buka:

```text
http://localhost:3200/?mode=access
```

## Batasan

- Live Caption bergantung pada dukungan browser dan sistem operasi.
- Visual Sound Alert belum mengenali jenis suara seperti bel atau alarm.
- Single-switch saat ini menggunakan keyboard Space/Enter, belum perangkat switch HID khusus.
- Dwell selection menggunakan pointer, belum head tracking.
- Pengujian bersama pengguna nonverbal, pengguna AAC, komunitas Tuli, caregiver, dan profesional masih diperlukan sebelum penggunaan serius.
