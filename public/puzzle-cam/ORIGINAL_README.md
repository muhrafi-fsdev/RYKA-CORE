# Scrapbook Puzzle Cam

Sebuah aplikasi bilik foto (*photobooth*) interaktif berbasis web di kendalikan dengan gerakan tangan (*hand gestures*), pecahkan *sliding puzzle* untuk mendapatkan fotomu, dan hias hasil jepretanmu dengan stiker bergaya *scrapbook* — semuanya langsung di *browser* kamu tanpa perlu instalasi aplikasi tambahan!

## FITUR UTAMA

- **Hand-Gesture Capture:** Tidak perlu klik tombol! Buat bingkai (*frame*) menggunakan jari/tanganmu di depan kamera, dan aplikasi akan otomatis mengambil foto.
- **Sliding Puzzle Minigame:** Sebelum foto diproses, kamu harus menyusun pecahan fotomu dalam mini-game *sliding puzzle* 3x3 dengan gerakan mencubit (*pinch*). Buat gerakan kepalan tangan (*fist*) untuk menyimpan jika puzzle sudah selesai!
- **Photobooth Layouts:** Pilih gaya strip fotomu sebelum mulai! (Tersedia format 3 foto vertikal, 4 foto vertikal, atau grid 2x2).
- **Aesthetic Filters:** Tersedia pilihan filter warna menarik seperti *Black & White*, *Vintage*, atau *Normal* untuk menambah kesan estetik.
- **Scrapbook Editor:** Hias foto *strip*-mu di ruang edit virtual! Ganti warna bingkai (*frame color*) dan tempelkan stiker-stiker lucu (*drag-and-drop*).
- **Printing Animation:** Rasakan sensasi menunggu foto dicetak dengan animasi mesin cetak 3D virtual yang lucu sebelum masuk ke mode edit!

---

## CARA MENJALANKAN DI KOMPUTER LOKAL

Aplikasi ini berjalan murni di *frontend* (Browser). Namun, karena alasan keamanan privasi browser untuk mengakses kamera web (*webcam*), aplikasi ini harus dijalankan melalui **Local Server**.

### 1. Klon Repositori Ini
```bash
git clone https://github.com/Shafira0605/puzzle_cam.git
cd puzzle_cam
```

### 2. Jalankan Local Server
Kamu bisa menggunakan ekstensi **Live Server** di VSCode, atau menggunakan Python (jika sudah terinstal):
```bash
python -m http.server 8000
```

### 3. Buka di Browser
Buka browser (disarankan **Google Chrome** atau **Microsoft Edge**) lalu akses URL:
```text
http://localhost:8000
```
*Catatan: Pastikan komputermu terhubung ke internet saat pertama kali dibuka karena aplikasi akan mengunduh model AI pelacak tangan dari Google MediaPipe.*

---

## CARA BERMAIN

1. Buka aplikasi, pilih **Layout** (jumlah foto) dan **Filter** warnanya, lalu klik "START CREATING".
2. Di depan kamera, buat bentuk **bingkai (frame)** menggunakan jari telunjuk dan jempol kedua tanganmu.
3. Aplikasi akan mengambil gambar dan mengacaknya menjadi *puzzle*.
4. Gunakan gaya gerakan tangan **mencubit (pinch)** dan geser tanganmu untuk memindahkan kepingan *puzzle*.
5. Setelah *puzzle* tersusun, buat **kepalan tangan (fist)** untuk mengunci dan menyimpan kepingan tersebut.
6. Ulangi proses hingga seluruh slot foto pada layout *photobooth* terpenuhi.
7. Tunggu animasi *printing* selesai, lalu hias fotomu di **Scrapbook Studio** dengan stiker dan warna bingkai.
8. Klik **Download Photo** untuk menyimpan mahakarya *scrapbook*-mu!

---

## TEKNOLOGI YANG DIGUNAKAN

- **HTML5 & Vanilla JavaScript** (ES6 Modules)
- **CSS3 & Tailwind CSS** (Untuk *layout* UI estetik)
- **Google MediaPipe Hands** (Deteksi gerakan kerangka tangan secara *real-time*)
- **HTML5 Canvas API** (Manipulasi gambar, filter, dan fitur interaktif drag-and-drop stiker)

---
*Created and Modified by Shafira0605*
