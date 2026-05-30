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

// --- 1. REFACTORING SECURITY MANAGER ---
const SecurityManager = {
    isPrivileged: false, // Default: Bukan Guru/Admin

    // Fungsi ini hanya dipanggil SETELAH data ditarik dari Firebase
    setPrivileged: function(roles) {
        const roleArray = Array.isArray(roles) ? roles : [roles];
        this.isPrivileged = roleArray.includes('admin') || roleArray.includes('guru');
        
        if (this.isPrivileged) {
            // Buka kunci seleksi teks jika terbukti sebagai guru/admin
            document.body.style.userSelect = "auto";
            document.body.style.webkitUserSelect = "auto";
        }
    },

    initGlobal: function() {
        // Blokir klik kanan
        document.addEventListener('contextmenu', e => {
            if (!this.isPrivileged) e.preventDefault();
        });

        // Blokir copy, paste, drag
        ['copy', 'cut', 'paste', 'selectstart', 'dragstart'].forEach(evt => {
            document.addEventListener(evt, e => {
                if (!this.isPrivileged && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                }
            });
        });

        // Blokir Inspect Element & Screenshot (Hanya untuk Siswa)
        document.addEventListener('keydown', e => {
            if (this.isPrivileged) return; // Guru bebas menggunakan shortcut

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

        // Cegah tombol Back Browser
        history.pushState(null, null, window.location.href);
        window.onpopstate = () => { 
            history.pushState(null, null, window.location.href); 
            if(examState.isExamActive && !this.isPrivileged) {
                this.handleViolation("Sistem mendeteksi Anda mencoba menekan navigasi Kembali (Back)!");
            }
        };

        window.addEventListener('beforeunload', (e) => {
            if (examState.isExamActive && !this.isPrivileged) {
                e.preventDefault();
                e.returnValue = 'Ujian sedang berlangsung! Keluar dari halaman ini akan membatalkan ujian Anda.';
                return e.returnValue;
            }
        });
    },

    startStrictExamMode: function() {
        if (this.isPrivileged) return; // Jangan hukum guru yang sedang simulasi

        // Tab Switching Detection
        document.addEventListener('visibilitychange', () => { 
            if (document.hidden && examState.isExamActive) {
                document.body.style.filter = "blur(25px)";
                this.handleViolation("Sistem mendeteksi Anda membuka tab atau aplikasi lain!"); 
            } else if (!document.hidden && examState.isExamActive) {
                document.body.style.filter = "none";
            }
        });
        
        // Keluar dari Layar Penuh
        document.addEventListener("fullscreenchange", () => {
            if (!document.fullscreenElement && examState.isExamActive) {
                this.handleViolation("Mode Layar Penuh (Fullscreen) dimatikan!");
            }
        });
    },

    handleViolation: async function(alasan) {
        if (!examState.isExamActive || this.isPrivileged) return;
        
        examState.pelanggaran++;
        const violationEl = document.getElementById('violation-count');
        if (violationEl) violationEl.innerText = examState.pelanggaran;

        if (examState.pelanggaran >= examState.maxPelanggaran) {
            examState.isExamActive = false;
            await window.customAlert(`Ujian dihentikan karena mencapai batas maksimal ${examState.maxPelanggaran} kali pelanggaran.\n\nAlasan Terakhir: ${alasan}`, 'DISKUALIFIKASI');
            selesaiUjian("DISKUALIFIKASI");
        } else {
            await window.customAlert(`${alasan}\n\nPeringatan ${examState.pelanggaran}/${examState.maxPelanggaran}!\nJika mencapai batas, ujian otomatis selesai dan Anda didiskualifikasi.`, 'PERINGATAN KEAMANAN');
            this.openFullscreen();
        }
    },

    openFullscreen: function() {
        if (this.isPrivileged) return;
        const el = document.documentElement;
        if (el.requestFullscreen) { el.requestFullscreen().catch(() => {}); } 
        else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); } 
    },

    closeFullscreen: function() {
        if (document.exitFullscreen) { document.exitFullscreen().catch(()=>{}); }
    }
};

// --- 2. INTEGRASI AUTENTIKASI DENGAN SECURITY MANAGER ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi perlindungan ketat (Default: Berlaku untuk semua yang baru buka web)
    SecurityManager.initGlobal();

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.replace("index.html"); return; }
        
        try {
            // 2. Tarik data otentik yang valid dari server Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // 3. Verifikasi Server: Beritahu SecurityManager apa role sebenarnya
                SecurityManager.setPrivileged(userData.role);

                examState.student = { uid: user.uid, ...userData };
                document.getElementById('welcome-student').innerHTML = `Assalamu'alaikum, <span style="display: inline-block;">${examState.student.nama}! 🙏</span>`;
                document.getElementById('student-class').value = Array.isArray(examState.student.kelas) ? examState.student.kelas[0] : (examState.student.kelas || "-");
                document.getElementById('exam-student-name').innerText = `${examState.student.nama} (${examState.student.username})`;
                
                await loadMapelOptions();

                // --- FITUR BYPASS & DETEKSI TOKEN OTOMATIS UNTUK SEB ---
                const urlParams = new URLSearchParams(window.location.search);
                const directMapel = urlParams.get('mapel');

                if (directMapel) {
                    setTimeout(async () => {
                        const mapelSelect = document.getElementById('select-mapel');
                        const tokenInput = document.getElementById('input-token');
                        const kelasSiswa = document.getElementById('student-class').value;

                        if (!kelasSiswa || kelasSiswa === "-") return;

                        try {
                            // 1. Set pilihan mata pelajaran pada dropdown
                            if (!Array.from(mapelSelect.options).some(opt => opt.value === directMapel)) {
                                mapelSelect.innerHTML += `<option value="${directMapel}">${directMapel}</option>`;
                            }
                            mapelSelect.value = directMapel;

                            // 2. Tarik token aktif dari database secara otomatis berdasarkan Mapel & Kelas siswa
                            const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
                            const tokenKey = `token_${directMapel}_${kelasSiswa}`;

                            if (tokenSnap.exists() && tokenSnap.data()[tokenKey]) {
                                const tokenData = tokenSnap.data()[tokenKey];
                                const tokenCode = typeof tokenData === 'object' ? tokenData.code : tokenData;
                                
                                // Isikan token ke input secara gaib
                                tokenInput.value = tokenCode;

                                // 3. Eksekusi klik tombol mulai ujian secara otomatis
                                document.getElementById('pre-exam-ui').style.opacity = '0.5';
                                document.getElementById('pre-exam-ui').style.pointerEvents = 'none';
                                document.getElementById('btn-verifikasi').click();
                            } else {
                                window.customAlert(`Gagal masuk otomatis. Token untuk mapel "${directMapel}" di kelas "${kelasSiswa}" belum diatur oleh guru.`, "Peringatan");
                            }
                        } catch (err) {
                            console.error("Gagal melakukan bypass token otomatis:", err);
                        }
                    }, 600); // Jeda aman memastikan data akademik ter-render
                }
                // --------------------------------------------------------

            } else {
                // User tidak punya data di database, tendang keluar
                window.location.replace("index.html");
            }
        } catch(e) { 
            console.error("Gagal memuat profil pengguna:", e); 
        }
    });

    const toggleSidebar = () => {
        const sidebar = document.getElementById('sidebar-nav');
        const overlay = document.getElementById('overlay-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open'); 
            if(overlay) { overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none'; }
        }
    };

    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', toggleSidebar);
    document.getElementById('btn-fab-nav')?.addEventListener('click', toggleSidebar);
    document.getElementById('overlay-sidebar')?.addEventListener('click', toggleSidebar);
    document.getElementById('btn-close-sidebar')?.addEventListener('click', toggleSidebar);
});

async function loadMapelOptions() {
    try {
        const snap = await getDoc(doc(db, "pengaturan", "data_akademik"));
        const select = document.getElementById('select-mapel');
        if (snap.exists() && snap.data().list_mapel) { 
            select.innerHTML = '<option value="">-- Pilih Mapel Ujian --</option>' + snap.data().list_mapel.map(m => `<option value="${m}">${m}</option>`).join(''); 
        }
    } catch(e) {}
}

document.getElementById('btn-verifikasi').onclick = async () => {
    examState.mapelTerpilih = document.getElementById('select-mapel').value;
    const tokenInput = document.getElementById('input-token').value.toUpperCase().trim();
    const kelasSiswa = document.getElementById('student-class').value;

    if(!examState.mapelTerpilih || !tokenInput) return window.customAlert("Pilih mapel dan masukkan token dengan benar!", "Peringatan");
    
    SecurityManager.openFullscreen();

    const btn = document.getElementById('btn-verifikasi'); 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...'; btn.disabled = true;

    try {
        const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        const tokenKey = `token_${examState.mapelTerpilih}_${kelasSiswa}`;
        if (!tokenSnap.exists() || !tokenSnap.data()[tokenKey]) throw new Error("Token ujian untuk mapel dan kelas ini belum diatur oleh guru.");

        const tokenData = tokenSnap.data()[tokenKey];
        const tokenCode = typeof tokenData === 'object' ? tokenData.code : tokenData;
        if (tokenInput !== tokenCode) throw new Error("Token yang Anda masukkan SALAH!");

        if (typeof tokenData === 'object' && tokenData.expiredAt) {
            const waktuSekarang = new Date().getTime();
            if (waktuSekarang > tokenData.expiredAt) {
                throw new Error("Token sudah kedaluwarsa (masa aktif habis). Silakan minta guru untuk memperbarui token!");
            }
        }

        const qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", examState.mapelTerpilih));
        const soalSnap = await getDocs(qSoal);
        
        examState.arraySoal = [];
        soalSnap.forEach(d => {
            let data = d.data();
            let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
            if (arrKelas.includes(kelasSiswa)) { examState.arraySoal.push({id: d.id, ...data}); }
        });

        if (examState.arraySoal.length === 0) throw new Error("Soal belum tersedia untuk kelas & mapel ini.");
        examState.arraySoal.sort((a, b) => (a.nomor_soal || 0) - (b.nomor_soal || 0));

        let durasiMenit = 90;
        const timeSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
        if (timeSnap.exists() && timeSnap.data()[`${examState.mapelTerpilih}_${kelasSiswa}`]) { 
            durasiMenit = timeSnap.data()[`${examState.mapelTerpilih}_${kelasSiswa}`]; 
        }
        examState.durasiDetik = durasiMenit * 60;

        SecurityManager.startStrictExamMode();
        examState.isExamActive = true;
        
        WatermarkManager.init(examState.student.nama, examState.student.username);

        // PERBAIKAN: SESUAIKAN DENGAN ID HTML YANG BENAR
        document.getElementById('pre-exam-ui').style.display = 'none';
        document.getElementById('exam-workspace').style.display = 'flex';
        document.getElementById('exam-mapel-title').innerText = `UJIAN: ${examState.mapelTerpilih.toUpperCase()}`;

        renderNavigasi();
        tampilkanSoal(0);
        jalankanTimer();
        
    } catch(e) {
        SecurityManager.closeFullscreen();
        window.customAlert(e.message, "Akses Ditolak");
    } finally {
        btn.innerHTML = '<i class="fas fa-play-circle"></i> MULAI UJIAN'; btn.disabled = false;
    }
};

function jalankanTimer() {
    const display = document.getElementById('timer-display');
    examState.timerInterval = setInterval(() => {
        if (examState.durasiDetik <= 0) {
            clearInterval(examState.timerInterval);
            window.customAlert("Waktu ujian telah habis! Sistem akan mengumpulkan jawaban Anda secara otomatis.", "Selesai").then(() => selesaiUjian("WAKTU HABIS"));
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
    const grid = document.getElementById('grid-nav-soal');
    if (!grid) return;
    grid.innerHTML = '';
    examState.arraySoal.forEach((soal, idx) => {
        let isFilled = false;
        let ans = examState.jawabanSiswa[soal.id];
        let tipe = (soal.tipe || soal.tipe_soal || 'PG').toUpperCase();
        
        if (tipe === 'PG' && ans) isFilled = true;
        if (tipe === 'PGK' && Array.isArray(ans) && ans.length > 0) isFilled = true;
        if (tipe === 'MENJODOHKAN' && typeof ans === 'object' && Object.values(ans).some(v => v !== '')) isFilled = true;
        if (tipe === 'ESSAY' && ans && ans.trim() !== '') isFilled = true;

        const box = document.createElement('button');
        box.className = `q-box ${isFilled ? 'filled' : ''} ${examState.raguRagu[soal.id] ? 'ragu' : ''} ${examState.currentIndex === idx ? 'active' : ''}`;
        box.innerText = idx + 1;
        box.onclick = () => {
            tampilkanSoal(idx);
            const sidebar = document.getElementById('sidebar-nav');
            if (sidebar) sidebar.classList.remove('open');
            const overlay = document.getElementById('overlay-sidebar');
            if (overlay) overlay.style.display = 'none';
        };
        grid.appendChild(box);
    });
}

function tampilkanSoal(idx) {
    if (idx < 0 || idx >= examState.arraySoal.length) return;
    examState.currentIndex = idx;
    const soal = examState.arraySoal[idx];
    
    document.getElementById('current-q-num').innerText = idx + 1;
    const tipeSoal = (soal.tipe || soal.tipe_soal || 'PG').toUpperCase();
    document.getElementById('badge-tipe-soal').innerText = tipeSoal;
    
    const container = document.getElementById('soal-content');
    const teksSoal = soal.teks_soal || soal.teksSoal || soal.pertanyaan || '';
    
    let htmlContent = `<div style="font-size:1.1rem; line-height:1.6; margin-bottom:15px; color:var(--text-main);">${teksSoal}</div>`;
    
    if (soal.media_soal && soal.media_soal.url) {
        let urlMedia = soal.media_soal.url;
        let tipeMedia = soal.media_soal.type;
        htmlContent += `<div style="margin-bottom:20px; text-align:center;">`;
        if (tipeMedia === 'image') htmlContent += `<img src="${urlMedia}" style="max-width:100%; max-height:400px; border-radius:8px; border:1px solid #cbd5e1;">`;
        else if (tipeMedia === 'video') htmlContent += `<video src="${urlMedia}" controls controlsList="nodownload" style="max-width:100%; border-radius:8px;"></video>`;
        else if (tipeMedia === 'audio') htmlContent += `<audio src="${urlMedia}" controls controlsList="nodownload" style="width:100%;"></audio>`;
        htmlContent += `</div>`;
    }

    if (tipeSoal === 'PG') {
        const opsiArr = ['A', 'B', 'C', 'D', 'E'];
        htmlContent += `<div style="display:flex; flex-direction:column; gap:10px;">`;
        opsiArr.forEach(o => {
            const teksOpsi = (soal.opsi && soal.opsi[o]) ? soal.opsi[o] : soal[`opsi${o}`];
            if (teksOpsi) {
                const checked = examState.jawabanSiswa[soal.id] === o ? 'checked' : '';
                htmlContent += `
                    <label class="option-label ${checked ? 'selected' : ''}">
                        <input type="radio" name="answer_pg" value="${o}" ${checked} style="transform:scale(1.2); margin-right: 12px; cursor:pointer;">
                        <span style="flex:1;"><b>${o}.</b> ${teksOpsi}</span>
                    </label>`;
            }
        });
        htmlContent += `</div>`;
    } 
    else if (tipeSoal === 'PGK') {
        htmlContent += `<div style="font-size:0.85rem; color:var(--info); font-weight:bold; margin-bottom:10px;"><i class="fas fa-info-circle"></i> Anda dapat memilih lebih dari satu jawaban.</div>`;
        const opsiArr = ['A', 'B', 'C', 'D', 'E'];
        htmlContent += `<div style="display:flex; flex-direction:column; gap:10px;">`;
        opsiArr.forEach(o => {
            const teksOpsi = (soal.opsi && soal.opsi[o]) ? soal.opsi[o] : soal[`opsi${o}`];
            if (teksOpsi) {
                let arrJwb = examState.jawabanSiswa[soal.id] || [];
                const checked = arrJwb.includes(o) ? 'checked' : '';
                htmlContent += `
                    <label class="option-label ${checked ? 'selected' : ''}">
                        <input type="checkbox" name="answer_pgk" value="${o}" ${checked} style="transform:scale(1.3); margin-right: 12px; cursor:pointer;">
                        <span style="flex:1;"><b>${o}.</b> ${teksOpsi}</span>
                    </label>`;
            }
        });
        htmlContent += `</div>`;
    }
    else if (tipeSoal === 'MENJODOHKAN') {
        htmlContent += `<div style="font-size:0.85rem; color:var(--warning); font-weight:bold; margin-bottom:15px;"><i class="fas fa-hand-pointer"></i> Pilih pasangan jawaban yang tepat di kotak sebelah kanan.</div>`;
        let pasangan = soal.pasangan || [];
        let semuaKanan = pasangan.map(p => p.kanan).sort(() => Math.random() - 0.5); 
        
        htmlContent += `<div style="display:flex; flex-direction:column; gap:12px;">`;
        pasangan.forEach(p => {
            let jwbSiswaObj = examState.jawabanSiswa[soal.id] || {};
            let selectedKanan = jwbSiswaObj[p.kiri] || '';
            
            let optionsHtml = `<option value="">-- Pilih Pasangan --</option>`;
            semuaKanan.forEach(k => {
                optionsHtml += `<option value="${k}" ${selectedKanan === k ? 'selected' : ''}>${k}</option>`;
            });

            htmlContent += `
            <div style="display:flex; flex-direction:column; background:#f8fafc; padding:15px; border:1px solid #cbd5e1; border-radius:8px;">
                <div style="font-weight:600; margin-bottom:10px; color:var(--secondary); font-size:0.95rem;">${p.kiri}</div>
                <select class="input-text select-jodoh" data-kiri="${p.kiri}" style="border-color:var(--primary); background:white;">
                    ${optionsHtml}
                </select>
            </div>`;
        });
        htmlContent += `</div>`;
    }
    else {
        const nilaiInput = examState.jawabanSiswa[soal.id] || '';
        htmlContent += `<textarea id="essay-ans" class="input-text" rows="5" placeholder="Ketik jawaban uraian Anda di sini..." style="resize:vertical;">${nilaiInput}</textarea>`;
    }

    container.innerHTML = htmlContent;

    if (tipeSoal === 'PG') {
        container.querySelectorAll('input[name="answer_pg"]').forEach(radio => {
            radio.onchange = (e) => { 
                examState.jawabanSiswa[soal.id] = e.target.value; 
                container.querySelectorAll('.option-label').forEach(lbl => lbl.classList.remove('selected'));
                e.target.closest('.option-label').classList.add('selected');
                renderNavigasi(); 
            };
        });
    } 
    else if (tipeSoal === 'PGK') {
        container.querySelectorAll('input[name="answer_pgk"]').forEach(cb => {
            cb.onchange = (e) => {
                let arr = examState.jawabanSiswa[soal.id] || [];
                if(e.target.checked) {
                    if(!arr.includes(e.target.value)) arr.push(e.target.value);
                    e.target.closest('.option-label').classList.add('selected');
                } else {
                    arr = arr.filter(v => v !== e.target.value);
                    e.target.closest('.option-label').classList.remove('selected');
                }
                examState.jawabanSiswa[soal.id] = arr;
                renderNavigasi();
            };
        });
    }
    else if (tipeSoal === 'MENJODOHKAN') {
        container.querySelectorAll('.select-jodoh').forEach(sel => {
            sel.onchange = (e) => {
                let jwbSiswaObj = examState.jawabanSiswa[soal.id] || {};
                jwbSiswaObj[e.target.getAttribute('data-kiri')] = e.target.value;
                examState.jawabanSiswa[soal.id] = jwbSiswaObj;
                renderNavigasi();
            };
        });
    }
    else {
        const tx = document.getElementById('essay-ans');
        if (tx) {
            tx.oninput = (e) => { examState.jawabanSiswa[soal.id] = e.target.value; renderNavigasi(); };
        }
    }

    const cbRagu = document.getElementById('cb-ragu');
    if (cbRagu) {
        cbRagu.checked = !!examState.raguRagu[soal.id];
        cbRagu.onchange = (e) => { examState.raguRagu[soal.id] = e.target.checked; renderNavigasi(); };
    }

    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (examState.currentIndex === 0) {
        if(btnPrev) btnPrev.style.visibility = 'hidden';
    } else {
        if(btnPrev) {
            btnPrev.style.visibility = 'visible';
            btnPrev.onclick = () => tampilkanSoal(examState.currentIndex - 1);
        }
    }

    if (examState.currentIndex === examState.arraySoal.length - 1) {
        if(btnNext) {
            btnNext.innerHTML = '<i class="fas fa-check"></i>'; // Hanya icon centang
            btnNext.style.backgroundColor = 'var(--danger)'; 
            btnNext.title = 'Selesai Ujian';
            btnNext.onclick = checkSelesaiUjian;
        }
    } else {
        if(btnNext) {
            btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>'; // Hanya icon panah
            btnNext.style.backgroundColor = ''; 
            btnNext.title = 'Selanjutnya';
            btnNext.onclick = () => tampilkanSoal(examState.currentIndex + 1);
        }
    }
}

async function checkSelesaiUjian() {
    const jumlahSoal = examState.arraySoal.length;
    let dijawab = 0;

    examState.arraySoal.forEach(s => {
        let ans = examState.jawabanSiswa[s.id];
        let tipe = (s.tipe || s.tipe_soal || 'PG').toUpperCase();
        if (tipe === 'PG' && ans) dijawab++;
        else if (tipe === 'PGK' && Array.isArray(ans) && ans.length > 0) dijawab++;
        else if (tipe === 'MENJODOHKAN' && typeof ans === 'object' && Object.values(ans).some(v => v !== '')) dijawab++;
        else if (tipe === 'ESSAY' && ans && ans.trim() !== '') dijawab++;
    });

    const adaRagu = Object.values(examState.raguRagu).includes(true);

    let infoMsg = `Anda telah menjawab ${dijawab} dari ${jumlahSoal} soal.`;
    if (dijawab < jumlahSoal) infoMsg += `\n\n⚠️ Masih ada ${jumlahSoal - dijawab} soal KOSONG yang belum Anda jawab.`;
    if (adaRagu) infoMsg += `\n\n⚠️ Terdapat soal yang masih ditandai RAGU-RAGU.`;

    if (await window.customConfirm(`${infoMsg}\n\nApakah Anda YAKIN ingin mengumpulkan lembar jawaban ini sekarang?`, "warning", "Konfirmasi Pengumpulan", "Ya, Kumpulkan")) {
        selesaiUjian("NORMAL");
    }
}

// PERBAIKAN: MEMASTIKAN TIDAK ERROR JIKA BTN SELESAI TIDAK DITEMUKAN
const btnSelesaiUjian = document.getElementById('btn-selesai-ujian');
if (btnSelesaiUjian) {
    btnSelesaiUjian.onclick = checkSelesaiUjian;
}

async function selesaiUjian(statusAkhir = "NORMAL") {
    clearInterval(examState.timerInterval);
    examState.isExamActive = false;
    SecurityManager.closeFullscreen();

    document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column; background:var(--bg-main);"><i class="fas fa-spinner fa-spin fa-4x" style="color:var(--primary); margin-bottom:20px;"></i><h2 style="color:var(--secondary); font-family:sans-serif; text-align:center;">Menyimpan Lembar Jawaban...</h2><p style="color:var(--text-muted);">Mohon jangan tutup atau kembali dari halaman ini.</p></div>';

    let totalBobotPG = 0;
    let skorDiperolehPG = 0;

    examState.arraySoal.forEach(s => {
        const tipeSoal = (s.tipe || s.tipe_soal || 'PG').toUpperCase();
        const bobot = parseFloat(s.bobot) || 1;
        const jwb = examState.jawabanSiswa[s.id];

        if(tipeSoal === 'PG') {
            totalBobotPG += bobot;
            const kunci = s.kunci_jawaban || s.jawaban_benar;
            if(jwb === kunci) { skorDiperolehPG += bobot; }
        } 
        else if (tipeSoal === 'PGK') {
            totalBobotPG += bobot;
            let kunciArr = Array.isArray(s.kunci_jawaban) ? s.kunci_jawaban : [];
            let jwbArr = Array.isArray(jwb) ? jwb : [];
            if(kunciArr.length > 0 && jwbArr.length === kunciArr.length && kunciArr.every(k => jwbArr.includes(k))) {
                skorDiperolehPG += bobot;
            }
        }
        else if (tipeSoal === 'MENJODOHKAN') {
            totalBobotPG += bobot;
            if (s.pasangan && Array.isArray(s.pasangan)) {
                let totalPairs = s.pasangan.length;
                let correctPairs = 0;
                let jwbObj = typeof jwb === 'object' ? jwb : {};
                s.pasangan.forEach(p => {
                    if (jwbObj[p.kiri] === p.kanan) correctPairs++;
                });
                if (totalPairs > 0) {
                    skorDiperolehPG += (correctPairs / totalPairs) * bobot;
                }
            }
        }
    });
    
    let skorAkhir = 0;
    if(totalBobotPG > 0) skorAkhir = Math.round((skorDiperolehPG / totalBobotPG) * 100);

    const payload = {
        uid: examState.student.uid,
        nama: examState.student.nama,
        username: examState.student.username,
        kelas: Array.isArray(examState.student.kelas) ? examState.student.kelas[0] : examState.student.kelas,
        mataPelajaran: examState.mapelTerpilih,
        jawaban: examState.jawabanSiswa,
        pelanggaran: examState.pelanggaran,
        skorPG: skorAkhir,
        skor: skorAkhir, 
        waktuSubmit: new Date().toISOString(),
        statusPelanggaran: statusAkhir
    };

    try {
        await addDoc(collection(db, "hasil_ujian"), payload);
        alert("PEMBERITAHUAN:\nLembar jawaban Anda berhasil direkam dengan aman oleh server. Anda akan diarahkan keluar.");
        window.location.replace("index.html");
    } catch(e) {
        alert("GAGAL MENYIMPAN!\nTerjadi kesalahan koneksi internet atau server sibuk. Silakan panggil pengawas ruangan dan JANGAN tutup halaman ini.");
        window.location.replace("index.html");
    }
}