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
// 2. MODAL & UTILITIES
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

window.customConfirm = (msg, title = 'Konfirmasi') => {
    return new Promise(res => {
        const modal = document.getElementById('modal-custom-confirm');
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = msg;
        modal.style.display = 'flex';
        document.getElementById('btn-confirm-ok').onclick = () => { modal.style.display = 'none'; res(true); };
        document.getElementById('btn-confirm-cancel').onclick = () => { modal.style.display = 'none'; res(false); };
    });
};

// ==========================================
// 3. WATERMARK MANAGER (DINAMIS & BERGERAK)
// ==========================================
const WatermarkManager = {
    overlayId: 'cbt-secure-watermark',

    init: function(nama, nis) {
        this.createOverlay(nama, nis);
        this.enforceOverlay(nama, nis);
    },

    createOverlay: function(nama, nis) {
        if (document.getElementById(this.overlayId)) return;

        const watermarkDiv = document.createElement('div');
        watermarkDiv.id = this.overlayId;
        
        watermarkDiv.style.position = 'fixed';
        watermarkDiv.style.top = '0';
        watermarkDiv.style.left = '0';
        watermarkDiv.style.width = '200vw'; 
        watermarkDiv.style.height = '200vh';
        watermarkDiv.style.pointerEvents = 'none'; 
        watermarkDiv.style.zIndex = '99999';
        watermarkDiv.style.opacity = '0.15'; 

        const canvas = document.createElement('canvas');
        canvas.width = 300; 
        canvas.height = 180; 
        const ctx = canvas.getContext('2d');

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 5); 
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(`${nama}`, 0, -25);
        ctx.fillText(`NIS: ${nis}`, 0, 0);
        ctx.fillText(`CBT SMAICH`, 0, 25);

        watermarkDiv.style.backgroundImage = `url(${canvas.toDataURL('image/png')})`;
        watermarkDiv.style.backgroundRepeat = 'repeat';
        
        let pos = 0;
        setInterval(() => {
            pos -= 1;
            watermarkDiv.style.backgroundPosition = `${pos}px ${pos}px`;
        }, 50);

        document.body.appendChild(watermarkDiv);
    },

    enforceOverlay: function(nama, nis) {
        const observer = new MutationObserver((mutations) => {
            if (!document.getElementById(this.overlayId)) {
                this.createOverlay(nama, nis);
                SecurityManager.handleViolation("Terdeteksi percobaan menghapus sistem keamanan layar!");
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
};

// ==========================================
// 4. SECURITY MANAGER (ANTI-CHEAT ADVANCED)
// ==========================================
const SecurityManager = {
    initGlobal: function() {
        // Blokir Klik Kanan
        document.addEventListener('contextmenu', e => e.preventDefault());
        
        // Memburamkan Layar saat Jendela Kehilangan Fokus (Buka aplikasi lain, Snipping Tool, dll)
        window.addEventListener('blur', () => { 
            if(examState && examState.isExamActive) {
                document.body.style.filter = "blur(20px)"; 
            }
        });
        
        window.addEventListener('focus', () => { 
            if(examState && examState.isExamActive) {
                document.body.style.filter = "none"; 
                this.openFullscreen(); // Paksa fullscreen lagi jika mereka baru pindah tab
            }
        });

        // Anti PrintScreen dan Keyboard OS
        document.addEventListener('keydown', e => {
            const forbiddenKeys = ['F12', 'PrintScreen', 'Meta', 'OS', 'ContextMenu'];
            if (forbiddenKeys.includes(e.key) || 
               (e.ctrlKey && ['c', 'v', 'x', 'u', 'p', 's', 'a', 'f'].includes(e.key.toLowerCase())) || 
               (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 's'].includes(e.key.toLowerCase())) ||
               (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') // Mac OS Screenshot
               ) { 
                
                e.preventDefault(); 
                
                if (e.key === 'PrintScreen' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's')) {
                    navigator.clipboard.writeText("Tindakan Ilegal CBT SMAICH").catch(()=>{});
                    if(examState.isExamActive) this.handleViolation("Percobaan Screenshot/PrintScreen Terdeteksi!");
                }
            }
        });

        document.addEventListener('keyup', e => {
            if (e.key === 'PrintScreen') {
                navigator.clipboard.writeText("Tindakan Ilegal CBT SMAICH").catch(()=>{});
                if(examState.isExamActive) this.handleViolation("Tombol PrintScreen Ditekan!");
            }
        });

        history.pushState(null, null, window.location.href);
        window.addEventListener('popstate', () => { 
            history.pushState(null, null, window.location.href); 
            if(examState.isExamActive) this.openFullscreen(); 
        });

        window.addEventListener('beforeunload', (e) => { 
            if(examState.isExamActive) { e.preventDefault(); e.returnValue = ""; return ""; }
        });

        this.startDevToolsTrap();
    },

    startDevToolsTrap: function() {
        setInterval(() => {
            const start = performance.now();
            debugger; 
            if (performance.now() - start > 100) {
                if(examState.isExamActive) {
                    this.handleViolation("Terdeteksi membuka Inspect Element / Developer Tools!");
                }
            }
        }, 1500);
    },

    startStrictExamMode: function() {
        this.openFullscreen();
        
        document.addEventListener('visibilitychange', () => { 
            if (document.visibilityState === 'hidden' && examState.isExamActive) {
                document.body.style.filter = "blur(20px)";
                this.handleViolation("Terdeteksi pindah tab atau layar diminimize!"); 
            }
        });
    },

    handleViolation: async function(alasan = "Aktivitas mencurigakan terdeteksi") {
        if (!examState.isExamActive) return;

        examState.pelanggaran++;
        const violationEl = document.getElementById('violation-count');
        if (violationEl) violationEl.innerText = examState.pelanggaran;
        
        this.openFullscreen();

        if (examState.pelanggaran >= examState.maxPelanggaran) {
            await window.customAlert(`Anda telah melakukan ${examState.maxPelanggaran} kali pelanggaran.\nAlasan Terakhir: ${alasan}\n\nUjian Anda DIHENTIKAN SECARA OTOMATIS!`, 'PELANGGARAN MAKSIMAL (SANKSI)');
            
            // Otomatis Submit Nilai Jika Pelanggaran Maksimal
            if (typeof selesaiUjian === "function") selesaiUjian(true, true); 
        } else {
            window.customAlert(`${alasan}\n\nPeringatan Ke-${examState.pelanggaran}! Pada peringatan ke-${examState.maxPelanggaran}, ujian akan dihentikan dan nilai dianggap 0.`, 'PERINGATAN KEAMANAN');
        }
    },

    openFullscreen: function() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) { elem.requestFullscreen().catch(()=>{}); } 
        else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
        else if (elem.msRequestFullscreen) { elem.msRequestFullscreen(); }
    },

    closeFullscreen: function() {
        if (document.exitFullscreen) { document.exitFullscreen().catch(()=>{}); } 
        else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); } 
        else if (document.msExitFullscreen) { document.msExitFullscreen(); }
    }
};

window.openFullscreen = SecurityManager.openFullscreen.bind(SecurityManager);

// ==========================================
// 5. INISIALISASI DATA SISWA & AUTH
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    SecurityManager.initGlobal(); // <--- INISIALISASI KEAMANAN DIPANGGIL DI SINI

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.replace("index.html"); return; }
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                examState.student = { uid: user.uid, ...userDoc.data() };
                document.getElementById('welcome-student').innerText = `Assalamu'alaikum ${examState.student.nama}...`;
                document.getElementById('student-class').value = examState.student.kelas || examState.student.kelas_siswa || "-";
                document.getElementById('exam-student-name').innerText = `${examState.student.nama} (${examState.student.username})`;
                WatermarkManager.init(examState.student.nama, examState.student.username);
                await loadMapelOptions();
            } else { await window.customAlert("Data siswa tidak ditemukan."); auth.signOut(); window.location.replace("index.html"); }
        } catch(e) { console.error("Gagal memuat profil:", e); }
    });
});

async function loadMapelOptions() {
    try {
        const snap = await getDoc(doc(db, "pengaturan", "data_akademik"));
        const select = document.getElementById('select-mapel');
        if (snap.exists() && snap.data().list_mapel) { select.innerHTML = '<option value="">-- Pilih Mapel --</option>' + snap.data().list_mapel.map(m => `<option value="${m}">${m}</option>`).join(''); }
    } catch(e) {}
}

// ==========================================
// 6. LOGIKA MULAI UJIAN & VERIFIKASI TOKEN
// ==========================================
document.getElementById('btn-verifikasi').onclick = async () => {
    examState.mapelTerpilih = document.getElementById('select-mapel').value;
    const tokenInput = document.getElementById('input-token').value.toUpperCase().trim();
    const kelasSiswa = document.getElementById('student-class').value;

    if(!examState.mapelTerpilih || !tokenInput) return window.customAlert("Pilih mapel dan masukkan token!", "Peringatan");

    // [PENTING] Eksekusi Fullscreen harus dipanggil SECARA LANGSUNG saat di-klik tombol mulai ujian
    SecurityManager.openFullscreen();

    const btn = document.getElementById('btn-verifikasi'); 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...'; 
    btn.disabled = true;

    try {
        const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        const tokenKey = `token_${examState.mapelTerpilih}_${kelasSiswa}`;
        
        if (!tokenSnap.exists() || !tokenSnap.data()[tokenKey]) {
            throw new Error("Token tidak valid atau belum diatur oleh Admin.");
        }

        const tokenData = tokenSnap.data()[tokenKey];
        const tokenCode = typeof tokenData === 'object' ? tokenData.code : tokenData;
        const isActive = typeof tokenData === 'object' ? (tokenData.active !== false) : true;

        if (tokenInput !== tokenCode) throw new Error("Kode Token Salah!");
        if (!isActive) throw new Error("Token sudah dinonaktifkan oleh Admin!");

        const qHasil = query(collection(db, "hasil_ujian"), where("uid", "==", examState.student.uid), where("mataPelajaran", "==", examState.mapelTerpilih));
        const cekHasil = await getDocs(qHasil);
        if(!cekHasil.empty) throw new Error("Anda sudah menyelesaikan ujian mapel ini.");

        const qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", examState.mapelTerpilih), where("kelas", "==", kelasSiswa));
        const soalSnap = await getDocs(qSoal);
        if (soalSnap.empty) throw new Error("Belum ada soal untuk mata pelajaran ini.");

        examState.arraySoal = [];
        soalSnap.forEach(d => examState.arraySoal.push({id: d.id, ...d.data()}));
        examState.arraySoal.sort((a, b) => (a.nomor_soal || 0) - (b.nomor_soal || 0));

        let durasiMenit = 90; 
        const timeSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
        if (timeSnap.exists() && timeSnap.data()[`${examState.mapelTerpilih}_${kelasSiswa}`]) { 
            durasiMenit = timeSnap.data()[`${examState.mapelTerpilih}_${kelasSiswa}`]; 
        }
        examState.durasiDetik = durasiMenit * 60;

        SecurityManager.startStrictExamMode();
        examState.isExamActive = true;
        document.getElementById('pre-exam-screen').style.display = 'none';
        document.getElementById('exam-workspace').style.display = 'flex';
        document.getElementById('exam-mapel-title').innerText = `UJIAN: ${examState.mapelTerpilih.toUpperCase()}`;

        // Memanggil fungsi original milik Anda untuk merender Soal & Navigasi
        renderNavigasi(); 
        tampilkanSoal(0); 
        jalankanTimer();

    } catch(e) { 
        SecurityManager.closeFullscreen(); 
        window.customAlert(e.message || "Terjadi kesalahan sistem.", "Gagal Akses"); 
    } finally { 
        btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; 
        btn.disabled = false; 
    }
};

// =========================================================================
// PASTIKAN ANDA TIDAK MENGHAPUS KODE BAWAAN ANDA DI BAWAH INI:
// - function renderMedia(mediaObj) { ... }
// - function tampilkanSoal(idx) { ... }
// - function renderNavigasi() { ... }
// - function jalankanTimer() { ... }
// - function selesaiUjian() { ... }
// - Serta logika drawer navigasi (mobile) di paling bawah.
// =========================================================================
