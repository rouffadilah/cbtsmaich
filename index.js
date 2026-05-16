// index.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const btnSubmit = document.getElementById("btn-submit");

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
    
    // Set UI State: Loading
    const originalBtnText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMPROSES...';
    btnSubmit.disabled = true;

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
            alert("AKSES DITOLAK: Akun Anda tidak memiliki data di database.");
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

        // 4. Routing Berdasarkan Role
        if (roles.includes("admin") || roles.includes("guru")) {
            window.location.replace("dashboard.html"); 
        } else {
            window.location.replace("attempt.html"); 
        }

    } catch (error) {
        console.error("Proses Login Gagal:", error);
        
        // Menangani tipe error yang umum
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            alert("LOGIN GAGAL: Username atau Password Anda salah!");
        } else if (error.code === 'permission-denied') {
            alert("ERROR DATABASE: Akses ke Firestore ditolak. Periksa Firestore Rules.");
        } else {
            alert(`TERJADI KESALAHAN: ${error.message}`);
        }
    } finally {
        // Reset UI State
        btnSubmit.innerHTML = originalBtnText;
        btnSubmit.disabled = false;
    }
});
