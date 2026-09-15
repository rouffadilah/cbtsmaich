# Perbaikan akses database CBT-SMAICH

Project Firebase: `cbt-sekolah-7fed0`

## 1. Terapkan Firestore Security Rules

Dari folder proyek ini jalankan:

```bash
firebase login
firebase use cbt-sekolah-7fed0
firebase deploy --only firestore:rules
```

File yang dipakai adalah `firestore.rules`.

## 2. Struktur koleksi yang digunakan aplikasi

- `users/{uid}` — profil akun dan role
- `pengaturan/data_akademik` — daftar mapel dan kelas
- `pengaturan/waktu_ujian` — durasi ujian per mapel/kelas
- `pengaturan/jadwal_ujian` — jadwal ujian
- `pengaturan/token_ujian` — token ujian
- `pengaturan/acak_soal` — status pengacakan soal
- `pengaturan/status_registrasi` — status registrasi
- `bank_soal/{id}` — bank soal
- `hasil_ujian/{id}` — hasil ujian

## 3. Hak akses

- Siswa: membaca pengaturan/bank soal yang dibutuhkan, membuat hasil ujian sendiri, dan membaca hasil miliknya.
- Guru: mengelola bank soal/pengaturan dan membaca hasil ujian.
- Admin: akses penuh pada data aplikasi.

## 4. Catatan penting

GitHub Pages hanya menjadi frontend. Firestore tetap berada di Firebase. Karena itu, setelah file rules diperbaiki, rules tersebut tetap harus dipublish ke project Firebase.

Jangan menaruh service-account private key atau credential rahasia di repository GitHub.
