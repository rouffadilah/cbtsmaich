import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Variabel Global
let questions = [];
let currentIdx = 0;
let userAnswers = [];
let doubtStatus = [];
let mapelTerpilih = ""; // Menyimpan mata pelajaran yang dipilih siswa

const KEY_ANS = 'cbt_jawaban_smaich';
const KEY_DOUBT = 'cbt_ragu_smaich';

// ==========================================
// 1. LOGIKA VALIDASI TOKEN & MAPEL
// ==========================================
const preExamSection = document.getElementById('pre-exam-section');
const mainExamLayout = document.getElementById('main-exam-layout');
const btnVerifikasi = document.getElementById('btn-verifikasi');
const tokenError = document.getElementById('token-error');

btnVerifikasi.addEventListener('click', async () => {
    const inputToken = document.getElementById('input-token').value.trim().toUpperCase();
    const selectMapel = document.getElementById('select-mapel').value;

    if (!selectMapel) {
        alert("Silakan pilih mata pelajaran terlebih dahulu!");
        return;
    }

    if (!inputToken) {
        alert("Token ujian tidak boleh kosong!");
        return;
    }

    // Ubah UI tombol menjadi mode loading
    const originalText = btnVerifikasi.innerHTML;
    btnVerifikasi.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMVALIDASI...';
    btnVerifikasi.disabled = true;
    tokenError.style.display = 'none';

    try {
        // Ambil token aktif dari database Firestore
        const pengaturanRef = doc(db, "pengaturan", "token_ujian");
        const pengaturanSnap = await getDoc(pengaturanRef);
        
        let tokenAktif = "SMAICH-26XQ"; // Token default jika database gagal dibaca
        if (pengaturanSnap.exists() && pengaturanSnap.data().token_aktif) {
            tokenAktif = pengaturanSnap.data().token_aktif;
        }

        // Cek kecocokan token
        if (inputToken !== tokenAktif) {
            tokenError.style.display = 'block';
            btnVerifikasi.innerHTML = originalText;
            btnVerifikasi.disabled = false;
            return;
        }

        // Jika token benar: simpan mapel, sembunyikan form persiapan, dan tampilkan UI ujian
        mapelTerpilih = selectMapel;
        preExamSection.style.display = 'none';
        mainExamLayout.style.display = 'grid'; // Menggunakan grid sesuai CSS layout ujian
        
        // Mulai muat soal dari database
        initUjian(); 

    } catch (error) {
        console.error("Error validasi token:", error);
        alert("Terjadi kesalahan sistem saat memvalidasi token. Pastikan internet Anda stabil.");
        btnVerifikasi.innerHTML = originalText;
        btnVerifikasi.disabled = false;
    }
});

// ==========================================
// 2. MEMUAT BANK SOAL DARI FIREBASE
// ==========================================
async function initUjian() {
    const qContainer = document.getElementById('q-container');
    qContainer.innerHTML = `
        <div style='text-align:center; padding:50px; color: var(--text-muted);'>
            <i class='fas fa-spinner fa-spin fa-2x'></i>
            <p style='margin-top:15px;'>Memuat Soal ${mapelTerpilih.toUpperCase()}...</p>
        </div>
    `;

    try {
        const snapshot = await getDocs(collection(db, "bank_soal"));
        if (snapshot.empty) {
            qContainer.innerHTML = "<p style='text-align:center;'>Belum ada soal tersedia di database untuk saat ini.</p>";
            return;
        }

        // Memasukkan data soal dari Firestore ke dalam array
        snapshot.forEach(doc => {
            const d = doc.data();
            const pilihanArray = [d.opsi_a, d.opsi_b, d.opsi_c, d.opsi_d, d.opsi_e].filter(Boolean);

            questions.push({  
                id: doc.id, 
                teks: d.teks_soal, 
                pilihan: pilihanArray, 
                kunci: d.kunci_jawaban 
            });
        });

        // Memuat progress jawaban sebelumnya (jika siswa ter-refresh/keluar tidak sengaja)
        const savedAns = localStorage.getItem(KEY_ANS);
        const savedDoubt = localStorage.getItem(KEY_DOUBT);
        
        userAnswers = savedAns ? JSON.parse(savedAns) : new Array(questions.length).fill(null);
        doubtStatus = savedDoubt ? JSON.parse(savedDoubt) : new Array(questions.length).fill(false);

        // Render UI awal
        buildGrid();
        renderSoal(0);
        startTimer(120 * 60); // Set waktu: 120 Menit (dalam detik)

    } catch (error) {
        console.error("Error loading soal:", error);
        qContainer.innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat ujian. Periksa koneksi internet atau rules Firestore Anda.</p>`;
    }
}

// ==========================================
// 3. MERENDER SOAL & MEMPERBARUI ANTARMUKA (UI)
// ==========================================
function renderSoal(idx) {
    currentIdx = idx;
    const qContainer = document.getElementById('q-container');
    const q = questions[idx];

    // Update nomor soal di header card
    document.getElementById('current-q-num').innerText = idx + 1;

    let html = `
        <div class="q-text" style="font-size: 1.1rem; margin-bottom: 25px;">${q.teks}</div>
        <div class="options-container" style="display: flex; flex-direction: column; gap: 12px;">
    `;

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
    
    // Highlight jawaban yang dipilih secara visual
    document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected', 'active-border'));
    const selectedInput = document.querySelector(`input[value="${val}"]`);
    if(selectedInput) {
        selectedInput.parentElement.classList.add('selected');
        // Tambahkan inline styling langsung jika kelas CSS belum menangani active state dengan baik
        selectedInput.parentElement.style.borderColor = 'var(--primary)';
        selectedInput.parentElement.style.backgroundColor = 'var(--primary-light)';
    }
    
    updateUI();
};

function updateUI() {
    // Pengaturan visibilitas Tombol Navigasi
    document.getElementById('prev-btn').style.visibility = currentIdx === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('next-btn');
    
    if (currentIdx === questions.length - 1) {
        nextBtn.innerHTML = `SELESAI <i class="fas fa-flag-checkered"></i>`;
        nextBtn.classList.add('btn-finish');
    } else {
        nextBtn.innerHTML = `SELANJUTNYA <i class="fas fa-chevron-right"></i>`;
        nextBtn.classList.remove('btn-finish');
    }

    // Status Tombol Ragu-Ragu
    const doubtBtn = document.getElementById('doubt-btn');
    if(doubtStatus[currentIdx]) {
        doubtBtn.classList.add('active');
        doubtBtn.style.backgroundColor = 'var(--warning)';
        doubtBtn.style.color = '#fff';
    } else {
        doubtBtn.classList.remove('active');
        doubtBtn.style.backgroundColor = '#fef3c7'; // Default styling
        doubtBtn.style.color = '#92400e';
    }

    // Pembaruan Grid Navigasi Soal Kanan
    const boxes = document.querySelectorAll('.q-box');
    boxes.forEach((box, i) => {
        // Reset class ke default dulu
        box.className = 'q-box';
        
        // Tambahkan class sesuai status
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

// ==========================================
// 4. PENGATURAN WAKTU (TIMER)
// ==========================================
function startTimer(durationInSeconds) {
    let timer = durationInSeconds;
    const display = document.getElementById('timer');
    
    const interval = setInterval(() => {
        const h = Math.floor(timer / 3600);
        const m = Math.floor((timer % 3600) / 60);
        const s = timer % 60;

        display.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        // Peringatan 5 menit terakhir (300 detik)
        if (timer <= 300) {
            display.style.color = 'var(--danger)'; 
            display.classList.add('blink');
        }

        // Waktu habis
        if (--timer < 0) {
            clearInterval(interval);
            alert("Waktu Habis! Jawaban Anda akan dikumpulkan secara otomatis.");
            document.getElementById('finish-btn').click();
        }
    }, 1000);
}

// ==========================================
// 5. EVENT LISTENERS TOMBOL AKSI
// ==========================================
document.getElementById('next-btn').onclick = () => {
    if (currentIdx < questions.length - 1) {
        renderSoal(currentIdx + 1);
    } else {
        document.getElementById('finish-btn').click();
    }
};

document.getElementById('prev-btn').onclick = () => {
    if (currentIdx > 0) renderSoal(currentIdx - 1);
};

document.getElementById('doubt-btn').onclick = () => {
    doubtStatus[currentIdx] = !doubtStatus[currentIdx];
    localStorage.setItem(KEY_DOUBT, JSON.stringify(doubtStatus));
    updateUI();
};

document.getElementById('finish-btn').onclick = async () => {
    // Validasi apakah ada soal yang belum dijawab
    const belumDijawab = userAnswers.filter(ans => ans === null).length;
    let pesanKonfirmasi = "Apakah Anda yakin ingin mengakhiri ujian? Jawaban tidak dapat diubah lagi setelah ini.";
    
    if(belumDijawab > 0) {
        pesanKonfirmasi = `PERINGATAN: Masih ada ${belumDijawab} soal yang belum Anda jawab!\n\n` + pesanKonfirmasi;
    }

    if (!confirm(pesanKonfirmasi)) return;

    // Proses Submit Jawaban
    try {
        // Ubah teks tombol selesai
        const finishBtn = document.getElementById('finish-btn');
        finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENGIRIM JAWABAN...';
        finishBtn.disabled = true;

        const user = auth.currentUser;
        
        await addDoc(collection(db, "hasil_ujian"), {
            userId: user?.uid || "Anonymous", 
            namaSiswa: user?.displayName || "Siswa",
            mataPelajaran: mapelTerpilih, // Mapel yang dipilih saat verifikasi
            jawabanSiswa: userAnswers, 
            waktuSelesai: new Date(), 
            status: "Selesai"
        });
        
        // Bersihkan cache jawaban setelah berhasil submit
        localStorage.removeItem(KEY_ANS); 
        localStorage.removeItem(KEY_DOUBT);
        
        alert("Jawaban berhasil dikirim. Terima kasih dan sukses selalu!");
        window.location.href = "index.html"; 
    } catch (error) {
        console.error("Gagal mengirim hasil:", error);
        alert("Gagal mengirim jawaban! Pastikan Anda terhubung ke internet yang stabil.");
        document.getElementById('finish-btn').innerHTML = '<i class="fas fa-check-double"></i> SELESAI UJIAN';
        document.getElementById('finish-btn').disabled = false;
    }
};

// ==========================================
// 6. PENGECEKAN STATUS LOGIN SAAT HALAMAN DIMUAT
// ==========================================
auth.onAuthStateChanged(user => {
    if (user) {
        // Tampilkan nama siswa di header, fallback ke email jika display name kosong
        document.getElementById('student-name').innerText = user.displayName || user.email.split('@')[0];
    } else {
        // Redirect kembali ke login jika belum terautentikasi
        window.location.href = "index.html"; 
    }
});
