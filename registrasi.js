import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. STATE & KONFIGURASI
// ==========================================
const regState = {
    role: 'siswa',
    isSiswaOpen: true,
    isGuruOpen: true
};

// ==========================================
// 2. SECURITY MANAGER (UI Dasar)
// ==========================================
const SecurityManager = {
    init: function() {
        document.addEventListener('contextmenu', e => e.preventDefault());
        ['copy', 'cut', 'paste', 'selectstart'].forEach(evt => {
            document.addEventListener(evt, e => { 
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); 
            });
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'F12' || e.key === 'PrintScreen' || 
               (e.ctrlKey && ['c', 'v', 'x', 'u', 'p', 's', 'a', 'f'].includes(e.key.toLowerCase())) || 
               (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 's'].includes(e.key.toLowerCase()))) { 
                e.preventDefault(); 
            }
        });
        window.addEventListener('blur', () => { document.body.style.filter = "blur(10px)"; });
        window.addEventListener('focus', () => { document.body.style.filter = "none"; });
    }
};

// ==========================================
// 3. UI & FORM MANAGER
// ==========================================
const UIManager = {
    updateRegStatusUI: function() {
        const btnSubmit = document.getElementById("btn-submit");
        const warningBox = document.getElementById("reg-warning");
        
        let isAllowed = (regState.role === 'siswa' && regState.isSiswaOpen) || 
                        (regState.role === 'guru' && regState.isGuruOpen);

        if (!isAllowed) {
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = '0.5';
            btnSubmit.innerHTML = '<i class="fas fa-lock"></i> PENDAFTARAN DITUTUP';
            warningBox.style.display = 'block';
            warningBox.innerHTML = `<i class="fas fa-lock"></i> Pendaftaran form <b>${regState.role.toUpperCase()}</b> saat ini ditutup oleh Admin.`;
        } else {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
            btnSubmit.innerHTML = 'DAFTAR SEKARANG';
            warningBox.style.display = 'none';
        }
    },

    setRoleMode: function(role) {
        regState.role = role;
        document.getElementById("reg-role").value = role;
        
        const boxSiswa = document.getElementById("select-siswa");
        const boxGuru = document.getElementById("select-guru");
        const inputUsername = document.getElementById("reg-username");
        const inputKelasSiswa = document.getElementById("reg-kelas-siswa");
        
        if (role === 'guru') {
            document.getElementById("reg-title").innerText = "REGISTRASI GURU";
            document.getElementById("username-label").innerText = "ID Guru";
            boxGuru.classList.add('active');
            boxSiswa.classList.remove('active');
            
            inputUsername.placeholder = "Contoh: E24H6-223";
            inputUsername.removeAttribute("inputmode");
            inputUsername.setAttribute("maxlength", "9");
            
            document.getElementById("group-kelas-siswa").style.display = 'none';
            document.getElementById("group-mapel-guru").style.display = 'block';
            document.getElementById("group-kelas-guru").style.display = 'block';
            if(inputKelasSiswa) inputKelasSiswa.removeAttribute("required");
        } else {
            document.getElementById("reg-title").innerText = "REGISTRASI SISWA";
            document.getElementById("username-label").innerText = "Nomor Peserta / NIS";
            boxSiswa.classList.add('active');
            boxGuru.classList.remove('active');
            
            inputUsername.placeholder = "Masukkan NIS (10 Digit Angka)";
            inputUsername.setAttribute("inputmode", "numeric");
            inputUsername.setAttribute("maxlength", "10");

            document.getElementById("group-kelas-siswa").style.display = 'block';
            document.getElementById("group-mapel-guru").style.display = 'none';
            document.getElementById("group-kelas-guru").style.display = 'none';
            if(inputKelasSiswa) inputKelasSiswa.setAttribute("required", "true");
        }
        this.updateRegStatusUI(); 
    },

    setLoadingState: function(isLoading) {
        const btnSubmit = document.getElementById("btn-submit");
        if(isLoading) {
            btnSubmit.dataset.originalText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = "<i class='fas fa-spinner fa-spin'></i> MEMPROSES...";
            btnSubmit.disabled = true;
        } else {
            btnSubmit.innerHTML = btnSubmit.dataset.originalText || "DAFTAR SEKARANG";
            btnSubmit.disabled = false;
        }
    }
};

// ==========================================
// 4. MAIN EXECUTION & FIREBASE LOGIC
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    SecurityManager.init();

    // Event Listener Ganti Role
    document.getElementById("select-siswa").addEventListener('click', () => UIManager.setRoleMode('siswa'));
    document.getElementById("select-guru").addEventListener('click', () => UIManager.setRoleMode('guru'));

    // Tarik Data Konfigurasi Master dari Firestore
    async function fetchInitialData() {
        try {
            // Ambil Status Izin Registrasi
            const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
            if(regSnap.exists()) {
                regState.isSiswaOpen = regSnap.data().siswa_aktif !== false; 
                regState.isGuruOpen = regSnap.data().guru_aktif !== false; 
            }

            // Ambil Data Master (Kelas & Mapel)
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
            UIManager.updateRegStatusUI();
        } catch(e) { 
            console.error("Gagal menarik data akademik awal:", e); 
        }
    }

    fetchInitialData();

    // Proses Submit Registrasi
    document.getElementById("register-form")?.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        
        // Proteksi Tambahan
        if (regState.role === 'siswa' && !regState.isSiswaOpen) return alert("Pendaftaran Siswa sedang ditutup oleh Admin!");
        if (regState.role === 'guru' && !regState.isGuruOpen) return alert("Pendaftaran Guru sedang ditutup oleh Admin!");
        
        const name = document.getElementById("reg-name").value.trim();
        const username = document.getElementById("reg-username").value.replace(/\s+/g, '').toUpperCase();
        const password = document.getElementById("reg-password").value;
        const confirmPassword = document.getElementById("reg-confirm-password").value;

        // Validasi Dasar
        if(password !== confirmPassword) return alert("Validasi Gagal: Konfirmasi Password tidak cocok!");
        if(password.length < 6) return alert("Validasi Gagal: Password minimal 6 karakter!");

        // Validasi Format Username (ID)
        if (regState.role === 'siswa') {
            const isNumeric = /^\d+$/.test(username);
            if (!isNumeric || username.length !== 10) return alert("Pendaftaran Ditolak: NIS harus berupa 10 digit angka tanpa spasi!");
        } else if (regState.role === 'guru') {
            const regexGuru = /^[A-Z]\d{2}[A-Z]\d-\d{3}$/; // Contoh Format: E24H6-223
            if (!regexGuru.test(username)) return alert("Pendaftaran Ditolak: Format ID Guru tidak sesuai standar!\n(Contoh valid: E24H6-223)");
        }

        // Siapkan Payload Data
        let payload = {
            nama: name,
            username: username,
            createdAt: serverTimestamp()
        };

        if (regState.role === 'siswa') {
            payload.role = ['siswa'];
            payload.kelas = document.getElementById("reg-kelas-siswa").value;
            if(!payload.kelas) return alert("Silakan pilih kelas terlebih dahulu!");
            
        } else if (regState.role === 'guru') {
            payload.role = ['guru'];
            const mapelTerpilih = Array.from(document.querySelectorAll('.reg-mapel-cb:checked')).map(cb => cb.value);
            const kelasTerpilih = Array.from(document.querySelectorAll('.reg-kelas-cb:checked')).map(cb => cb.value);
            
            if (mapelTerpilih.length === 0 || kelasTerpilih.length === 0) {
                return alert("Pendaftaran Ditolak: Silakan centang minimal 1 Mata Pelajaran dan 1 Kelas Ajar!");
            }
            payload.mapel = mapelTerpilih;
            payload.kelas = kelasTerpilih;
        }

        // Eksekusi Pembuatan Akun
        UIManager.setLoadingState(true);
        const dummyEmail = `${username.toLowerCase()}@cbt.smaich.id`;

        try {
            // 1. Buat user di Firebase Auth
            const userCred = await createUserWithEmailAndPassword(auth, dummyEmail, password);
            const user = userCred.user;
            
            // 2. Update Profil Auth bawaan (untuk keperluan quick-display)
            await updateProfile(user, { displayName: name });

            // 3. Simpan relasi/data lengkap ke Firestore
            await setDoc(doc(db, "users", user.uid), payload);

            alert(`Sukses! Akun ${regState.role.toUpperCase()} atas nama ${name} berhasil dibuat.\n\nINFO: Simpan kredensial Anda baik-baik, sistem akan mengalihkan ke halaman Login.`);
            window.location.replace("index.html"); // Replace mencegah user back ke form ini

        } catch (error) {
            console.error("Registrasi Error:", error);
            let msg = "Terjadi kesalahan sistem saat registrasi.";
            if (error.code === 'auth/email-already-in-use') msg = "Pendaftaran Gagal: ID/Username tersebut sudah terdaftar di sistem!";
            if (error.code === 'auth/network-request-failed') msg = "Pendaftaran Gagal: Periksa koneksi internet Anda.";
            
            alert(msg);
            UIManager.setLoadingState(false);
        }
    });
});
