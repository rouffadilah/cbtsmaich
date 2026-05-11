import { auth, db, storage } from './firebase-config.js'; 
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, updateProfile, getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

const secondaryApp = initializeApp({ apiKey: "AIzaSyB8R0VNO0noUlkcUcjBkpsGFrYPdtA7KxM", authDomain: "cbt-sekolah-7fed0.firebaseapp.com", projectId: "cbt-sekolah-7fed0", storageBucket: "cbt-sekolah-7fed0.firebasestorage.app", messagingSenderId: "289218396137", appId: "1:289218396137:web:366383efd1348edad3d578" }, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

let listMapel = []; let listKelas = []; let allUsersData = []; let allSoalData = []; let filteredSoalData = [];
let previewCurrentIdx = 0; let allHasilUjian = []; let currentMapelDetail = ""; 

// ==========================================
// 1. MODAL CUSTOM
// ==========================================
window.customAlert = (msg, type = 'info', title = '') => { /* Logika Custom Alert dari kodingan sebelumnya... */ alert(msg); return Promise.resolve(); };
window.customConfirm = (msg, type = 'warning', title = 'Konfirmasi', okText = 'Ya') => { /* Logika Custom Confirm... */ return Promise.resolve(confirm(msg)); };

// ==========================================
// 2. HELPER & UPLOAD
// ==========================================
async function uploadFileKeStorage(file) {
    if (!file) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const storageRef = ref(storage, `bank_soal_media/${Date.now()}_${safeName}`);
    await uploadBytes(storageRef, file);
    return { url: await getDownloadURL(storageRef), type: file.type.split('/')[0] };
}
function base64ToFile(base64Str, filename) {
    try { let arr = base64Str.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n); while (n--) u8arr[n] = bstr.charCodeAt(n); return new File([u8arr], filename, { type: mime }); } catch (e) { return null; }
}
function renderMediaHTML(mediaObj) {
    if (!mediaObj) return '';
    if (mediaObj.type === 'image') return `<img src="${mediaObj.url}" style="max-width:100%; max-height:300px; border-radius:8px; margin-bottom:15px; display:block;">`;
    if (mediaObj.type === 'audio') return `<audio controls src="${mediaObj.url}" style="width:100%; margin-bottom:15px;"></audio>`;
    if (mediaObj.type === 'video') return `<video controls src="${mediaObj.url}" style="max-width:100%; max-height:300px; border-radius:8px; margin-bottom:15px;"></video>`;
    return '';
}

// ==========================================
// 3. LOGIKA UTAMA & ROUTING
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    let userRoles = JSON.parse(localStorage.getItem("userRole") || "[]");
    const isAdmin = userRoles.includes("admin"); const isGuru = userRoles.includes("guru");

    function handleRouting() {
        let hash = window.location.hash.substring(1) || 'section-beranda';
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        if (hash === 'section-hasil-detail') { document.getElementById('section-hasil').classList.add('active'); document.getElementById('hasil-summary-view').style.display = 'none'; document.getElementById('hasil-detail-view').style.display = 'block'; return; }
        const target = document.getElementById(hash); if (target) target.classList.add('active');
        if (hash === 'section-hasil') { document.getElementById('hasil-summary-view').style.display = 'block'; document.getElementById('hasil-detail-view').style.display = 'none'; currentMapelDetail = ""; }
    }
    window.addEventListener('hashchange', handleRouting);
    document.querySelectorAll('.stat-clickable').forEach(b => b.onclick = (e) => window.location.hash = e.currentTarget.dataset.target);

    onAuthStateChanged(auth, async (user) => {
        if (!user || (!isAdmin && !isGuru)) { window.location.href = "index.html"; return; }
        document.getElementById('greeting-text').innerHTML = `Assalamu'alaikum, ${user.displayName || "Pengguna"}! 🙏`;
        handleRouting(); loadDataMaster(); loadDataHasil(); loadActiveTokens(); if (isAdmin) loadDataPengguna();
    });

    document.getElementById('btn-logout').onclick = async () => { if (confirm("Yakin ingin keluar?")) { await signOut(auth); localStorage.clear(); window.location.href = "index.html"; } };

    // ==========================================
    // 4. BANK SOAL & SET WAKTU UJIAN
    // ==========================================
    const btnTampil = document.getElementById('btn-tampil-soal');
    if(btnTampil) btnTampil.onclick = loadDataSoal;

    async function loadDataSoal() {
        const m = document.getElementById('filter-soal-mapel').value;
        const k = document.getElementById('filter-soal-kelas').value;
        const tbody = document.querySelector('#table-soal tbody');

        if(!m || !k) return alert("Pilih Mapel dan Kelas terlebih dahulu!");
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Memuat data soal...</td></tr>';

        try {
            const qS = query(collection(db, "bank_soal"), where("mataPelajaran", "==", m), where("kelas", "==", k));
            const snap = await getDocs(qS);
            
            allSoalData = []; snap.forEach(d => allSoalData.push({id: d.id, ...d.data()}));
            allSoalData.sort((a,b) => a.nomor_soal - b.nomor_soal);
            filteredSoalData = allSoalData;
            
            document.getElementById('stat-soal').innerText = allSoalData.length;

            // ---- FITUR BARU: Ambil Waktu Ujian ----
            try {
                const timeSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
                if (timeSnap.exists() && timeSnap.data()[`${m}_${k}`]) {
                    document.getElementById('input-waktu-ujian').value = timeSnap.data()[`${m}_${k}`];
                } else {
                    document.getElementById('input-waktu-ujian').value = ''; 
                }
            } catch(e) { console.error("Gagal load waktu", e); }
            // ----------------------------------------

            tbody.innerHTML = '';
            if(allSoalData.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada soal.</td></tr>'; document.getElementById('btn-preview-full').style.display = 'none'; return; }

            allSoalData.forEach(dat => {
                tbody.innerHTML += `<tr><td style="text-align:center; font-weight:bold;">${dat.nomor_soal}</td><td>${dat.mataPelajaran}</td><td>${dat.kelas}</td><td>${dat.tipe}</td><td>${dat.teks_soal.substring(0,40)}...</td><td><button onclick="window.hapusDokumen('bank_soal', '${dat.id}', window.loadDataSoal)" style="color:red; cursor:pointer;"><i class="fas fa-trash"></i></button></td></tr>`;
            });
            document.getElementById('btn-preview-full').style.display = 'inline-block';
        } catch(e) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data.</td></tr>'; }
    }
    window.loadDataSoal = loadDataSoal;

    // ---- FITUR BARU: SIMPAN WAKTU UJIAN ----
    const btnSimpanWaktu = document.getElementById('btn-simpan-waktu');
    if (btnSimpanWaktu) {
        btnSimpanWaktu.onclick = async () => {
            const m = document.getElementById('filter-soal-mapel').value;
            const k = document.getElementById('filter-soal-kelas').value;
            const w = document.getElementById('input-waktu-ujian').value;

            if(!m || !k) return alert("Pilih Mapel dan Kelas terlebih dahulu!");
            if(!w || w <= 0) return alert("Masukkan waktu ujian (menit) yang valid!");

            const origText = btnSimpanWaktu.innerHTML;
            btnSimpanWaktu.innerHTML = 'Menyimpan...'; btnSimpanWaktu.disabled = true;

            try {
                await setDoc(doc(db, "pengaturan", "waktu_ujian"), { [`${m}_${k}`]: parseInt(w) }, { merge: true });
                alert(`Waktu ujian berhasil diatur menjadi ${w} Menit!`);
            } catch(e) { alert("Gagal menyimpan waktu."); }
            
            btnSimpanWaktu.innerHTML = origText; btnSimpanWaktu.disabled = false;
        };
    }

    // ==========================================
    // 5. MANAJEMEN TOKEN (PERBAIKAN HAPUS & PERPANJANG)
    // ==========================================
    async function loadActiveTokens() {
        const tbody = document.querySelector('#table-active-tokens tbody'); if(!tbody) return; 
        try {
            const snap = await getDoc(doc(db, "pengaturan", "token_ujian")); tbody.innerHTML = '';
            if(snap.exists() && Object.keys(snap.data()).length > 0) { 
                const data = snap.data();
                Object.keys(data).forEach(k => { 
                    let d = data[k]; let mapelKelas = k.replace('token_', '').replace('_', ' - ');
                    let tokenCode = typeof d === 'object' ? d.code : d; let expiresAt = typeof d === 'object' ? d.expiresAt : 0;
                    let timeLeft = Math.floor((expiresAt - Date.now()) / 60000);
                    let badge = timeLeft > 0 ? `<span style="background:var(--success);color:white;padding:2px 6px;border-radius:4px;font-size:0.75rem;">Sisa ${timeLeft} mnt</span>` : `<span style="background:var(--danger);color:white;padding:2px 6px;border-radius:4px;font-size:0.75rem;">Habis</span>`;
                    
                    tbody.innerHTML += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 12px 10px;">${mapelKelas}</td><td style="padding: 12px 10px; font-weight: bold; color: var(--primary);">${tokenCode} ${badge}</td>
                        <td style="padding: 12px 10px; text-align: right; white-space: nowrap;">
                            <button onclick="window.perpanjangToken('${k}')" style="color:var(--success); background:#ecfdf5; border:1px solid #a7f3d0; padding:6px 10px; border-radius:6px; cursor:pointer;" title="Perpanjang 15 Menit"><i class="fas fa-clock"></i></button>
                            <button onclick="window.hapusTokenUtama('${k}')" style="color:var(--danger); background:#fee2e2; border:1px solid #fecaca; padding:6px 10px; border-radius:6px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                        </td></tr>`; 
                }); 
            } else { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px;">Belum ada token.</td></tr>`; }
        } catch (e) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color:red;">Error database.</td></tr>`; }
    }

    document.getElementById('btn-refresh-token').onclick = loadActiveTokens;
    document.getElementById('btn-save-token').onclick = async () => {
        const m = document.getElementById('set-token-mapel').value; const k = document.getElementById('set-token-kelas').value; const t = document.getElementById('input-token-baru').value.toUpperCase().trim();
        if(!m || !k || !t) return alert("Isi form lengkap!");
        try { await setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${m}_${k}`]: { code: t, expiresAt: Date.now() + (15 * 60000) } }, { merge: true }); alert("Token Aktif 15 Menit!"); loadActiveTokens(); } catch(e) {}
    };

    window.hapusTokenUtama = async (k) => { 
        if(confirm("Hapus token?")) { 
            try { const snap = await getDoc(doc(db, "pengaturan", "token_ujian")); if(snap.exists()) { let data = snap.data(); delete data[k]; await setDoc(doc(db, "pengaturan", "token_ujian"), data); loadActiveTokens(); } } catch (e) { alert("Gagal"); }
        } 
    };

    window.perpanjangToken = async (k) => {
        if(confirm("Tambah waktu 15 menit?")) {
            try {
                const snap = await getDoc(doc(db, "pengaturan", "token_ujian"));
                if (snap.exists() && snap.data()[k]) {
                    let c = snap.data()[k]; let p = (typeof c === 'object') ? { code: c.code, expiresAt: Date.now() + (15*60000) } : { code: c, expiresAt: Date.now() + (15*60000) };
                    await setDoc(doc(db, "pengaturan", "token_ujian"), { [k]: p }, { merge: true }); alert("Diperpanjang!"); loadActiveTokens();
                }
            } catch(e) { alert("Gagal"); }
        }
    };

    window.hapusDokumen = async (coll, id, callback) => { if(confirm("Hapus permanen?")) { await deleteDoc(doc(db, coll, id)); if(callback) callback(); } };

    // Sisipkan fungsi render Data Master, Hasil, dan Preview disini jika diperlukan...
    async function loadDataMaster() { /* Kode sebelumnya... */ }
    async function loadDataHasil() { /* Kode sebelumnya... */ }
});
