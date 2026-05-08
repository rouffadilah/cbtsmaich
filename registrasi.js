import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("register-form");
    const btnSubmit = document.getElementById("btn-submit");
    const boxSiswa = document.getElementById("select-siswa");
    const boxGuru = document.getElementById("select-guru");
    const roleInput = document.getElementById("reg-role");
    const usernameLabel = document.getElementById("username-label");
    const regTitle = document.getElementById("reg-title");

   // 1. Fungsi Ganti Role (Visual & Input)
    function setRole(role) {
        roleInput.value = role;
        if (role === 'guru') {
            regTitle.innerText = "REGISTRASI GURU";
            usernameLabel.innerText = "Username / NIP";
            boxGuru.classList.add('active');
            boxSiswa.classList.remove('active');
        } else {
            regTitle.innerText = "REGISTRASI SISWA";
            usernameLabel.innerText = "Nomor Peserta / NIS";
            boxSiswa.classList.add('active');
            boxGuru.classList.remove('active');
        }
    }

    boxSiswa.addEventListener('click', () => setRole('siswa'));
    boxGuru.addEventListener('click', () => setRole('guru'));

    // 2. Proses Pendaftaran
    registerForm?.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        
        const name = document.getElementById("reg-name").value;
        const username = document.getElementById("reg-username").value;
        const password = document.getElementById("reg-password").value;
        const role = roleInput.value;

        if(password !== document.getElementById("reg-confirm-password").value) {
            return alert("Password tidak cocok!");
        }

        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = "<i class='fas fa-spinner fa-spin'></i> MEMPROSES...";
        btnSubmit.disabled = true;

        const dummyEmail = `${username}@cbt.smaich.id`;

        try {
            // A. Buat Akun di Firebase Auth
            const userCred = await createUserWithEmailAndPassword(auth, dummyEmail, password);
            const user = userCred.user;

            // B. Simpan Nama ke Profil Auth
            await updateProfile(user, { displayName: name });

            // C. Simpan Data Peran ke Firestore
            await setDoc(doc(db, "users", user.uid), {
                nama: name,
                username: username,
                role: role,
                createdAt: serverTimestamp()
            });

            alert(`Selamat! Akun ${role.toUpperCase()} berhasil dibuat. Silakan login.`);
            window.location.href = "index.html";

        } catch (error) {
            console.error("Error Registrasi:", error);
            
            // MENAMPILKAN PESAN ERROR ASLI DARI FIREBASE
            let msg = "Terjadi kesalahan: " + error.message; 
            
            if (error.code === 'auth/email-already-in-use') msg = "Gagal: ID/Username tersebut sudah terdaftar!";
            if (error.code === 'auth/weak-password') msg = "Gagal: Password terlalu lemah (minimal 6 karakter)!";
            if (error.code === 'auth/operation-not-allowed') msg = "Gagal: Anda belum mengaktifkan metode 'Email/Password' di Firebase Console!";
            
            alert(msg);
            btnSubmit.innerHTML = originalBtnText;
            btnSubmit.disabled = false;
        }
    });
});
