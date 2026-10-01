const crypto = require("crypto");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT belum dikonfigurasi di Vercel.");
  const serviceAccount = JSON.parse(raw);
  return initializeApp({ credential: cert(serviceAccount) });
}

function db() { return getFirestore(getAdminApp()); }
function authAdmin() { return getAuth(getAdminApp()); }

function normalizeRoles(value) {
  if (Array.isArray(value)) return value.map(v => String(v).toLowerCase());
  return value ? [String(value).toLowerCase()] : [];
}

function isStaff(data) {
  const roles = normalizeRoles(data?.role);
  return roles.includes("admin") || roles.includes("guru");
}

async function requireStaff(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Sesi login tidak valid.");
  const decoded = await authAdmin().verifyIdToken(token);
  const snap = await db().doc(`users/${decoded.uid}`).get();
  if (!snap.exists || !isStaff(snap.data())) throw new Error("Akses guru/admin diperlukan.");
  return { decoded, user: snap.data() };
}

function getSecret() {
  const explicit = process.env.CBT_TOKEN_SECRET;
  if (explicit) return explicit;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccount = JSON.parse(raw || "{}");
  if (!serviceAccount.private_key) throw new Error("Secret token belum tersedia.");
  return crypto.createHash("sha256").update(serviceAccount.private_key).digest("hex");
}

function sanitizeMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 15;
  return Math.min(240, Math.max(1, Math.floor(n)));
}

function generateAutoToken(mapel, kelas, rotationMinutes, bucket, seed = "v1") {
  const input = `${seed}|${String(mapel).trim()}|${String(kelas).trim()}|${bucket}`;
  const digest = crypto.createHmac("sha256", getSecret()).update(input).digest("hex").toUpperCase();
  return digest.slice(0, 6);
}

async function getTokenConfig(mapel, kelas) {
  const key = `token_${mapel}_${kelas}`;
  const snap = await db().doc("pengaturan/token_ujian").get();
  const raw = snap.exists ? snap.data()[key] : null;
  if (raw && typeof raw === "object") return { key, ...raw };
  if (raw) return { key, code: String(raw), mode: "custom", active: true, rotationMinutes: 15 };
  return { key, mode: "auto", active: true, rotationMinutes: 15, seed: "v1" };
}

function currentToken(config, mapel, kelas, nowMs = Date.now()) {
  if (config.active === false) return { required: false, code: "", expiresAt: null, mode: config.mode || "auto" };

  const mode = String(config.mode || "auto").toLowerCase();
  if (mode === "custom") {
    const code = String(config.customCode || config.code || "").trim().toUpperCase();
    if (!code) return { required: true, code: "", expiresAt: null, mode: "custom" };
    return { required: true, code, expiresAt: config.expiresAt || null, mode: "custom" };
  }

  const rotationMinutes = sanitizeMinutes(config.rotationMinutes || 15);
  const periodMs = rotationMinutes * 60 * 1000;
  const bucket = Math.floor(nowMs / periodMs);
  const expiresAt = (bucket + 1) * periodMs;
  return {
    required: true,
    code: generateAutoToken(mapel, kelas, rotationMinutes, bucket, config.seed || "v1"),
    expiresAt,
    mode: "auto",
    rotationMinutes,
    bucket
  };
}

module.exports = { db, requireStaff, getTokenConfig, currentToken, sanitizeMinutes };
