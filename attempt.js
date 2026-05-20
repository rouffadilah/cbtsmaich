import { auth, db } from './firebase-config.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const examState = {
    student: null, mapelTerpilih: "", arraySoal: [], currentIndex: 0,
    jawabanSiswa: {}, raguRagu: {}, timerInterval: null, durasiDetik: 0,
    pelanggaran: 0, maxPelanggaran: 3, isExamActive: false
};

window.customAlert = (msg, title = 'Informasi') => {
    return new Promise(res => {
        const modal = document.getElementById('modal-custom-alert');
        if(!modal) { alert(msg); return res(); }
        document.getElementById('alert-title').innerText = title;
        document.getElementById('alert-message').innerText = msg;
        modal.style.display = 'flex';
        document.getElementById('btn-alert-ok').onclick = () => { modal.style.display = 'none'; res(); };
    });
};

window.customConfirm = (msg, title = 'Konfirmasi') => {
    return new Promise(res => {
        const modal = document.getElementById('modal-custom-confirm');
        if(!modal) { return res(confirm(msg)); }
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = msg;
        modal.style.display = 'flex';
        document.getElementById('btn-confirm-ok').onclick = () => { modal.style.display = 'none'; res(true); };
        document.getElementById('btn-confirm-cancel').onclick = () => { modal.style.display = 'none'; res(false); };
    });
};

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
        watermarkDiv.style = "position:fixed; top:0; left:0; width:200vw; height:200vh; pointer-events:none; z-index:99999; opacity:0.12; background-repeat:repeat;";
        
        const canvas = document.createElement('canvas');
        canvas.width = 300; canvas.height = 180; 
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 6); 
        ctx.font = 'bold 15px Inter, sans-serif'; ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(nama, 0, -15);
        ctx.fillText(`NIS: ${nis}`, 0, 5);
        ctx.fillText(`CBT SMAICH`, 0, 25);

        watermarkDiv.style.backgroundImage = `url(${canvas.toDataURL('image/png')})`;
        document.body.appendChild(watermarkDiv);
    },
    enforceOverlay: function(nama, nis) {
        const observer = new MutationObserver(() => {
            if (!document.getElementById(this.overlayId)) this.createOverlay(nama, nis);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
};

const SecurityManager = {
    initGlobal: function() {
        document.addEventListener('contextmenu', e => e.preventDefault());
        ['copy', 'cut', 'paste', 'selectstart', 'dragstart'].forEach(evt => {
            document.addEventListener(evt, e => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
            });
        });

        document.addEventListener('keydown', e => {
            const forbidden = ['F12', 'PrintScreen', 'Meta', 'OS', 'ContextMenu'];
            if (forbidden.includes(e.key) || 
               (e.ctrlKey && ['c', 'v', 'x', 'u', 'p', 's', 'a', 'f'].includes(e.key.toLowerCase())) || 
               (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 's'].includes(e.key.toLowerCase())) ||
               (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's')) { 
                e.preventDefault(); 
                if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's')) {
                    navigator.clipboard.writeText("Aksi Ilegal Terdeteksi").catch(()=>{});
                    this.handleViolation("Percobaan Screenshot/PrintScreen Terdeteksi!");
                }
            }
        });

        document.addEventListener('keyup', e => {
            if (e.key === 'PrintScreen') navigator.clipboard.writeText("Aksi Ilegal Terdeteksi").catch(()=>{});
        });

        history.pushState(null, null, window.location.href);
        window.addEventListener('popstate', () => { 
            history.pushState(null, null, window.location.href); 
            if(examState.isExamActive) this.openFullscreen(); 
        });
    },
    startStrictExamMode: function() {
        // [PERBAIKAN KEAMANAN]: Menggunakan Page Visibility API alih-alih 'blur' yang mudah diakali ekstensi
        document.addEventListener('visibilitychange', () => { 
            if (document.hidden && examState.isExamActive) {
                document.body.style.filter = "blur(25px)";
                this.handleViolation("Sistem mendeteksi Anda membuka tab atau aplikasi lain!"); 
            } else if (!document.hidden && examState.isExamActive) {
                document.body.style.filter = "none";
                this.openFullscreen();
            }
        });
        
        document.addEventListener("fullscreenchange", () => {
            if (!document.fullscreenElement && examState.isExamActive) {
                this.handleViolation("Mode Layar Penuh (Fullscreen) dimatikan!");
            }
        });
    },
    handleViolation: async function(alasan) {
        if (!examState.isExamActive) return;
        examState.pelanggaran++;
        document.getElementById('violation-count').innerText = examState.pelanggaran;
        this.openFullscreen();

        if (examState.pelanggaran >= examState.maxPelanggaran) {
            examState.isExamActive = false;
            await window.customAlert(`Ujian dihentikan karena mencapai batas maksimal ${examState.maxPelanggaran} kali pelanggaran.\nAlasan: ${alasan}`, 'DISKUALIFIKASI');
            selesaiUjian("DISKUALIFIKASI");
        } else {
            window.customAlert(`${alasan}\nPeringatan ${examState.pelanggaran}/${examState.maxPelanggaran}! Jika mencapai batas, ujian otomatis selesai.`, 'PERINGATAN KEAMANAN');
        }
    },
    openFullscreen: function() {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
            el.msRequestFullscreen();
        }
    },
    closeFullscreen: function() {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(()=>{});
        }
    }
};

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
                WatermarkManager.init(examState.student.nama, examState.student.username);
                await loadMapelOptions();
            }
        } catch(e) { console.error(e); }
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

document.getElementById('btn-verifikasi').onclick = async () => {
    examState.mapelTerpilih = document.getElementById('select-mapel').value;
    const tokenInput = document.getElementById('input-token').value.toUpperCase().trim();
    const kelasSiswa = document.getElementById('student-class').value;

    if(!examState.mapelTerpilih || !tokenInput) return window.customAlert("Pilih mapel dan masukkan token!", "Peringatan");
    
    SecurityManager.openFullscreen();

    const btn = document.getElementById('btn-verifikasi'); 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...'; btn.disabled = true;

    try {
        const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        const tokenKey = `token_${examState.mapelTerpilih}_${kelasSiswa}`;
        if (!tokenSnap.exists() || !tokenSnap.data()[tokenKey]) throw new Error("Token ujian belum diatur.");

        const tokenData = tokenSnap.data()[tokenKey];
        const tokenCode = typeof tokenData === 'object' ? tokenData.code : tokenData;
        if (tokenInput !== tokenCode) throw new Error("Token yang Anda masukkan salah!");

        const qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", examState.mapelTerpilih), where("kelas", "==", kelasSiswa));
        const soalSnap = await getDocs(qSoal);
        if (soalSnap.empty) throw new Error("Soal belum tersedia untuk kelas & mapel ini.");

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

        renderNavigasi();
        tampilkanSoal(0);
        jalankanTimer();
    } catch(e) {
        SecurityManager.closeFullscreen();
        window.customAlert(e.message, "Gagal Masuk");
    } finally {
        btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; btn.disabled = false;
    }
};

function jalankanTimer() {
    const display = document.getElementById('timer-display');
    examState.timerInterval = setInterval(() => {
        if (examState.durasiDetik <= 0) {
            clearInterval(examState.timerInterval);
            window.customAlert("Waktu ujian telah habis!", "Selesai").then(() => selesaiUjian("WAKTU HABIS"));
            return;
        }
        examState.durasiDetik--;
        const j = Math.floor(examState.durasiDetik / 3600).toString().padStart(2, '0');
        const m = Math.floor((examState.durasiDetik % 3600) / 60).toString().padStart(2, '0');
        const d = (examState.durasiDetik % 60).toString().padStart(2, '0');
        display.innerText = `${j}:${m}:${d}`;
    }, 1000);
}

function renderNavigasi() {
    const grid = document.getElementById('nav-grid');
    grid.innerHTML = '';
    examState.arraySoal.forEach((soal, idx) => {
        const box = document.createElement('button');
        box.className = `q-box ${examState.jawabanSiswa[soal.id] ? 'filled' : ''} ${examState.raguRagu[soal.id] ? 'ragu' : ''} ${examState.currentIndex === idx ? 'active' : ''}`;
        box.innerText = idx + 1;
        box.onclick = () => tampilkanSoal(idx);
        grid.appendChild(box);
    });
}

function tampilkanSoal(idx) {
    if (idx < 0 || idx >= examState.arraySoal.length) return;
    examState.currentIndex = idx;
    const soal = examState.arraySoal[idx];
    
    document.getElementById('current-q-num').innerText = idx + 1;
    
    const tipeSoal = soal.tipe || soal.tipe_soal || 'PG';
    document.getElementById('badge-tipe-soal').innerText = tipeSoal.toUpperCase();
    
    const container = document.getElementById('soal-content');
    const teksSoal = soal.teks_soal || soal.teksSoal || soal.pertanyaan || '';
    let htmlContent = `<p style="font-size:1.1rem; line-height:1.6; margin-bottom:20px;">${teksSoal}</p>`;

    if (tipeSoal === 'PG') {
        const opsiArr = ['A', 'B', 'C', 'D', 'E'];
        htmlContent += `<div style="display:flex; flex-direction:column; gap:12px;">`;
        
        opsiArr.forEach(o => {
            const teksOpsi = (soal.opsi && soal.opsi[o]) ? soal.opsi[o] : soal[`opsi${o}`];
            if (teksOpsi) {
                const checked = examState.jawabanSiswa[soal.id] === o ? 'checked' : '';
                htmlContent += `
                    <label style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid #e2e8f0; border-radius:8px; cursor:pointer;">
                        <input type="radio" name="answer" value="${o}" ${checked} style="transform:scale(1.2);">
                        <span><b>${o}.</b> ${teksOpsi}</span>
                    </label>`;
            }
        });
        htmlContent += `</div>`;
    } else {
        const nilaiInput = examState.jawabanSiswa[soal.id] || '';
        htmlContent += `<textarea id="essay-ans" class="input-text" rows="4" placeholder="Ketik jawaban Anda di sini...">${nilaiInput}</textarea>`;
    }

    container.innerHTML = htmlContent;

    if (tipeSoal === 'PG') {
        container.querySelectorAll('input[name="answer"]').forEach(radio => {
            radio.onchange = (e) => { examState.jawabanSiswa[soal.id] = e.target.value; renderNavigasi(); };
        });
    } else {
        const tx = document.getElementById('essay-ans');
        tx.oninput = (e) => { examState.jawabanSiswa[soal.id] = e.target.value; renderNavigasi(); };
    }

    const cbRagu = document.getElementById('cb-ragu');
    cbRagu.checked = !!examState.raguRagu[soal.id];
    cbRagu.onchange = (e) => { examState.raguRagu[soal.id] = e.target.checked; renderNavigasi(); };

    renderNavigasi();

    // --- TAMBAHAN LOGIKA TOMBOL PREV & NEXT DINAMIS ---
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    // Pengaturan Tombol Sebelumnya (Sembunyikan di soal pertama)
    if (examState.currentIndex === 0) {
        btnPrev.style.visibility = 'hidden';
    } else {
        btnPrev.style.visibility = 'visible';
        btnPrev.onclick = () => tampilkanSoal(examState.currentIndex - 1);
    }

    // Pengaturan Tombol Selanjutnya / Selesai
    if (examState.currentIndex === examState.arraySoal.length - 1) {
        // Mode Selesai pada soal terakhir
        btnNext.innerHTML = '<i class="fas fa-check"></i>';
        btnNext.style.backgroundColor = 'var(--danger)'; 
        btnNext.title = 'Selesai Ujian';
        btnNext.onclick = async () => {
            const jumlahSoal = examState.arraySoal.length;
            const dijawab = Object.keys(examState.jawabanSiswa).length;
            const adaRagu = Object.values(examState.raguRagu).includes(true);

            let infoMsg = `Anda telah menjawab ${dijawab} dari ${jumlahSoal} soal.`;
            if(adaRagu) infoMsg += `\n\n⚠️ PERINGATAN: Masih ada soal yang ditandai RAGU-RAGU!`;

            if (await window.customConfirm(`${infoMsg}\n\nApakah kamu yakin untuk menyelesaikan ujian ini?`, "Selesai Ujian")) {
                selesaiUjian("NORMAL");
            }
        };
    } else {
        // Mode Lanjut Normal
        btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
        btnNext.style.backgroundColor = ''; // Reset ke warna asli
        btnNext.title = 'Selanjutnya';
        btnNext.onclick = () => tampilkanSoal(examState.currentIndex + 1);
    }
} // <-- Penutup function tampilkanSoal(idx)
}

document.getElementById('btn-selesai').onclick = async () => {
    const jumlahSoal = examState.arraySoal.length;
    const dijawab = Object.keys(examState.jawabanSiswa).length;
    const adaRagu = Object.values(examState.raguRagu).includes(true);

    let infoMsg = `Anda telah menjawab ${dijawab} dari ${jumlahSoal} soal.`;
    if(adaRagu) infoMsg += `\n\n⚠️ PERINGATAN: Masih ada soal yang ditandai RAGU-RAGU!`;

    if (await window.customConfirm(`${infoMsg}\n\nApakah Anda yakin ingin menyelesaikan ujian sekarang?`, "Selesai Ujian")) {
        selesaiUjian("NORMAL");
    }
};

async function selesaiUjian(statusAkhir = "NORMAL") {
    clearInterval(examState.timerInterval);
    examState.isExamActive = false;
    SecurityManager.closeFullscreen();

    // Tampilan Loading
    document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column; background:var(--bg-main);"><h2 style="color:var(--secondary); font-family:sans-serif;">Menyimpan Lembar Ujian Anda...</h2><p style="color:var(--text-muted);">Mohon jangan tutup jendela ini.</p></div>';

    let benar = 0; let salah = 0; let skor = 0;
    let totalBobotPG = 0;
    let skorDiperolehPG = 0;

    // Hitung Skor Berdasarkan Bobot
    examState.arraySoal.forEach(s => {
        const tipeSoal = s.tipe || s.tipe_soal || 'PG';
        const bobot = parseFloat(s.bobot) || 1; // Default bobot 1 jika tidak diisi

        if(tipeSoal === 'PG') {
            totalBobotPG += bobot;
            const kunci = s.kunci_jawaban || s.jawaban_benar;
            if(examState.jawabanSiswa[s.id] === kunci) {
                benar++; 
                skorDiperolehPG += bobot; // Tambahkan bobot jika benar
            } else {
                salah++;
            }
        }
    });
    
    // Konversi skor ke skala 100 berdasarkan total bobot maksimal
    if(totalBobotPG > 0) skor = Math.round((skorDiperolehPG / totalBobotPG) * 100);

    const payload = {
        uid: examState.student.uid,
        nama: examState.student.nama,
        username: examState.student.username,
        kelas: examState.student.kelas || examState.student.kelas_siswa,
        mataPelajaran: examState.mapelTerpilih,
        jawaban: examState.jawabanSiswa,
        pelanggaran: examState.pelanggaran,
        skorPG: skor,
        waktuSubmit: new Date().toISOString(),
        statusPelanggaran: statusAkhir
    };

    try {
        await addDoc(collection(db, "hasil_ujian"), payload);
        alert("PEMBERITAHUAN:\nJawaban Anda berhasil disimpan di server. Anda akan diarahkan kembali ke halaman utama.");
        window.location.replace("index.html");
    } catch(e) {
        alert("GAGAL MENYIMPAN!\nTerjadi kesalahan koneksi. Silakan panggil pengawas ruangan.");
        window.location.replace("index.html");
    }
}
