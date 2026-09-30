# CBT SMAICH Security V2

Branch ini memindahkan bagian kritis ujian ke Firebase Cloud Functions.

## Perubahan

- Jadwal, durasi, token, dan randomisasi divalidasi server-side.
- Siswa tidak lagi membaca koleksi `bank_soal` secara langsung.
- Kunci jawaban tidak dikirim ke browser.
- Soal MENJODOHKAN dikirim tanpa pemetaan jawaban benar.
- Attempt ujian disimpan di `exam_attempts`.
- Jawaban disimpan server-side di `exam_attempts/{attemptId}/answers/{questionId}`.
- Penilaian dilakukan server-side.
- Hasil ujian dibuat oleh server, bukan oleh browser.
- Timer UI mengikuti `endAt` yang diberikan server.
- Token tidak dapat di-bypass dengan parameter URL dari browser.
- Autosave lokal tetap ada sebagai cadangan, tetapi server menjadi sumber utama.
- Submit dibuat idempotent untuk attempt yang sudah berstatus SUBMITTED.

## Deploy

Jalankan dari root repository:

```bash
firebase login
firebase use cbt-sekolah-7fed0
firebase deploy --only firestore:rules,functions
```

Pastikan Firebase CLI dan Node.js 20 tersedia.

## Urutan pengujian

1. Deploy rules + functions.
2. Login sebagai siswa uji.
3. Mulai ujian dengan token benar.
4. Pastikan soal tampil.
5. Jawab PG, PGK, MENJODOHKAN, dan ESSAY.
6. Refresh sebelum submit dan pastikan attempt tidak rusak.
7. Putuskan internet sebentar lalu sambungkan kembali.
8. Submit.
9. Pastikan hanya satu hasil dibuat.
10. Login sebagai siswa lain dan pastikan tidak dapat membaca bank soal/kunci.
11. Login sebagai guru/admin dan pastikan dashboard tetap dapat membaca bank soal dan hasil.
12. Uji token salah, ujian belum dimulai, dan ujian sudah berakhir.

## Catatan

Jangan menghapus rules lama dari production sebelum Cloud Functions V2 berhasil dideploy dan diuji. Branch ini sengaja dipisahkan dari `main` agar deployment lama tetap dapat dipulihkan.
