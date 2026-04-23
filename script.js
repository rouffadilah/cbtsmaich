import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let questions = [], currentIdx = 0, userAnswers = [], doubtStatus = [];
const KEY_ANS = 'cbt_jawaban_smaich', KEY_DOUBT = 'cbt_ragu_smaich';

async function initUjian() {
    // ==========================================
    // SISTEM KEAMANAN TOKEN UJIAN
    // ==========================================
    const userToken = prompt("Masukkan Token Ujian (Diberikan oleh Pengawas):");
    
    // Sesuaikan dengan token yang Anda set di Dashboard Guru
    if (userToken !== "SMAICH-26XQ") {
        alert("Token Salah atau Tidak Valid! Anda akan dialihkan ke halaman login.");
        window.location.href = "login.html"; // Pastikan index lama sudah diganti nama jadi login.html
        return;
    }

    const qContainer = document.getElementById('q-container');
    qContainer.innerHTML = "<p style='text-align:center; padding:50px;'><i class='fas fa-spinner fa-spin'></i> Memuat Soal...</p>";

    try {
        const snapshot = await getDocs(collection(db, "bank_soal"));
        if (snapshot.empty) {
            qContainer.innerHTML = "<p style='text-align:center;'>Belum ada soal tersedia di database.</p>";
            return;
        }

        snapshot.forEach(doc => {
            const d = doc.data();
            
            // Gabungkan field opsi_a s/d opsi_e menjadi satu Array
            // .filter(Boolean) berfungsi untuk membuang opsi yang kosong
            const pilihanArray = [d.opsi_a, d.opsi_b, d.opsi_c, d.opsi_d, d.opsi_e].filter(Boolean);

            questions.push({ 
                id: doc.id, 
                teks: d.teks_soal, 
                pilihan: pilihanArray, 
                kunci: d.kunci_jawaban 
            });
        });

        // Load saved progress
        const savedAns = localStorage.getItem(KEY_ANS);
        const savedDoubt = localStorage.getItem(KEY_DOUBT);
        userAnswers = savedAns ? JSON.parse(savedAns) : new Array(questions.length).fill(null);
        doubtStatus = savedDoubt ? JSON.parse(savedDoubt) : new Array(questions.length).fill(false);

        buildGrid();
        renderSoal(0);
        startTimer(120 * 60); // 120 Menit

    } catch (error) {
        console.error("Error loading soal:", error);
        qContainer.innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat soal. Periksa koneksi atau rules Firestore.</p>`;
    }
}

function renderSoal(idx) {
    currentIdx = idx;
    const qContainer = document.getElementById('q-container');
    const q = questions[idx];

    let html = `
        <div class="question-header">
            <span class="q-number">Soal No. ${idx + 1}</span>
        </div>
        <div class="q-text">${q.teks}</div>
        <div class="options-container">
    `;

    const labels = ['A', 'B', 'C', 'D', 'E'];
    q.pilihan.forEach((opt, i) => {
        const isChecked = userAnswers[idx] === labels[i] ? 'checked' : '';
        html += `
            <label class="option-item ${isChecked ? 'selected' : ''}">
                <input type="radio" name="soal" value="${labels[i]}" ${isChecked} onchange="saveAnswer(${idx}, '${labels[i]}')">
                <span class="opt-label">${labels[i]}</span>
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
    
    // Highlight jawaban yang dipilih
    document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
    document.querySelector(`input[value="${val}"]`).parentElement.classList.add('selected');
    
    updateUI();
};

function updateUI() {
    // Tombol Navigasi
    document.getElementById('prev-btn').style.visibility = currentIdx === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('next-btn');
    if (currentIdx === questions.length - 1) {
        nextBtn.innerHTML = `SELESAI <i class="fas fa-flag-checkered"></i>`;
        nextBtn.classList.add('btn-finish');
    } else {
        nextBtn.innerHTML = `SELANJUTNYA <i class="fas fa-chevron-right"></i>`;
        nextBtn.classList.remove('btn-finish');
    }

    // Tombol Ragu
    const doubtBtn = document.getElementById('doubt-btn');
    doubtBtn.className = `nav-btn btn-doubt ${doubtStatus[currentIdx] ? 'active' : ''}`;

    // Grid Update
    const boxes = document.querySelectorAll('.num-box');
    boxes.forEach((box, i) => {
        box.className = 'num-box';
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
        box.className = 'num-box';
        box.innerText = i + 1;
        box.onclick = () => renderSoal(i);
        grid.appendChild(box);
    });
}

// ==========================================
// PENGATURAN WAKTU (TIMER)
// ==========================================
function startTimer(durationInSeconds) {
    let timer = durationInSeconds;
    const display = document.getElementById('timer');
    
    const interval = setInterval(() => {
        const h = Math.floor(timer / 3600);
        const m = Math.floor((timer % 3600) / 60);
        const s = timer % 60;

        display.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        if (timer <= 300) {
            display.style.color = 'var(--danger)'; // Peringatan 5 menit terakhir
            display.classList.add('blink');
        }

        if (--timer < 0) {
            clearInterval(interval);
            alert("Waktu Habis! Jawaban Anda akan dikumpulkan otomatis.");
            document.getElementById('finish-btn').click();
        }
    }, 1000);
}

// ==========================================
// EVENT LISTENERS NAVIGASI & SUBMIT
// ==========================================
document.getElementById('next-btn').onclick = () => currentIdx < questions.length - 1 ? renderSoal(currentIdx + 1) : document.getElementById('finish-btn').click();
document.getElementById('prev-btn').onclick = () => currentIdx > 0 && renderSoal(currentIdx - 1);
document.getElementById('doubt-btn').onclick = () => {
    doubtStatus[currentIdx] = !doubtStatus[currentIdx];
    localStorage.setItem(KEY_DOUBT, JSON.stringify(doubtStatus));
    updateUI();
};

document.getElementById('finish-btn').onclick = async () => {
    if (!confirm("Apakah Anda yakin ingin mengakhiri ujian? Jawaban tidak dapat diubah lagi.")) return;
    try {
        const user = auth.currentUser;
        await addDoc(collection(db, "hasil_ujian"), {
            userId: user?.uid || "Anonymous", 
            namaSiswa: user?.displayName || "Siswa",
            jawabanSiswa: userAnswers, 
            waktuSelesai: new Date(), 
            status: "Selesai"
        });
        
        // Bersihkan cache jawaban setelah selesai
        localStorage.removeItem(KEY_ANS); 
        localStorage.removeItem(KEY_DOUBT);
        
        alert("Jawaban berhasil dikirim. Terima kasih!");
        window.location.href = "login.html"; 
    } catch (error) {
        console.error(error);
        alert("Gagal mengirim jawaban! Pastikan Anda terhubung ke internet.");
    }
};

// ==========================================
// INISIALISASI SAAT HALAMAN DIMUAT
// ==========================================
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('student-name').innerText = user.displayName || user.email.split('@')[0];
        initUjian();
    } else {
        window.location.href = "login.html"; // Redirect jika belum login
    }
});