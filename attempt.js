import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Variabel Global
let questions = []; let currentIdx = 0; let userAnswers = []; let doubtStatus = []; let mapelTerpilih = ""; 
let dataKelasSiswa = "-"; // Tambahan variabel untuk menyimpan Kelas siswa
const KEY_ANS = 'cbt_jawaban_smaich'; const KEY_DOUBT = 'cbt_ragu_smaich';

// 1. PENGECEKAN STATUS LOGIN SAAT HALAMAN DIMUAT LALU LOAD MAPEL
auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    document.getElementById('student-name').innerText = user.displayName || user.email.split('@')[0];
    
    try {
        // Ambil Data Kelas dari Profil Siswa
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if(userDoc.exists() && userDoc.data().kelas) dataKelasSiswa = userDoc.data().kelas;

        // Ambil Daftar Mapel dari Data Master Admin
        const masterDoc = await getDoc(doc(db, "pengaturan", "data_akademik"));
        if(masterDoc.exists() && masterDoc.data().list_mapel) {
            const selectMapel = document.getElementById('select-mapel');
            selectMapel.innerHTML = '<option value="" disabled selected>-- Pilih Mata Pelajaran --</option>' +
                masterDoc.data().list_mapel.map(m => `<option value="${m}">${m}</option>`).join('');
        }
    } catch(e) { console.error("Gagal load data awal", e); }
});

// 2. LOGIKA VALIDASI TOKEN BERDASARKAN MAPEL
const preExamSection = document.getElementById('pre-exam-section');
const mainExamLayout = document.getElementById('main-exam-layout');
const btnVerifikasi = document.getElementById('btn-verifikasi');
const tokenError = document.getElementById('token-error');

btnVerifikasi.addEventListener('click', async () => {
    const inputToken = document.getElementById('input-token').value.trim().toUpperCase();
    const selectMapel = document.getElementById('select-mapel').value;

    if (!selectMapel || !inputToken) return alert("Pilih mata pelajaran dan masukkan Token!");

    const originalText = btnVerifikasi.innerHTML;
    btnVerifikasi.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMVALIDASI...'; btnVerifikasi.disabled = true; tokenError.style.display = 'none';

    try {
        const pengaturanSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        let tokenAktif = (pengaturanSnap.exists() && pengaturanSnap.data()[`token_${selectMapel}`]) ? pengaturanSnap.data()[`token_${selectMapel}`] : null;

        if (!tokenAktif || inputToken !== tokenAktif) {
            tokenError.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Token tidak valid atau salah!';
            tokenError.style.display = 'block'; btnVerifikasi.innerHTML = originalText; btnVerifikasi.disabled = false;
            return;
        }

        mapelTerpilih = selectMapel; preExamSection.style.display = 'none'; mainExamLayout.style.display = 'grid'; 
        initUjian(); 
    } catch (error) { alert("Gagal memvalidasi token."); btnVerifikasi.innerHTML = originalText; btnVerifikasi.disabled = false; }
});

// 3. MEMUAT BANK SOAL DARI FIREBASE (Hanya mapel yang dipilih)
async function initUjian() {
    const qContainer = document.getElementById('q-container');
    qContainer.innerHTML = `<div style='text-align:center; padding:50px;'><i class='fas fa-spinner fa-spin fa-2x'></i><p>Memuat Soal ${mapelTerpilih}...</p></div>`;

    try {
        const snapshot = await getDocs(collection(db, "bank_soal"));
        snapshot.forEach(doc => {
            const d = doc.data();
            // FILTER: Hanya masukkan soal yang nama mapel-nya SAMA
            if (d.mataPelajaran === mapelTerpilih) {
                const pilihanArray = [d.opsi_a, d.opsi_b, d.opsi_c, d.opsi_d, d.opsi_e].filter(Boolean);
                questions.push({ id: doc.id, teks: d.teks_soal, pilihan: pilihanArray, kunci: d.kunci_jawaban });
            }
        });

        if (questions.length === 0) { qContainer.innerHTML = "<p style='text-align:center; color:red;'>Belum ada soal untuk mapel ini.</p>"; return; }

        const savedAns = localStorage.getItem(KEY_ANS); const savedDoubt = localStorage.getItem(KEY_DOUBT);
        userAnswers = savedAns ? JSON.parse(savedAns) : new Array(questions.length).fill(null);
        doubtStatus = savedDoubt ? JSON.parse(savedDoubt) : new Array(questions.length).fill(false);

        buildGrid(); renderSoal(0); startTimer(120 * 60); 
    } catch (error) { qContainer.innerHTML = "<p style='color:red;'>Gagal memuat bank soal.</p>"; }
}

// 4. MERENDER SOAL & UI (Sama seperti sebelumnya, diringkas)
function renderSoal(idx) {
    currentIdx = idx; const q = questions[idx]; document.getElementById('current-q-num').innerText = idx + 1;
    let html = `<div class="q-text" style="font-size: 1.1rem; margin-bottom: 25px;">${q.teks}</div><div class="options-container" style="display: flex; flex-direction: column; gap: 12px;">`;
    const labels = ['A', 'B', 'C', 'D', 'E'];
    q.pilihan.forEach((opt, i) => {
        const isChecked = userAnswers[idx] === labels[i] ? 'checked' : '';
        html += `<label class="option-item ${isChecked ? 'selected' : ''}" style="display: flex; align-items: flex-start; padding: 15px; border: 1.5px solid var(--border-color); border-radius: 8px; cursor: pointer;">
                <input type="radio" name="soal" value="${labels[i]}" ${isChecked} onchange="saveAnswer(${idx}, '${labels[i]}')" style="margin-right: 15px;">
                <span style="font-weight: bold; margin-right: 10px;">${labels[i]}.</span><span>${opt}</span></label>`;
    });
    html += `</div>`; document.getElementById('q-container').innerHTML = html; updateUI();
}

window.saveAnswer = (idx, val) => {
    userAnswers[idx] = val; localStorage.setItem(KEY_ANS, JSON.stringify(userAnswers));
    document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected', 'active-border'));
    const selInput = document.querySelector(`input[value="${val}"]`);
    if(selInput) { selInput.parentElement.classList.add('selected'); selInput.parentElement.style.borderColor = 'var(--primary)'; selInput.parentElement.style.backgroundColor = 'var(--primary-light)'; }
    updateUI();
};

function updateUI() {
    document.getElementById('prev-btn').style.visibility = currentIdx === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('next-btn');
    if (currentIdx === questions.length - 1) { nextBtn.innerHTML = `SELESAI <i class="fas fa-flag-checkered"></i>`; nextBtn.classList.add('btn-finish'); } 
    else { nextBtn.innerHTML = `SELANJUTNYA <i class="fas fa-chevron-right"></i>`; nextBtn.classList.remove('btn-finish'); }
    
    const dbBtn = document.getElementById('doubt-btn');
    if(doubtStatus[currentIdx]) { dbBtn.classList.add('active'); dbBtn.style.backgroundColor = 'var(--warning)'; dbBtn.style.color = '#fff'; } 
    else { dbBtn.classList.remove('active'); dbBtn.style.backgroundColor = '#fef3c7'; dbBtn.style.color = '#92400e'; }

    document.querySelectorAll('.q-box').forEach((box, i) => {
        box.className = 'q-box';
        if (i === currentIdx) box.classList.add('active-q');
        if (doubtStatus[i]) box.classList.add('doubt'); else if (userAnswers[i]) box.classList.add('answered');
    });
}

function buildGrid() {
    const grid = document.getElementById('q-grid'); grid.innerHTML = '';
    questions.forEach((_, i) => {
        const box = document.createElement('div'); box.className = 'q-box'; box.innerText = i + 1;
        box.onclick = () => renderSoal(i); grid.appendChild(box);
    });
}

function startTimer(duration) {
    let timer = duration; const display = document.getElementById('timer');
    const interval = setInterval(() => {
        const h = Math.floor(timer / 3600), m = Math.floor((timer % 3600) / 60), s = timer % 60;
        display.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (timer <= 300) { display.style.color = 'var(--danger)'; display.classList.add('blink'); }
        if (--timer < 0) { clearInterval(interval); alert("Waktu Habis!"); document.getElementById('finish-btn').click(); }
    }, 1000);
}

document.getElementById('next-btn').onclick = () => { if (currentIdx < questions.length - 1) renderSoal(currentIdx + 1); else document.getElementById('finish-btn').click(); };
document.getElementById('prev-btn').onclick = () => { if (currentIdx > 0) renderSoal(currentIdx - 1); };
document.getElementById('doubt-btn').onclick = () => { doubtStatus[currentIdx] = !doubtStatus[currentIdx]; localStorage.setItem(KEY_DOUBT, JSON.stringify(doubtStatus)); updateUI(); };

// 5. MENGIRIM JAWABAN (DENGAN MENYERTAKAN DATA KELAS)
document.getElementById('finish-btn').onclick = async () => {
    const belumDijawab = userAnswers.filter(ans => ans === null).length;
    let msg = "Apakah Anda yakin ingin mengakhiri ujian?";
    if(belumDijawab > 0) msg = `Masih ada ${belumDijawab} soal kosong!\n\n` + msg;
    if (!confirm(msg)) return;

    try {
        const btn = document.getElementById('finish-btn'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENGIRIM...'; btn.disabled = true;

        // KALKULASI NILAI (PG SAJA)
        let benar = 0; let rincianBenar = [];
        questions.forEach((q, i) => { if(userAnswers[i] === q.kunci) { benar++; rincianBenar.push(i+1); } });
        let nilaiAkhir = questions.length > 0 ? Math.round((benar / questions.length) * 100) : 0;

        const user = auth.currentUser;
        await addDoc(collection(db, "hasil_ujian"), {
            userId: user?.uid || "Anonymous", 
            namaSiswa: user?.displayName || "Siswa",
            kelas: dataKelasSiswa, // Menyimpan Kelas yang diatur Admin
            mataPelajaran: mapelTerpilih, 
            jawabanSiswa: userAnswers, 
            benar: benar,
            nilai: nilaiAkhir,
            totalSoal: questions.length,
            rincianBenar: rincianBenar,
            waktuSelesai: new Date(), 
            status: "Selesai"
        });
        
        localStorage.removeItem(KEY_ANS); localStorage.removeItem(KEY_DOUBT);
        alert(`Ujian selesai. Nilai Akhir: ${nilaiAkhir}`); window.location.href = "index.html"; 
    } catch (error) { alert("Gagal mengirim jawaban!"); }
};
