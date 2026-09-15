# CBT SMAICH — Firebase Backend Setup

Project Firebase: `cbt-sekolah-7fed0`  
Firebase App ID: `1:289218396137:web:366383efd1348edad3d578`

## 1. Authentication
Di Firebase Console buka **Authentication → Sign-in method** lalu aktifkan **Email/Password**.

Username CBT tetap dipakai oleh aplikasi, tetapi di Firebase Auth disimpan sebagai email teknis dengan pola:

`USERNAME@cbt.smaich.id`

Contoh NIS `1234567890` menjadi `1234567890@cbt.smaich.id`.

## 2. Firestore
Buka **Firestore Database** pada project `cbt-sekolah-7fed0` dan pastikan database sudah dibuat.

File `firestore.rules` sudah disiapkan untuk koleksi:
- `users`
- `pengaturan`
- `bank_soal`
- `hasil_ujian`

## 3. Deploy Rules
Jalankan dari folder proyek:

```bash
firebase use cbt-sekolah-7fed0
firebase deploy --only firestore:rules
```

File `firebase.json` sudah diarahkan ke `firestore.rules`.

## 4. Struktur data users
Profil pengguna dibuat di `users/{FirebaseAuthUID}`. Contoh siswa:

```json
{
  "nama": "Nama Siswa",
  "username": "1234567890",
  "role": ["siswa"],
  "kelas": "X-1"
}
```

Contoh guru:

```json
{
  "nama": "Nama Guru",
  "username": "E24H6-223",
  "role": ["guru"],
  "mapel": ["Informatika"],
  "kelas": ["X-1", "X-2"]
}
```

Admin harus dipromosikan oleh admin yang sudah ada atau dibuat melalui kanal administrasi Firebase yang aman; browser biasa tidak diizinkan membuat role `admin`.

## 5. Penting setelah update
Service worker sudah dinaikkan ke versi `v5` agar cache HTML/JS lama dibuang. Setelah deploy GitHub Pages, lakukan hard refresh sekali pada browser yang sebelumnya pernah membuka aplikasi.
