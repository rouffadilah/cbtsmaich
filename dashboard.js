import { auth, db, storage } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const secondaryApp = initializeApp({
    apiKey: "AIzaSyB8R0VNO0noUlkcUcjBkpsGFrYPdtA7KxM",
    authDomain: "cbt-sekolah-7fed0.firebaseapp.com",
    projectId: "cbt-sekolah-7fed0",
    storageBucket: "cbt-sekolah-7fed0.firebasestorage.app",
    messagingSenderId: "289218396137",
    appId: "1:289218396137:web:366383efd1348edad3d578"
}, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

let listMapel = []; let listKelas = []; let allUsersData = []; let allSoalData = []; let filteredSoalData = [];
let currentMapelDetail = ""; 

// --- 1. MODAL CUSTOM & NOTIFIKASI ---
window.customAlert = (msg, type='info') => {
    const modal = document.getElementById('modal-custom-alert');
    if(!modal) { alert(msg); return Promise.resolve(); }
    document.getElementById('alert-message').innerText = msg;
    modal.style.display = 'flex';
    return new Promise(res => {
        document.getElementById('btn-alert-ok').onclick = () => { modal.style.display = 'none'; res(); };
    });
};

window.customConfirm = (msg) => {
    const modal = document.getElementById('modal-custom-confirm');
    document.getElementById('confirm-message').innerText = msg;
    modal.style.display = 'flex';
    return new Promise(res => {
        document.getElementById('btn-confirm-ok').onclick = () => { modal.style.display = 'none'; res(true); };
        document.getElementById('btn-confirm-cancel').onclick = () => { modal.style.display = 'none'; res(false); };
    });
};

// --- 2. HELPER MEDIA ---
async function uploadFileKeStorage(file) {
    if(!file) return null;
    const storageRef = ref(storage, `bank_soal_media/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return { url: await getDownloadURL(storageRef), type: file.type.split('/')[0] };
}

function base64ToFile(base64Str, filename) {
    try {
        let arr = base64Str.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, {type: mime});
    } catch(e) { return null; }
}

// --- 3. LOGIKA DASHBOARD ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Routing Panel
    function handleRouting() {
        let hash = window.location.hash.substring(1) || 'section-beranda';
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(hash);
        if(target) target.classList.add('active');
    }
    window.addEventListener('hashchange', handleRouting);
    document.querySelectorAll('.stat-clickable').forEach(b => b.onclick = (e) => window.location.hash = e.currentTarget.dataset.target);

    onAuthStateChanged(auth, async (user) => {
        if(!user) { window.location.href = "index.html"; return; }
        document.getElementById('greeting-text').innerText = `Assalamu'alaikum, ${user.displayName || 'User'}! 🙏`;
        handleRouting(); loadDataMaster(); loadDataHasil(); loadActiveTokens(); loadDataPengguna();
    });

    document.getElementById('btn-logout').onclick = async () => {
        if(await customConfirm("Yakin ingin keluar?")) { await signOut(auth); localStorage.clear(); window.location.href = "index.html"; }
    };

    // --- 4. MANAJEMEN BANK SOAL (FUNGSI TAMPILKAN) ---
    const btnTampil = document.getElementById('btn-tampil-soal');
    if(btnTampil) btnTampil.onclick = loadDataSoal;

    async function loadDataSoal() {
        const m = document.getElementById('filter-soal-mapel').value;
        const k = document.getElementById('filter-soal-kelas').value;
        const tbody = document.querySelector('#table-soal tbody');

        if(!m || !k) return customAlert("Pilih Mapel dan Kelas terlebih dahulu!", "warning");

        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Memuat data soal...</td></tr>';

        try {
            const qS = query(collection(db, "bank_soal"), where("mataPelajaran", "==", m), where("kelas", "==", k));
            const snap = await getDocs(qS);
            
            allSoalData = [];
            snap.forEach(d => allSoalData.push({id: d.id, ...d.data()}));
            allSoalData.sort((a,b) => a.nomor_soal - b.nomor_soal);
            
            document.getElementById('stat-soal').innerText = allSoalData.length;
            tbody.innerHTML = '';

            if(allSoalData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">Belum ada soal untuk kategori ini.</td></tr>';
                return;
            }

            allSoalData.forEach(dat => {
                tbody.innerHTML += `
                    <tr>
                        <td style="text-align:center;">${dat.nomor_soal}</td>
                        <td>${dat.mataPelajaran}</td>
                        <td>${dat.kelas}</td>
                        <td><span class="badge" style="background:var(--primary-light); color:var(--primary-hover); font-weight:bold; padding:4px 8px; border-radius:4px;">${dat.tipe}</span></td>
                        <td>${dat.teks_soal.substring(0,50)}${dat.teks_soal.length > 50 ? '...' : ''}</td>
                        <td>
                            <button onclick="window.editSoal('${dat.id}')" style="color:var(--warning); background:none; border:none; cursor:pointer; font-size:1.1rem;" title="Edit"><i class="fas fa-edit"></i></button>
                            <button onclick="window.hapusDokumen('bank_soal', '${dat.id}', window.loadDataSoal)" style="color:var(--danger); background:none; border:none; cursor:pointer; font-size:1.1rem; margin-left:10px;" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
            document.getElementById('btn-preview-full').style.display = 'inline-block';
        } catch(e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data dari database.</td></tr>';
        }
    }
    window.loadDataSoal = loadDataSoal; // Ekspor ke global agar bisa dipanggil tombol hapus

    // --- 5. IMPORT & MODAL MANAGEMENT ---
    document.getElementById('btn-tambah-manual').onclick = () => {
        document.getElementById('modal-tambah-soal').style.display = 'flex';
        renderFormDinamis('PG');
    };

    document.getElementById('tab-import').onclick = () => {
        document.getElementById('area-manual').style.display = 'none';
        document.getElementById('area-import').style.display = 'block';
    };

    document.getElementById('tab-manual').onclick = () => {
        document.getElementById('area-import').style.display = 'none';
        document.getElementById('area-manual').style.display = 'block';
    };

    // --- 6. DATA MASTER & PENGGUNA ---
    async function loadDataMaster() {
        const snap = await getDoc(doc(db, "pengaturan", "data_akademik"));
        if(snap.exists()) {
            listMapel = snap.data().list_mapel || [];
            listKelas = snap.data().list_kelas || [];
            const optsM = '<option value="">-- Pilih Mapel --</option>' + listMapel.map(m => `<option value="${m}">${m}</option>`).join('');
            const optsK = '<option value="">-- Pilih Kelas --</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
            document.querySelectorAll('#filter-soal-mapel, #import-mapel, #soal-mapel').forEach(s => s.innerHTML = optsM);
            document.querySelectorAll('#filter-soal-kelas, #import-kelas, #soal-kelas').forEach(s => s.innerHTML = optsK);
        }
    }

    async function loadDataHasil() {
        const snap = await getDocs(collection(db, "hasil_ujian"));
        document.getElementById('stat-ujian').innerText = snap.size;
        const grid = document.getElementById('grid-mapel-hasil'); if(!grid) return; grid.innerHTML = '';
        let maps = [...new Set(snap.docs.map(d => d.data().mataPelajaran))];
        maps.forEach(m => {
            grid.innerHTML += `<div class="mapel-card" onclick="window.openDetailHasil('${m}')"><h3>${m}</h3><p>Selesai</p></div>`;
        });
    }

    async function loadActiveTokens() {
        const snap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        const tbody = document.querySelector('#table-active-tokens tbody'); if(!tbody) return;
        tbody.innerHTML = '';
        if(snap.exists()){
            Object.entries(snap.data()).forEach(([k, d]) => {
                tbody.innerHTML += `<tr><td>${k.replace('token_','')}</td><td>-</td><td><b>${d.code || d}</b></td><td><button onclick="window.hapusTokenUtama('${k}')" style="color:var(--danger); border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        }
    }

    window.hapusDokumen = async (coll, id, callback) => {
        if(await customConfirm("Data akan dihapus permanen. Lanjutkan?")) {
            await deleteDoc(doc(db, coll, id));
            if(callback) callback();
        }
    };
});
