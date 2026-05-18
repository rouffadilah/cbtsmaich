import { auth, db } from './firebase-config.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. STATE MANAGEMENT (STATUS UJIAN)
// ==========================================
const examState = {
    student: null, mapelTerpilih: "", arraySoal: [], currentIndex: 0,
    jawabanSiswa: {}, raguRagu: {}, timerInterval: null, durasiDetik: 0,
    pelanggaran: 0, maxPelanggaran: 3, isExamActive: false
};

// ==========================================
// 2. MODAL CUSTOM & ALERT
// ==========================================
window.customAlert = (msg, title = 'Informasi') => {
    return new Promise(res => {
        const modal = document.getElementById('modal-custom-alert');
        document.getElementById('alert-title').innerText = title;
        document.getElementById('alert-message').innerText = msg;
        modal.style.display = 'flex';
        document.getElementById('btn-alert-ok').onclick = () => { modal.style.display = 'none'; res(); };
    });
};

// ==========================================
// 3. SECURITY MANAGER (ANTI-SCREENSHOT & FULLSCREEN)
// ==========================================
const SecurityManager = {
    initGlobal: function() {
        // Blokir Klik Kanan & Drag Text
        document.addEventListener('contextmenu', e => e.preventDefault());
        ['copy', 'cut', 'paste', 'selectstart', 'dragstart'].forEach(evt => 
            document.addEventListener(evt, e => { 
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); } 
            })
        );

        // Blokir Keyboard Anti PrintScreen, Snipping Tool, Save, Print
        document.addEventListener('keydown', e => {
            const forbiddenKeys = ['F12', 'PrintScreen', 'Meta', 'OS', 'ContextMenu'];
            if (forbiddenKeys.includes(e.key) || 
               (e.ctrlKey && ['c', 'v', 'x', 'u', 'p', 's', 'a', 'f'].includes(e.key.toLowerCase())) || 
               (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 's'].includes(e.key.toLowerCase()))) { 
                e.preventDefault(); 
                
                // Deteksi khusus jika mencoba menekan PrintScreen atau Win+Shift+S
                if (e.key === 'PrintScreen' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') || (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's')) {
                    navigator.clipboard.writeText("Tindakan Ilegal CBT SMAICH").catch(()=>{}); // Kosongkan clipboard
                    if(examState.isExamActive) this.handleViolation("Percobaan Screenshot/PrintScreen Terdeteksi!");
                }
            }
        });

        // Kosongkan clipboard lagi saat tombol PrintScreen dilepas
        document.addEventListener('keyup', e => {
            if (e.key === 'PrintScreen') {
                navigator.clipboard.writeText("Tindakan Ilegal CBT SMAICH").catch(()=>{});
                if(examState.isExamActive) this.handleViolation("Tombol PrintScreen Ditekan!");
            }
        });

        // Jebakan Tombol Back Browser
        history.pushState(null, null, window.location.href);
        window.addEventListener('popstate', () => { 
            history.pushState(null, null, window.location.href); 
            if(examState.isExamActive) this.openFullscreen(); 
        });

        window.addEventListener('beforeunload', (e) => { 
            if(examState.isExamActive) { e.preventDefault(); e.returnValue = ""; return ""; }
        });
    },

    startStrictExamMode: function() {
        this.openFullscreen(); // Paksa Masuk Fullscreen
        
        // Anti AI/Buka Tab Baru (Blur Layar)
        window.addEventListener('blur', () => {
            if(examState.isExamActive) {
                document.body.style.filter = "blur(20px)";
                this.handleViolation("Fokus layar hilang! (Terdeteksi membuka aplikasi lain / Tab Baru)");
            }
        });
        
        document.addEventListener('visibilitychange', () => { 
            if (document.visibilityState === 'hidden' && examState.isExamActive) {
                document.body.style.filter = "blur(20px)";
                this.handleViolation("Terdeteksi pindah tab atau layar diminimize!"); 
            }
        });
        
        window.addEventListener('focus', () => { 
            if(examState.isExamActive) {
                document.body.style.filter = "none";
                this.openFullscreen(); // Memaksa fullscreen lagi jika mereka berhasil keluar
            }
        });

        // Deteksi jika user menekan ESC untuk keluar dari layar penuh
        document.addEventListener("fullscreenchange", () => {
            if (!document.fullscreenElement && examState.isExamActive) {
                this.handleViolation("Anda keluar dari Mode Layar Penuh!");
            }
        });
    },

    handleViolation: async function(alasan = "Aktivitas mencurigakan terdeteksi") {
        if (!examState.isExamActive) return;

        examState.pelanggaran++;
        const violationEl = document.getElementById('violation-count');
        if (violationEl) violationEl.innerText = examState.pelanggaran;
        
        this.openFullscreen(); // Paksa kembali fullscreen saat popup muncul

        if (examState.pelanggaran >= examState.maxPelanggaran) {
            await window.customAlert(`Anda telah melakukan ${examState.maxPelanggaran} kali pelanggaran.\nAlasan Terakhir: ${alasan}\n\nUjian Anda DIHENTIKAN SECARA OTOMATIS!`, 'DISKUALIFIKASI');
            // Eksekusi Submit otomatis di sini
            console.log("Submit paksa karena pelanggaran");
        } else {
            window.customAlert(`${alasan}\n\nPeringatan Ke-${examState.pelanggaran}! Pada peringatan ke-${examState.maxPelanggaran}, ujian akan dihentikan otomatis.`, 'PERINGATAN KEAMANAN');
        }
    },

    openFullscreen: function() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) { elem.requestFullscreen().catch(()=>{}); } 
        else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
        else if (elem.msRequestFullscreen) { elem.msRequestFullscreen(); }
    }
};

// ==========================================
// 4. INISIALISASI DATA SISWA & AUTH
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    SecurityManager.initGlobal(); 
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.replace("index.html"); return; }
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                examState.student = { uid: user.uid, ...userDoc.data() };
                document.getElementById('welcome-student').innerText = `Assalamu'alaikum ${examState.student.nama}...`;
                document.getElementById('student-class').value = examState.student.kelas || examState.student.kelas_siswa || "-";
                document.getElementById('exam-student-name').innerText = `${examState.student.nama} (${examState.student.username})`;
                await loadMapelOptions();
            }
        } catch(e) { console.error("Gagal memuat profil:", e); }
    });
});

async function loadMapelOptions() {
    try {
        const snap = await getDoc(doc(db, "pengaturan", "data_akademik"));
        const select = document.getElementById('select-mapel');
        if (snap.exists() && snap.data().list_mapel) { 
            select.innerHTML = '<option value="">-- Pilih Mapel --</option>' + snap.data().list_mapel.map(m => `<option value="${m}">${m}</option>`).join(''); 
        }
    } catch(e) {}
}

// ==========================================
// 5. MULAI UJIAN & FULLSCREEN OTOMATIS
// ==========================================
document.getElementById('btn-verifikasi').onclick = async () => {
    examState.mapelTerpilih = document.getElementById('select-mapel').value;
    const tokenInput = document.getElementById('input-token').value.toUpperCase().trim();

    if(!examState.mapelTerpilih || !tokenInput) return window.customAlert("Pilih mapel dan masukkan token!", "Peringatan");

    // FULLSCREEN DI-TRIGGER LANGSUNG OLEH KLIK USER (Wajib di awal event klik)
    SecurityManager.openFullscreen();

    const btn = document.getElementById('btn-verifikasi'); 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...'; 
    btn.disabled = true;

    try {
        // ... (Logika Validasi Token dan Tarik Data Soal dari Firebase) ...
        // Simulasi jika berhasil lolos:
        setTimeout(() => {
            SecurityManager.startStrictExamMode(); // Aktifkan pengawasan ketat saat ujian mulai
            examState.isExamActive = true;
            document.getElementById('pre-exam-screen').style.display = 'none';
            document.getElementById('exam-workspace').style.display = 'flex';
            document.getElementById('exam-mapel-title').innerText = `UJIAN: ${examState.mapelTerpilih.toUpperCase()}`;
            
            // Lanjutkan dengan memanggil fungsi tampilkanSoal(0) dan timer di sini
            console.log("Ujian dimulai dengan aman.");
        }, 1000);

    } catch(e) { 
        window.customAlert(e.message || "Terjadi kesalahan sistem.", "Gagal Akses"); 
    } finally { 
        btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; 
        btn.disabled = false; 
    }
};
