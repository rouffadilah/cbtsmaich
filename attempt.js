import { auth, db } from './firebase-config.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let studentData = null;
let mapelTerpilih = "";
let arraySoal = [];
let currentIndex = 0;
let jawabanSiswa = {}; 
let raguRagu = {};
let timerInterval;
let durasiDetik = 0;
let pelanggaran = 0;

window.customAlert = (msg, title = 'Informasi') => {
    return new Promise(res => {
        const modal = document.getElementById('modal-custom-alert');
        document.getElementById('alert-title').innerText = title;
        document.getElementById('alert-message').innerText = msg;
        modal.style.display = 'flex';
        document.getElementById('btn-alert-ok').onclick = () => { modal.style.display = 'none'; res(); };
    });
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "index.html"; return; }
        
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                studentData = { uid: user.uid, ...userDoc.data() };
                document.getElementById('welcome-student').innerText = `Assalamu'alaikum ${studentData.nama}...`;
                document.getElementById('student-class').value = studentData.kelas || studentData.kelas_siswa || "-";
                document.getElementById('exam-student-name').innerText = `${studentData.nama} (${studentData.username})`;
                await loadMapelOptions();
            } else {
                await customAlert("Data siswa tidak ditemukan.");
                auth.signOut(); window.location.href = "index.html";
            }
        } catch(e) { console.error(e); }
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
    } catch(e) {}
}

// === FUNGSI BANTUAN FULLSCREEN LINTAS BROWSER ===
function openFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) { elem.requestFullscreen().catch(()=>{}); } 
    else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); } // Safari
    else if (elem.msRequestFullscreen) { elem.msRequestFullscreen(); } // Edge/IE
}
function closeFullscreen() {
    if (document.exitFullscreen) { document.exitFullscreen().catch(()=>{}); } 
    else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); } 
    else if (document.msExitFullscreen) { document.msExitFullscreen(); }
}

document.getElementById('btn-verifikasi').onclick = async () => {
    mapelTerpilih = document.getElementById('select-mapel').value;
    const tokenInput = document.getElementById('input-token').value.toUpperCase().trim();
    const kelasSiswa = document.getElementById('student-class').value;

    if(!mapelTerpilih || !tokenInput) return customAlert("Pilih mapel dan masukkan token!", "Peringatan");

    const btn = document.getElementById('btn-verifikasi');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...'; 
    btn.disabled = true;

    try {
        const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        const tokenKey = `token_${mapelTerpilih}_${kelasSiswa}`;
        
        if (!tokenSnap.exists() || !tokenSnap.data()[tokenKey]) {
            btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; btn.disabled = false;
            return customAlert("Token tidak valid atau belum diaktifkan oleh Admin.", "Akses Ditolak");
        }

        const tokenData = tokenSnap.data()[tokenKey];
        const tokenCode = typeof tokenData === 'object' ? tokenData.code : tokenData;
        const expiresAt = typeof tokenData === 'object' ? tokenData.expiresAt : 0;

        if (tokenInput !== tokenCode) {
            btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; btn.disabled = false;
            return customAlert("Kode Token Salah!", "Akses Ditolak");
        }
        if (Date.now() > expiresAt) {
            btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; btn.disabled = false;
            return customAlert("Waktu Token sudah habis! Silakan minta token baru ke Pengawas.", "Token Expired");
        }

        const qHasil = query(collection(db, "hasil_ujian"), where("uid", "==", studentData.uid), where("mataPelajaran", "==", mapelTerpilih));
        const cekHasil = await getDocs(qHasil);
        if(!cekHasil.empty) {
            btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; btn.disabled = false;
            return customAlert("Anda sudah menyelesaikan ujian mapel ini.", "Ditolak");
        }

        const qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapelTerpilih), where("kelas", "==", kelasSiswa));
        const soalSnap = await getDocs(qSoal);
        
        if (soalSnap.empty) {
            btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; btn.disabled = false;
            return customAlert("Belum ada soal untuk mata pelajaran ini.", "Kosong");
        }

        arraySoal = [];
        soalSnap.forEach(d => arraySoal.push({id: d.id, ...d.data()}));
        arraySoal.sort((a, b) => a.nomor_soal - b.nomor_soal);

        let durasiMenit = 90; 
        try {
            const timeSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
            if (timeSnap.exists() && timeSnap.data()[`${mapelTerpilih}_${kelasSiswa}`]) {
                durasiMenit = timeSnap.data()[`${mapelTerpilih}_${kelasSiswa}`];
            }
        } catch (e) {}

        durasiDetik = durasiMenit * 60;
        
        // PAKSA FULLSCREEN & KEAMANAN
        openFullscreen();
        mulaiKeamananUjian();
        
        document.getElementById('pre-exam-screen').style.display = 'none';
        document.getElementById('exam-workspace').style.display = 'flex';
        document.getElementById('exam-mapel-title').innerText = `UJIAN: ${mapelTerpilih.toUpperCase()}`;
        
        renderNavigasi();
        tampilkanSoal(0);
        jalankanTimer();

    } catch(e) {
        console.error(e);
        customAlert("Terjadi kesalahan jaringan.");
        btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; btn.disabled = false;
    }
};

function renderMedia(mediaObj) {
    if (!mediaObj) return '';
    if (mediaObj.type === 'image') return `<img src="${mediaObj.url}" style="max-width:100%; max-height:250px; border-radius:8px; margin-top:10px; display:block;" ondragstart="return false;">`;
    if (mediaObj.type === 'audio') return `<audio controls src="${mediaObj.url}" style="width:100%; margin-top:10px;"></audio>`;
    return '';
}

function tampilkanSoal(idx) {
    currentIndex = idx;
    const soal = arraySoal[idx];
    
    document.getElementById('current-q-num').innerText = idx + 1;
    document.getElementById('badge-tipe-soal').innerText = soal.tipe || 'PG';
    document.getElementById('cb-ragu').checked = raguRagu[idx] || false;

    let html = `<div style="margin-bottom: 20px;">${soal.teks_soal}</div>`;
    html += renderMedia(soal.media_soal);
    
    if (soal.tipe === 'PG' || !soal.tipe) {
        html += `<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">`;
        ['A','B','C','D','E'].forEach(opt => {
            if (soal.opsi && soal.opsi[opt]) {
                let isChecked = jawabanSiswa[soal.id] === opt;
                let bgClass = isChecked ? 'selected' : '';
                html += `
                    <label class="option-label ${bgClass}" onclick="pilihJawabanPG('${soal.id}', '${opt}')">
                        <input type="radio" name="opsi" value="${opt}" ${isChecked ? 'checked' : ''} style="margin-right: 15px; transform: scale(1.2);">
                        <span style="font-weight: bold; margin-right: 10px;">${opt}.</span>
                        <div style="flex: 1;">${renderMedia(soal.opsi_media?.[opt])} ${soal.opsi[opt]}</div>
                    </label>`;
            }
        });
        html += `</div>`;
    } 
    else if (soal.tipe === 'Uraian' || soal.tipe === 'Essay' || soal.tipe === 'Isian') {
        let teksJawaban = jawabanSiswa[soal.id] || "";
        html += `
            <div style="margin-top: 25px;">
                <label style="font-weight: 700; color: var(--secondary); display: block; margin-bottom: 10px;"><i class="fas fa-keyboard"></i> Ketik Jawaban Anda:</label>
                <textarea rows="${soal.tipe === 'Isian' ? '2' : '8'}" 
                    style="width: 100%; padding: 15px; font-size: 1.1rem; border: 2px solid #cbd5e1; border-radius: 8px; font-family: inherit; resize: vertical;" 
                    placeholder="Tuliskan jawaban Anda di sini..."
                    oninput="simpanJawabanTeks('${soal.id}', this.value)"
                    onpaste="return false;"
                >${teksJawaban}</textarea>
            </div>`;
    }

    document.getElementById('question-content').innerHTML = html;
    
    document.getElementById('btn-prev').style.visibility = idx === 0 ? 'hidden' : 'visible';
    const btnNext = document.getElementById('btn-next');
    if (idx === arraySoal.length - 1) {
        btnNext.innerHTML = `<i class="fas fa-check"></i>`;
        btnNext.style.background = 'var(--danger)';
    } else {
        btnNext.innerHTML = `<i class="fas fa-chevron-right"></i>`;
        btnNext.style.background = 'var(--primary)';
    }
    
    updateWarnaGrid();
}

window.pilihJawabanPG = (soalId, opsi) => { jawabanSiswa[soalId] = opsi; tampilkanSoal(currentIndex); };
window.simpanJawabanTeks = (soalId, teks) => { jawabanSiswa[soalId] = teks; updateWarnaGrid(); };
document.getElementById('cb-ragu').onchange = (e) => { raguRagu[currentIndex] = e.target.checked; updateWarnaGrid(); };

document.getElementById('btn-prev').onclick = () => { if(currentIndex > 0) tampilkanSoal(currentIndex - 1); };
document.getElementById('btn-next').onclick = () => { if(currentIndex < arraySoal.length - 1) tampilkanSoal(currentIndex + 1); else selesaiUjian(); };

function renderNavigasi() {
    const grid = document.getElementById('nav-grid'); grid.innerHTML = '';
    arraySoal.forEach((s, i) => {
        let box = document.createElement('div');
        box.className = `q-box`; box.id = `nav-box-${i}`;
        box.innerText = i + 1;
        box.onclick = () => tampilkanSoal(i);
        grid.appendChild(box);
    });
}

function updateWarnaGrid() {
    arraySoal.forEach((s, i) => {
        let box = document.getElementById(`nav-box-${i}`);
        box.className = 'q-box'; 
        if (jawabanSiswa[s.id] && jawabanSiswa[s.id].trim() !== '') box.classList.add('answered');
        if (raguRagu[i]) box.classList.add('doubt');
        if (i === currentIndex) box.classList.add('active');
    });
}

function jalankanTimer() {
    timerInterval = setInterval(() => {
        durasiDetik--;
        let h = Math.floor(durasiDetik / 3600);
        let m = Math.floor((durasiDetik % 3600) / 60);
        let s = durasiDetik % 60;
        
        document.getElementById('exam-timer').innerText = 
            `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            
        if(durasiDetik <= 300) { document.getElementById('exam-timer').parentElement.style.background = '#fef2f2'; document.getElementById('exam-timer').style.color = 'red'; }
        if(durasiDetik <= 0) { clearInterval(timerInterval); selesaiUjian(true); }
    }, 1000);
}

document.getElementById('btn-finish').onclick = () => selesaiUjian();

async function selesaiUjian(isTimeOut = false, isPelanggaran = false) {
    if(!isTimeOut && !isPelanggaran) {
        let terjawab = Object.keys(jawabanSiswa).filter(k => jawabanSiswa[k].trim() !== '').length;
        if(terjawab < arraySoal.length) {
            let sisa = arraySoal.length - terjawab;
            let conf = confirm(`Peringatan! Masih ada ${sisa} soal yang BELUM TERJAWAB. Yakin ingin mengumpulkan ujian sekarang?`);
            if(!conf) return;
        } else {
            let conf = confirm("Apakah Anda yakin telah selesai dan ingin mengumpulkan jawaban?");
            if(!conf) return;
        }
    } else if (isTimeOut && !isPelanggaran) { 
        alert("Waktu habis! Jawaban Anda otomatis dikumpulkan."); 
    }

    clearInterval(timerInterval);
    document.getElementById('exam-workspace').innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column; background:#f8fafc;"><i class="fas fa-spinner fa-spin fa-3x" style="color:var(--primary); margin-bottom:20px;"></i><h2>Menyimpan Jawaban...</h2></div>`;

    let skorBenar = 0;
    arraySoal.forEach(q => {
        if(q.tipe === 'PG' && q.kunci_jawaban && jawabanSiswa[q.id] === q.kunci_jawaban) {
            skorBenar++;
        }
    });
    
    let totalSoal = arraySoal.length;
    let nilaiAkhir = Math.round((skorBenar / totalSoal) * 100);

    let payload = {
        uid: studentData.uid,
        namaSiswa: studentData.nama,
        kelas: document.getElementById('student-class').value,
        mataPelajaran: mapelTerpilih,
        jawabanSiswa: jawabanSiswa,
        benar: skorBenar,
        totalSoal: totalSoal,
        nilai: nilaiAkhir,
        pelanggaran: pelanggaran,
        waktuKumpul: new Date()
    };

    try {
        await addDoc(collection(db, "hasil_ujian"), payload);
        closeFullscreen(); // Tutup Fullscreen saat selesai
        alert(`Ujian Selesai!\nJawaban Anda telah berhasil disimpan di server.`);
        window.location.href = "index.html";
    } catch(e) {
        alert("Gagal menyimpan ke server. Hubungi pengawas!");
    }
}

// ==========================================
// 5. KEAMANAN ANTI-NYONTEK & ANTI-AI SANGAT KETAT
// ==========================================
function mulaiKeamananUjian() {
    // 1. Deteksi Pindah Tab (Membuka aplikasi lain / split screen)
    window.addEventListener('blur', catatPelanggaran);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') catatPelanggaran(); });
    
    // 2. Blokir Klik Kanan
    document.addEventListener('contextmenu', event => event.preventDefault());

    // 3. Blokir Blok Teks (Mencegah Google Lens / Copy Teks Manual)
    document.addEventListener('selectstart', event => event.preventDefault());

    // 4. Blokir Aksi Copy, Cut, dan Paste
    ['copy', 'cut', 'paste'].forEach(evt => document.addEventListener(evt, event => event.preventDefault()));

    // 5. Blokir Shortcut Keyboard Pencarian & Inspect Element
    document.addEventListener('keydown', event => {
        if (
            event.key === 'F12' || 
            event.key === 'PrintScreen' ||
            (event.ctrlKey && ['c', 'v', 'x', 'u', 'p', 's', 'a', 'f'].includes(event.key.toLowerCase())) ||
            (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(event.key.toLowerCase()))
        ) {
            event.preventDefault();
        }
    });
}

function catatPelanggaran() {
    pelanggaran++;
    document.getElementById('violation-count').innerText = pelanggaran;
    
    if (pelanggaran >= 3) {
        alert(`PERINGATAN MAKSIMAL!\nAnda telah melakukan 3 kali pelanggaran. Ujian dihentikan secara otomatis.`);
        selesaiUjian(true, true); 
    } else {
        alert(`PERINGATAN KE-${pelanggaran}!\nAnda terdeteksi keluar dari halaman ujian / membuka tab lain. Pada pelanggaran ke-3, ujian akan dihentikan.`);
        openFullscreen(); // Paksa fullscreen lagi jika siswa mencoba keluar
    }
}

// ==========================================
// 6. LOGIKA DRAWER NAVIGASI (MOBILE)
// ==========================================
const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');
const sidebarNav = document.getElementById('sidebar-nav');
const drawerOverlay = document.getElementById('drawer-overlay');

function openDrawer() {
    sidebarNav.classList.add('open');
    drawerOverlay.classList.add('active');
}

function closeDrawer() {
    sidebarNav.classList.remove('open');
    drawerOverlay.classList.remove('active');
}

if(btnToggleDrawer) btnToggleDrawer.addEventListener('click', openDrawer);
if(btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);
if(drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

// Otomatis menutup drawer di HP saat siswa mengklik salah satu nomor soal
document.getElementById('nav-grid').addEventListener('click', (e) => {
    if (e.target.classList.contains('q-box') && window.innerWidth <= 1024) {
        closeDrawer();
    }
});

// ==========================================
// 7. LOGIKA KELUAR & HANDLER TOMBOL BACK HP
// ==========================================

// Fungsi untuk tombol Keluar UI
const btnExitExam = document.getElementById('btn-exit-exam');
if (btnExitExam) {
    btnExitExam.addEventListener('click', () => {
        const conf = confirm("Apakah Anda yakin ingin keluar? Progress ujian Anda tidak akan tersimpan jika belum menekan tombol SELESAI UJIAN.");
        if (conf) {
            closeFullscreen(); // Pastikan keluar dari mode fullscreen
            window.location.href = "index.html";
        }
    });
}

// Menangkap event tombol 'Back' fisik di HP atau Browser
history.pushState(null, null, location.href); // Push state pertama
window.addEventListener('popstate', function(event) {
    // Tahan state agar tidak langsung terlempar keluar tanpa izin
    history.pushState(null, null, location.href);
    
    // Tampilkan konfirmasi
    const conf = confirm("Tombol kembali ditekan. Apakah Anda benar-benar ingin keluar dari aplikasi ujian ini?");
    if (conf) {
        closeFullscreen();
        window.location.href = "index.html"; // Arahkan kembali ke halaman login
    }
});
