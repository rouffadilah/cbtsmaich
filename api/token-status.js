const { requireStaff, getTokenConfig, currentToken } = require("../lib/token");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { user } = await requireStaff(req);
    const mapel = String(req.query?.mapel || "").trim();
    const kelas = String(req.query?.kelas || "").trim();
    if (!mapel || !kelas) return res.status(400).json({ error: "Mapel dan kelas wajib diisi." });

    const isAdmin = (Array.isArray(user.role) ? user.role : [user.role]).map(String).map(v => v.toLowerCase()).includes("admin");
    const assignedMapel = Array.isArray(user.mapel) ? user.mapel.map(String) : [];
    if (!isAdmin && assignedMapel.length && !assignedMapel.includes(mapel)) {
      return res.status(403).json({ error: "Guru tidak memiliki akses ke mata pelajaran ini." });
    }

    const config = await getTokenConfig(mapel, kelas);
    const token = currentToken(config, mapel, kelas);
    return res.status(200).json({
      mapel,
      kelas,
      required: token.required,
      code: token.code,
      mode: token.mode,
      rotationMinutes: token.rotationMinutes || null,
      expiresAt: token.expiresAt || null
    });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: error?.message || "Gagal mengambil token." });
  }
};
