// index.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const btnSubmit = document.getElementById("btn-submit");
const loginStatus = document.getElementById("login-status");
const btnLoginGoogle = document.getElementById("btn-login-google");

const setLoginMessage = (type, message) => {
    if (!loginStatus) return;
    loginStatus.className = `auth-status ${type}`;
    loginStatus.textContent = message;
};

const setSubmittingState = (isSubmitting) => {
    if (!btnSubmit) return;
    btnSubmit.disabled = isSubmitting;
    if (!btnSubmit.dataset.defaultText) btnSubmit.dataset.defaultText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = isSubmitting ? '<i class="fas fa-spinner fa-spin"></i> MEMPROSES...' : btnSubmit.dataset.defaultText;
};

const normalizeArrayData = (data) => {
    if (Array.isArray(data)) return data.map(v => String(v).trim()).filter(Boolean);
    if (typeof data === 'string' && data.trim() !== '') return [data.trim()];
    return [];
};

const normalizeRoles = data => normalizeArrayData(data).map(v => v.toLowerCase());

// Firebase Auth + Firestore profile are the only authorization sources.
// localStorage is intentionally not used for role decisions.
onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;
        const roles = normalizeRoles(snap.data().role);
        if (roles.includes("admin") || roles.includes("guru")) {
            window.location.replace("/dashboard");
        } else {
            window.location.replace("/attempt");
        }
    } catch (error) {
        console.error("Gagal memuat profil login:", error);
    }
});

const provider = new GoogleAuthProvider();

if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener("click", async (e) => {
        e.preventDefault();
        setSubmittingState(true);
        setLoginMessage('info', 'Membuka jendela Google...');
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            let userData;
            if (!userDocSnap.exists()) {
                userData = {
                    nama: user.displayName || "Siswa Baru",
                    username: user.email || "",
                    role: ['siswa'],
                    kelas: ['Umum']
                };
                await setDoc(userDocRef, userData);
            } else {
                userData = userDocSnap.data() || {};
            }

            const roles = normalizeRoles(userData.role || ['siswa']);
            window.location.replace(roles.includes('guru') || roles.includes('admin') ? "/dashboard" : "/attempt");
        } catch (error) {
            console.error("Popup Error:", error);
            setLoginMessage('error', "Gagal masuk: " + error.message);
        } finally {
            setSubmittingState(false);
        }
    });
}

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setSubmittingState(true);
        setLoginMessage('info', 'Memverifikasi kredensial Anda...');

        const username = document.getElementById("username").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        const dummyEmail = username.includes("@") ? username : `${username}@cbt.smaich.id`;

        try {
            const userCred = await signInWithEmailAndPassword(auth, dummyEmail, password);
            const user = userCred.user;
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (!userDoc.exists()) {
                setLoginMessage('error', 'Akun tidak memiliki profil di database. Hubungi admin sekolah.');
                await auth.signOut();
                return;
            }

            const userData = userDoc.data() || {};
            const roles = normalizeRoles(userData.role);
            const isStaff = roles.includes('guru') || roles.includes('admin');

            setLoginMessage('success', isStaff ? 'Berhasil masuk. Mengalihkan ke dashboard...' : 'Berhasil masuk. Mengalihkan ke ujian...');
            window.location.replace(isStaff ? "/dashboard" : "/attempt");
        } catch (error) {
            console.error("Proses Login Manual Gagal:", error);
            if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(error.code)) {
                setLoginMessage('error', 'Username atau password tidak valid. Silakan coba lagi.');
            } else if (error.code === 'permission-denied') {
                setLoginMessage('error', 'Akses database ditolak. Periksa status server.');
            } else {
                setLoginMessage('error', `Terjadi kesalahan: ${error.message}`);
            }
        } finally {
            setSubmittingState(false);
        }
    });
}
