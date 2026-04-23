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

   // 1. Fungsi Ganti Role (Visual & Input) - TEMA PROFESIONAL (TANPA BIRU)
    function setRole(role) {
        roleInput.value = role;
        if (role === 'guru') {
            // Gaya Guru Aktif
            boxGuru.style.borderColor = '#1f2937'; // Charcoal Dark
            boxGuru.style.background = '#f3f4f6'; // Light Gray
            boxGuru.querySelector('i').style.color = '#1f2937';
            // Gaya Siswa Non-aktif
            boxSiswa.style.borderColor = '#e5e7eb';
            boxSiswa.style.background = 'white';
            boxSiswa.querySelector('i').style.color = '#9ca3af';
        } else {
            // Gaya Siswa Aktif
            boxSiswa.style.borderColor = '#1f2937';
            boxSiswa.style.background = '#f3f4f6';
            boxSiswa.querySelector('i').style.color = '#1f2937';
            // Gaya Guru Non-aktif
            boxGuru.style.borderColor = '#e5e7eb';
            boxGuru.style.background = 'white';
            boxGuru.querySelector('i').style.color = '#9ca3af';
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

            // C. Simpan Data Peran ke Firestore (PENTING)
            await setDoc(doc(db, "users", user.uid), {
                nama: name,
                username: username,
                role: role,
                createdAt: serverTimestamp()
            });

            alert(`Selamat! Akun ${role.toUpperCase()} berhasil dibuat.`);
            window.location.href = "index.html";

        } catch (error) {
            let msg = "Terjadi kesalahan.";
            if (error.code === 'auth/email-already-in-use') msg = "ID/Username sudah terdaftar!";
            if (error.code === 'auth/weak-password') msg = "Password minimal 6 karakter!";
            
            alert(msg);
            btnSubmit.innerHTML = originalBtnText;
            btnSubmit.disabled = false;
        }
    });
});