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
        // 1. Coba Login via Firebase Auth
        let userCred;
        try {
            userCred = await signInWithEmailAndPassword(auth, dummyEmail, password);
        } catch (authError) {
            console.error("Auth Error:", authError);
            alert("LOGIN GAGAL: Username atau Password Anda salah!");
            throw new Error("Henti");
        }

        const user = userCred.user;

        // 2. Cek Hak Akses (Role) di Firestore Database
        let userDoc;
        try {
            userDoc = await getDoc(doc(db, "users", user.uid));
        } catch (dbError) {
            console.error("Database Error:", dbError);
            alert("ERROR DATABASE: Koneksi ke Firestore diblokir. Pastikan Rules Firestore sudah disetel 'allow read, write: if true;'");
            throw new Error("Henti");
        }

        // 3. Arahkan Halaman
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Simpan Hak Akses ke memori perangkat
            localStorage.setItem("userRole", userData.role);
            if (userData.role === 'guru') {
                localStorage.setItem("userMapel", userData.mapel || "informatika");
            }

            // Lempar ke halaman yang sesuai
            if (userData.role === "admin" || userData.role === "guru") {
                window.location.href = "dashboard.html"; 
            } else {
                window.location.href = "attempt.html"; 
            }
        } else {
            alert("AKSES DITOLAK: Akun Anda belum memiliki data (Siswa/Guru/Admin) di dalam database. Silakan daftar ulang.");
            await auth.signOut();
        }

    } catch (error) {
        // Error sudah ditangani oleh alert di atas
    } finally {
        btnSubmit.innerHTML = originalBtnText;
        btnSubmit.disabled = false;
    }
});
