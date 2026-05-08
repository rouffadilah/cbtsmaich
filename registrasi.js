import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("register-form");
    const btnSubmit = document.getElementById("btn-submit");
    const boxSiswa = document.getElementById("select-siswa");
    const boxGuru = document.getElementById("select-guru");
    const roleInput = document.getElementById("reg-role");
    const usernameLabel = document.getElementById("username-label");
    const regTitle = document.getElementById("reg-title");
    
    let statusRegSiswa = true;
    let statusRegGuru = true;

    async function fetchRegStatus() {
        try {
            const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
            if(regSnap.exists()) {
                statusRegSiswa = regSnap.data().siswa_aktif !== false; 
                statusRegGuru = regSnap.data().guru_aktif !== false; 
            }
            updateRegUI(roleInput.value);
        } catch(e) { console.error("Gagal menarik status registrasi", e); }
    }

    function updateRegUI(role) {
        const warningBox = document.getElementById("reg-warning");
        
        let isAllowed = true;
        if (role === 'siswa' && !statusRegSiswa) isAllowed = false;
        if (role === 'guru' && !statusRegGuru) isAllowed = false;

        if (!isAllowed) {
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = '0.5';
            btnSubmit.innerHTML = '<i class="fas fa-lock"></i> PENDAFTARAN DITUTUP';
            warningBox.style.display = 'block';
            warningBox.innerHTML = `<i class="fas fa-lock"></i> Pendaftaran form <b>${role.toUpperCase()}</b> saat ini ditutup oleh Admin.`;
        } else {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
            btnSubmit.innerHTML = 'DAFTAR SEKARANG';
            warningBox.style.display = 'none';
        }
    }

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
        updateRegUI(role); 
    }

    boxSiswa.addEventListener('click', () => setRole('siswa'));
    boxGuru.addEventListener('click', () => setRole('guru'));

    fetchRegStatus();

    registerForm?.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        
        const role = roleInput.value;
        
        if (role === 'siswa' && !statusRegSiswa) return alert("Pendaftaran Siswa sedang ditutup!");
        if (role === 'guru' && !statusRegGuru) return alert("Pendaftaran Guru sedang ditutup!");
        
        const name = document.getElementById("reg-name").value;
        const username = document.getElementById("reg-username").value.replace(/\s+/g, '');
        const password = document.getElementById("reg-password").value;

        if(password !== document.getElementById("reg-confirm-password").value) {
            return alert("Password tidak cocok!");
        }

        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = "<i class='fas fa-spinner fa-spin'></i> MEMPROSES...";
        btnSubmit.disabled = true;

        const dummyEmail = `${username}@cbt.smaich.id`;

        try {
            const userCred = await createUserWithEmailAndPassword(auth, dummyEmail, password);
            const user = userCred.user;

            await updateProfile(user, { displayName: name });

            // PERBAIKAN: Selalu simpan role sebagai Array
            await setDoc(doc(db, "users", user.uid), {
                nama: name,
                username: username,
                role: [role], // Menyesuaikan dengan format baru multi-role
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
