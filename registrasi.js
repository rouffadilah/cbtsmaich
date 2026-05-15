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

            const akademikSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
            if(akademikSnap.exists()) {
                const data = akademikSnap.data();
                const listKelas = data.list_kelas || [];
                const listMapel = data.list_mapel || [];

                const selectKelasSiswa = document.getElementById("reg-kelas-siswa");
                if(selectKelasSiswa) {
                    selectKelasSiswa.innerHTML = '<option value="" disabled selected>Pilih Kelas...</option>' + 
                        listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
                }

                const containerMapel = document.getElementById("reg-mapel-container");
                if(containerMapel) {
                    containerMapel.innerHTML = listMapel.map(m => `<label><input type="checkbox" class="reg-mapel-cb" value="${m}"> ${m}</label>`).join('');
                }

                const containerKelasGuru = document.getElementById("reg-kelas-guru-container");
                if(containerKelasGuru) {
                    containerKelasGuru.innerHTML = listKelas.map(k => `<label><input type="checkbox" class="reg-kelas-cb" value="${k}"> ${k}</label>`).join('');
                }
            }
            updateRegUI(roleInput.value);
        } catch(e) { 
            console.error("Gagal menarik data awal", e); 
        }
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
        const groupKelasSiswa = document.getElementById("group-kelas-siswa");
        const groupMapelGuru = document.getElementById("group-mapel-guru");
        const groupKelasGuru = document.getElementById("group-kelas-guru");
        const groupRoleGuru = document.getElementById("group-role-guru"); // Tambahan
        const inputKelasSiswa = document.getElementById("reg-kelas-siswa");
        const inputUsername = document.getElementById("reg-username");

        if (role === 'guru') {
            regTitle.innerText = "REGISTRASI GURU";
            usernameLabel.innerText = "ID Guru";
            boxGuru.classList.add('active');
            boxSiswa.classList.remove('active');
            
            // Set input khusus Guru
            inputUsername.placeholder = "Contoh: E24H6-223";
            inputUsername.removeAttribute("inputmode");
            inputUsername.setAttribute("maxlength", "9");
            
            if(groupKelasSiswa) groupKelasSiswa.style.display = 'none';
            if(groupRoleGuru) groupRoleGuru.style.display = 'block'; // Munculkan Role Guru
            if(groupMapelGuru) groupMapelGuru.style.display = 'block';
            if(groupKelasGuru) groupKelasGuru.style.display = 'block';
            if(inputKelasSiswa) inputKelasSiswa.removeAttribute("required");
        } else {
            regTitle.innerText = "REGISTRASI SISWA";
            usernameLabel.innerText = "Nomor Peserta / NIS";
            boxSiswa.classList.add('active');
            boxGuru.classList.remove('active');
            
            // Set input khusus Siswa
            inputUsername.placeholder = "Masukkan NIS (10 Digit Angka)";
            inputUsername.setAttribute("inputmode", "numeric");
            inputUsername.setAttribute("maxlength", "10");

            if(groupKelasSiswa) groupKelasSiswa.style.display = 'block';
            if(groupRoleGuru) groupRoleGuru.style.display = 'none'; // Sembunyikan Role Guru
            if(groupMapelGuru) groupMapelGuru.style.display = 'none';
            if(groupKelasGuru) groupKelasGuru.style.display = 'none';
            if(inputKelasSiswa) inputKelasSiswa.setAttribute("required", "true");
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
        const username = document.getElementById("reg-username").value.replace(/\s+/g, '').toUpperCase();
        const password = document.getElementById("reg-password").value;

        if(password !== document.getElementById("reg-confirm-password").value) {
            return alert("Password tidak cocok!");
        }

        // --- VALIDASI FORMAT USERNAME ---
        if (role === 'siswa') {
            const isNumeric = /^\d+$/.test(username);
            if (!isNumeric) return alert("Pendaftaran Ditolak: NIS Siswa harus berupa angka!");
            if (username.length !== 10) return alert(`Pendaftaran Ditolak: NIS harus berjumlah 10 digit angka!`);
        } else if (role === 'guru') {
            const regexGuru = /^[A-Z]\d{2}[A-Z]\d-\d{3}$/;
            if (!regexGuru.test(username)) return alert("Pendaftaran Ditolak: Format ID Guru tidak sesuai!\nContoh: E24H6-223");
        }

        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = "<i class='fas fa-spinner fa-spin'></i> MEMPROSES...";
        btnSubmit.disabled = true;

        const dummyEmail = `${username}@cbt.smaich.id`;

        try {
            let payload = {
                nama: name,
                username: username,
                createdAt: serverTimestamp()
            };

            if (role === 'siswa') {
                payload.role = ['siswa'];
                payload.kelas = document.getElementById("reg-kelas-siswa").value;
            } else if (role === 'guru') {
                // MENGAMBIL ROLE TERPILIH (BARU)
                const roleTerpilih = Array.from(document.querySelectorAll('.reg-role-cb:checked')).map(cb => cb.value);
                if (!roleTerpilih.includes('guru')) roleTerpilih.push('guru'); // Pastikan 'guru' tetap ada
                payload.role = roleTerpilih;

                const mapelTerpilih = Array.from(document.querySelectorAll('.reg-mapel-cb:checked')).map(cb => cb.value);
                const kelasTerpilih = Array.from(document.querySelectorAll('.reg-kelas-cb:checked')).map(cb => cb.value);
                
                if (mapelTerpilih.length === 0 || kelasTerpilih.length === 0) {
                    btnSubmit.innerHTML = originalBtnText;
                    btnSubmit.disabled = false;
                    return alert("Pendaftaran ditolak: Silakan centang minimal 1 Mata Pelajaran dan 1 Kelas Ajar!");
                }
                
                payload.mapel = mapelTerpilih;
                payload.kelas = kelasTerpilih;
            }

            const userCred = await createUserWithEmailAndPassword(auth, dummyEmail, password);
            const user = userCred.user;
            await updateProfile(user, { displayName: name });

            await setDoc(doc(db, "users", user.uid), payload);

            alert(`Selamat! Akun ${role.toUpperCase()} berhasil dibuat.\n\nINFO KEAMANAN: Sangat disarankan bagi Anda untuk mengubah password ini nanti secara mandiri, agar hak akses pribadi tetap terjaga dan aman.`);
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
