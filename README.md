# X Video Saver

Ekstensi Chrome sederhana untuk mengunduh video dari postingan X (Twitter) dengan pilihan kualitas.

## Cara pasang
1. Ekstrak file ZIP ke sebuah folder.
2. Buka `chrome://extensions` di Chrome (laptop/PC).
3. Aktifkan **Developer mode** (pojok kanan atas).
4. Klik **Load unpacked**, lalu pilih folder hasil ekstrak (yang berisi `manifest.json`).
5. Sematkan (pin) ikon ekstensi di toolbar agar mudah diklik.

## Cara pakai
- Buka postingan X yang berisi video, lalu klik ikon ekstensi. Link akan terisi dan dicari otomatis.
- Atau tempel link postingan secara manual, lalu klik **Cari**.
- Pilih kualitas di menu, lalu klik **Unduh**. File tersimpan di `Downloads/X-Videos/`.

## Cara kerja & privasi
- Data postingan diambil dari layanan publik **api.fxtwitter.com** (cadangan: **api.vxtwitter.com**).
  Kedua layanan itu hanya menerima ID postingan yang kamu cari.
- File video diunduh langsung dari server X (`video.twimg.com`).
- Ekstensi **tidak** menyuntikkan script ke halaman X, tidak membaca cookie/akun, dan tidak punya server sendiri.
- Izin yang dipakai: `downloads` (menyimpan file) dan `activeTab` (membaca link tab aktif hanya saat ikon diklik).

## Batasan
- Hanya untuk postingan publik. Postingan akun yang dikunci (private) tidak bisa diunduh.
- Kalau fxtwitter/vxtwitter sedang down, pencarian akan gagal sementara.
