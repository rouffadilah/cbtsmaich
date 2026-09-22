# Deploy CBT SMAICH ke Vercel

Project ini adalah aplikasi static HTML/CSS/JavaScript yang menggunakan Firebase Authentication, Firestore, Storage, dan SDK Firebase dari `gstatic.com`. Tidak diperlukan build framework seperti Next.js.

## Cara deploy

1. Ekstrak folder `cbtsmaich-main`.
2. Buka Vercel dan pilih **Add New > Project**.
3. Import repository GitHub yang berisi isi folder ini, atau upload project dari komputer.
4. Biarkan **Framework Preset** otomatis/Other. Untuk project static ini tidak perlu Build Command maupun Output Directory.
5. Deploy.
6. Pastikan Production Domain mengarah ke:
   `https://cbtsmaich.vercel.app/`

## Konfigurasi Firebase untuk domain Vercel

Di Firebase Console project `cbt-sekolah-7fed0`: **Authentication > Settings > Authorized domains**, tambahkan:

`cbtsmaich.vercel.app`

Google Sign-In juga harus aktif pada **Authentication > Sign-in method > Google**. Domain aplikasi Vercel perlu diotorisasi agar autentikasi web berjalan.

## URL aplikasi

- Login: `/`
- Registrasi: `/registrasi`
- Ujian siswa: `/attempt`
- Dashboard guru/admin: `/dashboard`

Konfigurasi `vercel.json` memakai `cleanUrls`, sehingga URL halaman tidak perlu menampilkan `.html`.

## Catatan

File `firebase-config.js` berisi Firebase Web App config. Nilai seperti `apiKey` pada konfigurasi Firebase Web memang bukan kredensial server rahasia; keamanan utama tetap bergantung pada Firebase Authentication dan Firestore Security Rules. Jangan pernah menaruh service-account private key di browser.
