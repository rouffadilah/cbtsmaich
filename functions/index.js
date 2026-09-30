const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

const normalizeRoles = (value) => Array.isArray(value) ? value.map(String).map(v => v.toLowerCase()) : (value ? [String(value).toLowerCase()] : []);
const isStudent = (data) => normalizeRoles(data?.role).includes("siswa");

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sesi login tidak valid.");
  return request.auth.uid;
}

async function getStudent(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || !isStudent(snap.data())) throw new HttpsError("permission-denied", "Akun siswa tidak valid.");
  return snap.data();
}

function shuffle(values) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function publicQuestion(data, id) {
  const q = { ...data, id };
  delete q.kunci_jawaban;
  delete q.jawaban_benar;
  delete q.kunci;
  delete q.jawabanBenar;
  delete q.correctAnswer;
  delete q.correctAnswers;
  delete q.answerKey;

  const tipe = String(q.tipe || q.tipe_soal || "PG").toUpperCase();

  // MENJODOHKAN: pasangan asli berisi pemetaan jawaban benar.
  // Kirim sisi kiri dan daftar sisi kanan secara terpisah.
  if (tipe === "MENJODOHKAN" && Array.isArray(data.pasangan)) {
    const pairs = data.pasangan.filter(p => p && p.kiri != null && p.kanan != null);
    q.pasangan = pairs.map(p => ({ kiri: p.kiri }));
    q.opsiPasangan = shuffle(pairs.map(p => String(p.kanan).trim()).filter(Boolean));
  }

  return q;
}

async function getAttempt(uid, attemptId) {
  if (!attemptId) throw new HttpsError("invalid-argument", "attemptId wajib diisi.");
  const ref = db.doc(`exam_attempts/${attemptId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Attempt ujian tidak ditemukan.");
  const data = snap.data();
  if (data.uid !== uid) throw new HttpsError("permission-denied", "Attempt bukan milik akun ini.");
  return { ref, data };
}

exports.startExam = onCall(async (request) => {
  const uid = requireAuth(request);
  const student = await getStudent(uid);
  const { mapel, kelas, token = "" } = request.data || {};

  if (!mapel || !kelas) throw new HttpsError("invalid-argument", "Mapel dan kelas wajib dipilih.");

  const jadwalSnap = await db.doc("pengaturan/jadwal_ujian").get();
  const waktuSnap = await db.doc("pengaturan/waktu_ujian").get();
  const tokenSnap = await db.doc("pengaturan/token_ujian").get();
  const acakSnap = await db.doc("pengaturan/acak_soal").get();

  const jadwalKey = `${mapel}_${kelas}`;
  const jadwalMulaiStr = jadwalSnap.exists ? jadwalSnap.data()[jadwalKey] : null;
  const durasiMenit = Number(waktuSnap.exists ? waktuSnap.data()[jadwalKey] : 90) || 90;

  const nowMs = Date.now();
  if (jadwalMulaiStr) {
    const startMs = new Date(jadwalMulaiStr).getTime();
    const endMs = startMs + durasiMenit * 60 * 1000;
    if (nowMs < startMs) throw new HttpsError("failed-precondition", "Ujian belum dimulai.");
    if (nowMs > endMs) throw new HttpsError("deadline-exceeded", "Waktu ujian sudah berakhir.");
  }

  const tokenKey = `token_${mapel}_${kelas}`;
  const tokenData = tokenSnap.exists ? tokenSnap.data()[tokenKey] : null;
  const currentToken = typeof tokenData === "object" ? tokenData?.code : tokenData;
  if (currentToken && String(token).toUpperCase().trim() !== String(currentToken).toUpperCase().trim()) {
    throw new HttpsError("permission-denied", "Token ujian salah.");
  }

  const qSnap = await db.collection("bank_soal").where("mataPelajaran", "==", mapel).get();
  const all = [];
  qSnap.forEach(doc => {
    const d = doc.data();
    const classes = Array.isArray(d.kelas) ? d.kelas : [d.kelas];
    if (classes.includes(kelas) || classes.includes("Umum") || classes.length === 0) {
      all.push({ id: doc.id, data: d });
    }
  });
  if (!all.length) throw new HttpsError("not-found", "Soal belum tersedia untuk kelas dan mapel ini.");

  const isAcak = Boolean(acakSnap.exists && acakSnap.data()[jadwalKey]);
  const ordered = isAcak ? shuffle(all) : all.sort((a,b) => (a.data.nomor_soal || 0) - (b.data.nomor_soal || 0));

  const startAt = Timestamp.now();
  const endAt = Timestamp.fromMillis(startAt.toMillis() + durasiMenit * 60 * 1000);
  const attemptRef = db.collection("exam_attempts").doc();

  await attemptRef.set({
    uid,
    nama: student.nama || request.auth.token.name || "",
    username: student.username || request.auth.token.email || "",
    kelas,
    mataPelajaran: mapel,
    startAt,
    endAt,
    status: "ACTIVE",
    violationCount: 0,
    questionOrder: ordered.map(x => x.id),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    attemptId: attemptRef.id,
    startAt: startAt.toMillis(),
    endAt: endAt.toMillis(),
    durationSeconds: Math.max(0, Math.floor((endAt.toMillis() - nowMs) / 1000)),
    questions: ordered.map(x => publicQuestion(x.data, x.id))
  };
});

exports.saveAnswer = onCall(async (request) => {
  const uid = requireAuth(request);
  const { attemptId, questionId, answer, raguRagu = false } = request.data || {};
  const { ref, data } = await getAttempt(uid, attemptId);

  if (data.status !== "ACTIVE") throw new HttpsError("failed-precondition", "Ujian sudah tidak aktif.");
  if (Timestamp.now().toMillis() > data.endAt.toMillis()) throw new HttpsError("deadline-exceeded", "Waktu ujian telah berakhir.");
  if (!data.questionOrder?.includes(questionId)) throw new HttpsError("invalid-argument", "Soal tidak termasuk dalam attempt ini.");

  await db.doc(`exam_attempts/${attemptId}/answers/${questionId}`).set({
    answer,
    raguRagu: Boolean(raguRagu),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await ref.update({ updatedAt: FieldValue.serverTimestamp() });
  return { ok: true, serverTime: Date.now(), endAt: data.endAt.toMillis() };
});

exports.reportViolation = onCall(async (request) => {
  const uid = requireAuth(request);
  const { attemptId, reason = "UNKNOWN" } = request.data || {};
  const { ref, data } = await getAttempt(uid, attemptId);

  if (data.status !== "ACTIVE") throw new HttpsError("failed-precondition", "Ujian sudah tidak aktif.");
  if (Timestamp.now().toMillis() > data.endAt.toMillis()) throw new HttpsError("deadline-exceeded", "Waktu ujian telah berakhir.");

  const count = Number(data.violationCount || 0) + 1;
  await ref.update({
    violationCount: count,
    lastViolationReason: String(reason).slice(0, 200),
    lastViolationAt: FieldValue.serverTimestamp(),
    forceDisqualify: count >= 3,
    updatedAt: FieldValue.serverTimestamp()
  });

  return { count, max: 3, forceDisqualify: count >= 3 };
});

exports.submitExam = onCall(async (request) => {
  const uid = requireAuth(request);
  const { attemptId, statusAkhir = "NORMAL" } = request.data || {};
  const { ref, data: attempt } = await getAttempt(uid, attemptId);
  const finalStatus = attempt.forceDisqualify ? "DISKUALIFIKASI" : statusAkhir;

  if (attempt.status !== "ACTIVE") {
    return { alreadySubmitted: true, status: attempt.status };
  }

  const qSnap = await db.collection("bank_soal").where("mataPelajaran", "==", attempt.mataPelajaran).get();
  const questions = new Map();
  qSnap.forEach(doc => {
    const q = doc.data();
    const classes = Array.isArray(q.kelas) ? q.kelas : [q.kelas];
    if (classes.includes(attempt.kelas) || classes.includes("Umum") || classes.length === 0) questions.set(doc.id, q);
  });

  const answersSnap = await ref.collection("answers").get();
  const answers = {};
  answersSnap.forEach(doc => { answers[doc.id] = doc.data().answer; });

  let total = 0;
  let earned = 0;
  for (const questionId of attempt.questionOrder || []) {
    const q = questions.get(questionId);
    if (!q) continue;
    const type = String(q.tipe || q.tipe_soal || "PG").toUpperCase();
    const weight = Number(q.bobot) || 1;
    const answer = answers[questionId];

    if (type === "PG") {
      total += weight;
      const key = q.kunci_jawaban ?? q.jawaban_benar;
      if (answer === key) earned += weight;
    } else if (type === "PGK") {
      total += weight;
      const key = Array.isArray(q.kunci_jawaban) ? q.kunci_jawaban : [];
      const ans = Array.isArray(answer) ? answer : [];
      if (key.length && ans.length === key.length && key.every(k => ans.includes(k))) earned += weight;
    } else if (type === "MENJODOHKAN") {
      total += weight;
      const pairs = Array.isArray(q.pasangan) ? q.pasangan : [];
      const obj = answer && typeof answer === "object" ? answer : {};
      let correct = 0;
      pairs.forEach(p => { if (obj[p.kiri] === p.kanan) correct++; });
      if (pairs.length) earned += (correct / pairs.length) * weight;
    }
  }

  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  const resultRef = db.collection("hasil_ujian").doc();
  await resultRef.set({
    uid,
    nama: attempt.nama,
    username: attempt.username,
    kelas: attempt.kelas,
    mataPelajaran: attempt.mataPelajaran,
    jawaban: answers,
    skorPG: score,
    skor: score,
    waktuSubmit: FieldValue.serverTimestamp(),
    statusPelanggaran: finalStatus,
    attemptId,
    createdAt: FieldValue.serverTimestamp()
  });

  await ref.update({
    status: "SUBMITTED",
    submittedAt: FieldValue.serverTimestamp(),
    resultId: resultRef.id,
    updatedAt: FieldValue.serverTimestamp()
  });

  return { ok: true, resultId: resultRef.id, score, status: finalStatus };
});
