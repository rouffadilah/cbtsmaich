const crypto = require("crypto");
const { requireStaff, db, getTokenConfig, currentToken, sanitizeMinutes } = require("../lib/token");

function rolesOf(value) {
  return (Array.isArray(value) ? value : [value]).filter(Boolean).map(String).map(v => v.toLowerCase());
}

function canManage(user, mapel) {
  if (rolesOf(user.role).includes("admin")) return true;
  const assigned = Array.isArray(user.mapel) ? user.mapel.map(String) : [];
  return !assigned.length || assigned.includes(mapel);
}

module.exports = async (req, res) => {
  try {
    const { user } = await requireStaff(req);
    const mapel = String(req.body?.mapel || req.query?.mapel || "").trim();
    const kelas = String(req.body?.kelas || req.query?.kelas || "").trim();
    if (!mapel || !kelas) return res.status(400).json({ error: "Mapel dan kelas wajib diisi." });
    if (!canManage(user, mapel)) return res.status(403).json({ error: "Guru tidak memiliki akses ke mata pelajaran ini." });

    const ref = db().doc("pengaturan/token_ujian");
    const key = `token_${mapel}_${kelas}`;

    if (req.method === "GET") {
      const config = await getTokenConfig(mapel, kelas);
      const token = currentToken(config, mapel, kelas);
      return res.status(200).json({
        mapel, kelas, mode: token.mode, active: config.active !== false,
        rotationMinutes: token.rotationMinutes || config.rotationMinutes || 15,
        code: token.code, expiresAt: token.expiresAt || null,
        required: token.required
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const mode = String(req.body?.mode || "auto").toLowerCase();
    const rotationMinutes = sanitizeMinutes(req.body?.rotationMinutes || 15);
    const active = req.body?.active !== false;

    if (!active) {
      await ref.set({ [key]: { mode: "disabled", active: false, updatedAt: Date.now(), updatedBy: user.username || "staff" } }, { merge: true });
      return res.status(200).json({ ok: true, mode: "disabled", active: false });
    }

    if (mode === "custom") {
      const customCode = String(req.body?.customCode || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{4,12}$/.test(customCode)) {
        return res.status(400).json({ error: "Token custom harus 4-12 karakter A-Z/0-9." });
      }
      const expiresMinutes = sanitizeMinutes(req.body?.expiresMinutes || rotationMinutes);
      const expiresAt = Date.now() + expiresMinutes * 60 * 1000;
      await ref.set({
        [key]: { mode: "custom", customCode, active: true, expiresAt, rotationMinutes: expiresMinutes, updatedAt: Date.now(), updatedBy: user.username || "staff" }
      }, { merge: true });
    } else {
      await ref.set({
        [key]: { mode: "auto", active: true, rotationMinutes, seed: crypto.randomBytes(8).toString("hex"), updatedAt: Date.now(), updatedBy: user.username || "staff" }
      }, { merge: true });
    }

    const config = await getTokenConfig(mapel, kelas);
    const token = currentToken(config, mapel, kelas);
    return res.status(200).json({ ok: true, mapel, kelas, mode: token.mode, rotationMinutes: token.rotationMinutes || rotationMinutes, code: token.code, expiresAt: token.expiresAt || null, required: token.required });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: error?.message || "Gagal mengatur token." });
  }
};
