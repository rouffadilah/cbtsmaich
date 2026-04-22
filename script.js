import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// State Global
let questions = []; // Akan diisi dari database
let currentQuestionIndex = 0;
let userAnswers = [];
let doubtStatus = [];

const STORAGE_KEY = 'cbt_jawaban_smaich';
const DOUBT_KEY = 'cbt_ragu_smaich';

// 1. FUNGSI AMBIL DATA DARI FIREBASE
async function fetchQuestions() {
    const qContainer = document.getElementById('q-container');
    qContainer.innerHTML = "<p style='text-align:center; padding:50px;'>Memuat Soal Ujian...</p>";

    try {
        const querySnapshot = await getDocs(collection(db, "bank_soal"));
        
        if (querySnapshot.empty) {
            qContainer.innerHTML = "<p style='text-align:center; padding:50px; color:red;'>Belum ada soal tersedia di database.</p>";
            return;
        }

        // Masukkan data dari Firebase ke array questions
        questions = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            questions.push({
                id: doc.id,
                type: data.tipe,
                label: data.tipe === "mcq" ? "Pilihan Ganda" : "Soal",
                text: data.pertanyaan,
                options: data.pilihan, // Array [A, B, C, D, E]
                correct: data.kunciJawaban
            });
        });

        // Inisialisasi Jawaban & Status Ragu (Ambil dari LocalStorage jika ada)
        const savedAnswers = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const savedDoubt = JSON.parse(localStorage.getItem(DOUBT_KEY));

        userAnswers = savedAnswers || Array(questions.length).fill(null);
        doubtStatus = savedDoubt || Array(questions.length).fill(false);

        // Render soal pertama
        renderQuestion(0);
        renderSidebarNav();

    } catch (error) {
        console.error("Gagal mengambil soal:", error);
        qContainer.innerHTML = "<p style='text-align:center; color:red;'>Koneksi Gagal. Silakan refresh halaman.</p>";
    }
}

// 2. RENDER UI SOAL
function renderQuestion(index) {
    if (questions.length === 0) return;
    
    const q = questions[index];
    const container = document.getElementById('q-container');
    
    container.innerHTML = `
        <span class="q-header">SOAL NOMOR ${index + 1}</span>
        <span class="q-type-badge">${q.label}</span>
        <div class="q-text">${q.text}</div>
        <div class="options-list" id="options-list"></div>
    `;

    const optList = document.getElementById('options-list');
    q.options.forEach((opt, i) => {
        const char = String.fromCharCode(65 + i);
        const item = document.createElement('div');
        item.className = `option-item ${userAnswers[index] === char ? 'selected' : ''}`;
        item.innerHTML = `<div class="opt-label">${char}</div><span>${opt}</span>`;
        item.onclick = () => selectOption(index, char);
        optList.appendChild(item);
    });

    updateNavButtons();
    renderSidebarNav();
}

function selectOption(index, val) {
    userAnswers[index] = val;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userAnswers));
    renderQuestion(index);
}

// 3. NAVIGASI
function updateNavButtons() {
    document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;
    document.getElementById('next-btn').innerText = currentQuestionIndex === questions.length - 1 ? "Selesai" : "Lanjut";
    
    const doubtBtn = document.getElementById('doubt-btn');
    if (doubtStatus[currentQuestionIndex]) doubtBtn.classList.add('active');
    else doubtBtn.classList.remove('active');
}

function renderSidebarNav() {
    const grid = document.getElementById('q-grid');
    grid.innerHTML = '';
    questions.forEach((_, i) => {
        const box = document.createElement('div');
        box.className = `num-box ${i === currentQuestionIndex ? 'active-q' : ''} ${doubtStatus[i] ? 'doubt' : (userAnswers[i] ? 'answered' : '')}`;
        box.innerText = i + 1;
        box.onclick = () => { currentQuestionIndex = i; renderQuestion(i); };
        grid.appendChild(box);
    });
}

// 4. KIRIM JAWABAN (FINISH)
document.getElementById('finish-btn').onclick = async () => {
    const confirmFinish = confirm("Apakah Anda yakin ingin mengakhiri ujian?");
    if (!confirmFinish) return;

    try {
        const user = auth.currentUser;
        // Simpan hasil ke koleksi "hasil_ujian"
        await addDoc(collection(db, "hasil_ujian"), {
            userId: user ? user.uid : "Anonymous",
            namaSiswa: user ? user.displayName : "Siswa",
            jawabanSiswa: userAnswers,
            waktuSelesai: new Date(),
            status: "Selesai"
        });

        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(DOUBT_KEY);
        alert("Jawaban berhasil dikirim!");
        window.location.href = "index.html";
    } catch (e) {
        alert("Gagal mengirim jawaban. Cek koneksi.");
    }
};

// Event Navigasi Tombol
document.getElementById('next-btn').onclick = () => {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion(currentQuestionIndex);
    } else {
        document.getElementById('finish-btn').click();
    }
};

document.getElementById('prev-btn').onclick = () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion(currentQuestionIndex);
    }
};

document.getElementById('doubt-btn').onclick = () => {
    doubtStatus[currentQuestionIndex] = !doubtStatus[currentQuestionIndex];
    localStorage.setItem(DOUBT_KEY, JSON.stringify(doubtStatus));
    renderQuestion(currentQuestionIndex);
};

// Jalankan pengambilan data saat startup
fetchQuestions();
