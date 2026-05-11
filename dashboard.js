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

// --- MODAL CUSTOM ---
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

// --- HELPER MEDIA ---
async function uploadFileKeStorage(file) {
    if(!file) return null;
    const storageRef = ref(storage, `bank_soal_media/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { url, type: file.type.split('/')[0] };
}

function base64ToFile(base64Str, filename) {
    try {
        let arr = base64Str.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, {type: mime});
    } catch(e) { return null; }
}

// --- LOGIKA UTAMA ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Routing
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

    // --- MANAJEMEN SOAL ---
    document.getElementById('btn-tambah-manual').onclick = () => {
        document.getElementById('modal-tambah-soal').style.display = 'flex';
        renderFormDinamis('PG');
    };

    document.getElementById('close-modal-soal').onclick = () => document.getElementById('modal-tambah-soal').style.display = 'none';

    function renderFormDinamis(tipe) {
        const area = document.getElementById('area-opsi-dinamis');
        if(tipe === 'PG' || tipe === 'PGK') {
            area.innerHTML = ['A','B','C','D','E'].map(o => `
                <div style="display:flex; gap:10px; margin-bottom:8px; align-items:center; background:#fff; padding:8px; border-radius:8px; border:1px solid #e2e8f0;">
                    <input type="${tipe==='PG'?'radio':'checkbox'}" name="kunci" value="${o}">
                    <label style="font-weight:bold;">${o}</label>
                    <input type="text" id="opsi-${o}" class="input-text" placeholder="Teks Opsi ${o}" style="flex:1;">
                    <input type="file" id="media-opsi-${o}" style="width:180px; font-size:0.7rem;">
                </div>`).join('');
        } else if(tipe === 'Menjodohkan') {
            area.innerHTML = '<p style="font-size:0.8rem; color:#64748b;">Format: Pernyataan = Jawaban (Gunakan tombol Import Excel untuk mempermudah)</p>';
        } else {
            area.innerHTML = '<p>Jawaban akan diisi manual oleh siswa.</p>';
        }
    }

    // ==========================================
// MESIN IMPORT EXCEL & WORD CERDAS
// ==========================================
let selectedExcelSoal = null;
let selectedWordSoal = null;

// Logika Perpindahan Tab Modal
document.getElementById('tab-manual')?.addEventListener('click', () => {
    document.getElementById('area-manual').style.display = 'block';
    document.getElementById('area-import').style.display = 'none';
    document.getElementById('tab-manual').classList.remove('btn-secondary');
    document.getElementById('tab-import').classList.add('btn-secondary');
});

document.getElementById('tab-import')?.addEventListener('click', () => {
    document.getElementById('area-manual').style.display = 'none';
    document.getElementById('area-import').style.display = 'block';
    document.getElementById('tab-import').classList.remove('btn-secondary');
    document.getElementById('tab-manual').classList.add('btn-secondary');
});

// Listener Deteksi File
document.getElementById('file-excel')?.addEventListener('change', (e) => {
    selectedExcelSoal = e.target.files[0];
    const label = document.getElementById('label-file-excel');
    if(selectedExcelSoal) {
        label.innerHTML = `<b style="color:var(--success);">${selectedExcelSoal.name}</b>`;
        selectedWordSoal = null; 
    }
});

document.getElementById('file-word')?.addEventListener('change', (e) => {
    selectedWordSoal = e.target.files[0];
    const label = document.getElementById('label-file-word');
    if(selectedWordSoal) {
        label.innerHTML = `<b style="color:var(--info);">${selectedWordSoal.name}</b>`;
        selectedExcelSoal = null;
    }
});

// Eksekusi Import
document.getElementById('btn-proses-import-soal')?.addEventListener('click', async () => {
    const mapel = document.getElementById('import-mapel').value;
    const kelas = document.getElementById('import-kelas').value;

    if (!selectedExcelSoal && !selectedWordSoal) return await window.customAlert("Pilih file Excel atau Word terlebih dahulu!", "warning");
    if (!mapel || !kelas) return await window.customAlert("Pilih Mapel dan Kelas tujuan!", "warning");

    const btn = document.getElementById('btn-proses-import-soal');
    const origText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;

    if (selectedWordSoal) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const options = {
                    convertImage: mammoth.images.imgElement(img => img.read("base64").then(b => ({src: "data:"+img.contentType+";base64,"+b})))
                };
                const result = await mammoth.convertToHtml({arrayBuffer: e.target.result}, options);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = result.value;

                let qList = [], curr = null;
                tempDiv.childNodes.forEach(el => {
                    let txt = (el.textContent || "").trim(), upper = txt.toUpperCase(), img = el.querySelector('img')?.src;
                    if(upper.includes('NO:')) {
                        if(curr) qList.push(curr);
                        curr = { nomor_soal: parseInt(upper.split(':')[1])||1, tipe:'PG', teks_soal:'', opsi:{A:'',B:'',C:'',D:'',E:''}, kunci_jawaban:'', media_soal:null, opsi_media:{} };
                    } else if(curr) {
                        if(upper.includes('TIPE:')) curr.tipe = upper.split(':')[1].trim();
                        else if(upper.includes('SOAL:')) { curr.teks_soal = txt.split(/SOAL:/i)[1] || ""; if(img) curr.media_soal = img; }
                        else if(upper.startsWith('A.')) { curr.opsi.A = txt.substring(2); if(img) curr.opsi_media.A=img; }
                        else if(upper.startsWith('B.')) { curr.opsi.B = txt.substring(2); if(img) curr.opsi_media.B=img; }
                        else if(upper.startsWith('C.')) { curr.opsi.C = txt.substring(2); if(img) curr.opsi_media.C=img; }
                        else if(upper.startsWith('D.')) { curr.opsi.D = txt.substring(2); if(img) curr.opsi_media.D=img; }
                        else if(upper.startsWith('E.')) { curr.opsi.E = txt.substring(2); if(img) curr.opsi_media.E=img; }
                        else if(upper.includes('KUNCI:')) curr.kunci_jawaban = upper.split(':')[1].trim();
                    }
                });
                if(curr) qList.push(curr);

                for(let q of qList) {
                    let pay = { mataPelajaran: mapel, kelas, nomor_soal: q.nomor_soal, tipe: q.tipe, teks_soal: q.teks_soal, createdAt: new Date() };
                    if(q.media_soal) pay.media_soal = await uploadFileKeStorage(base64ToFile(q.media_soal, `s_${Date.now()}.jpg`));
                    if(q.tipe==='PG'||q.tipe==='PGK') {
                        pay.opsi = q.opsi; pay.kunci_jawaban = q.kunci_jawaban;
                        let om = {};
                        for(let k in q.opsi_media) om[k] = await uploadFileKeStorage(base64ToFile(q.opsi_media[k], `o_${k}.jpg`));
                        if(Object.keys(om).length>0) pay.opsi_media = om;
                    }
                    await addDoc(collection(db, "bank_soal"), pay);
                }
                await window.customAlert("Import Word Berhasil!", "success");
                location.reload();
            } catch(err) { await window.customAlert("Format file tidak sesuai template!", "error"); }
            btn.innerHTML = origText; btn.disabled = false;
        };
        reader.readAsArrayBuffer(selectedWordSoal);
    }
});

    // --- TEMPLATE DOWNLOADER ---
    document.getElementById('btn-dl-word').onclick = () => {
        const html = `<html><body><b>NO:</b> 1<br><b>TIPE:</b> PG<br><b>SOAL:</b> Pertanyaan?<br><b>A.</b> Opsi 1<br><b>B.</b> Opsi 2<br><b>KUNCI:</b> A</body></html>`;
        const blob = new Blob(['\ufeff', html], {type:'application/msword'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'Template_SMAICH.doc'; a.click();
    };

    // --- LOAD DATA DROPDOWNS ---
    async function loadDataMaster() {
        const snap = await getDoc(doc(db, "pengaturan", "data_akademik"));
        if(snap.exists()) {
            listMapel = snap.data().list_mapel || [];
            listKelas = snap.data().list_kelas || [];
            const opts = '<option value="">-- Pilih --</option>' + listMapel.map(m => `<option value="${m}">${m}</option>`).join('');
            document.querySelectorAll('#import-mapel, #filter-soal-mapel, #soal-mapel').forEach(s => s.innerHTML = opts);
            const optsK = '<option value="">-- Pilih --</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
            document.querySelectorAll('#import-kelas, #filter-soal-kelas, #soal-kelas').forEach(s => s.innerHTML = optsK);
        }
    }

    async function loadDataSoal() { /* Fungsi Load Tabel Soal */ }
    async function loadDataHasil() { /* Fungsi Load Tabel Hasil */ }
    async function loadActiveTokens() { /* Fungsi Load Tabel Token */ }
    async function loadDataPengguna() { /* Fungsi Load Tabel User */ }
});
