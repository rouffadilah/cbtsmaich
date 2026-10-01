const { requireStaff, getTokenConfig, currentToken, canManageMapel } = require("../lib/token");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { user } = await requireStaff(req);
    const mapel = String(req.query?.mapel || "").trim();
    const kelas = String(req.query?.kelas || "").trim();
    if (!mapel || !kelas) return res.status(400).json({ error: "Mapel dan kelas wajib diisi." });
    if (!canManageMapel(user, mapel)) return res.status(403).json({ error: "Guru tidak memiliki assignment untuk mata pelajaran ini." });

    const config = await getTokenConfig(mapel, kelas);
    const token = currentToken(config, mapel, kelas);
    return res.status(200).json({
      mapel,
      kelas,
      required: token.required,
      active: config.active !== false && token.mode !== "disabled",
      code: token.code,
      mode: token.mode,
      rotationMinutes: token.rotationMinutes || null,
      expiresAt: token.expiresAt || null
    });
  } catch (error) {
    console.error(error);
    const message = error?.message || "Gagal mengambil token.";
    const status = /assignment|akses guru|akses/i.test(message) ? 403 : 401;
    return res.status(status).json({ error: message });
  }
};
