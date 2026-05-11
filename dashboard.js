import { auth, db, storage } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Konfigurasi aplikasi kedua untuk manajemen pembuatan akun (agar admin tidak logout saat membuatkan akun orang lain)
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
let previewCurrentIdx = 0; let allHasilUjian = []; let currentMapelDetail = ""; 

// ==========================================
// 1. MESIN POP-UP CUSTOM ALERT & CONFIRM
// ==========================================
window.customAlert = function(message, type = 'info', title = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-alert');
        const icon = document.getElementById('alert-icon');
        const titleEl = document.getElementById('alert-title');
        const messageEl = document.getElementById('alert-message');
        const btnOk = document.getElementById('btn-alert-ok');
        
        if (!modal) { alert(message); resolve(); return; }
        
        let color = 'var(--info)'; let iconClass = 'fas fa-info-circle'; let defaultTitle = 'Informasi';
        if (type === 'success') { color = 'var(--success)'; iconClass = 'fas fa-check-circle'; defaultTitle = 'Berhasil'; }
        else if (type === 'error') { color = 'var(--danger)'; iconClass = 'fas fa-times-circle'; defaultTitle = 'Gagal / Error'; }
        else if (type === 'warning') { color = 'var(--warning)'; iconClass = 'fas fa-exclamation-triangle'; defaultTitle = 'Peringatan'; }
        
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        icon.className = `${iconClass} fa-4x`; icon.style.color = color;
        btnOk.style.backgroundColor = color;
        titleEl.innerText = title || defaultTitle;
        messageEl.innerText = message;
        modal.style.display = 'flex';
        
        const handleOk = () => { modal.style.display = 'none'; btnOk.removeEventListener('click', handleOk); resolve(); };
        btnOk.addEventListener('click', handleOk);
    });
};

window.customConfirm = function(message, type = 'warning', title = 'Konfirmasi', okText = 'Ya, Lanjutkan') {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-confirm');
        const icon = document.getElementById('confirm-icon');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const btnOk = document.getElementById('btn-confirm-ok');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        
        if (!modal) { resolve(confirm(message)); return; }
        
        let color = 'var(--warning)'; let iconClass = 'fas fa-question-circle';
        if (type === 'danger') { color = 'var(--danger)'; iconClass = 'fas fa-exclamation-triangle'; }
        else if (type === 'info') { color = 'var(--info)'; iconClass = 'fas fa-info-circle'; }
        
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        icon.className = `${iconClass} fa-4x`; icon.style.color = color;
        btnOk.style.backgroundColor = color; btnOk.innerText = okText;
        titleEl.innerText = title;
        messageEl.innerText = message;
        modal.style.display = 'flex';
        
        const cleanup = () => { modal.style.display = 'none'; btnOk.removeEventListener('click', handleOk); btnCancel.removeEventListener('click', handleCancel); };
        const handleOk = () => { cleanup(); resolve(true); };
        const handleCancel = () => { cleanup(); resolve(false); };
        
        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
    });
};

// ==========================================
// 2. HELPER MEDIA & STORAGE
// ==========================================
function renderMediaHTML(mediaObj) {
    if(!mediaObj) return '';
    if(mediaObj.type === 'image') return `<img src="${mediaObj.url}" style="max-width:100%; max-height:350px; border-radius:8px; margin-bottom:15px; display:block;">`;
    if(mediaObj.type === 'audio') return `<audio controls src="${mediaObj.url}" style="width:100%; max-width:400px; margin-bottom:15px; display:block; outline:none;"></audio>`;
    if(mediaObj.type === 'video') return `<video controls src="${mediaObj.url}" style="max-width:100%; max-height:350px; border-radius:8px; margin-bottom:15px; display:block;"></video>`;
    return '';
}

function base64ToFile(base64Str, filename) {
    try {
        let arr = base64Str.split(',');
        let mime = arr[0].match(/:(.*?);/)[1];
        let bstr = atob(arr[1]);
        let n = bstr.length;
        let u8arr = new Uint8Array(n);
        while(n--) { u8arr[n] = bstr.charCodeAt(n); }
        return new File([u8arr], filename, {type: mime});
    } catch(e) { return null; }
}

async function uploadFileKeStorage(file) {
    if(!file) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const storageRef = ref(storage, `bank_soal_media/${Date.now()}_${safeName}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    let type = 'image';
    if(file.type.startsWith('audio')) type = 'audio';
    if(file.type.startsWith('video')) type = 'video';
    return { url, type };
}

// ==========================================
// 3. AUTHENTICATION & ROUTING
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    let userRoles = []; let userMapel = []; let userKelas = [];
    try {
        userRoles = JSON.parse(localStorage.getItem("userRole") || "[]");
        userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]");
        userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
    } catch(e) { console.warn("Cache error"); }
    
    const isAdmin = userRoles.includes("admin");
    const isGuru = userRoles.includes("guru");

    function handleRouting() {
        let isModalOpen = false;
        document.querySelectorAll('.modal').forEach(m => { if (m.style.display === 'flex') { m.style.display = 'none'; isModalOpen = true; } });
        if (isModalOpen) return; 

        let hash = window.location.hash.substring(1);
        if (!hash) hash = 'section-beranda'; 

        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

        if (hash === 'section-hasil-detail') {
            if (!currentMapelDetail) { window.location.hash = 'section-hasil'; return; }
            const secHasil = document.getElementById('section-hasil');
            if (secHasil) secHasil.classList.add('active');
            document.getElementById('hasil-summary-view').style.display = 'none'; 
            document.getElementById('hasil-detail-view').style.display = 'block';
            return;
        }

        const targetSection = document.getElementById(hash);
        if (targetSection) targetSection.classList.add('active');

        if (hash === 'section-hasil') {
            document.getElementById('hasil-summary-view').style.display = 'block';
            document.getElementById('hasil-detail-view').style.display = 'none';
            currentMapelDetail = "";
        }
    }

    window.addEventListener('hashchange', handleRouting);
    document.querySelectorAll('.stat-clickable').forEach(box => { box.addEventListener('click', (e) => { window.location.hash = e.currentTarget.dataset.target; }); });

    onAuthStateChanged(auth, async (user) => {
        if (!user || (!isAdmin && !isGuru)) { window.location.href = "index.html"; return; }

        let finalDisplayName = user.displayName;
        if (!finalDisplayName) {
            try { const userDoc = await getDoc(doc(db, "users", user.uid)); if (userDoc.exists()) finalDisplayName = userDoc.data().nama; } catch(e) {}
        }
        finalDisplayName = finalDisplayName || "Pengguna";

        const greetingText = document.getElementById('greeting-text');
        if (greetingText) greetingText.innerHTML = `Assalamu'alaikum, ${finalDisplayName}! 🙏`;

        if (isAdmin) {
            fetchStatusReg(); 
        } else if (isGuru && !isAdmin) {
            document.getElementById('menu-pengguna').style.display = 'none'; 
            document.getElementById('admin-reg-status').style.display = 'none'; 
            document.getElementById('admin-data-master').style.display = 'none';
            document.getElementById('pengaturan-title').innerText = "Pengaturan Token Ujian"; 
            const mMenuPeng = document.getElementById('menu-pengaturan');
            if (mMenuPeng) { const pTag = mMenuPeng.querySelector('p'); if (pTag) pTag.innerText = 'Token Ujian'; }
        }

        handleRouting(); loadDataMaster(); loadDataHasil(); loadActiveTokens(); if (isAdmin) loadDataPengguna();
    });

    document.getElementById('btn-logout')?.addEventListener('click', async () => { 
        if(await window.customConfirm('Apakah Anda yakin ingin keluar dari aplikasi?', 'warning', 'Konfirmasi Keluar', 'Ya, Keluar')) { 
            await signOut(auth); localStorage.clear(); window.location.href = 'index.html'; 
        } 
    });

    // ==========================================
    // 4. DATA MASTER (MAPEL & KELAS)
    // ==========================================
    async function loadDataMaster() {
        try {
            const docSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
            if(docSnap.exists()) { listMapel = docSnap.data().list_mapel || []; listKelas = docSnap.data().list_kelas || []; }
            renderTableMaster(); populateSemuaDropdown();
        } catch(e) {}
    }

    function renderTableMaster() {
        const tbodyMapel = document.querySelector('#table-master-mapel tbody');
        if(tbodyMapel) tbodyMapel.innerHTML = listMapel.length === 0 ? `<tr><td style="text-align:center;">Kosong</td></tr>` : listMapel.map((m, i) => `<tr><td>${m}</td><td style="text-align:right;"><button onclick="window.hapusMapel(${i})" style="color:var(--danger); background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        const tbodyKelas = document.querySelector('#table-master-kelas tbody');
        if(tbodyKelas) tbodyKelas.innerHTML = listKelas.length === 0 ? `<tr><td style="text-align:center;">Kosong</td></tr>` : listKelas.map((k, i) => `<tr><td>${k}</td><td style="text-align:right;"><button onclick="window.hapusKelas(${i})" style="color:var(--danger); background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    }

    function populateSemuaDropdown() {
        let allowedMapel = listMapel; let allowedKelas = listKelas;
        if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); allowedKelas = listKelas.filter(k => userKelas.includes(k)); }

        const optionsMapel = '<option value="" disabled selected>Pilih Mapel...</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        const optionsKelasFilter = '<option value="" disabled selected>Pilih Kelas...</option>' + allowedKelas.map(k => `<option value="${k}">${k}</option>`).join('');
        const optionsKelasSiswa = '<option value="" disabled selected>Pilih Kelas...</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        ['soal-mapel', 'import-mapel', 'set-token-mapel', 'filter-soal-mapel', 'edit-soal-mapel'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = optionsMapel; });
        ['set-token-kelas', 'soal-kelas', 'import-kelas', 'filter-soal-kelas', 'edit-soal-kelas'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = optionsKelasFilter; });
        ['new-kelas-siswa', 'edit-kelas-siswa'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = optionsKelasSiswa; });
        
        const mc = document.getElementById('new-mapel-container'); if(mc) mc.innerHTML = listMapel.map(m => `<label style="display:block;"><input type="checkbox" class="new-mapel-cb" value="${m}"> ${m}</label>`).join('');
        const kc = document.getElementById('new-kelas-guru-container'); if(kc) kc.innerHTML = listKelas.map(k => `<label style="display:block;"><input type="checkbox" class="new-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');
    }

    document.getElementById('btn-add-mapel')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-mapel').value.trim(); if(!val) return;
        if(listMapel.includes(val)) return await window.customAlert("Mata Pelajaran sudah ada!", "warning");
        listMapel.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true });
        document.getElementById('input-new-mapel').value = ''; loadDataMaster();
    });

    document.getElementById('btn-add-kelas')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-kelas').value.trim(); if(!val) return;
        if(listKelas.includes(val)) return await window.customAlert("Kelas sudah ada!", "warning");
        listKelas.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true });
        document.getElementById('input-new-kelas').value = ''; loadDataMaster();
    });

    window.hapusMapel = async (index) => { if(!(await window.customConfirm("Hapus Mapel ini?", "danger", "Hapus"))) return; listMapel.splice(index, 1); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true }); loadDataMaster(); };
    window.hapusKelas = async (index) => { if(!(await window.customConfirm("Hapus Kelas ini?", "danger", "Hapus"))) return; listKelas.splice(index, 1); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true }); loadDataMaster(); };

    async function fetchStatusReg() {
        try {
            const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
            if (regSnap.exists()) {
                document.getElementById('status-reg-siswa').value = regSnap.data().siswa_aktif !== false ? "buka" : "tutup";
                document.getElementById('status-reg-guru').value = regSnap.data().guru_aktif !== false ? "buka" : "tutup";
            }
        } catch (e) {}
    }

    document.getElementById('btn-save-reg-status')?.addEventListener('click', async () => {
        const sSiswa = document.getElementById('status-reg-siswa').value === "buka"; const sGuru = document.getElementById('status-reg-guru').value === "buka";
        try { await setDoc(doc(db, "pengaturan", "status_registrasi"), { siswa_aktif: sSiswa, guru_aktif: sGuru }, { merge: true }); await window.customAlert("Status pendaftaran diperbarui!", "success"); } catch (e) {}
    });

    // ==========================================
    // 5. MANAJEMEN PENGGUNA
    // ==========================================
    async function loadDataPengguna() {
        const tbody = document.querySelector('#table-siswa tbody'); if(!tbody) return;
        try {
            const snap = await getDocs(collection(db, "users")); document.getElementById('stat-siswa').innerText = snap.size;
            tbody.innerHTML = ''; allUsersData = [];
            snap.forEach(docSnap => {
                const data = docSnap.data(); data.id = docSnap.id; allUsersData.push(data);
                const rls = Array.isArray(data.role) ? data.role : [data.role];
                tbody.innerHTML += `<tr><td>${data.username}</td><td><strong>${data.nama}</strong></td><td><span style="background:var(--secondary); color:white; padding:3px 8px; border-radius:4px; font-size:0.75rem;">${rls.join(', ').toUpperCase()}</span></td><td>${rls.includes('guru') ? (data.mapel||'-') : (data.kelas||'-')}</td><td><button onclick="window.editPengguna('${docSnap.id}')" style="color:var(--warning); background:none; border:none; cursor:pointer; margin-right:10px;"><i class="fas fa-edit"></i></button><button onclick="window.hapusDokumen('users', '${docSnap.id}', window.refreshPengguna)" style="color:var(--danger); background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        } catch(e) {}
    }
    window.refreshPengguna = loadDataPengguna;

    document.getElementById('btn-add-user')?.addEventListener('click', async () => {
        const nama = document.getElementById('new-nama').value; const user = document.getElementById('new-username').value.trim(); const pass = document.getElementById('new-pass').value;
        const selectedRoles = Array.from(document.querySelectorAll('.new-role-cb:checked')).map(cb => cb.value);
        if(!nama || !user || !pass || selectedRoles.length === 0) return await window.customAlert("Lengkapi form!", "warning");
        const btn = document.getElementById('btn-add-user'); btn.innerText = "Memproses..."; btn.disabled = true;
        try {
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, `${user}@cbt.smaich.id`, pass);
            await setDoc(doc(db, "users", userCred.user.uid), { nama, username: user, role: selectedRoles, createdAt: new Date() });
            await window.customAlert("Akun berhasil dibuat!", "success"); loadDataPengguna();
        } catch(e) { await window.customAlert("Gagal/Username sudah ada.", "error"); }
        btn.innerText = "SIMPAN AKUN"; btn.disabled = false;
    });

    // ==========================================
    // 6. BANK SOAL & WORD/EXCEL IMPORT
    // ==========================================
    let selectedExcelSoal = null; let selectedWordSoal = null;

    document.getElementById('file-excel')?.addEventListener('change', (e) => {
        selectedExcelSoal = e.target.files[0]; const label = document.getElementById('label-file-excel'); const box = document.getElementById('box-excel');
        if(selectedExcelSoal) { label.innerHTML = `<b>${selectedExcelSoal.name}</b>`; box.style.borderColor = "var(--success)"; selectedWordSoal = null; }
    });

    document.getElementById('file-word')?.addEventListener('change', (e) => {
        selectedWordSoal = e.target.files[0]; const label = document.getElementById('label-file-word'); const box = document.getElementById('box-word');
        if(selectedWordSoal) { label.innerHTML = `<b>${selectedWordSoal.name}</b>`; box.style.borderColor = "var(--info)"; selectedExcelSoal = null; }
    });

    document.getElementById('btn-dl-excel')?.addEventListener('click', (e) => {
        e.preventDefault();
        const ws_data = [["No", "Tipe", "Soal", "Media Soal", "OpsiA", "Media A", "OpsiB", "Media B", "OpsiC", "Media C", "OpsiD", "Media D", "OpsiE", "Media E", "Kunci", "Rubrik"], [1, "PG", "Contoh Soal?", "", "A", "", "B", "", "C", "", "D", "", "E", "", "A", ""]];
        const ws = XLSX.utils.aoa_to_sheet(ws_data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Soal"); XLSX.writeFile(wb, "Template_CBT_Excel.xlsx");
    });

    document.getElementById('btn-dl-word')?.addEventListener('click', (e) => {
        e.preventDefault();
        const content = `<html><body><h2>Template Word</h2><p>NO: 1<br>TIPE: PG<br>SOAL: Contoh?<br>A. Opsi<br>B. Opsi<br>KUNCI: A</p></body></html>`;
        const blob = new Blob(['\ufeff', content], { type: 'application/msword' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Template_CBT_Word.doc'; a.click();
    });

    document.getElementById('btn-proses-import-soal')?.addEventListener('click', async () => {
        const mapel = document.getElementById('import-mapel').value; const kelas = document.getElementById('import-kelas').value;
        if(!selectedExcelSoal && !selectedWordSoal) return await window.customAlert("Pilih file!", "warning");
        if(!mapel || !kelas) return await window.customAlert("Pilih tujuan!", "warning");

        const btn = document.getElementById('btn-proses-import-soal'); const orig = btn.innerHTML; btn.innerHTML = "Memproses..."; btn.disabled = true;

        if (selectedWordSoal) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const result = await mammoth.convertToHtml({arrayBuffer: e.target.result}, { convertImage: mammoth.images.imgElement(img => img.read("base64").then(b => ({src: "data:"+img.contentType+";base64,"+b}))) });
                    const div = document.createElement('div'); div.innerHTML = result.value;
                    let qList = []; let curr = null; let field = null;

                    div.childNodes.forEach(el => {
                        if(el.nodeName !== 'P') return;
                        let txt = el.textContent.trim(); let upper = txt.toUpperCase(); let img = el.querySelector('img')?.src;
                        if(upper.includes('NO:')) { if(curr) qList.push(curr); curr = { nomor_soal: parseInt(upper.split(':')[1])||99, tipe:'PG', teks_soal:'', opsi:{A:'',B:'',C:'',D:'',E:''}, kunci_jawaban:'', media_soal_base64:null, opsi_media_base64:{} }; field=null; }
                        else if(!curr) return;
                        if(upper.includes('TIPE:')) { curr.tipe = upper.split(':')[1].trim(); }
                        else if(upper.includes('SOAL:')) { curr.teks_soal = txt.split(/SOAL:/i)[1]?.trim(); field='SOAL'; if(img) curr.media_soal_base64=img; }
                        else if(upper.startsWith('A.')) { curr.opsi.A = txt.substring(2).trim(); field='A'; if(img) curr.opsi_media_base64.A=img; }
                        else if(upper.startsWith('B.')) { curr.opsi.B = txt.substring(2).trim(); field='B'; if(img) curr.opsi_media_base64.B=img; }
                        else if(upper.startsWith('C.')) { curr.opsi.C = txt.substring(2).trim(); field='C'; if(img) curr.opsi_media_base64.C=img; }
                        else if(upper.startsWith('D.')) { curr.opsi.D = txt.substring(2).trim(); field='D'; if(img) curr.opsi_media_base64.D=img; }
                        else if(upper.startsWith('E.')) { curr.opsi.E = txt.substring(2).trim(); field='E'; if(img) curr.opsi_media_base64.E=img; }
                        else if(upper.includes('KUNCI:')) { curr.kunci_jawaban = upper.split(':')[1].trim(); field=null; }
                    });
                    if(curr) qList.push(curr);
                    for(let q of qList) {
                        let pay = { mataPelajaran: mapel, kelas: kelas, nomor_soal: q.nomor_soal, tipe: q.tipe, teks_soal: q.teks_soal, createdAt: new Date() };
                        if(q.media_soal_base64) { let f = base64ToFile(q.media_soal_base64, `s_${Date.now()}.jpg`); pay.media_soal = await uploadFileKeStorage(f); }
                        if(q.tipe==='PG'||q.tipe==='PGK'){ pay.opsi = q.opsi; pay.kunci_jawaban = q.kunci_jawaban; let oMed = {}; for(let o of ['A','B','C','D','E']){ if(q.opsi_media_base64[o]){ let f = base64ToFile(q.opsi_media_base64[o], `o_${o}_${Date.now()}.jpg`); oMed[o] = await uploadFileKeStorage(f); } } if(Object.keys(oMed).length>0) pay.opsi_media = oMed; }
                        await addDoc(collection(db, "bank_soal"), pay);
                    }
                    await window.customAlert("Import Word Berhasil!", "success"); loadDataSoal(); document.getElementById('modal-tambah-soal').style.display='none';
                } catch(err) { await window.customAlert("Gagal baca file.", "error"); }
                btn.innerHTML = orig; btn.disabled = false;
            };
            reader.readAsArrayBuffer(selectedWordSoal);
        }
    });

    // --- SISA FUNGSI LAIN (Disederhanakan untuk efisiensi) ---
    async function loadDataSoal() {
        const m = document.getElementById('filter-soal-mapel').value; const k = document.getElementById('filter-soal-kelas').value;
        const tbody = document.querySelector('#table-soal tbody'); if(!m || !k) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Memuat...</td></tr>';
        const qS = query(collection(db, "bank_soal"), where("mataPelajaran", "==", m), where("kelas", "==", k));
        const snap = await getDocs(qS); document.getElementById('stat-soal').innerText = snap.size;
        tbody.innerHTML = ''; allSoalData = [];
        snap.forEach(d => { let dat = {id: d.id, ...d.data()}; allSoalData.push(dat); filteredSoalData = allSoalData; tbody.innerHTML += `<tr><td>${dat.nomor_soal}</td><td>${dat.mataPelajaran}</td><td>${dat.kelas}</td><td>${dat.tipe}</td><td>${dat.teks_soal.substring(0,30)}...</td><td><button onclick="window.editSoal('${dat.id}')" style="color:var(--warning); background:none; border:none; cursor:pointer;"><i class="fas fa-edit"></i></button></td></tr>`; });
        document.getElementById('btn-preview-full').style.display = snap.size > 0 ? 'inline-block' : 'none';
    }

    async function loadDataHasil() {
        const snap = await getDocs(collection(db, "hasil_ujian")); document.getElementById('stat-ujian').innerText = snap.size;
        allHasilUjian = []; snap.forEach(d => allHasilUjian.push({id: d.id, ...d.data()}));
        const grid = document.getElementById('grid-mapel-hasil'); if(!grid) return; grid.innerHTML = '';
        let maps = [...new Set(allHasilUjian.map(h => h.mataPelajaran))];
        maps.forEach(m => { grid.innerHTML += `<div class="mapel-card" onclick="window.openDetailHasil('${m}')"><h3>${m}</h3><p>${allHasilUjian.filter(h=>h.mataPelajaran===m).length} Selesai</p></div>`; });
    }

    async function loadActiveTokens() {
        const snap = await getDoc(doc(db, "pengaturan", "token_ujian")); const tbody = document.querySelector('#table-active-tokens tbody'); if(!tbody) return; tbody.innerHTML = '';
        if(snap.exists()){ Object.keys(snap.data()).forEach(k => { let d = snap.data()[k]; tbody.innerHTML += `<tr><td>${k}</td><td>-</td><td>${d.code || d}</td><td><button onclick="window.hapusTokenUtama('${k}')" style="color:var(--danger); border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td></tr>`; }); }
    }

    window.hapusTokenUtama = async (k) => { if(!(await window.customConfirm("Hapus Token?"))) return; await updateDoc(doc(db, "pengaturan", "token_ujian"), {[k]: deleteField()}); loadActiveTokens(); };
    window.hapusDokumen = async (koll, id, call) => { if(!(await window.customConfirm("Hapus data permanen?"))) return; await deleteDoc(doc(db, koll, id)); call(); };
    window.refreshSoal = loadDataSoal;
});
