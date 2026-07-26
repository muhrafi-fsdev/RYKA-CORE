# RYKA Puzzle Cam Integration

Modul ini menambahkan halaman `/puzzle-cam` dengan navbar terpisah:

- **CORE** — gesture control utama RYKA
- **ACCESS** — komunikasi aksesibel
- **PUZZLE CAM** — photobooth, puzzle, dan scrapbook editor

Puzzle Cam ditempatkan sebagai modul statis terisolasi di `public/puzzle-cam/`
agar CSS dan JavaScript asli tidak bertabrakan dengan antarmuka RYKA CORE.

## Menjalankan

```powershell
npm run dev
```

Buka:

```text
http://localhost:3200/puzzle-cam
```

Izinkan kamera saat browser meminta permission.
