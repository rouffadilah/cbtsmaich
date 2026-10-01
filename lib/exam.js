const crypto = require("crypto");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getTokenConfig, currentToken } = require("./token");

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT belum dikonfigurasi di Vercel.");
  let serviceAccount;
  try { serviceAccount = JSON.parse(raw); }
  catch { throw new Error("FIREBASE_SERVICE_ACCOUNT bukan JSON yang valid."); }
  return initializeApp({ credential: cert(serviceAccount) });
}

function db() { return getFirestore(getAdminApp()); }
function authAdmin() { return getAuth(getAdminApp()); }

async function requireAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Sesi login tidak valid.");
  return authAdmin().verifyIdToken(token);
}

const normalizeRoles = (value) => Array.isArray(value)
  ? value.map(String).map(v => v.toLowerCase())
  : (value ? [String(value).toLowerCase()] : []);

function isStudent(data) { return normalizeRoles(data?.role).includes("siswa"); }

function studentClasses(data) {
  const raw = data?.kelas ?? data?.kelasSiswa ?? data?.class ?? [];
  return (Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(v => String(v).trim());
}

function studentBelongsToClass(student, kelas) {
  return studentClasses(student).includes(String(kelas).trim());
}

async function getStudent(uid) {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists || !isStudent(snap.data())) throw new Error("Akun siswa tidak valid.");
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
  if (tipe === "MENJODOHKAN" && Array.isArray(data.pasangan)) {
    const pairs = data.pasangan.filter(p => p && p.kiri != null && p.kanan != null);
    // Frontend lama memakai keberadaan field `kanan` hanya sebagai filter baris.
    // Nilainya sengaja dikosongkan agar kunci jawaban tetap server-only.
    q.pasangan = pairs.map(p => ({ kiri: p.kiri, kanan: "" }));
    q.opsiPasangan = shuffle(pairs.map(p => String(p.kanan).trim()).filter(Boolean));
  }
  return q;
}

async function getQuestions(mapel, kelas) {
  const snap = await db().collection("bank_soal").where("mataPelajaran", "==", mapel).get();
  const all = [];
  snap.forEach(doc => {
    const d = doc.data();
    const classes = Array.isArray(d.kelas) ? d.kelas : [d.kelas];
    if (classes.includes(kelas) || classes.includes("Umum") || classes.length === 0 || classes[0] == null) {
      all.push({ id: doc.id, data: d });
    }
  });
  if (!all.length) throw new Error("Soal belum tersedia untuk kelas dan mapel ini.");
  return all;
}

async function getAttempt(uid, attemptId) {
  if (!attemptId) throw new Error("attemptId wajib diisi.");
  const ref = db().doc(`exam_attempts/${attemptId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Attempt ujian tidak ditemukan.");
  const data = snap.data();
  if (data.uid !== uid) throw new Error("Attempt bukan milik akun ini.");
  return { ref, data };
}

function scheduleWindow(jadwalMulaiStr, durasiMenit, nowMs) {
  if (!jadwalMulaiStr) return { startMs: nowMs, scheduleEndMs: null };
  const startMs = new Date(jadwalMulaiStr).getTime();
  if (!Number.isFinite(startMs)) throw new Error("Jadwal ujian tidak valid.");
  return { startMs, scheduleEndMs: startMs + durasiMenit * 60 * 1000 };
}

async function startExam(req) {
  const decoded = await requireAuth(req);
  const uid = decoded.uid;
  const student = await getStudent(uid);
  const { mapel, kelas, token = "" } = req.body || {};
  if (!mapel || !kelas) throw new Error("Mapel dan kelas wajib dipilih.");
  if (!studentBelongsToClass(student, kelas)) throw new Error("Siswa tidak terdaftar pada kelas yang dipilih.");

  const firestore = db();
  const jadwalKey = `${mapel}_${kelas}`;
  const [jadwalSnap, waktuSnap, acakSnap] = await Promise.all([
    firestore.doc("pengaturan/jadwal_ujian").get(),
    firestore.doc("pengaturan/waktu_ujian").get(),
    firestore.doc("pengaturan/acak_soal").get()
  ]);

  const jadwalMulaiStr = jadwalSnap.exists ? jadwalSnap.data()[jadwalKey] : null;
  const durasiMenit = Number(waktuSnap.exists ? waktuSnap.data()[jadwalKey] : 90) || 90;
  const nowMs = Date.now();
  const { startMs, scheduleEndMs } = scheduleWindow(jadwalMulaiStr, durasiMenit, nowMs);

  if (jadwalMulaiStr) {
    if (nowMs < startMs) throw new Error("Ujian belum dimulai.");
    if (nowMs > scheduleEndMs) throw new Error("Waktu ujian sudah berakhir.");
  }

  // Satu attempt server-side per siswa + mapel + kelas.
  // Refresh/retry akan mengembalikan attempt ACTIVE yang sama.
  const attemptId = crypto.createHash("sha256").update(`${uid}|${mapel}|${kelas}`).digest("hex").slice(0, 40);
  const attemptRef = firestore.doc(`exam_attempts/${attemptId}`);
  const existingSnap = await attemptRef.get();

  if (existingSnap.exists) {
    const existing = existingSnap.data();
    if (existing.status === "SUBMITTED") throw new Error("Ujian ini sudah pernah dikumpulkan.");
    if (existing.status === "DISQUALIFIED" || existing.forceDisqualify) throw new Error("Ujian ini sudah didiskualifikasi.");
    if (existing.endAt && Date.now() >= existing.endAt.toMillis()) {
      await attemptRef.update({ status: "EXPIRED", updatedAt: FieldValue.serverTimestamp() });
      throw new Error("Waktu ujian pada attempt ini sudah berakhir.");
    }

    const all = await getQuestions(mapel, kelas);
    const questionMap = new Map(all.map(x => [x.id, x.data]));
    const selected = (existing.questionOrder || []).map(id => questionMap.has(id) ? { id, data: questionMap.get(id) } : null).filter(Boolean);
    const answersSnap = await attemptRef.collection("answers").get();
    const savedAnswers = {};
    const savedRaguRagu = {};
    answersSnap.forEach(doc => {
      savedAnswers[doc.id] = doc.data().answer;
      savedRaguRagu[doc.id] = Boolean(doc.data().raguRagu);
    });

    return {
      attemptId,
      startAt: existing.startAt.toMillis(),
      endAt: existing.endAt.toMillis(),
      durationSeconds: Math.max(0, Math.floor((existing.endAt.toMillis() - Date.now()) / 1000)),
      tokenExpiresAt: existing.tokenExpiresAt?.toMillis?.() || null,
      resumed: true,
      savedAnswers,
      savedRaguRagu,
      questions: selected.map(x => publicQuestion(x.data, x.id))
    };
  }

  const tokenConfig = await getTokenConfig(mapel, kelas);
  const tokenInfo = currentToken(tokenConfig, mapel, kelas, nowMs);
  const provider = String(decoded.firebase?.sign_in_provider || "").toLowerCase();
  const suppliedToken = String(token || "").trim().toUpperCase();
  const studentUsesGoogle = provider === "google.com";

  // Kebijakan CBT SMAICH: siswa yang login dengan Google selalu wajib token.
  // Login non-Google mengikuti konfigurasi token aktif/nonaktif.
  const mustUseToken = studentUsesGoogle || (isStudent(student) && tokenInfo.required);
  if (mustUseToken) {
    if (!tokenInfo.code) {
      throw new Error(studentUsesGoogle
        ? "Login Google wajib menggunakan token ujian aktif. Hubungi guru untuk mengaktifkan/memberikan token."
        : "Token ujian belum tersedia. Hubungi guru untuk mendapatkan token aktif.");
    }
    if (tokenInfo.expiresAt && nowMs >= Number(tokenInfo.expiresAt)) throw new Error("Token ujian sudah kedaluwarsa. Minta token terbaru kepada guru.");
    if (!suppliedToken) throw new Error("Token ujian wajib diisi.");
    if (suppliedToken !== tokenInfo.code) throw new Error("Token ujian salah atau sudah berubah. Gunakan token terbaru.");
  }

  const all = await getQuestions(mapel, kelas);
  const isAcak = Boolean(acakSnap.exists && acakSnap.data()[jadwalKey]);
  const ordered = isAcak ? shuffle(all) : all.sort((a, b) => (a.data.nomor_soal || 0) - (b.data.nomor_soal || 0));
  const createdStartMs = Date.now();
  const cappedEndMs = Math.min(createdStartMs + durasiMenit * 60 * 1000, scheduleEndMs || Number.POSITIVE_INFINITY);

  const attemptData = {
    uid,
    nama: student.nama || decoded.name || "",
    username: student.username || decoded.email || "",
    email: decoded.email || "",
    authProvider: provider,
    kelas,
    mataPelajaran: mapel,
    startAt: Timestamp.fromMillis(createdStartMs),
    endAt: Timestamp.fromMillis(cappedEndMs),
    status: "ACTIVE",
    violationCount: 0,
    forceDisqualify: false,
    tokenMode: tokenInfo.mode || "auto",
    tokenExpiresAt: tokenInfo.expiresAt ? Timestamp.fromMillis(Number(tokenInfo.expiresAt)) : null,
    questionOrder: ordered.map(x => x.id),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  try {
    await attemptRef.create(attemptData);
  } catch (error) {
    // Dua klik Start yang bersamaan: salah satu membuat attempt, yang lain cukup membaca attempt tersebut.
    if (error?.code !== 6 && !String(error?.message || "").toLowerCase().includes("already exists")) throw error;
  }

  const finalSnap = await attemptRef.get();
  const finalAttempt = finalSnap.data();
  if (finalAttempt.status !== "ACTIVE") throw new Error("Attempt ujian tidak aktif.");

  return {
    attemptId,
    startAt: finalAttempt.startAt.toMillis(),
    endAt: finalAttempt.endAt.toMillis(),
    durationSeconds: Math.max(0, Math.floor((finalAttempt.endAt.toMillis() - Date.now()) / 1000)),
    tokenExpiresAt: tokenInfo.expiresAt || null,
    resumed: false,
    savedAnswers: {},
    savedRaguRagu: {},
    questions: ordered.map(x => publicQuestion(x.data, x.id))
  };
}

async function saveAnswer(req) {
  const decoded = await requireAuth(req);
  const { attemptId, questionId, answer, raguRagu = false, revision = Date.now() } = req.body || {};
  const { ref, data } = await getAttempt(decoded.uid, attemptId);
  if (data.status !== "ACTIVE") throw new Error("Ujian sudah tidak aktif.");
  if (Date.now() >= data.endAt.toMillis()) throw new Error("Waktu ujian telah berakhir.");
  if (!data.questionOrder?.includes(questionId)) throw new Error("Soal tidak termasuk dalam attempt ini.");

  const answerRef = db().doc(`exam_attempts/${attemptId}/answers/${questionId}`);
  const incomingRevision = Number(revision) || Date.now();
  await db().runTransaction(async transaction => {
    const snap = await transaction.get(answerRef);
    const existingRevision = Number(snap.exists ? snap.data().revision : 0);
    if (incomingRevision > existingRevision) {
      transaction.set(answerRef, {
        answer,
        raguRagu: Boolean(raguRagu),
        revision: incomingRevision,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    transaction.update(ref, { updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true, serverTime: Date.now(), endAt: data.endAt.toMillis(), revision: incomingRevision };
}

async function reportViolation(req) {
  const decoded = await requireAuth(req);
  const { attemptId, reason = "UNKNOWN" } = req.body || {};
  const { ref } = await getAttempt(decoded.uid, attemptId);
  let result;
  await db().runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Attempt ujian tidak ditemukan.");
    const data = snap.data();
    if (data.uid !== decoded.uid) throw new Error("Attempt bukan milik akun ini.");
    if (data.status !== "ACTIVE") throw new Error("Ujian sudah tidak aktif.");
    if (Date.now() >= data.endAt.toMillis()) throw new Error("Waktu ujian telah berakhir.");
    const count = Number(data.violationCount || 0) + 1;
    const disqualify = count >= 3;
    transaction.update(ref, {
      violationCount: count,
      lastViolationReason: String(reason).slice(0, 200),
      lastViolationAt: FieldValue.serverTimestamp(),
      forceDisqualify: disqualify,
      updatedAt: FieldValue.serverTimestamp()
    });
    result = { count, max: 3, forceDisqualify: disqualify };
  });
  return result;
}

function gradeQuestions(questions, answers) {
  let total = 0;
  let earned = 0;
  for (const [questionId, q] of questions.entries()) {
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
  return { score: total > 0 ? Math.round((earned / total) * 100) : 0 };
}

async function submitExam(req) {
  const decoded = await requireAuth(req);
  const { attemptId, statusAkhir = "NORMAL" } = req.body || {};
  const firestore = db();
  const ref = firestore.doc(`exam_attempts/${attemptId}`);
  const resultRef = firestore.doc(`hasil_ujian/${attemptId}`);
  let response;

  await firestore.runTransaction(async transaction => {
    const attemptSnap = await transaction.get(ref);
    if (!attemptSnap.exists) throw new Error("Attempt ujian tidak ditemukan.");
    const attempt = attemptSnap.data();
    if (attempt.uid !== decoded.uid) throw new Error("Attempt bukan milik akun ini.");
    if (attempt.status === "SUBMITTED") {
      response = { alreadySubmitted: true, status: attempt.status, resultId: attempt.resultId || resultRef.id };
      return;
    }
    if (attempt.status !== "ACTIVE") throw new Error("Ujian sudah tidak aktif.");

    const answersSnap = await transaction.get(ref.collection("answers"));
    const answers = {};
    answersSnap.forEach(doc => { answers[doc.id] = doc.data().answer; });

    const qSnap = await transaction.get(firestore.collection("bank_soal").where("mataPelajaran", "==", attempt.mataPelajaran));
    const questions = new Map();
    qSnap.forEach(doc => {
      const q = doc.data();
      const classes = Array.isArray(q.kelas) ? q.kelas : [q.kelas];
      if (classes.includes(attempt.kelas) || classes.includes("Umum") || classes.length === 0 || classes[0] == null) questions.set(doc.id, q);
    });

    const selected = new Map();
    for (const id of attempt.questionOrder || []) if (questions.has(id)) selected.set(id, questions.get(id));
    const { score } = gradeQuestions(selected, answers);
    const finalStatus = attempt.forceDisqualify ? "DISKUALIFIKASI" : statusAkhir;
    const resultSnap = await transaction.get(resultRef);

    if (!resultSnap.exists) {
      transaction.create(resultRef, {
        uid: decoded.uid,
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
    }
    transaction.update(ref, {
      status: "SUBMITTED",
      submittedAt: FieldValue.serverTimestamp(),
      resultId: resultRef.id,
      updatedAt: FieldValue.serverTimestamp()
    });
    response = { ok: true, resultId: resultRef.id, score, status: finalStatus };
  });

  return response;
}

module.exports = { startExam, saveAnswer, reportViolation, submitExam };
