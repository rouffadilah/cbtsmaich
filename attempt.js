import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Variabel Global
let questions = []; let currentIdx = 0; let userAnswers = []; let doubtStatus = []; let mapelTerpilih = ""; 
let dataKelasSiswa = "-"; 
let dataNamaSiswa = "Siswa"; 
let shuffledTargetsCache = {}; 
const KEY_ANS = 'cbt_jawaban_smaich'; const KEY_DOUBT = 'cbt_ragu_smaich';

// Variabel Anti-Cheat
let cheatWarnings = 0;
const MAX_CHEAT_WARNINGS = 3;
let isExamActive = false; 
let isWarningShowing = false;

// 1. PENGECEKAN LOGIN, MEMUAT PROFIL SISWA & SAPAAN DINAMIS
auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    
    dataNamaSiswa = user.displayName || user.email.split('@')[0];
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if(userDoc.exists()) {
            const userData = userDoc.data();
            if(userData.kelas) dataKelasSiswa = userData.kelas;
            if(userData.nama) dataNamaSiswa = userData.nama; 
        }

        document.getElementById('student-name').innerText = dataNamaSiswa;
        
        const greetingEl = document.getElementById('greeting-peserta');
        if (greetingEl) {
            greetingEl.innerText = `Assalamu'alaikum ${dataNamaSiswa}...`;
        }

        const masterDoc = await getDoc(doc(db, "pengaturan", "data_akademik"));
        if(masterDoc.exists()) {
            const dataAkademik = masterDoc.data();
            
            // Render Pilihan Mapel
            if(dataAkademik.list_mapel) {
                const selectMapel = document.getElementById('select-mapel');
                selectMapel.innerHTML = '<option value="" disabled selected>-- Pilih Mata Pelajaran --</option>' +
                    dataAkademik.list_mapel.map(m => `<option value="${m}">${m}</option>`).join('');
            }
            
            // PERBAIKAN: Render Pilihan Kelas
            if(dataAkademik.list_kelas) {
                const selectKelas = document.getElementById('select-kelas');
                selectKelas.innerHTML = '<option value="" disabled selected>-- Pilih Kelas --</option>' +
                    dataAkademik.list_kelas.map(k => `<option value="${k}">${k}</option>`).join('');
                
                // Auto-select kelas jika dataKelasSiswa sudah ada dari database
                if (dataKelasSiswa && dataKelasSiswa !== "-") {
                    selectKelas.value = dataKelasSiswa;
                }
            }
        }
    } catch(e) { console.error("Gagal load data awal", e); }
});

setInterval(() => { 
    const liveTimeEl = document.getElementById('live-time-student');
    if (liveTimeEl) {
        liveTimeEl.innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + " WIB"; 
    }
}, 1000);

// 2. VALIDASI TOKEN OTOMATIS
const preExamSection = document.getElementById('pre-exam-section');
const mainExamLayout = document.getElementById('main-exam-layout');
const btnVerifikasi = document.getElementById('btn-verifikasi');
const tokenError = document.getElementById('token-error');

btnVerifikasi.addEventListener('click', async () => {
    const inputToken = document.getElementById('input-token').value.trim().toUpperCase();
    const selectMapel = document.getElementById('select-mapel').value;
    const selectKelas = document.getElementById('select-kelas').value; // Mengambil nilai dari dropdown kelas

    if (!selectMapel || !selectKelas || !inputToken) {
        return alert("Pilih mata pelajaran, kelas, dan masukkan Token!");
    }
    
    // Perbarui data kelas siswa berdasarkan form yang dipilih
    dataKelasSiswa = selectKelas;

    const originalText = btnVerifikasi.innerHTML;
    btnVerifikasi.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMVALIDASI...'; 
    btnVerifikasi.disabled = true; 
    tokenError.style.display = 'none';

    try {
        const pengaturanSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        
        // Cek kecocokan token berdasarkan Mapel dan Kelas yang dipilih
        const tokenKey = `token_${selectMapel}_${selectKelas}`;
        let tokenAktif = (pengaturanSnap.exists() && pengaturanSnap.data()[tokenKey]) ? pengaturanSnap.data()[tokenKey] : null;

        if (!tokenAktif || inputToken !== tokenAktif) {
            tokenError.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Token untuk <b>${selectMapel}</b> kelas <b>${selectKelas}</b> tidak aktif atau salah!`;
            tokenError.style.display = 'block'; 
            btnVerifikasi.innerHTML = originalText; 
            btnVerifikasi.disabled = false;
            return;
        }

        mapelTerpilih = selectMapel; 
        preExamSection.style.display = 'none'; 
        mainExamLayout.style.display = 'grid'; 
        setTimeout(() => { isExamActive = true; }, 1000); 
        initUjian(); 
    } catch (error) { 
        alert("Gagal memvalidasi token."); 
        btnVerifikasi.innerHTML = originalText; 
        btnVerifikasi.disabled = false; 
    }
});

// 3. MEMUAT BANK SOAL
async function initUjian() {
    const qContainer = document.getElementById('q-container');
    qContainer.innerHTML = `<div style='text-align:center; padding:50px;'><i class='fas fa-spinner fa-spin fa-2x'></i><p>Memuat Soal ${mapelTerpilih}...</p></div>`;

    try {
        const qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapelTerpilih));
        const snapshot = await getDocs(qSoal);
        
        if (snapshot.empty) { qContainer.innerHTML = "<p style='text-align:center; color:red;'>Belum ada soal untuk mapel ini.</p>"; return; }

        snapshot.forEach(doc => { questions.push({ id: doc.id, ...doc.data() }); });

        const savedAns = localStorage.getItem(KEY_ANS); const savedDoubt = localStorage.getItem(KEY_DOUBT);
        userAnswers = savedAns ? JSON.parse(savedAns) : new Array(questions.length).fill(null);
        doubtStatus = savedDoubt ? JSON.parse(savedDoubt) : new Array(questions.length).fill(false);

        buildGrid(); renderSoal(0); startTimer(120 * 60); 
    } catch (error) { qContainer.innerHTML = "<p style='color:red;'>Gagal memuat bank soal.</p>"; }
}

// 4. RENDER DINAMIS BERBAGAI TIPE SOAL
function renderSoal(idx) {
    currentIdx = idx; const qContainer = document.getElementById('q-container'); const q = questions[idx];
    document.getElementById('current-q-num').innerText = idx + 1; document.getElementById('badge-tipe-soal').innerText = q.tipe || 'PG';
    let html = `<div class="q-text" style="font-size: 1.1rem; margin-bottom: 25px;">${q.teks_soal}</div>`;
    
    if (q.tipe === 'PG' || !q.tipe) {
        html += `<div class="options-container" style="display: flex; flex-direction: column; gap: 12px;">`;
        ['A', 'B', 'C', 'D', 'E'].forEach(lbl => {
            if(!q.opsi || !q.opsi[lbl]) return; const isChecked = userAnswers[idx] === lbl ? 'checked' : '';
            html += `<label class="option-item ${isChecked ? 'selected' : ''}" style="display: flex; padding: 15px; border: 1.5px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer;"><input type="radio" name="soal" value="${lbl}" ${isChecked} onchange="window.saveAnswerPG(${idx}, '${lbl}')" style="margin-right: 15px; transform: scale(1.2);"><span style="font-weight: bold; margin-right: 10px;">${lbl}.</span><span>${q.opsi[lbl]}</span></label>`;
        }); html += `</div>`;
    } 
    else if (q.tipe === 'PGK') {
        html += `<div class="options-container" style="display: flex; flex-direction: column; gap: 12px;">`;
        let currentAns = userAnswers[idx] || [];
        ['A', 'B', 'C', 'D', 'E'].forEach(lbl => {
            if(!q.opsi || !q.opsi[lbl]) return; const isChecked = currentAns.includes(lbl) ? 'checked' : '';
            html += `<label class="option-item" style="display: flex; padding: 15px; border: 1.5px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer;"><input type="checkbox" class="cb_pgk_${idx}" value="${lbl}" ${isChecked} onchange="window.saveAnswerPGK(${idx})" style="margin-right: 15px; transform: scale(1.2);"><span style="font-weight: bold; margin-right: 10px;">${lbl}.</span><span>${q.opsi[lbl]}</span></label>`;
        }); html += `</div>`;
    }
    else if (q.tipe === 'Menjodohkan') {
        if(!shuffledTargetsCache[idx]) { let targets = q.pasangan.map(p => p.target); shuffledTargetsCache[idx] = targets.sort(() => Math.random() - 0.5); }
        let currentAns = userAnswers[idx] || {};
        html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
        q.pasangan.forEach((p) => {
            let selValue = currentAns[p.premis] || "";
            html += `<div style="display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);"><div style="flex: 1; font-weight: 500;">${p.premis}</div><i class="fas fa-arrow-right" style="color: var(--text-muted);"></i><select class="sel_jodoh_${idx} input-text" data-premis="${p.premis}" onchange="window.saveAnswerJodoh(${idx})" style="flex: 1;"><option value="" disabled ${!selValue ? 'selected' : ''}>-- Pilih Pasangan --</option>${shuffledTargetsCache[idx].map(t => `<option value="${t}" ${selValue === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
        }); html += `</div>`;
    }
    else if (q.tipe === 'Isian') {
        let currentAns = userAnswers[idx] || "";
        html += `<div style="margin-top: 10px;"><input type="text" id="isian_${idx}" class="input-text" value="${currentAns}" placeholder="Ketik jawaban singkat Anda di sini..." onkeyup="window.saveAnswerText(${idx}, 'isian_${idx}')" style="font-size: 1.1rem; padding: 15px;"></div>`;
    }
    else if (q.tipe === 'Uraian') {
        let currentAns = userAnswers[idx] || "";
        html += `<div style="margin-top: 10px;"><textarea id="uraian_${idx}" class="input-text" rows="6" placeholder="Ketik uraian/penjelasan lengkap Anda di sini..." onkeyup="window.saveAnswerText(${idx}, 'uraian_${idx}')" style="font-size: 1rem; padding: 15px;">${currentAns}</textarea></div>`;
    }

    qContainer.innerHTML = html; updateUI();
}

window.saveAnswerPG = (idx, val) => { userAnswers[idx] = val; simpanLokalDanUI(); };
window.saveAnswerPGK = (idx) => { let checked = Array.from(document.querySelectorAll(`.cb_pgk_${idx}:checked`)).map(cb => cb.value); userAnswers[idx] = checked.length > 0 ? checked : null; simpanLokalDanUI(); };
window.saveAnswerJodoh = (idx) => { let ans = {}; let isFilled = false; document.querySelectorAll(`.sel_jodoh_${idx}`).forEach(sel => { if(sel.value) { ans[sel.dataset.premis] = sel.value; isFilled = true; } }); userAnswers[idx] = isFilled ? ans : null; simpanLokalDanUI(); };
window.saveAnswerText = (idx, elementId) => { let val = document.getElementById(elementId).value; userAnswers[idx] = val.trim() ? val : null; simpanLokalDanUI(); };
function simpanLokalDanUI() { localStorage.setItem(KEY_ANS, JSON.stringify(userAnswers)); updateUI(); }

function updateUI() {
    document.getElementById('prev-btn').style.visibility = currentIdx === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('next-btn');
    if (currentIdx === questions.length - 1) { nextBtn.innerHTML = `SELESAI <i class="fas fa-flag-checkered"></i>`; nextBtn.classList.add('btn-finish'); } 
    else { nextBtn.innerHTML = `SELANJUTNYA <i class="fas fa-chevron-right"></i>`; nextBtn.classList.remove('btn-finish'); }

    const doubtBtn = document.getElementById('doubt-btn');
    if(doubtStatus[currentIdx]) { doubtBtn.classList.add('active'); doubtBtn.style.backgroundColor = 'var(--warning)'; doubtBtn.style.color = '#fff'; } 
    else { doubtBtn.classList.remove('active'); doubtBtn.style.backgroundColor = '#fef3c7'; doubtBtn.style.color = '#92400e'; }

    const boxes = document.querySelectorAll('.q-box');
    boxes.forEach((box, i) => {
        box.className = 'q-box';
        if (i === currentIdx) box.classList.add('active-q');
        if (doubtStatus[i]) box.classList.add('doubt'); else if (userAnswers[i]) box.classList.add('answered');
    });
}

function buildGrid() {
    const grid = document.getElementById('q-grid'); grid.innerHTML = '';
    questions.forEach((_, i) => { const box = document.createElement('div'); box.className = 'q-box'; box.innerText = i + 1; box.onclick = () => renderSoal(i); grid.appendChild(box); });
}

function startTimer(durationInSeconds) {
    let timer = durationInSeconds; const display = document.getElementById('timer');
    const interval = setInterval(() => {
        const h = Math.floor(timer / 3600), m = Math.floor((timer % 3600) / 60), s = timer % 60;
        display.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (timer <= 300) { display.style.color = 'var(--danger)'; display.classList.add('blink'); }
        if (--timer < 0) { clearInterval(interval); forceSubmitExam("Waktu Habis! Jawaban Anda dikirim secara otomatis."); }
    }, 1000);
}

document.getElementById('next-btn').onclick = () => { if (currentIdx < questions.length - 1) renderSoal(currentIdx + 1); else document.getElementById('finish-btn').click(); };
document.getElementById('prev-btn').onclick = () => { if (currentIdx > 0) renderSoal(currentIdx - 1); };
document.getElementById('doubt-btn').onclick = () => { doubtStatus[currentIdx] = !doubtStatus[currentIdx]; localStorage.setItem(KEY_DOUBT, JSON.stringify(doubtStatus)); updateUI(); };


// ==========================================
// 5. MESIN ANTI-CHEAT (PENDETEKSI PINDAH TAB)
// ==========================================

function triggerCheatWarning() {
    if (!isExamActive || isWarningShowing) return;
    
    isWarningShowing = true;
    cheatWarnings++;

    if (cheatWarnings >= MAX_CHEAT_WARNINGS) {
        forceSubmitExam("PELANGGARAN FATAL! Anda telah meninggalkan ujian atau melakukan tindakan ilegal 3 kali. Ujian dihentikan otomatis secara paksa.");
        return;
    }

    document.getElementById('cheat-count').innerText = cheatWarnings;
    document.getElementById('modal-pelanggaran').style.display = 'flex';
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'hidden' && isExamActive) { triggerCheatWarning(); }
});

window.addEventListener("blur", () => {
    if (isExamActive) { triggerCheatWarning(); }
});

document.getElementById('btn-mengerti-pelanggaran').addEventListener('click', () => {
    document.getElementById('modal-pelanggaran').style.display = 'none';
    setTimeout(() => { isWarningShowing = false; }, 1000);
});

// ==========================================
// 6. KALKULASI & SUBMIT HASIL UJIAN
// ==========================================

async function forceSubmitExam(pesanPeringatan) {
    isExamActive = false; alert(pesanPeringatan); await eksekusiKirimJawaban();
}

document.getElementById('finish-btn').onclick = async () => {
    const belumDijawab = userAnswers.filter(ans => ans === null || (typeof ans === 'object' && Object.keys(ans).length === 0)).length;
    let pesan = "Apakah Anda yakin mengakhiri ujian?";
    if(belumDijawab > 0) pesan = `Masih ada ${belumDijawab} soal kosong!\n\n` + pesan;
    
    if (!confirm(pesan)) return;

    isExamActive = false; 
    await eksekusiKirimJawaban();
};

async function eksekusiKirimJawaban() {
    const btn = document.getElementById('finish-btn'); 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENGHITUNG...'; 
    btn.disabled = true;

    let benar = 0; let rincianBenar = [];
    questions.forEach((q, i) => {
        let ans = userAnswers[i]; if(!ans) return;
        if (q.tipe === 'PG' || !q.tipe) { if(ans === q.kunci_jawaban) { benar++; rincianBenar.push(i+1); } } 
        else if (q.tipe === 'PGK') { if (Array.isArray(ans) && Array.isArray(q.kunci_jawaban)) { let isMatch = ans.length === q.kunci_jawaban.length && ans.every(val => q.kunci_jawaban.includes(val)); if (isMatch) { benar++; rincianBenar.push(i+1); } } }
        else if (q.tipe === 'Menjodohkan') { let pairsCorrect = 0; q.pasangan.forEach(kunciPair => { if(ans[kunciPair.premis] === kunciPair.target) pairsCorrect++; }); if(pairsCorrect === q.pasangan.length) { benar++; rincianBenar.push(i+1); } }
        else if (q.tipe === 'Isian') { if(typeof ans === 'string' && ans.toLowerCase().trim() === q.kunci_jawaban.toLowerCase().trim()) { benar++; rincianBenar.push(i+1); } }
    });

    let nilaiAkhir = questions.length > 0 ? Math.round((benar / questions.length) * 100) : 0;

    try {
        const user = auth.currentUser;
        await addDoc(collection(db, "hasil_ujian"), {
            userId: user?.uid || "Anonymous", 
            namaSiswa: dataNamaSiswa, 
            kelas: dataKelasSiswa, // Menyimpan pilihan kelas
            mataPelajaran: mapelTerpilih, 
            jawabanSiswa: userAnswers, 
            benar: benar,
            nilai: nilaiAkhir, 
            totalSoal: questions.length, 
            rincianBenar: rincianBenar,
            pelanggaranKecurangan: cheatWarnings, 
            waktuSelesai: new Date(), 
            status: "Selesai"
        });
        
        localStorage.removeItem(KEY_ANS); localStorage.removeItem(KEY_DOUBT);
        
        alert(`Ujian telah selesai dan jawaban Anda berhasil tersimpan. Silakan logout.`); 
        window.location.href = "index.html"; 
    } catch (error) { 
        console.error(error); 
        alert("Gagal mengirim jawaban: " + error.message); 
        isExamActive = true; 
        btn.innerHTML = '<i class="fas fa-check-double"></i> SELESAI UJIAN'; 
        btn.disabled = false; 
    }
}

// ==========================================
// 7. MESIN ANTI-COPAS & ANTI-AI
// ==========================================
document.addEventListener('contextmenu', event => { if(isExamActive) event.preventDefault(); });
document.addEventListener('copy', event => { if(isExamActive) event.preventDefault(); });
document.addEventListener('cut', event => { if(isExamActive) event.preventDefault(); });
document.addEventListener('paste', event => { if(isExamActive) event.preventDefault(); });
document.addEventListener('dragstart', event => { if(isExamActive) event.preventDefault(); });
document.addEventListener('drop', event => { if(isExamActive) event.preventDefault(); });

document.addEventListener('keydown', (e) => {
    if (!isExamActive) return;
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'C' || e.key === 'c' || e.key === 'V' || e.key === 'v' || e.key === 'P' || e.key === 'p')) ||
        (e.metaKey && (e.key === 'C' || e.key === 'c' || e.key === 'V' || e.key === 'v' || e.key === 'P' || e.key === 'p'))
    ) {
        e.preventDefault();
        triggerCheatWarning();
    }
});
