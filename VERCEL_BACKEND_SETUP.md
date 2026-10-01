# CBT SMAICH — Vercel Backend (Spark Plan)

CBT SMAICH tidak lagi membutuhkan Firebase Cloud Functions untuk backend ujian.

## Arsitektur

- Frontend: Vercel
- Backend ujian: Vercel Functions (`/api/*`)
- Database: Cloud Firestore
- Login: Firebase Authentication
- Admin SDK: berjalan hanya di server Vercel

Cloud Functions dan Cloud Build tidak digunakan oleh arsitektur ini, sehingga project Firebase dapat tetap berada di Spark selama penggunaan Firestore tetap dalam kuota gratisnya.

## Vercel Environment Variable

Tambahkan pada Vercel Project Settings → Environment Variables:

`FIREBASE_SERVICE_ACCOUNT`

Value: isi JSON service account Firebase/Google Cloud yang memiliki akses baca/tulis Firestore.

Jangan commit file JSON ke GitHub.

## IAM

Service account yang dipakai backend membutuhkan role `Cloud Datastore User` (`roles/datastore.user`) pada project Firebase agar dapat membaca dan menulis data Firestore. Role ini memberi akses read/write ke data tanpa memberi hak administrasi database.

## Endpoint

- `POST /api/start-exam`
- `POST /api/save-answer`
- `POST /api/report-violation`
- `POST /api/submit-exam`

Semua endpoint mewajibkan Firebase ID token pada header `Authorization: Bearer <token>`.

## Keamanan

- Kunci jawaban hanya dibaca oleh backend.
- Soal yang dikirim ke browser disaring dari field kunci jawaban.
- Token ujian divalidasi di server.
- Jadwal dan waktu ujian divalidasi di server.
- Jawaban disimpan melalui endpoint server.
- Nilai dihitung di server.
- Pelanggaran dicatat di server.
- Parameter URL tidak dapat mem-bypass token.

## Deployment

Push branch `security-v2` ke GitHub. Vercel akan melakukan deployment dari repository yang sudah terhubung.

Setelah deployment selesai, lakukan pengujian siswa dengan akun uji sebelum merge ke `main`.
