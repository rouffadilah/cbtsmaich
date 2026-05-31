// index.js
import { auth, db } from './firebase-config.js';
// PERUBAHAN: Kembali menggunakan signInWithPopup dan menambahkan onAuthStateChanged
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. VARIABEL DOM
// ==========================================
const loginForm = document.getElementById("login-form");
const btnSubmit = document.getElementById("btn-submit");
const loginStatus = document.getElementById("login-status");
const btnLoginGoogle = document.getElementById("btn-login-google");

// ==========================================
// 2. FUNGSI UTILITAS
// ==========================================
const setLoginMessage = (type, message) => {
    if (!loginStatus) return;
    loginStatus.className = `auth-status ${type}`;
    loginStatus.textContent = message;
};

const setSubmittingState = (isSubmitting) => {
    if (!btnSubmit) return;
    btnSubmit.disabled = isSubmitting;
    
    if (!btnSubmit.dataset.defaultText) {
        btnSubmit.dataset.defaultText = btnSubmit.innerHTML;
    }
    
    btnSubmit.innerHTML = isSubmitting ? '<i class="fas fa-spinner fa-spin"></i> MEMPROSES...' : btnSubmit.dataset.defaultText;
};

const normalizeArrayData = (data) => {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string' && data.trim() !== '') return [data];
    return [];
};

// ==========================================
// 3. CEK STATUS LOGIN OTOMATIS
// ==========================================
// Jika user sebenarnya sudah berhasil login, langsung arahkan ke halamannya
onAuthStateChanged(auth, (user) => {
    if (user) {
        const roles = JSON.parse(localStorage.getItem("userRole") || "[]");
        if (roles.includes("admin") || roles.includes("guru")) {
            window.location.replace("dashboard.html");
        } else if (roles.includes("siswa")) {
            window.location.replace("attempt.html");
        }
    }
});

// ==========================================
// 4. LOGIKA GOOGLE LOGIN (POPUP MODE)
// ==========================================
const provider = new GoogleAuthProvider();

if (btnLoginGoogle) {
    btnLoginGoogle.addEventListener("click", async (e) => {
        e.preventDefault(); 
        setSubmittingState(true);
        setLoginMessage('info', 'Membuka jendela Google...');
        
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            setLoginMessage('info', 'Berhasil! Menyiapkan data akun Anda...');
            
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            let roles = ['siswa'];
            let userData = null;

            // Jika user baru pertama kali login dengan Google
            if (!userDocSnap.exists()) {
                userData = {
                    nama: user.displayName || "Siswa Baru",
                    username: user.email, 
                    role: roles,
                    kelas: ['Umum'] 
                };
                await setDoc(userDocRef, userData);
            } else {
                userData = userDocSnap.data();
                roles = normalizeArrayData(userData.role || ['siswa']);
            }

            // Simpan role ke local storage
            localStorage.setItem("userRole", JSON.stringify(roles));
            
            if (roles.includes('guru') || roles.includes('admin')) {
                const mapels = normalizeArrayData(userData?.mapel);
                const kelases = normalizeArrayData(userData?.kelas);
                localStorage.setItem("userMapel", JSON.stringify(mapels));
                localStorage.setItem("userKelas", JSON.stringify(kelases));
                window.location.replace("dashboard.html");
            } else {
                window.location.replace("attempt.html");
            }
        } catch (error) {
            console.error("Popup Error:", error);
            setLoginMessage('error', "Gagal masuk: " + error.message);
        } finally {
            setSubmittingState(false);
        }
    });
}

// ==========================================
// 5. LOGIKA LOGIN MANUAL (USERNAME/EMAIL + PASSWORD)
// ==========================================
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

            const userData = userDoc.data();
            const roles = normalizeArrayData(userData.role);
            
            localStorage.setItem("userRole", JSON.stringify(roles));
            
            if (roles.includes('guru') || roles.includes('admin')) {
                const mapels = normalizeArrayData(userData.mapel);
                const kelases = normalizeArrayData(userData.kelas);
                localStorage.setItem("userMapel", JSON.stringify(mapels));
                localStorage.setItem("userKelas", JSON.stringify(kelases));
                
                setLoginMessage('success', 'Berhasil masuk. Mengalihkan ke dashboard...');
                window.location.replace("dashboard.html"); 
            } else {
                setLoginMessage('success', 'Berhasil masuk. Mengalihkan ke ujian...');
                window.location.replace("attempt.html"); 
            }

        } catch (error) {
            console.error("Proses Login Manual Gagal:", error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
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