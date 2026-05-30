// index.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const btnSubmit = document.getElementById("btn-submit");
const loginStatus = document.getElementById("login-status");

const setLoginMessage = (type, message) => {
    if (!loginStatus) return;
    loginStatus.className = `auth-status ${type}`;
    loginStatus.textContent = message;
};

const setSubmittingState = (isSubmitting) => {
    if (!btnSubmit) return;
    btnSubmit.disabled = isSubmitting;
    const defaultText = btnSubmit.dataset.defaultText || btnSubmit.innerHTML;
    btnSubmit.innerHTML = isSubmitting ? '<i class="fas fa-spinner fa-spin"></i> MEMPROSES...' : defaultText;
};

/**
 * Fungsi untuk menstandarkan array data (role, mapel, kelas)
 */
const normalizeArrayData = (data) => {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string' && data.trim() !== '') return [data];
    return [];
};

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault(); 
    
    // Paksa fullscreen saat tombol login ditekan
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) { docEl.requestFullscreen().catch(()=>{}); }
    else if (docEl.webkitRequestFullscreen) { docEl.webkitRequestFullscreen(); } 
    
    setSubmittingState(true);
    setLoginMessage('info', 'Memverifikasi kredensial Anda...');

    // Sanitasi Input
    const username = document.getElementById("username").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const dummyEmail = `${username}@cbt.smaich.id`;

    try {
        // 1. Proses Autentikasi
        const userCred = await signInWithEmailAndPassword(auth, dummyEmail, password);
        const user = userCred.user;

        // 2. Tarik Data Profil dari Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            setLoginMessage('error', 'Akun tidak memiliki data profil di database. Hubungi admin sekolah.');
            await auth.signOut();
            return;
        }

        const userData = userDoc.data();
        
        // 3. Normalisasi Role dan Akses
        const roles = normalizeArrayData(userData.role);
        localStorage.setItem("userRole", JSON.stringify(roles));
        
        if (roles.includes('guru')) {
            const mapels = normalizeArrayData(userData.mapel);
            const kelases = normalizeArrayData(userData.kelas);

            localStorage.setItem("userMapel", JSON.stringify(mapels));
            localStorage.setItem("userKelas", JSON.stringify(kelases));
        }

        setLoginMessage('success', 'Berhasil masuk. Mengalihkan ke dashboard...');

        // 4. Routing Berdasarkan Role
        if (roles.includes("admin") || roles.includes("guru")) {
            window.location.replace("dashboard.html"); 
        } else {
            // Tangkap parameter URL (jika ada) dan teruskan ke attempt.html
            const queryString = window.location.search;
            window.location.replace("attempt.html" + queryString); 
        }

    } catch (error) {
        console.error("Proses Login Gagal:", error);
        
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            setLoginMessage('error', 'Username atau password tidak valid. Silakan coba lagi.');
        } else if (error.code === 'permission-denied') {
            setLoginMessage('error', 'Akses database ditolak. Periksa konfigurasi Firestore.');
        } else {
            setLoginMessage('error', `Terjadi kesalahan: ${error.message}`);
        }
    } finally {
        setSubmittingState(false);
    }
});
