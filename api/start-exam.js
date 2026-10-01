const { startExam } = require("../lib/exam");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  try { return res.status(200).json(await startExam(req)); }
  catch (error) { console.error(error); return res.status(400).json({ error: error?.message || "Gagal memulai ujian." }); }
};
