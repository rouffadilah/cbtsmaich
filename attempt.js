import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Variabel Global
let questions = [];
let currentIdx = 0;
let userAnswers = [];
let doubtStatus = [];
let mapelTerpilih = ""; 

const KEY_ANS = 'cbt_jawaban_smaich';
const KEY_DOUBT = 'cbt_ragu_smaich';

// 1. Validasi Token
const preExamSection = document.getElementById('pre-exam-section');
const mainExamLayout = document.getElementById('main-exam-layout');
const btnVerifikasi = document.getElementById('btn-verifikasi');
const tokenError = document.getElementById('token-error');

btnVerifikasi.addEventListener('click', async () => {
    const inputToken = document.getElementById('input-token').value.trim().toUpperCase();
    const selectMapel = document.getElementById('select-mapel').value;

    if (!selectMapel || !inputToken) return alert("Pilih mapel dan masukkan token!");

    btnVerifikasi.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMVALIDASI...';
    btnVerifikasi.disabled = true;
    tokenError.style.display = 'none';

    try {
        const pengaturanSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        let tokenAktif = pengaturanSnap.exists() ? pengaturanSnap.data()[`token_${selectMapel}`] : null;

        if (!tokenAktif || inputToken !== tokenAktif) {
            tokenError.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Token salah atau belum diaktifkan Guru!';
            tokenError.style.display = 'block';
            btnVerifikasi.innerHTML = '<i class="fas fa-key"></i> VERIFIKASI & MULAI';
            btnVerifikasi.disabled = false;
            return;
        }

        mapelTerpilih = selectMapel;
        preExamSection.style.display = 'none';
        mainExamLayout.style.display = 'grid'; 
        initUjian(); 

    } catch (error) {
        console.error(error);
        alert("Gagal memvalidasi token.");
        btnVerifikasi.disabled = false;
    }
});

// 2. Memuat Soal Berdasarkan Mapel
async function initUjian() {
    const qContainer = document.getElementById('q-container');
    
    try {
        // PERUBAHAN: Hanya ambil soal yang mapelnya cocok
        const qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapelTerpilih));
        const snapshot = await getDocs(qSoal);
        
        if (snapshot.empty) {
            qContainer.innerHTML = "<p style='text-align:center; color: red;'>Belum ada soal tersedia untuk mapel ini.</p>";
            return;
        }

        snapshot.forEach(doc => {
            const d = doc.data();
            const pilihanArray = [d.opsi_a, d.opsi_b, d.opsi_c, d.opsi_d, d.opsi_e].filter(Boolean);
            questions.push({ id: doc.id, teks: d.teks_soal, pilihan: pilihanArray, kunci: d.kunci_jawaban });
        });

        const savedAns = localStorage.getItem(KEY_ANS);
        const savedDoubt = localStorage.getItem(KEY_DOUBT);
        userAnswers = savedAns ? JSON.parse(savedAns) : new Array(questions.length).fill(null);
        doubtStatus = savedDoubt ? JSON.parse(savedDoubt) : new Array(questions.length).fill(false);

        buildGrid();
        renderSoal(0);
        startTimer(120 * 60); 

    } catch (error) {
        console.error(error);
        qContainer.innerHTML = "<p style='text-align:center; color:red;'>Gagal memuat bank soal.</p>";
    }
}

// 3. Merender Soal UI
function renderSoal(idx) {
    currentIdx = idx;
    const qContainer = document.getElementById('q-container');
    const q = questions[idx];
    document.getElementById('current-q-num').innerText = idx + 1;

    let html = `<div class="q-text" style="font-size: 1.1rem; margin-bottom: 25px;">${q.teks}</div><div class="options-container" style="display: flex; flex-direction: column; gap: 12px;">`;
    const labels = ['A', 'B', 'C', 'D', 'E'];
    
    q.pilihan.forEach((opt, i) => {
        const isChecked = userAnswers[idx] === labels[i] ? 'checked' : '';
        html += `
            <label class="option-item ${isChecked ? 'selected' : ''}" style="display: flex; align-items: flex-start; padding: 15px; border: 1.5px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: var(--transition);">
                <input type="radio" name="soal" value="${labels[i]}" ${isChecked} onchange="saveAnswer(${idx}, '${labels[i]}')" style="margin-top: 4px; margin-right: 15px; transform: scale(1.2);">
                <span class="opt-label" style="font-weight: bold; margin-right: 10px;">${labels[i]}.</span>
                <span class="opt-text">${opt}</span>
            </label>
        `;
    });
    html += `</div>`;
    qContainer.innerHTML = html;
    updateUI();
}

window.saveAnswer = (idx, val) => {
    userAnswers[idx] = val;
    localStorage.setItem(KEY_ANS, JSON.stringify(userAnswers));
    document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected', 'active-border'));
    const selectedInput = document.querySelector(`input[value="${val}"]`);
    if(selectedInput) {
        selectedInput.parentElement.classList.add('selected');
        selectedInput.parentElement.style.borderColor = 'var(--primary)';
        selectedInput.parentElement.style.backgroundColor = 'var(--primary-light)';
    }
    updateUI();
};

function updateUI() {
    document.getElementById('prev-btn').style.visibility = currentIdx === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('next-btn');
    if (currentIdx === questions.length - 1) {
        nextBtn.innerHTML = `SELESAI <i class="fas fa-flag-checkered"></i>`;
        nextBtn.classList.add('btn-finish');
    } else {
        nextBtn.innerHTML = `SELANJUTNYA <i class="fas fa-chevron-right"></i>`;
        nextBtn.classList.remove('btn-finish');
    }

    const doubtBtn = document.getElementById('doubt-btn');
    if(doubtStatus[currentIdx]) {
        doubtBtn.classList.add('active'); doubtBtn.style.backgroundColor = 'var(--warning)'; doubtBtn.style.color = '#fff';
    } else {
        doubtBtn.classList.remove('active'); doubtBtn.style.backgroundColor = '#fef3c7'; doubtBtn.style.color = '#92400e';
    }

    const boxes = document.querySelectorAll('.q-box');
    boxes.forEach((box, i) => {
        box.className = 'q-box';
        if (i === currentIdx) box.classList.add('active-q');
        if (doubtStatus[i]) box.classList.add('doubt');
        else if (userAnswers[i]) box.classList.add('answered');
    });
}

function buildGrid() {
    const grid = document.getElementById('q-grid');
    grid.innerHTML = '';
    questions.forEach((_, i) => {
        const box = document.createElement('div');
        box.className = 'q-box';
        box.innerText = i + 1;
        box.onclick = () => renderSoal(i);
        grid.appendChild(box);
    });
}

// 4. Timer
function startTimer(durationInSeconds) {
    let timer = durationInSeconds;
    const display = document.getElementById('timer');
    const interval = setInterval(() => {
        const h = Math.floor(timer / 3600), m = Math.floor((timer % 3600) / 60), s = timer % 60;
        display.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (timer <= 300) { display.style.color = 'var(--danger)'; display.classList.add('blink'); }
        if (--timer < 0) {
            clearInterval(interval);
            alert("Waktu Habis! Jawaban Anda akan dikumpulkan otomatis.");
            document.getElementById('finish-btn').click();
        }
    }, 1000);
}

// 5. Event Listeners Aksi
document.getElementById('next-btn').onclick = () => { if (currentIdx < questions.length - 1) renderSoal(currentIdx + 1); else document.getElementById('finish-btn').click(); };
document.getElementById('prev-btn').onclick = () => { if (currentIdx > 0) renderSoal(currentIdx - 1); };
document.getElementById('doubt-btn').onclick = () => { doubtStatus[currentIdx] = !doubtStatus[currentIdx]; localStorage.setItem(KEY_DOUBT, JSON.stringify(doubtStatus)); updateUI(); };

// 6. Submit & Kalkulasi Nilai
document.getElementById('finish-btn').onclick = async () => {
    const belumDijawab = userAnswers.filter(ans => ans === null).length;
    let pesan = "Apakah Anda yakin mengakhiri ujian?";
    if(belumDijawab > 0) pesan = `PERINGATAN: Masih ada ${belumDijawab} soal kosong!\n\n` + pesan;
    if (!confirm(pesan)) return;

    const btn = document.getElementById('finish-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENGHITUNG NILAI...';
    btn.disabled = true;

    // PERUBAHAN: Hitung Skor!
    let benar = 0;
    let rincianBenar = [];
    questions.forEach((q, i) => {
        if(userAnswers[i] === q.kunci) {
            benar++;
            rincianBenar.push(i+1);
        }
    });
    let nilaiAkhir = questions.length > 0 ? Math.round((benar / questions.length) * 100) : 0;
    let salah = questions.length - benar;

    try {
        const user = auth.currentUser;
        await addDoc(collection(db, "hasil_ujian"), {
            userId: user?.uid || "Anonymous", 
            namaSiswa: user?.displayName || "Siswa",
            mataPelajaran: mapelTerpilih, 
            jawabanSiswa: userAnswers,
            benar: benar,
            salah: salah,
            nilai: nilaiAkhir,
            totalSoal: questions.length,
            rincianBenar: rincianBenar,
            waktuSelesai: new Date(), 
            status: "Selesai"
        });
        
        localStorage.removeItem(KEY_ANS); 
        localStorage.removeItem(KEY_DOUBT);
        
        alert(`Ujian selesai! Nilai kamu: ${nilaiAkhir}`);
        window.location.href = "index.html"; 
    } catch (error) {
        console.error(error);
        alert("Gagal mengirim jawaban: " + error.message);
        btn.innerHTML = '<i class="fas fa-check-double"></i> SELESAI UJIAN';
        btn.disabled = false;
    }
};

// 7. Cek Login
auth.onAuthStateChanged(user => {
    if (user) { document.getElementById('student-name').innerText = user.displayName || user.email.split('@')[0]; }
    else { window.location.href = "index.html"; }
});
