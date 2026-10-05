const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT belum dikonfigurasi di Vercel.');
  const serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });
}

function json(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(data));
}

function normalizeRoles(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim().toLowerCase()).filter(Boolean);
  if (value == null) return [];
  return String(value).split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan.' });

  try {
    const app = getAdminApp();
    const auth = app.auth();
    const db = app.firestore();

    const authorization = req.headers.authorization || '';
    if (!authorization.startsWith('Bearer ')) return json(res, 401, { error: 'Token autentikasi tidak ditemukan.' });

    const decoded = await auth.verifyIdToken(authorization.slice(7));
    const requesterSnap = await db.collection('users').doc(decoded.uid).get();
    if (!requesterSnap.exists || !normalizeRoles(requesterSnap.data().role).includes('admin')) {
      return json(res, 403, { error: 'Hanya admin yang dapat mengubah kredensial pengguna.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const uid = String(body.uid || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!uid) return json(res, 400, { error: 'UID pengguna wajib diisi.' });
    if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
      return json(res, 400, { error: 'Username hanya boleh berisi huruf, angka, titik, underscore, atau strip (3-64 karakter).' });
    }
    if (password && password.length < 6) return json(res, 400, { error: 'Password baru minimal 6 karakter.' });

    const email = `${username}@cbt.smaich.id`;
    const current = await auth.getUser(uid);

    try {
      const owner = await auth.getUserByEmail(email);
      if (owner.uid !== uid) return json(res, 409, { error: 'Username tersebut sudah digunakan akun lain.' });
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    const update = { email };
    if (password) update.password = password;
    await auth.updateUser(uid, update);

    const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
    const safeProfile = {
      nama: String(profile.nama || '').trim(),
      username,
    };
    if (Array.isArray(profile.role)) safeProfile.role = profile.role;
    if (Array.isArray(profile.mapel)) safeProfile.mapel = profile.mapel;
    if (Array.isArray(profile.kelas)) safeProfile.kelas = profile.kelas;

    await db.collection('users').doc(uid).set(safeProfile, { merge: true });

    return json(res, 200, {
      success: true,
      uid,
      username,
      email,
      passwordChanged: Boolean(password),
      previousEmail: current.email || null,
    });
  } catch (error) {
    console.error('ADMIN_UPDATE_USER_ERROR', error);
    const code = error.code || '';
    if (code === 'auth/invalid-password') return json(res, 400, { error: 'Password tidak memenuhi aturan Firebase.' });
    if (code === 'auth/invalid-email') return json(res, 400, { error: 'Username menghasilkan alamat login yang tidak valid.' });
    if (code === 'auth/user-not-found') return json(res, 404, { error: 'Akun Firebase tidak ditemukan.' });
    return json(res, 500, { error: error.message || 'Gagal memperbarui akun.' });
  }
};
