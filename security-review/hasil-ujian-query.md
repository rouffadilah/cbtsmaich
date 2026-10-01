# Hasil Ujian Access Review

This branch is reserved for the staged security hardening of `hasil_ujian` access.

## Required implementation order

1. Change the dashboard query so teachers do not read the entire `hasil_ujian` collection.
2. Ensure newly submitted results include the submitting student's `uid` and the relevant subject/class fields.
3. Add Firestore rules that constrain teacher reads to authorized subject/class data and student reads to their own results.
4. Test admin, teacher, and student flows before merging.

No production Firestore rule is changed by this review file.