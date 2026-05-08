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
        let userCred;
        try {
            userCred = await signInWithEmailAndPassword(auth, dummyEmail, password);
        } catch (authError) {
            console.error("Auth Error:", authError);
            alert("LOGIN GAGAL: Username atau Password Anda salah!");
            throw new Error("Henti");
        }

        const user = userCred.user;
        let userDoc;
        try {
            userDoc = await getDoc(doc(db, "users", user.uid));
        } catch (dbError) {
            console.error("Database Error:", dbError);
            alert("ERROR DATABASE: Koneksi ke Firestore diblokir. Pastikan Rules Firestore sudah disetel 'allow read, write: if true;'");
            throw new Error("Henti");
        }

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // PERBAIKAN: Menangkap Multi-Role dalam bentuk Array
            let roles = [];
            if (Array.isArray(userData.role)) roles = userData.role;
            else if (typeof userData.role === 'string' && userData.role.trim() !== '') roles = [userData.role];
            
            localStorage.setItem("userRole", JSON.stringify(roles));
            
            if (roles.includes('guru')) {
                let mapels = [];
                if (Array.isArray(userData.mapel)) mapels = userData.mapel;
                else if (typeof userData.mapel === 'string' && userData.mapel.trim() !== '') mapels = [userData.mapel];
                
                let kelases = [];
                if (Array.isArray(userData.kelas)) kelases = userData.kelas;
                else if (typeof userData.kelas === 'string' && userData.kelas.trim() !== '') kelases = [userData.kelas];

                localStorage.setItem("userMapel", JSON.stringify(mapels));
                localStorage.setItem("userKelas", JSON.stringify(kelases));
            }

            // Arahkan ke Dashboard jika Admin ATAU Guru
            if (roles.includes("admin") || roles.includes("guru")) {
                window.location.href = "dashboard.html"; 
            } else {
                window.location.href = "attempt.html"; 
            }
        } else {
            alert("AKSES DITOLAK: Akun Anda tidak memiliki data di database.");
            await auth.signOut();
        }

    } catch (error) {
    } finally {
        btnSubmit.innerHTML = originalBtnText;
        btnSubmit.disabled = false;
    }
});
