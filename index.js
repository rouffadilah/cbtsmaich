import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const btnSubmit = document.getElementById("btn-submit");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault(); 
    
    const originalBtnText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMPROSES...';
    btnSubmit.disabled = true;

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const dummyEmail = `${username}@cbt.smaich.id`;

    try {
        // 1. Login Firebase Auth
        const userCred = await signInWithEmailAndPassword(auth, dummyEmail, password);
        const user = userCred.user;

        // 2. Ambil Role dan Mapel dari Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Simpan sesi ke LocalStorage untuk Dashboard
            localStorage.setItem("userRole", userData.role);
            if (userData.role === 'guru') {
                localStorage.setItem("userMapel", userData.mapel || "informatika"); // default fallback
            }

            // 3. Arahkan Halaman Sesuai Hak Akses
            if (userData.role === "admin" || userData.role === "guru") {
                window.location.href = "dashboard.html"; 
            } else {
                window.location.href = "attempt.html"; // Siswa
            }
        } else {
            alert("Akses ditolak! Data pengguna tidak ditemukan di database.");
            auth.signOut();
            btnSubmit.innerHTML = originalBtnText;
            btnSubmit.disabled = false;
        }

    } catch (error) {
        console.error("Login Error:", error);
        alert("Username atau Password salah!");
        btnSubmit.innerHTML = originalBtnText;
        btnSubmit.disabled = false;
    }
});
