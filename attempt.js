import { auth, db } from './firebase-config.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. STATE MANAGEMENT (STATUS UJIAN)
// ==========================================
const examState = {
    student: null,
    mapelTerpilih: "",
    arraySoal: [],
    currentIndex: 0,
    jawabanSiswa: {},
    raguRagu: {},
    timerInterval: null,
    durasiDetik: 0,
    pelanggaran: 0,
    maxPelanggaran: 3,
    isExamActive: false
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
// 3. INISIALISASI DATA SISWA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    SecurityManager.initGlobal(); // Jalankan proteksi dasar

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
            } else {
                await window.customAlert("Data siswa tidak ditemukan.");
                auth.signOut(); 
                window.location.replace("index.html");
            }
        } catch(e) { 
            console.error("Gagal memuat profil:", e); 
        }
    });
});

async function loadMapelOptions() {
    try {
        const snap = await getDoc(doc(db, "pengaturan", "data_akademik"));
        const select = document.getElementById('select-mapel');
        if (snap.exists() && snap.data().list_mapel) {
            select.innerHTML = '<option value="">-- Pilih Mapel --</option>' + 
                snap.data().list_mapel.map(m => `<option value="${m}">${m}</option>`).join('');
        }
    } catch(e) {
        console.error("Gagal memuat mapel:", e);
    }
}

// ==========================================
// 4. LOGIKA MULAI UJIAN & VERIFIKASI TOKEN
// ==========================================
document.getElementById('btn-verifikasi').onclick = async () => {
    examState.mapelTerpilih = document.getElementById('select-mapel').value;
    const tokenInput = document.getElementById('input-token').value.toUpperCase().trim();
    const kelasSiswa = document.getElementById('student-class').value;

    if(!examState.mapelTerpilih || !tokenInput) return window.customAlert("Pilih mapel dan masukkan token!", "Peringatan");

    const btn = document.getElementById('btn-verifikasi');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...'; 
    btn.disabled = true;

    try {
        // Cek Token
        const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        const tokenKey = `token_${examState.mapelTerpilih}_${kelasSiswa}`;
        
        if (!tokenSnap.exists() || !tokenSnap.data()[tokenKey]) {
            throw new Error("Token tidak valid atau belum diaktifkan oleh Admin.");
        }

        const tokenData = tokenSnap.data()[tokenKey];
        const tokenCode = typeof tokenData === 'object' ? tokenData.code : tokenData;
        const expiresAt = typeof tokenData === 'object' ? tokenData.expiresAt : Infinity;

        if (tokenInput !== tokenCode) throw new Error("Kode Token Salah!");
        if (Date.now() > expiresAt) throw new Error("Waktu Token sudah habis! Silakan minta token baru ke Pengawas.");

        // Cek Riwayat Pengerjaan
        const qHasil = query(collection(db, "hasil_ujian"), where("uid", "==", examState.student.uid), where("mataPelajaran", "==", examState.mapelTerpilih));
        const cekHasil = await getDocs(qHasil);
        if(!cekHasil.empty) throw new Error("Anda sudah menyelesaikan ujian mapel ini.");

        // Ambil Soal
        const qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", examState.mapelTerpilih), where("kelas", "==", kelasSiswa));
        const soalSnap = await getDocs(qSoal);
        
        if (soalSnap.empty) throw new Error("Belum ada soal untuk mata pelajaran ini.");

        examState.arraySoal = [];
        soalSnap.forEach(d => examState.arraySoal.push({id: d.id, ...d.data()}));
        examState.arraySoal.sort((a, b) => a.nomor_soal - b.nomor_soal);

        // Atur Waktu
        let durasiMenit = 90; 
        const timeSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
        if (timeSnap.exists() && timeSnap.data()[`${examState.mapelTerpilih}_${kelasSiswa}`]) {
            durasiMenit = timeSnap.data()[`${examState.mapelTerpilih}_${kelasSiswa}`];
        }
        examState.durasiDetik = durasiMenit * 60;
        
        // Transisi ke Area Ujian
        SecurityManager.startStrictExamMode();
        examState.isExamActive = true;
        
        document.getElementById('pre-exam-screen').style.display = 'none';
        document.getElementById('exam-workspace').style.display = 'flex';
        document.getElementById('exam-mapel-title').innerText = `UJIAN: ${examState.mapelTerpilih.toUpperCase()}`;
        
        renderNavigasi();
        tampilkanSoal(0);
        jalankanTimer();

    } catch(e) {
        window.customAlert(e.message || "Terjadi kesalahan sistem.", "Gagal Akses");
    } finally {
        btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; 
        btn.disabled = false;
    }
};

// ==========================================
// 5. RENDER UI UJIAN
// ==========================================
function renderMedia(mediaObj) {
    if (!mediaObj) return '';
    if (mediaObj.type === 'image') return `<img src="${mediaObj.url}" style="max-width:100%; max-height:250px; border-radius:8px; margin-top:10px; display:block;" ondragstart="return false;">`;
    if (mediaObj.type === 'audio') return `<audio controls src="${mediaObj.url}" style="width:100%; margin-top:10px;"></audio>`;
    return '';
}

function tampilkanSoal(idx) {
    examState.currentIndex = idx;
    const soal = examState.arraySoal[idx];
    
    document.getElementById('current-q-num').innerText = idx + 1;
    document.getElementById('badge-tipe-soal').innerText = soal.tipe || 'PG';
    document.getElementById('cb-ragu').checked = examState.raguRagu[idx] || false;

    let html = `<div style="margin-bottom: 20px;">${soal.teks_soal}</div>`;
    html += renderMedia(soal.media_soal);
    
    if (soal.tipe === 'PG' || !soal.tipe) {
        html += `<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">`;
        ['A','B','C','D','E'].forEach(opt => {
            if (soal.opsi && soal.opsi[opt]) {
                let isChecked = examState.jawabanSiswa[soal.id] === opt;
                let bgClass = isChecked ? 'selected' : '';
                html += `
                    <label class="option-label ${bgClass}" onclick="window.pilihJawabanPG('${soal.id}', '${opt}')">
                        <input type="radio" name="opsi" value="${opt}" ${isChecked ? 'checked' : ''} style="margin-right: 15px; transform: scale(1.2);">
                        <span style="font-weight: bold; margin-right: 10px;">${opt}.</span>
                        <div style="flex: 1;">${renderMedia(soal.opsi_media?.[opt])} ${soal.opsi[opt]}</div>
                    </label>`;
            }
        });
        html += `</div>`;
    } 
    else if (soal.tipe === 'Uraian' || soal.tipe === 'Essay' || soal.tipe === 'Isian') {
        let teksJawaban = examState.jawabanSiswa[soal.id] || "";
        html += `
            <div style="margin-top: 25px;">
                <label style="font-weight: 700; color: var(--secondary); display: block; margin-bottom: 10px;"><i class="fas fa-keyboard"></i> Ketik Jawaban Anda:</label>
                <textarea rows="${soal.tipe === 'Isian' ? '2' : '8'}" 
                    style="width: 100%; padding: 15px; font-size: 1.1rem; border: 2px solid #cbd5e1; border-radius: 8px; font-family: inherit; resize: vertical;" 
                    placeholder="Tuliskan jawaban Anda di sini..."
                    oninput="window.simpanJawabanTeks('${soal.id}', this.value)"
                    onpaste="return false;"
                >${teksJawaban}</textarea>
            </div>`;
    }

    document.getElementById('question-content').innerHTML = html;
    
    // Atur tombol navigasi Bawah
    document.getElementById('btn-prev').style.visibility = idx === 0 ? 'hidden' : 'visible';
    const btnNext = document.getElementById('btn-next');
    if (idx === examState.arraySoal.length - 1) {
        btnNext.innerHTML = `<i class="fas fa-check"></i>`;
        btnNext.style.background = 'var(--danger)';
    } else {
        btnNext.innerHTML = `<i class="fas fa-chevron-right"></i>`;
        btnNext.style.background = 'var(--primary)';
    }
    
    updateWarnaGrid();
}

window.pilihJawabanPG = (soalId, opsi) => { 
    examState.jawabanSiswa[soalId] = opsi; 
    tampilkanSoal(examState.currentIndex); 
};
window.simpanJawabanTeks = (soalId, teks) => { 
    examState.jawabanSiswa[soalId] = teks; 
    updateWarnaGrid(); 
};
document.getElementById('cb-ragu').onchange = (e) => { 
    examState.raguRagu[examState.currentIndex] = e.target.checked; 
    updateWarnaGrid(); 
};

document.getElementById('btn-prev').onclick = () => { if(examState.currentIndex > 0) tampilkanSoal(examState.currentIndex - 1); };
document.getElementById('btn-next').onclick = () => { if(examState.currentIndex < examState.arraySoal.length - 1) tampilkanSoal(examState.currentIndex + 1); else selesaiUjian(); };

function renderNavigasi() {
    const grid = document.getElementById('nav-grid'); 
    grid.innerHTML = '';
    examState.arraySoal.forEach((s, i) => {
        let box = document.createElement('div');
        box.className = `q-box`; box.id = `nav-box-${i}`;
        box.innerText = i + 1;
        box.onclick = () => tampilkanSoal(i);
        grid.appendChild(box);
    });
}

function updateWarnaGrid() {
    examState.arraySoal.forEach((s, i) => {
        let box = document.getElementById(`nav-box-${i}`);
        box.className = 'q-box'; 
        if (examState.jawabanSiswa[s.id] && examState.jawabanSiswa[s.id].trim() !== '') box.classList.add('answered');
        if (examState.raguRagu[i]) box.classList.add('doubt');
        if (i === examState.currentIndex) box.classList.add('active');
    });
}

// ==========================================
// 6. TIMER & PENGUMPULAN (SUBMIT)
// ==========================================
function jalankanTimer() {
    examState.timerInterval = setInterval(() => {
        examState.durasiDetik--;
        let h = Math.floor(examState.durasiDetik / 3600);
        let m = Math.floor((examState.durasiDetik % 3600) / 60);
        let s = examState.durasiDetik % 60;
        
        document.getElementById('exam-timer').innerText = 
            `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            
        if(examState.durasiDetik <= 300) { 
            document.getElementById('exam-timer').parentElement.style.background = '#fef2f2'; 
            document.getElementById('exam-timer').style.color = 'red'; 
        }
        if(examState.durasiDetik <= 0) { 
            clearInterval(examState.timerInterval); 
            selesaiUjian(true); 
        }
    }, 1000);
}

document.getElementById('btn-finish').onclick = () => selesaiUjian();

async function selesaiUjian(isTimeOut = false, isPelanggaran = false) {
    if(!isTimeOut && !isPelanggaran) {
        let terjawab = Object.keys(examState.jawabanSiswa).filter(k => examState.jawabanSiswa[k].trim() !== '').length;
        if(terjawab < examState.arraySoal.length) {
            let sisa = examState.arraySoal.length - terjawab;
            let conf = await window.customConfirm(`Masih ada ${sisa} soal yang BELUM TERJAWAB. Yakin ingin mengumpulkan ujian sekarang?`, 'Peringatan Kosong');
            if(!conf) return;
        } else {
            let conf = await window.customConfirm("Apakah Anda yakin telah selesai dan ingin mengumpulkan jawaban?", 'Konfirmasi Selesai');
            if(!conf) return;
        }
    } else if (isTimeOut && !isPelanggaran) { 
        await window.customAlert("Waktu ujian telah habis! Jawaban Anda akan dikumpulkan secara otomatis.", "Waktu Habis"); 
    }

    clearInterval(examState.timerInterval);
    examState.isExamActive = false;

    document.getElementById('exam-workspace').innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column; background:#f8fafc;"><i class="fas fa-spinner fa-spin fa-3x" style="color:var(--primary); margin-bottom:20px;"></i><h2>Menyimpan Jawaban...</h2></div>`;

    let skorBenar = 0;
    examState.arraySoal.forEach(q => {
        if(q.tipe === 'PG' && q.kunci_jawaban && examState.jawabanSiswa[q.id] === q.kunci_jawaban) {
            skorBenar++;
        }
    });
    
    let totalSoal = examState.arraySoal.length;
    let nilaiAkhir = totalSoal > 0 ? Math.round((skorBenar / totalSoal) * 100) : 0;

    let payload = {
        uid: examState.student.uid,
        namaSiswa: examState.student.nama,
        kelas: document.getElementById('student-class').value,
        mataPelajaran: examState.mapelTerpilih,
        jawabanSiswa: examState.jawabanSiswa,
        benar: skorBenar,
        totalSoal: totalSoal,
        nilai: nilaiAkhir,
        pelanggaran: examState.pelanggaran,
        waktuKumpul: new Date()
    };

    try {
        await addDoc(collection(db, "hasil_ujian"), payload);
        SecurityManager.closeFullscreen();
        await window.customAlert(`Ujian Selesai!\nJawaban Anda telah berhasil disimpan di server.`, 'Berhasil');
        window.location.replace("index.html");
    } catch(e) {
        await window.customAlert("Gagal menyimpan ke server. Pastikan koneksi internet stabil dan lapor pengawas!", 'Error Jaringan');
        // Fallback: bisa menyimpan ke LocalStorage di sini jika offline
    }
}

// ==========================================
// 7. SECURITY MANAGER (ANTI-CHEAT)
// ==========================================
const SecurityManager = {
    initGlobal: function() {
        // Pencegahan aksi standar form/browser yang tidak berkaitan dengan form isi ujian
        document.addEventListener('contextmenu', e => e.preventDefault());
        ['copy', 'cut', 'paste', 'selectstart'].forEach(evt => 
            document.addEventListener(evt, e => { 
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); } 
            })
        );
        document.addEventListener('keydown', e => {
            if (e.key === 'F12' || e.key === 'PrintScreen' || 
               (e.ctrlKey && ['c', 'v', 'x', 'u', 'p', 's', 'a', 'f'].includes(e.key.toLowerCase())) || 
               (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 's'].includes(e.key.toLowerCase()))) { 
                e.preventDefault(); 
            }
        });

        // Mengikat riwayat browser agar tidak bisa menekan "Back"
        for(let i = 0; i < 5; i++) { history.pushState(null, document.title, location.href); }
        window.addEventListener('popstate', () => { 
            history.pushState(null, document.title, location.href); 
            if(examState.isExamActive) this.openFullscreen(); 
        });

        // Peringatan sebelum tab di-close paksa
        window.addEventListener('beforeunload', (e) => { 
            if(examState.isExamActive) { e.preventDefault(); e.returnValue = ""; return ""; }
        });
    },

    startStrictExamMode: function() {
        this.openFullscreen();
        
        // Deteksi tab blur / pindah aplikasi
        window.addEventListener('blur', this.handleViolation.bind(this));
        document.addEventListener('visibilitychange', () => { 
            if (document.visibilityState === 'hidden') this.handleViolation(); 
        });
        
        // Blur visual saat kehilangan fokus
        window.addEventListener('blur', () => { if(examState.isExamActive) document.body.style.filter = "blur(15px)"; });
        window.addEventListener('focus', () => { if(examState.isExamActive) document.body.style.filter = "none"; });
    },

    handleViolation: async function() {
        if (!examState.isExamActive) return;

        examState.pelanggaran++;
        const violationEl = document.getElementById('violation-count');
        if (violationEl) violationEl.innerText = examState.pelanggaran;
        
        this.openFullscreen();

        if (examState.pelanggaran >= examState.maxPelanggaran) {
            await window.customAlert(`Anda telah melakukan ${examState.maxPelanggaran} kali pelanggaran aktivitas mencurigakan. Ujian dihentikan secara otomatis.`, 'PELANGGARAN MAKSIMAL');
            selesaiUjian(true, true); 
        } else {
            window.customAlert(`Anda terdeteksi keluar dari layar ujian atau membuka tab lain.\n\nPeringatan Ke-${examState.pelanggaran}! Pada pelanggaran ke-${examState.maxPelanggaran}, ujian otomatis dihentikan.`, 'Peringatan Keamanan Aktif');
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
// 8. LOGIKA DRAWER NAVIGASI (MOBILE)
// ==========================================
const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');
const sidebarNav = document.getElementById('sidebar-nav');
const drawerOverlay = document.getElementById('drawer-overlay');

function toggleDrawer(isOpen) {
    if(isOpen) {
        sidebarNav.classList.add('open');
        drawerOverlay.classList.add('active');
    } else {
        sidebarNav.classList.remove('open');
        drawerOverlay.classList.remove('active');
    }
}

btnToggleDrawer?.addEventListener('click', () => toggleDrawer(true));
btnCloseDrawer?.addEventListener('click', () => toggleDrawer(false));
drawerOverlay?.addEventListener('click', () => toggleDrawer(false));

document.getElementById('nav-grid').addEventListener('click', (e) => {
    if (e.target.classList.contains('q-box') && window.innerWidth <= 1024) toggleDrawer(false);
});

// Tombol Keluar Darurat
document.getElementById('btn-exit-exam')?.addEventListener('click', async () => {
    if (await window.customConfirm("Apakah Anda yakin ingin keluar? Progress ujian Anda TIDAK AKAN TERSIMPAN jika belum menekan tombol SELESAI UJIAN.", "Keluar Ujian")) {
        SecurityManager.closeFullscreen(); 
        window.location.replace("index.html");
    }
});
