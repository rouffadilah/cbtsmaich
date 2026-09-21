import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updateEmail,
    updatePassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const makeAuthEmail = (username) => {
    const clean = String(username || '').trim().toLowerCase();
    return clean.includes('@') ? clean : `${clean}@cbt.smaich.id`;
};

const normalizeRoles = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    return value ? [value] : [];
};

const getErrorMessage = (error) => {
    const code = error?.code || '';
    const messages = {
        'auth/wrong-password': 'Password lama salah.',
        'auth/invalid-credential': 'Password lama salah atau sesi verifikasi tidak valid.',
        'auth/requires-recent-login': 'Demi keamanan, silakan masukkan password lama untuk memverifikasi perubahan akun.',
        'auth/email-already-in-use': 'Username tersebut sudah digunakan akun lain.',
        'auth/invalid-email': 'Username/identitas akun tidak valid.',
        'auth/weak-password': 'Password baru minimal 6 karakter.',
        'auth/too-many-requests': 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.',
        'permission-denied': 'Perubahan ditolak oleh aturan keamanan database.'
    };
    return messages[code] || error?.message || 'Gagal memperbarui akun.';
};

let activeUser = null;
let activeProfile = null;

const status = (type, message) => {
    const el = document.getElementById('account-status');
    if (!el) return;
    el.className = `auth-status ${type}`;
    el.textContent = message;
};

const isPasswordProvider = (user) =>
    !!user?.providerData?.some(provider => provider.providerId === 'password');

const setPasswordVisibility = (show) => {
    const group = document.getElementById('account-password-section');
    if (group) group.style.display = show ? 'block' : 'none';
};

const fillAccountForm = async () => {
    if (!activeUser) return false;

    const snap = await getDoc(doc(db, 'users', activeUser.uid));
    if (!snap.exists()) throw new Error('Profil akun tidak ditemukan di database.');

    activeProfile = snap.data();
    const roles = normalizeRoles(activeProfile.role);
    const usernameInput = document.getElementById('account-username');
    const roleOutput = document.getElementById('account-role');
    const nameInput = document.getElementById('account-name');

    if (nameInput) nameInput.value = activeProfile.nama || activeUser.displayName || '';
    if (usernameInput) {
        usernameInput.value = activeProfile.username || '';
        usernameInput.disabled = !isPasswordProvider(activeUser);
        usernameInput.title = usernameInput.disabled
            ? 'Username dikelola oleh penyedia login Google.'
            : 'Username yang digunakan saat login.';
    }
    if (roleOutput) roleOutput.value = roles.map(r => String(r).toUpperCase()).join(', ');

    setPasswordVisibility(isPasswordProvider(activeUser));
    return true;
};

const openAccountModal = async () => {
    const modal = document.getElementById('modal-akun-saya');
    if (!modal) return;

    try {
        status('info', 'Memuat data akun...');
        await fillAccountForm();
        document.getElementById('account-current-password')?.focus();
        modal.style.display = 'flex';
        status('info', 'Perubahan nama/username dan password dapat disimpan dari sini.');
    } catch (error) {
        status('error', getErrorMessage(error));
        modal.style.display = 'flex';
    }
};

const closeAccountModal = () => {
    const modal = document.getElementById('modal-akun-saya');
    if (modal) modal.style.display = 'none';
};

const handleSubmit = async (event) => {
    event.preventDefault();
    if (!activeUser || !activeProfile) return;

    const btn = document.getElementById('btn-save-akun-saya');
    const original = btn?.innerHTML || 'Simpan Perubahan';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }
    status('info', 'Memverifikasi dan menyimpan perubahan...');

    let oldAuthEmail = activeUser.email;
    let authEmailChanged = false;

    try {
        const nameInput = document.getElementById('account-name');
        const usernameInput = document.getElementById('account-username');
        const oldPasswordInput = document.getElementById('account-current-password');
        const newPasswordInput = document.getElementById('account-new-password');
        const confirmPasswordInput = document.getElementById('account-confirm-password');

        const newName = nameInput?.value.trim() || '';
        const oldUsername = String(activeProfile.username || '').trim().toUpperCase();
        const newUsername = String(usernameInput?.value || oldUsername).replace(/\s+/g, '').toUpperCase();
        const passwordProvider = isPasswordProvider(activeUser);
        const oldPassword = oldPasswordInput?.value || '';
        const newPassword = newPasswordInput?.value || '';
        const confirmPassword = confirmPasswordInput?.value || '';

        if (!newName) throw new Error('Nama lengkap wajib diisi.');
        if (!newUsername) throw new Error('Username wajib diisi.');

        const roles = normalizeRoles(activeProfile.role);
        if (roles.includes('siswa') && !/@/.test(newUsername)) {
            if (!/^\d{10}$/.test(newUsername)) throw new Error('NIS siswa harus berjumlah 10 digit angka.');
        }
        if (roles.includes('guru') && !/@/.test(newUsername)) {
            if (!/^[A-Z]\d{2}[A-Z]\d-\d{3}$/.test(newUsername)) {
                throw new Error('Format ID Guru tidak sesuai. Contoh: E24H6-223.');
            }
        }

        const usernameChanged = passwordProvider && newUsername !== oldUsername;
        const passwordChanged = passwordProvider && !!newPassword;
        const identityChangeNeedsReauth = usernameChanged || passwordChanged;

        if (!passwordProvider && (usernameChanged || passwordChanged)) {
            throw new Error('Username atau password akun non-password dikelola oleh penyedia login.');
        }

        if (passwordChanged) {
            if (newPassword.length < 6) throw new Error('Password baru minimal 6 karakter.');
            if (newPassword !== confirmPassword) throw new Error('Konfirmasi password baru tidak cocok.');
        }

        if (identityChangeNeedsReauth) {
            if (!oldPassword) throw new Error('Masukkan password lama untuk mengonfirmasi perubahan username/password.');
            const credential = EmailAuthProvider.credential(activeUser.email, oldPassword);
            await reauthenticateWithCredential(activeUser, credential);
        }

        const newAuthEmail = makeAuthEmail(newUsername);

        if (usernameChanged) {
            await updateEmail(activeUser, newAuthEmail);
            authEmailChanged = true;
        }

        if (newName !== (activeProfile.nama || '')) {
            await updateProfile(activeUser, { displayName: newName });
        }

        if (passwordChanged) {
            await updatePassword(activeUser, newPassword);
        }

        const payload = {
            nama: newName,
            username: newUsername,
            updatedAt: serverTimestamp()
        };
        await updateDoc(doc(db, 'users', activeUser.uid), payload);

        activeProfile = { ...activeProfile, ...payload };
        localStorage.setItem('userMapel', JSON.stringify(Array.isArray(activeProfile.mapel) ? activeProfile.mapel : []));
        localStorage.setItem('userKelas', JSON.stringify(Array.isArray(activeProfile.kelas) ? activeProfile.kelas : []));

        document.querySelectorAll('[data-account-name]').forEach(el => { el.textContent = newName; });
        if (authEmailChanged) {
            // Tidak ada pesan aksi lanjutan; sesi Firebase sudah memakai email baru.
        }

        const passwordText = passwordChanged ? ' Password juga berhasil diperbarui.' : '';
        status('success', `Profil akun berhasil diperbarui.${passwordText}`);

        if (newPasswordInput) newPasswordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';
        if (oldPasswordInput) oldPasswordInput.value = '';

        setTimeout(closeAccountModal, 700);
    } catch (error) {
        // Jika email Auth sempat berubah tetapi Firestore gagal, coba rollback agar username tetap sinkron.
        try {
            if (typeof authEmailChanged !== 'undefined' && authEmailChanged && activeUser && activeUser.email !== oldAuthEmail) {
                await updateEmail(activeUser, oldAuthEmail);
            }
        } catch (rollbackError) {
            console.warn('Rollback email Auth gagal:', rollbackError);
        }
        console.error('Gagal memperbarui akun:', error);
        status('error', getErrorMessage(error));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-open-akun-saya')?.addEventListener('click', openAccountModal);
    document.getElementById('btn-close-akun-saya')?.addEventListener('click', closeAccountModal);
    document.getElementById('form-akun-saya')?.addEventListener('submit', handleSubmit);

    const modal = document.getElementById('modal-akun-saya');
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) closeAccountModal();
    });

    onAuthStateChanged(auth, async (user) => {
        activeUser = user;
        if (!user || !document.getElementById('modal-akun-saya')) return;
        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
                activeProfile = snap.data();
                document.querySelectorAll('[data-account-name]').forEach(el => {
                    el.textContent = activeProfile.nama || user.displayName || 'Pengguna';
                });
            }
        } catch (error) {
            console.warn('Profil akun gagal dimuat:', error);
        }
    });
});

window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
