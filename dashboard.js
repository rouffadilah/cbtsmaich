import { auth, db, storage } from './firebase-config.js'; 
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Variabel Globals
let listMapel = []; let listKelas = []; let allUsersData = []; let allSoalData = []; let filteredSoalData = [];
let previewCurrentIdx = 0; let allHasilUjian = []; 
let currentMapelDetail = ""; let currentKelasDetail = "";

// ==========================================
// 1. MODAL CUSTOM & NOTIFIKASI
// ==========================================
window.customAlert = (msg, type = 'info', title = '') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-alert');
        if (!modal) { alert(msg); return resolve(); }
        
        const icon = document.getElementById('alert-icon');
        const titleEl = document.getElementById('alert-title');
        const messageEl = document.getElementById('alert-message');
        const btnOk = document.getElementById('btn-alert-ok');
        
        let color = 'var(--info)'; let iconClass = 'fas fa-info-circle'; let defaultTitle = 'Informasi';
        if (type === 'success') { color = 'var(--success)'; iconClass = 'fas fa-check-circle'; defaultTitle = 'Berhasil'; }
        else if (type === 'error') { color = 'var(--danger)'; iconClass = 'fas fa-times-circle'; defaultTitle = 'Gagal / Error'; }
        else if (type === 'warning') { color = 'var(--warning)'; iconClass = 'fas fa-exclamation-triangle'; defaultTitle = 'Peringatan'; }
        
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        icon.className = `${iconClass} fa-4x`; icon.style.color = color;
        btnOk.style.backgroundColor = color;
        titleEl.innerText = title || defaultTitle;
        messageEl.innerText = msg;
        
        modal.style.display = 'flex';
        btnOk.onclick = () => { modal.style.display = 'none'; resolve(); };
    });
};

window.customConfirm = (msg, type = 'warning', title = 'Konfirmasi', okText = 'Ya, Lanjutkan') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-confirm');
        if (!modal) { return resolve(confirm(msg)); }
        
        const icon = document.getElementById('confirm-icon');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const btnOk = document.getElementById('btn-confirm-ok');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        
        let color = 'var(--warning)'; let iconClass = 'fas fa-question-circle';
        if (type === 'danger') { color = 'var(--danger)'; iconClass = 'fas fa-exclamation-triangle'; }
        
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        icon.className = `${iconClass} fa-4x`; icon.style.color = color;
        btnOk.style.backgroundColor = color; btnOk.innerText = okText;
        titleEl.innerText = title;
        messageEl.innerText = msg;
        
        modal.style.display = 'flex';
        btnOk.onclick = () => { modal.style.display = 'none'; resolve(true); };
        btnCancel.onclick = () => { modal.style.display = 'none'; resolve(false); };
    });
};

// ==========================================
// 2. HELPER MEDIA
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
    if (mediaObj.type === 'audio') return `<audio controls src="${mediaObj.url}" style="width:100%; max-width:400px; margin-bottom:15px; display:block; outline:none;"></audio>`;
    if (mediaObj.type === 'video') return `<video controls src="${mediaObj.url}" style="max-width:100%; max-height:300px; border-radius:8px; margin-bottom:15px; display:block;"></video>`;
    return '';
}

// ==========================================
// 3. LOGIKA UTAMA DASHBOARD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    if (!window.location.hash) { window.location.hash = 'section-beranda'; }
    window.addEventListener('popstate', function(event) {
        if (!window.location.hash || window.location.hash === '') { window.location.hash = 'section-beranda'; }
    });

    let userRoles = []; let userMapel = []; let userKelas = [];
    try { 
        userRoles = JSON.parse(localStorage.getItem("userRole") || "[]"); 
        userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]"); 
        userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
    } catch (e) {}
    
    const isAdmin = userRoles.includes("admin"); 
    const isGuru = userRoles.includes("guru");

    function handleRouting() {
        let hash = window.location.hash.substring(1) || 'section-beranda';
        if (hash === 'section-pengaturan') hash = 'section-beranda';
        
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

        if (hash === 'section-hasil-detail') {
            if (!currentMapelDetail || !currentKelasDetail) { window.location.hash = 'section-hasil'; return; }
            document.getElementById('section-hasil').classList.add('active');
            if(document.getElementById('hasil-summary-view')) document.getElementById('hasil-summary-view').style.display = 'none'; 
            if(document.getElementById('hasil-detail-view')) document.getElementById('hasil-detail-view').style.display = 'block';
            return;
        }

        const target = document.getElementById(hash); 
        if (target) target.classList.add('active');
        
        if (hash === 'section-hasil') { 
            if(document.getElementById('hasil-summary-view')) document.getElementById('hasil-summary-view').style.display = 'block'; 
            if(document.getElementById('hasil-detail-view')) document.getElementById('hasil-detail-view').style.display = 'none'; 
            currentMapelDetail = ""; currentKelasDetail = "";
        }
    }

    window.addEventListener('hashchange', handleRouting);

    onAuthStateChanged(auth, async (user) => {
        if (!user || (!isAdmin && !isGuru)) { window.location.href = "index.html"; return; }
        
        let finalDisplayName = user.displayName;
        if (!finalDisplayName) { 
            try { const userDoc = await getDoc(doc(db, "users", user.uid)); if (userDoc.exists()) finalDisplayName = userDoc.data().nama; } catch(e) {} 
        }
        finalDisplayName = finalDisplayName || "Pengguna";

        const greetingText = document.getElementById('greeting-text'); 
        if (greetingText) greetingText.innerHTML = `Assalamu'alaikum, <span style="display: inline-block;">${finalDisplayName}! 🙏</span>`;

        // =====================================
        // RESTRIKSI AKSES (GURU VS ADMIN)
        // =====================================
        if (!isAdmin) {
            // Sembunyikan tombol-tombol khusus Admin
            const btnMaster = document.getElementById('btn-open-data-master');
            if (btnMaster) btnMaster.style.display = 'none';
            
            const btnAddUser = document.getElementById('btn-open-manajemen');
            if (btnAddUser) btnAddUser.style.display = 'none';
            
            const wrapRegGuru = document.getElementById('wrap-reg-guru');
            if (wrapRegGuru) wrapRegGuru.style.display = 'none';
            
            const wrapRegSiswa = document.getElementById('wrap-reg-siswa');
            if (wrapRegSiswa) wrapRegSiswa.style.display = 'none';
            
            const btnHapusAll = document.getElementById('btn-hapus-semua-hasil');
            if (btnHapusAll) btnHapusAll.style.display = 'none';
        }

        if (isAdmin) { 
            fetchStatusReg(); 
        } 

        handleRouting(); 
        loadDataMaster(); 
        loadDataHasil(); 
        loadDataPengguna(); 
    });

    document.getElementById('btn-logout').onclick = async () => { 
        if (await customConfirm("Yakin ingin keluar dari aplikasi?", "warning", "Konfirmasi Keluar", "Ya, Keluar")) { await signOut(auth); localStorage.clear(); window.location.href = "index.html"; } 
    };

    document.addEventListener('click', (e) => {
        const header = e.target.closest('.toggle-accordion');
        if (!header) return;

        const targetId = header.getAttribute('data-target');
        const target = document.getElementById(targetId);
        const icon = header.querySelector('.toggle-icon');

        if (!target) return;

        if (target.style.display === 'none' || target.style.display === '') {
            target.style.display = 'block';
            if (icon) icon.style.transform = 'rotate(180deg)';
            header.style.background = '#f8fafc';
        } else {
            target.style.display = 'none';
            if (icon) icon.style.transform = 'rotate(0deg)';
            header.style.background = '#ffffff';
        }
    });

    // ==========================================
    // PORTAL REGISTRASI (AUTO-SAVE) - BUG FIX
    // ==========================================
    async function fetchStatusReg() {
        try {
            const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
            if (regSnap.exists()) {
                const sSiswa = document.getElementById('status-reg-siswa'); 
                const sGuru = document.getElementById('status-reg-guru');
                if (sSiswa) sSiswa.checked = regSnap.data().siswa_aktif !== false;
                if (sGuru) sGuru.checked = regSnap.data().guru_aktif !== false;
            }
        } catch (e) {}
    }

    document.getElementById('status-reg-guru')?.addEventListener('change', async (e) => {
        try { await setDoc(doc(db, "pengaturan", "status_registrasi"), { guru_aktif: e.target.checked }, { merge: true }); } 
        catch (err) { console.error("Gagal simpan status guru", err); }
    });
    document.getElementById('status-reg-siswa')?.addEventListener('change', async (e) => {
        try { await setDoc(doc(db, "pengaturan", "status_registrasi"), { siswa_aktif: e.target.checked }, { merge: true }); } 
        catch (err) { console.error("Gagal simpan status siswa", err); }
    });

    // ==========================================
// 4. DATA MASTER
// ==========================================
let editMasterMode = false; // Status mode edit

document.getElementById('btn-open-data-master')?.addEventListener('click', () => { 
    document.getElementById('modal-data-master').style.display = 'flex'; 
    editMasterMode = false; // Reset mode saat buka
    renderTableMaster();
});

document.getElementById('close-modal-data-master')?.addEventListener('click', () => { 
    document.getElementById('modal-data-master').style.display = 'none'; 
});

// LOGIKA TOMBOL EDIT DATA MASTER (DIPERBAIKI)
document.getElementById('btn-edit-master-mode')?.addEventListener('click', () => { 
    editMasterMode = !editMasterMode;
    const btn = document.getElementById('btn-edit-master-mode');
    
    if (editMasterMode) {
        btn.innerHTML = '<i class="fas fa-check"></i> Selesai Edit';
        btn.classList.remove('btn-secondary');
        btn.style.backgroundColor = 'var(--success)';
    } else {
        btn.innerHTML = '<i class="fas fa-edit"></i> Edit Data Master';
        btn.classList.add('btn-secondary');
        btn.style.backgroundColor = '';
    }
    renderTableMaster();
});

async function loadDataMaster() {
    try {
        const docSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
        if (docSnap.exists()) { 
            listMapel = docSnap.data().list_mapel || []; 
            listKelas = docSnap.data().list_kelas || []; 
        }
        renderTableMaster(); 
        populateSemuaDropdown(); 
        loadBankSoalSummary();
    } catch (e) { console.error("Gagal load data master", e); }
}

document.getElementById('btn-add-master')?.addEventListener('click', async () => {
    const type = document.getElementById('input-master-type').value;
    const val = document.getElementById('input-master-name').value.trim(); 
    if (!val) return window.customAlert("Masukkan nama terlebih dahulu!", "warning");
    
    if (type === 'mapel') {
        if (listMapel.includes(val)) return await window.customAlert("Mata Pelajaran sudah ada!", "warning");
        listMapel.push(val); 
        await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true });
    } else {
        if (listKelas.includes(val)) return await window.customAlert("Kelas sudah ada!", "warning");
        listKelas.push(val); 
        await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true });
    }
    
    document.getElementById('input-master-name').value = ''; 
    loadDataMaster();
    await window.customAlert("Data berhasil ditambahkan!", "success");
});

// FUNGSI RENDER TABEL (DIPERBAIKI DENGAN TOMBOL HAPUS)
function renderTableMaster() {
    const tbody = document.getElementById('tbody-master-combined');
    if (!tbody) return;

    let maxLen = Math.max(listMapel.length, listKelas.length);
    if (maxLen === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 20px;">Belum ada data master.</td></tr>`;
        return;
    }

    let html = '';
    for (let i = 0; i < maxLen; i++) {
        let m = listMapel[i]; 
        let k = listKelas[i];
        
        // Buat HTML tombol hapus jika mode edit aktif
        let delMapel = (m && editMasterMode) ? `<button onclick="window.hapusMasterItem('mapel', '${m}')" style="color:var(--danger); background:none; border:none; cursor:pointer; margin-left:10px;"><i class="fas fa-times-circle"></i></button>` : '';
        let delKelas = (k && editMasterMode) ? `<button onclick="window.hapusMasterItem('kelas', '${k}')" style="color:var(--danger); background:none; border:none; cursor:pointer; margin-left:10px;"><i class="fas fa-times-circle"></i></button>` : '';

        let cellMapel = m ? `<td style="font-weight:600; display:flex; justify-content:space-between;">${m} ${delMapel}</td>` : `<td>-</td>`;
        let cellKelas = k ? `<td style="font-weight:600; display:flex; justify-content:space-between;">${k} ${delKelas}</td>` : `<td>-</td>`;
        
        html += `<tr>${cellMapel}${cellKelas}</tr>`;
    }
    tbody.innerHTML = html;
}

// FUNGSI HAPUS ITEM MASTER (TAMBAHAN BARU)
window.hapusMasterItem = async (type, val) => {
    if (!(await window.customConfirm(`Hapus ${type === 'mapel' ? 'Mapel' : 'Kelas'} "${val}"?`, "danger"))) return;
    
    try {
        if (type === 'mapel') {
            listMapel = listMapel.filter(item => item !== val);
            await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true });
        } else {
            listKelas = listKelas.filter(item => item !== val);
            await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true });
        }
        loadDataMaster(); // Refresh tabel dan dropdown
    } catch (e) {
        window.customAlert("Gagal menghapus data.", "error");
    }
};
    async function loadBankSoalSummary() {
        const tbody = document.querySelector('#table-bank-soal-summary tbody');
        if(!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Memuat data...</td></tr>';
        
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            let summary = {};
            
            let allowedMapel = listMapel;
            if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }

            snap.forEach(d => {
                let mapel = d.data().mataPelajaran; let kelas = d.data().kelas;
                if (allowedMapel.includes(mapel)) {
                    let key = `${mapel}_${kelas}`;
                    if(!summary[key]) summary[key] = { mapel, kelas, count: 0 };
                    summary[key].count++;
                }
            });

            const waktuSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
            const waktuData = waktuSnap.exists() ? waktuSnap.data() : {};
            
            const jadwalSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian"));
            const jadwalData = jadwalSnap.exists() ? jadwalSnap.data() : {};
            
            const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
            const tokenData = tokenSnap.exists() ? tokenSnap.data() : {};

            let html = '';
            for(let key in summary) {
                let d = summary[key];
                let durasi = waktuData[key] ? `${waktuData[key]} Menit` : '<span style="color:var(--danger); font-size:0.85rem;"><i class="fas fa-exclamation-triangle"></i> Belum Ada</span>';
                
                let jadwalRaw = jadwalData[key];
                let jadwalFormat = '<span style="color:var(--danger); font-size:0.85rem;"><i class="fas fa-exclamation-triangle"></i> Belum Ada</span>';
                if (jadwalRaw) {
                    let dObj = new Date(jadwalRaw);
                    jadwalFormat = dObj.toLocaleString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
                }

                let tokenRaw = tokenData[`token_${key}`];
                let tokenDisplay = '<span style="color:var(--text-muted); font-size:0.85rem;">-</span>';
                if(tokenRaw) {
                    let code = typeof tokenRaw === 'object' ? tokenRaw.code : tokenRaw;
                    let exp = typeof tokenRaw === 'object' ? tokenRaw.expiresAt : 0;
                    let sisa = Math.floor((exp - Date.now()) / 60000);
                    if(sisa > 0) { tokenDisplay = `<span style="font-weight:bold; color:var(--danger);">${code}</span> <br><span style="font-size:0.75rem; color:var(--success);">Aktif (${sisa}m)</span>`; } 
                    else { tokenDisplay = `<span style="font-weight:bold; color:var(--text-muted); text-decoration:line-through;">${code}</span> <br><span style="font-size:0.75rem; color:var(--danger);">Habis</span>`; }
                }

                html += `<tr>
                    <td><strong>${d.mapel}</strong></td>
                    <td>${d.kelas}</td>
                    <td>${jadwalFormat}</td>
                    <td>${durasi}</td>
                    <td>${tokenDisplay}</td>
                    <td><span style="background:var(--primary-light); color:var(--primary-hover); padding:3px 8px; border-radius:12px; font-weight:bold; font-size:0.85rem;">${d.count} Soal</span></td>
                    <td style="text-align:center;">
                        <button onclick="window.bukaEditSoal('${d.mapel}', '${d.kelas}')" class="btn-3d" style="background:var(--warning); margin:0; padding:6px 12px; font-size:0.85rem;"><i class="fas fa-edit"></i> Edit</button>
                    </td>
                </tr>`;
            }

            if(html === '') { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">Belum ada soal terdaftar.</td></tr>'; } 
            else { tbody.innerHTML = html; }
        } catch(e) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red; padding: 20px;">Gagal memuat bank soal dari database.</td></tr>'; }
    }
    window.loadBankSoalSummary = loadBankSoalSummary;

    window.bukaEditSoal = async (mapel, kelas) => {
        document.getElementById('view-summary-bank-soal').style.display = 'none';
        document.getElementById('view-soal-list').style.display = 'block';
        document.getElementById('label-mapel-edit').innerHTML = `${mapel} <span style="font-weight:normal; color:var(--text-muted); font-size:0.95rem;">(Kelas: ${kelas})</span>`;
        document.getElementById('filter-soal-mapel').value = mapel;
        document.getElementById('filter-soal-kelas').value = kelas;
        document.getElementById('list-soal').innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted); background: white; border: 1px solid var(--border-color); border-radius: 8px;">Memuat soal...</div>`;
        document.getElementById('btn-preview-full').style.display = 'none';
        
        const key = `${mapel}_${kelas}`;
        try {
            const wSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
            document.getElementById('input-waktu-ujian').value = (wSnap.exists() && wSnap.data()[key]) ? wSnap.data()[key] : '';
            
            const jSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian"));
            document.getElementById('input-jadwal-ujian').value = (jSnap.exists() && jSnap.data()[key]) ? jSnap.data()[key] : '';
            
            const tSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
            if(tSnap.exists() && tSnap.data()[`token_${key}`]) {
                let tData = tSnap.data()[`token_${key}`];
                document.getElementById('input-token-ujian').value = typeof tData === 'object' ? tData.code : tData;
            } else { document.getElementById('input-token-ujian').value = ''; }
        } catch(e) {}

        loadDataSoal(); 
    };

    document.getElementById('btn-back-mapel-list')?.addEventListener('click', () => {
        document.getElementById('view-soal-list').style.display = 'none';
        document.getElementById('view-summary-bank-soal').style.display = 'block';
        loadBankSoalSummary();
    });
    
    document.getElementById('btn-tambah-langsung')?.addEventListener('click', () => {
        document.getElementById('modal-tambah-soal').style.display = 'flex';
        renderFormDinamis('PG');
    });

    document.getElementById('btn-simpan-pengaturan-ujian')?.addEventListener('click', async () => {
        const mapel = document.getElementById('filter-soal-mapel').value;
        const kelas = document.getElementById('filter-soal-kelas').value;
        const waktu = document.getElementById('input-waktu-ujian').value;
        const jadwal = document.getElementById('input-jadwal-ujian').value;
        const token = document.getElementById('input-token-ujian').value.toUpperCase().trim();

        if(!mapel || !kelas) return;
        const btn = document.getElementById('btn-simpan-pengaturan-ujian');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        btn.disabled = true;

        try {
            const key = `${mapel}_${kelas}`;
            if(waktu) { await setDoc(doc(db, "pengaturan", "waktu_ujian"), { [key]: parseInt(waktu) }, { merge: true }); }
            if(jadwal) { await setDoc(doc(db, "pengaturan", "jadwal_ujian"), { [key]: jadwal }, { merge: true }); }
            if(token) { await setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${key}`]: { code: token, expiresAt: Date.now() + (15 * 60000) } }, { merge: true }); }

            await window.customAlert("Seting berhasil disimpan!", "success");
        } catch(e) { await window.customAlert("Gagal menyimpan pengaturan.", "error"); }
        btn.innerHTML = orig; btn.disabled = false;
    });

    function populateSemuaDropdown() {
        let allowedMapel = listMapel; let allowedKelas = listKelas;
        if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); allowedKelas = listKelas.filter(k => userKelas.includes(k)); }

        const optionsKelasSiswa = '<option value="" disabled selected>Pilih Kelas...</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
        const optionsKelasFilter = '<option value="" disabled selected>Pilih Kelas...</option>' + allowedKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        ['soal-kelas', 'import-kelas', 'edit-soal-kelas'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = optionsKelasFilter; });
        ['new-kelas-siswa', 'edit-kelas-siswa'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = optionsKelasSiswa; });

        const optionsMapel = '<option value="" disabled selected>Pilih Mapel...</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        ['soal-mapel', 'import-mapel', 'edit-soal-mapel'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = optionsMapel; }); 
        
        const emc = document.getElementById('edit-mapel-container'); if (emc) emc.innerHTML = listMapel.map(m => `<label><input type="checkbox" class="edit-mapel-cb" value="${m}"> ${m}</label>`).join('');
        const ekc = document.getElementById('edit-kelas-guru-container'); if (ekc) ekc.innerHTML = listKelas.map(k => `<label><input type="checkbox" class="edit-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');
    }

    // ==========================================
// 5. MANAJEMEN PENGGUNA (ADMIN)
// ==========================================

// ... (kode loadDataPengguna dan lainnya tetap sama) ...

document.getElementById('btn-save-edit-akun')?.addEventListener('click', async () => {
    const uid = document.getElementById('edit-uid').value;
    const name = document.getElementById('edit-nama').value.trim();
    const username = document.getElementById('edit-username').value.trim();
    const pass = document.getElementById('edit-pass').value.trim();
    const roles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(cb => cb.value);
    
    if (!name || !username || roles.length === 0) {
        return window.customAlert("Nama, Username, dan minimal satu Role harus diisi!", "warning");
    }

    const btn = document.getElementById('btn-save-edit-akun');
    const originalHTML = btn.innerHTML;

    // 1. Ubah tombol menjadi status loading
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const payload = {
            nama: name,
            username: username,
            role: roles
        };

        // Jika role guru, ambil data mapel & kelas
        if (roles.includes('guru')) {
            payload.mapel = Array.from(document.querySelectorAll('.edit-mapel-cb:checked')).map(cb => cb.value);
            payload.kelas = Array.from(document.querySelectorAll('.edit-kelas-guru-cb:checked')).map(cb => cb.value);
        }

        // Jika role siswa, ambil kelas siswa
        if (roles.includes('siswa')) {
            payload.kelas = document.getElementById('edit-kelas-siswa').value;
        }

        // Simpan password ke Firestore (hanya referensi, tidak mengubah Auth password secara otomatis)
        if (pass) {
            payload.password = pass; 
        }

        // 2. Update Dokumen di Firestore
        await updateDoc(doc(db, "users", uid), payload);

        // 3. Notifikasi Berhasil
        await window.customAlert("Profil pengguna berhasil diperbarui!", "success");
        
        // Tutup modal
        document.getElementById('modal-edit-akun').style.display = 'none';
        
        // Refresh tabel
        if (typeof window.loadDataPengguna === 'function') {
            window.loadDataPengguna();
        }

    } catch (err) {
        console.error("Error updating user:", err);
        await window.customAlert("Gagal menyimpan perubahan: " + err.message, "error");
    } finally {
        // 4. KEMBALIKAN TOMBOL KE SEMULA (Solusi agar tidak freeze)
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
});
    // ==========================================
    // 6. BANK SOAL
    // ==========================================
    async function loadDataSoal() {
        const m = document.getElementById('filter-soal-mapel').value;
        const k = document.getElementById('filter-soal-kelas').value;
        const listContainer = document.getElementById('list-soal');

        if(!m || !k) return;
        
        listContainer.innerHTML = `<div style="padding: 20px;"><div class="skeleton-box" style="width: 100%;"></div><div class="skeleton-box" style="width: 70%;"></div></div>`;

        try {
            const qS = query(collection(db, "bank_soal"), where("mataPelajaran", "==", m), where("kelas", "==", k));
            const snap = await getDocs(qS);
            
            allSoalData = []; snap.forEach(d => allSoalData.push({id: d.id, ...d.data()}));
            allSoalData.sort((a,b) => a.nomor_soal - b.nomor_soal);
            filteredSoalData = allSoalData;
            
            document.getElementById('stat-soal').innerText = allSoalData.length;

            listContainer.innerHTML = '';
            if(allSoalData.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--danger); background:white; border:1px solid var(--border-color); border-radius:8px;">Belum ada soal untuk kelas ini. Klik tombol Tambah Soal di atas untuk menambahkan.</div>';
                document.getElementById('btn-preview-full').style.display = 'none'; return;
            }

            allSoalData.forEach(dat => {
                let statusMedia = dat.media_soal ? '<i class="fas fa-paperclip" style="color:var(--success); margin-left:5px;"></i>' : '';
                listContainer.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; background:white; padding:15px; border:1px solid var(--border-color); border-radius:8px; gap:15px;">
                        <div style="flex:1;">
                            <div style="margin-bottom:5px;">
                                <span style="font-weight:bold; color:var(--secondary);">Soal No. ${dat.nomor_soal === 999 ? '-' : dat.nomor_soal}</span>
                                <span style="background:var(--primary-light); color:var(--primary-hover); font-weight:bold; padding:2px 6px; border-radius:4px; font-size:0.75rem; margin-left:8px;">${dat.tipe}</span>
                            </div>
                            <div style="color:var(--secondary); font-size:0.95rem;">${dat.teks_soal.substring(0,80)}... ${statusMedia}</div>
                        </div>
                        <div>
                            <button onclick="window.editSoal('${dat.id}')" class="btn-3d" style="background:var(--warning); padding:8px 15px; font-size:0.85rem; margin:0;" title="Edit Soal"><i class="fas fa-edit"></i> Edit</button>
                            <button onclick="window.hapusDokumen('bank_soal', '${dat.id}', window.loadDataSoalRefresh)" class="btn-3d" style="background:var(--danger); padding:8px 15px; font-size:0.85rem; margin:0; margin-left: 5px;" title="Hapus Soal"><i class="fas fa-trash"></i> Hapus</button>
                        </div>
                    </div>`;
            });
            document.getElementById('btn-preview-full').style.display = 'inline-block';
        } catch(e) { listContainer.innerHTML = '<div style="text-align:center; color:red; padding:20px;">Gagal memuat data dari database.</div>'; }
    }
    window.loadDataSoal = loadDataSoal; 
    window.loadDataSoalRefresh = () => { loadDataSoal(); loadBankSoalSummary(); };

    document.getElementById('close-modal-soal')?.addEventListener('click', () => { document.getElementById('modal-tambah-soal').style.display = 'none'; });
    document.getElementById('tab-manual')?.addEventListener('click', () => { document.getElementById('area-manual').style.display = 'block'; document.getElementById('area-import').style.display = 'none'; document.getElementById('tab-manual').classList.remove('btn-secondary'); document.getElementById('tab-import').classList.add('btn-secondary'); });
    document.getElementById('tab-import')?.addEventListener('click', () => { document.getElementById('area-manual').style.display = 'none'; document.getElementById('area-import').style.display = 'block'; document.getElementById('tab-import').classList.remove('btn-secondary'); document.getElementById('tab-manual').classList.add('btn-secondary'); });
    document.getElementById('soal-tipe')?.addEventListener('change', (e) => renderFormDinamis(e.target.value));

    function renderFormDinamis(tipe) {
        const areaOpsi = document.getElementById('area-opsi-dinamis'); if (!areaOpsi) return; areaOpsi.innerHTML = ''; 
        if (tipe === 'PG' || tipe === 'PGK') {
            areaOpsi.innerHTML = ['A','B','C','D','E'].map(opt => `
                <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; flex-wrap: wrap; background: white; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <input type="${tipe==='PG'?'radio':'checkbox'}" name="${tipe==='PG'?'kunci_pg':'kunci_pgk'}" value="${opt}" class="${tipe==='PGK'?'kunci_pgk':''}" style="transform: scale(1.2);">
                    <label style="font-weight: bold; width: 20px;">${opt}</label>
                    <input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="flex: 1; min-width: 200px;">
                    <input type="file" id="media-opsi-${opt}" class="input-text" accept="image/*, audio/*, video/*" style="flex: 1; min-width: 200px;" title="Media Opsi ${opt}">
                </div>`).join('');
        }
        else if (tipe === 'Menjodohkan') { areaOpsi.innerHTML = `<div id="container-jodoh">${[1,2,3].map(num => `<div style="display: flex; gap: 10px; margin-bottom: 8px;"><input type="text" class="jodoh-kiri input-text" placeholder="Pernyataan ${num}"><input type="text" class="jodoh-kanan input-text" placeholder="Jawaban ${num}"></div>`).join('')}</div>`; }
        else if (tipe === 'Isian') { areaOpsi.innerHTML = `<label>Kunci Jawaban Singkat</label><input type="text" id="kunci_isian" class="input-text" placeholder="Ketik jawaban benar">`; }
        else if (tipe === 'Uraian') { areaOpsi.innerHTML = `<label>Panduan Penilaian / Rubrik</label><textarea id="rubrik_uraian" class="input-text" rows="2" placeholder="Siswa harus menjawab..."></textarea>`; }
    }

    document.getElementById('btn-simpan-soal')?.addEventListener('click', async () => {
        const mapel = document.getElementById('soal-mapel').value; const kelas = document.getElementById('soal-kelas').value; const noSoal = document.getElementById('soal-nomor').value; const tipe = document.getElementById('soal-tipe').value; const teks = document.getElementById('soal-teks').value.trim();
        if (!mapel || !kelas || !noSoal) return await window.customAlert("Pilih Mapel, Kelas, dan Isi Nomor Soal!", "warning");

        const btnSimpan = document.getElementById('btn-simpan-soal'); const origBtnText = btnSimpan.innerHTML;
        btnSimpan.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...'; btnSimpan.disabled = true;

        try {
            let mediaSoalObj = null; const fileSoal = document.getElementById('soal-media')?.files[0]; if (fileSoal) mediaSoalObj = await uploadFileKeStorage(fileSoal);
            let opsiMediaObj = {}; if (tipe === 'PG' || tipe === 'PGK') { for (let opt of ['A','B','C','D','E']) { let fileOpsi = document.getElementById(`media-opsi-${opt}`)?.files[0]; if (fileOpsi) opsiMediaObj[opt] = await uploadFileKeStorage(fileOpsi); } }

            let payload = { mataPelajaran: mapel, kelas: kelas, nomor_soal: parseInt(noSoal), tipe: tipe, teks_soal: teks, createdAt: new Date() };
            if (mediaSoalObj) payload.media_soal = mediaSoalObj;
            if (Object.keys(opsiMediaObj).length > 0) payload.opsi_media = opsiMediaObj;

            if (tipe === 'PG') { payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value }; payload.kunci_jawaban = document.querySelector('input[name="kunci_pg"]:checked')?.value || ""; } 
            else if (tipe === 'PGK') { payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value }; let kunci = []; document.querySelectorAll('.kunci_pgk:checked').forEach(cb => kunci.push(cb.value)); payload.kunci_jawaban = kunci; } 
            else if (tipe === 'Menjodohkan') { let pasangan = []; document.querySelectorAll('.jodoh-kiri').forEach((el, idx) => { let kanan = document.querySelectorAll('.jodoh-kanan')[idx]; if (el.value) pasangan.push({ premis: el.value, target: kanan.value }); }); payload.pasangan = pasangan; } 
            else if (tipe === 'Isian') { payload.kunci_jawaban = document.getElementById('kunci_isian').value.toLowerCase(); } 
            else if (tipe === 'Uraian') { payload.rubrik = document.getElementById('rubrik_uraian').value; }

            await addDoc(collection(db, "bank_soal"), payload); 
            
            document.querySelectorAll('input[type="file"]').forEach(input => input.value = ''); document.getElementById('soal-teks').value = '';
            await window.customAlert("Soal berhasil ditambahkan!", "success"); document.getElementById('modal-tambah-soal').style.display = 'none'; 
            if(document.getElementById('view-soal-list').style.display === 'block') { loadDataSoalRefresh(); } else { loadBankSoalSummary(); }
        } catch (error) { await window.customAlert("Gagal menyimpan.", "error"); }
        btnSimpan.innerHTML = origBtnText; btnSimpan.disabled = false;
    });

    let selectedExcelSoal = null; let selectedWordSoal = null;
    document.getElementById('file-excel')?.addEventListener('change', (e) => { selectedExcelSoal = e.target.files[0]; const label = document.getElementById('label-file-excel'); const box = document.getElementById('box-excel'); if(selectedExcelSoal) { label.innerHTML = `<b style="color:var(--success);">${selectedExcelSoal.name}</b>`; box.style.borderColor = "var(--success)"; box.style.background = "#f0fdf4"; selectedWordSoal = null; document.getElementById('file-word').value = ''; const lw = document.getElementById('label-file-word'); const bw = document.getElementById('box-word'); if(lw) { lw.innerHTML = `Klik untuk pilih file`; bw.style.borderColor = "#cbd5e1"; bw.style.background = "#f8fafc"; } } });
    document.getElementById('file-word')?.addEventListener('change', (e) => { selectedWordSoal = e.target.files[0]; const label = document.getElementById('label-file-word'); const box = document.getElementById('box-word'); if(selectedWordSoal) { label.innerHTML = `<b style="color:var(--info);">${selectedWordSoal.name}</b>`; box.style.borderColor = "var(--info)"; box.style.background = "#eff6ff"; selectedExcelSoal = null; document.getElementById('file-excel').value = ''; const le = document.getElementById('label-file-excel'); const be = document.getElementById('box-excel'); if(le) { le.innerHTML = `Klik untuk pilih file`; be.style.borderColor = "#cbd5e1"; be.style.background = "#f8fafc"; } } });
    document.getElementById('btn-dl-excel')?.addEventListener('click', (e) => { e.preventDefault(); const ws_data = [["No", "Tipe", "Soal", "Media Soal", "OpsiA", "Media A", "OpsiB", "Media B", "OpsiC", "Media C", "OpsiD", "Media D", "OpsiE", "Media E", "Kunci", "Rubrik"], [1, "PG", "Contoh Soal", "", "A", "", "B", "", "C", "", "D", "", "E", "", "A", ""]]; const ws = XLSX.utils.aoa_to_sheet(ws_data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Soal"); XLSX.writeFile(wb, "Template_Soal.xlsx"); });
    document.getElementById('btn-dl-word')?.addEventListener('click', (e) => { e.preventDefault(); const content = `<html><body><p>NO: 1<br>TIPE: PG<br>SOAL: Contoh Soal?<br>A. Opsi A<br>B. Opsi B<br>KUNCI: A</p></body></html>`; const blob = new Blob(['\ufeff', content], { type: 'application/msword' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Template_Soal.doc'; a.click(); });

    document.getElementById('btn-proses-import-soal')?.addEventListener('click', async () => {
        if (!selectedExcelSoal && !selectedWordSoal) return await window.customAlert("Pilih file Excel atau Word terlebih dahulu!", "warning");
        const mapel = document.getElementById('import-mapel').value; const kelas = document.getElementById('import-kelas').value;
        if (!mapel || !kelas) return await window.customAlert("Pilih Mapel dan Kelas tujuan!", "warning");

        const btn = document.getElementById('btn-proses-import-soal'); const origText = btn.innerHTML; btn.disabled = true;

        if (selectedExcelSoal) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }); const jsonSoal = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    if (!(await window.customConfirm(`Import ${jsonSoal.length} soal?`))) { btn.innerHTML = origText; btn.disabled = false; return; }

                    for (let [index, row] of jsonSoal.entries()) {
                        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Memproses ${index + 1}/${jsonSoal.length}...`;
                        const tipe = (row.Tipe || 'PG').toString().toUpperCase(); const nomorSoal = parseInt(row['Nomor Soal'] || row['No'] || (index + 1));
                        let payload = { mataPelajaran: mapel, kelas: kelas, nomor_soal: nomorSoal, tipe: tipe, teks_soal: row.Soal, createdAt: new Date() };
                        if (tipe === 'PG') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = (row.Kunci||"A").toString().toUpperCase(); } 
                        else if (tipe === 'PGK') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = row.Kunci ? row.Kunci.toString().replace(/\s/g, '').toUpperCase().split(',') : []; }
                        else if (tipe === 'MENJODOHKAN') { let pasangan = []; ['OpsiA', 'OpsiB', 'OpsiC', 'OpsiD', 'OpsiE'].forEach(opt => { if(row[opt] && row[opt].includes('=')) { let parts = row[opt].split('='); pasangan.push({ premis: parts[0].trim(), target: parts[1].trim() }); } }); payload.pasangan = pasangan; }
                        else if (tipe === 'ISIAN') { payload.kunci_jawaban = (row.Kunci || "").toString().toLowerCase(); }
                        else if (tipe === 'URAIAN') { payload.rubrik = row['Keterangan/Rubrik'] || row.Rubrik || ""; }
                        await addDoc(collection(db, "bank_soal"), payload); 
                    }
                    await window.customAlert(`Import Berhasil!`, "success"); document.getElementById('modal-tambah-soal').style.display = 'none'; 
                    if(document.getElementById('view-soal-list').style.display === 'block') { loadDataSoalRefresh(); } else { loadBankSoalSummary(); }
                } catch (err) { await window.customAlert("Gagal membaca Excel.", "error"); }
                btn.innerHTML = origText; btn.disabled = false;
            };
            reader.readAsArrayBuffer(selectedExcelSoal);
        } else if (selectedWordSoal) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const result = await mammoth.convertToHtml({arrayBuffer: e.target.result}, { convertImage: mammoth.images.imgElement(img => img.read("base64").then(b => ({src: "data:"+img.contentType+";base64,"+b}))) });
                    const div = document.createElement('div'); div.innerHTML = result.value;
                    let qList = [], curr = null;
                    div.childNodes.forEach(el => {
                        let txt = (el.textContent || "").replace(/\s+/g, ' ').trim(), upper = txt.toUpperCase(), img = el.querySelector('img')?.src;
                        if (upper.match(/^NO\s*:/)) {
                            if(curr) qList.push(curr);
                            let no = parseInt(upper.replace('NO', '').replace(':', '').trim()) || (qList.length + 1);
                            curr = { nomor_soal: no, tipe: 'PG', teks_soal: '', opsi: {A:'',B:'',C:'',D:'',E:''}, kunci_jawaban: '', media_soal: null, opsi_media: {} };
                        } else if(curr) {
                            if (upper.startsWith('TIPE:')) curr.tipe = upper.split(':')[1]?.trim() || 'PG';
                            else if (upper.startsWith('SOAL:')) { curr.teks_soal += txt.replace(/SOAL\s*:/i, '').trim(); if(img) curr.media_soal = img; }
                            else if (upper.match(/^[A-E]\s*\./)) { let lbl = upper[0]; curr.opsi[lbl] += txt.substring(txt.indexOf('.') + 1).trim(); if(img) curr.opsi_media[lbl] = img; }
                            else if (upper.startsWith('KUNCI:')) curr.kunci_jawaban = upper.split(':')[1]?.trim() || '';
                            else if (upper.startsWith('RUBRIK:')) curr.rubrik = txt.replace(/RUBRIK\s*:/i, '').trim();
                        }
                    });
                    if(curr) qList.push(curr);

                    if (!(await window.customConfirm(`Terdeteksi ${qList.length} soal. Lanjutkan import?`))) { btn.innerHTML = origText; btn.disabled = false; return; }
                    for (let i = 0; i < qList.length; i++) {
                        let q = qList[i]; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Memproses ${i + 1}/${qList.length}...`;
                        let pay = { mataPelajaran: mapel, kelas, nomor_soal: q.nomor_soal, tipe: q.tipe, teks_soal: q.teks_soal, createdAt: new Date() };
                        if(q.rubrik) pay.rubrik = q.rubrik;
                        if(q.media_soal) pay.media_soal = await uploadFileKeStorage(base64ToFile(q.media_soal, `s_${Date.now()}.jpg`));
                        if(q.tipe === 'PG' || q.tipe === 'PGK') {
                            pay.opsi = q.opsi; pay.kunci_jawaban = q.kunci_jawaban;
                            let om = {}; for(let k in q.opsi_media) { om[k] = await uploadFileKeStorage(base64ToFile(q.opsi_media[k], `o_${k}.jpg`)); }
                            if(Object.keys(om).length > 0) pay.opsi_media = om;
                        }
                        await addDoc(collection(db, "bank_soal"), pay); 
                    }
                    await window.customAlert(`Import Word Berhasil!`, "success"); document.getElementById('modal-tambah-soal').style.display = 'none'; 
                    if(document.getElementById('view-soal-list').style.display === 'block') { loadDataSoalRefresh(); } else { loadBankSoalSummary(); }
                } catch (err) { console.error(err); await window.customAlert("Format Word tidak sesuai template.", "error"); }
                btn.innerHTML = origText; btn.disabled = false;
            };
            reader.readAsArrayBuffer(selectedWordSoal);
        }
    });

    window.editSoal = (id) => {
        const qData = filteredSoalData.find(s => s.id === id); if (!qData) return;
        document.getElementById('edit-soal-id').value = qData.id; document.getElementById('edit-soal-mapel').value = qData.mataPelajaran || ''; document.getElementById('edit-soal-kelas').value = qData.kelas || ''; document.getElementById('edit-soal-nomor').value = qData.nomor_soal === 999 ? '' : qData.nomor_soal; document.getElementById('edit-soal-tipe').value = qData.tipe || 'PG'; document.getElementById('edit-soal-teks').value = qData.teks_soal || '';
        
        const areaOpsi = document.getElementById('edit-area-opsi-dinamis'); areaOpsi.innerHTML = ''; 
        if (qData.tipe === 'PG' || qData.tipe === 'PGK') {
            areaOpsi.innerHTML = ['A','B','C','D','E'].map(opt => `
                <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; background: white; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <input type="${qData.tipe==='PG'?'radio':'checkbox'}" name="edit_kunci" value="${opt}" ${qData.kunci_jawaban?.includes(opt) ? 'checked' : ''}>
                    <label style="font-weight: bold; width: 20px;">${opt}</label>
                    <input type="text" id="edit-opsi-${opt}" class="input-text" value="${qData.opsi?.[opt] || ''}" style="flex: 1;">
                </div>`).join('');
        } else if (qData.tipe === 'Isian') { areaOpsi.innerHTML = `<input type="text" id="edit_kunci_isian" class="input-text" value="${qData.kunci_jawaban || ''}">`; }
        else if (qData.tipe === 'Uraian') { areaOpsi.innerHTML = `<textarea id="edit_rubrik_uraian" class="input-text" rows="2">${qData.rubrik || ''}</textarea>`; }
        
        document.getElementById('modal-edit-soal').style.display = 'flex';
    };

    document.getElementById('close-modal-edit-soal').onclick = () => document.getElementById('modal-edit-soal').style.display = 'none';

    document.getElementById('btn-update-soal').onclick = async () => {
        const id = document.getElementById('edit-soal-id').value; const btn = document.getElementById('btn-update-soal'); btn.innerHTML = 'Memperbarui...'; btn.disabled = true;
        try {
            let payload = { mataPelajaran: document.getElementById('edit-soal-mapel').value, kelas: document.getElementById('edit-soal-kelas').value, nomor_soal: parseInt(document.getElementById('edit-soal-nomor').value), tipe: document.getElementById('edit-soal-tipe').value, teks_soal: document.getElementById('edit-soal-teks').value };
            if(payload.tipe === 'PG') { payload.opsi = {A: document.getElementById('edit-opsi-A').value, B: document.getElementById('edit-opsi-B').value, C: document.getElementById('edit-opsi-C').value, D: document.getElementById('edit-opsi-D').value, E: document.getElementById('edit-opsi-E').value}; payload.kunci_jawaban = document.querySelector('input[name="edit_kunci"]:checked')?.value || ""; }
            else if(payload.tipe === 'Isian') { payload.kunci_jawaban = document.getElementById('edit_kunci_isian').value; }
            else if(payload.tipe === 'Uraian') { payload.rubrik = document.getElementById('edit_rubrik_uraian').value; }
            await updateDoc(doc(db, "bank_soal", id), payload); await window.customAlert("Berhasil diperbarui!", "success"); document.getElementById('modal-edit-soal').style.display = 'none'; window.loadDataSoalRefresh();
        } catch(e) { await window.customAlert("Gagal.", "error"); }
        btn.innerHTML = 'PERBARUI SOAL'; btn.disabled = false;
    };

    document.getElementById('btn-preview-full').onclick = () => { if(filteredSoalData.length === 0) return customAlert("Tampilkan soal dulu!", "warning"); document.getElementById('modal-preview-full').style.display = 'flex'; renderPreviewSoal(0); };
    document.getElementById('close-preview-full').onclick = () => document.getElementById('modal-preview-full').style.display = 'none';

    function renderPreviewSoal(idx) {
        previewCurrentIdx = idx; const q = filteredSoalData[idx];
        document.getElementById('prev-current-q-num').innerText = q.nomor_soal === 999 ? idx + 1 : q.nomor_soal; 
        document.getElementById('prev-badge-tipe').innerText = q.tipe || 'PG';
        
        let html = `<div class="q-text" style="font-size: 1.15rem; margin-bottom: 25px; line-height: 1.6;">${q.teks_soal}</div>`;
        html += renderMediaHTML(q.media_soal);
        
        if (q.tipe === 'PG' || q.tipe === 'PGK' || !q.tipe) {
            html += `<div class="options-container" style="display: flex; flex-direction: column; gap: 12px;">`;
            ['A', 'B', 'C', 'D', 'E'].forEach(lbl => {
                if((q.opsi && q.opsi[lbl]) || (q.opsi_media && q.opsi_media[lbl])) {
                    let isKunci = false; if(q.tipe === 'PGK') isKunci = (Array.isArray(q.kunci_jawaban) && q.kunci_jawaban.includes(lbl)); else isKunci = (q.kunci_jawaban === lbl);
                    let bg = isKunci ? 'background:#d1fae5; border-color:#10b981;' : 'background:#f8fafc; border-color:var(--border-color);'; 
                    let type = q.tipe === 'PGK' ? 'checkbox' : 'radio';
                    let mediaOpsiHTML = q.opsi_media && q.opsi_media[lbl] ? renderMediaHTML(q.opsi_media[lbl]) : '';
                    let teksOpsiHTML = (q.opsi && q.opsi[lbl]) ? `<span style="font-size: 1.05rem;">${q.opsi[lbl]}</span>` : '';
                    html += `<label class="option-item" style="display: flex; padding: 15px 20px; border: 1.5px solid; border-radius: var(--radius-md); ${bg} margin: 0; cursor: default;">
                        <input type="${type}" disabled ${isKunci ? 'checked' : ''} style="margin-right: 15px; transform: scale(1.2);">
                        <span style="font-weight: bold; margin-right: 15px; font-size: 1.05rem;">${lbl}.</span>
                        <div style="display:flex; flex-direction:column; width: 100%;">${mediaOpsiHTML}${teksOpsiHTML}</div>
                    </label>`;
                }
            }); html += `</div>`;
        } 
        else if (q.tipe === 'Menjodohkan') {
            html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
            if(q.pasangan) { q.pasangan.forEach(p => { html += `<div style="display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);"><div style="flex: 1; font-weight: 500; font-size: 1.05rem;">${p.premis}</div><i class="fas fa-arrow-right" style="color: var(--text-muted);"></i><div style="flex: 1; font-weight:bold; color:var(--primary); padding: 10px; background: #d1fae5; border-radius: 6px; border: 1px solid #10b981; font-size: 1.05rem;">${p.target}</div></div>`; }); } 
            html += `</div>`;
        }
        else if (q.tipe === 'Isian') { html += `<div style="margin-top: 10px;"><input type="text" class="input-text" value="${q.kunci_jawaban || ''}" disabled style="background:#d1fae5; color:#059669; font-weight:bold; padding:15px; font-size: 1.1rem;"><p style="font-size:0.85rem; color:var(--text-muted); margin-top:8px;"><i class="fas fa-info-circle"></i> Warna hijau adalah kunci jawaban akurat.</p></div>`; }
        else if (q.tipe === 'Uraian') { html += `<div style="margin-top: 10px;"><textarea class="input-text" rows="6" disabled placeholder="(Siswa akan mengisi jawaban uraian di sini)" style="font-size: 1.05rem; padding: 15px;"></textarea><div style="margin-top:15px; padding:15px; background:#fffbeb; border:1px solid var(--warning); border-radius:8px;"><strong style="color:var(--warning);"><i class="fas fa-info-circle"></i> Rubrik / Panduan Penilaian Guru:</strong> <br><span style="color: var(--secondary); margin-top: 5px; display: inline-block;">${q.rubrik || '-'}</span></div></div>`; }

        document.getElementById('prev-q-container').innerHTML = html;
        document.getElementById('prev-btn-prev').style.visibility = idx === 0 ? 'hidden' : 'visible'; 
        const nextBtn = document.getElementById('prev-btn-next');
        if (idx === filteredSoalData.length - 1) { nextBtn.innerHTML = `SELESAI <i class="fas fa-flag-checkered"></i>`; nextBtn.classList.add('btn-finish-exam'); nextBtn.style.background = 'var(--danger)'; nextBtn.style.color = 'white'; } else { nextBtn.innerHTML = `SELANJUTNYA <i class="fas fa-chevron-right"></i>`; nextBtn.classList.remove('btn-finish-exam'); nextBtn.style.background = 'var(--primary)'; nextBtn.style.color = 'white'; }
        const grid = document.getElementById('prev-q-grid'); grid.innerHTML = '';
        filteredSoalData.forEach((dat, i) => { const b = document.createElement('div'); b.className = 'q-box'; if(i === idx) b.classList.add('active-q'); else b.classList.add('answered'); b.innerText = dat.nomor_soal === 999 ? i + 1 : dat.nomor_soal; b.onclick = () => renderPreviewSoal(i); grid.appendChild(b); });
    }
    
    document.getElementById('prev-btn-prev').onclick = () => renderPreviewSoal(previewCurrentIdx - 1);
    document.getElementById('prev-btn-next').onclick = () => { if (previewCurrentIdx < filteredSoalData.length - 1) { renderPreviewSoal(previewCurrentIdx + 1); } else { customAlert("Ini adalah soal terakhir. Di halaman siswa, tombol ini akan menyelesaikan ujian.", "info"); } };

    // ==========================================
    // 7. HASIL UJIAN (PER MAPEL & KELAS)
    // ==========================================
    async function loadDataHasil() {
        const snap = await getDocs(collection(db, "hasil_ujian")); document.getElementById('stat-ujian').innerText = snap.size;
        allHasilUjian = []; snap.forEach(d => allHasilUjian.push({id: d.id, ...d.data()}));
        const grid = document.getElementById('grid-mapel-hasil'); if(!grid) return; grid.innerHTML = '';
        
        let groupedResults = {};
        allHasilUjian.forEach(h => {
            let key = `${h.mataPelajaran}|${h.kelas}`;
            if (!groupedResults[key]) { groupedResults[key] = { mapel: h.mataPelajaran, kelas: h.kelas, count: 0 }; }
            groupedResults[key].count++;
        });

        let displayedResults = Object.values(groupedResults);
        if (!isAdmin && isGuru) { displayedResults = displayedResults.filter(g => userMapel.includes(g.mapel) && userKelas.includes(g.kelas)); }

        if (displayedResults.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 20px; color: var(--text-muted);">Belum ada data ujian siswa masuk.</div>';
            return;
        }

        displayedResults.forEach(g => { 
            grid.innerHTML += `
            <div class="mapel-card" onclick="window.openDetailHasil('${g.mapel}', '${g.kelas}')" style="background: white; padding: 20px; border-radius: 8px; box-shadow: var(--shadow-sm); cursor: pointer; border: 1px solid var(--border-color); transition: transform 0.2s;">
                <h3 style="margin: 0 0 5px 0; color: var(--secondary); font-size: 1.15rem;">${g.mapel}</h3>
                <p style="margin: 0 0 10px 0; color: var(--info); font-weight: bold; font-size: 0.95rem;"><i class="fas fa-users"></i> KELAS: ${g.kelas}</p>
                <p style="margin: 0; color: var(--success); font-weight: bold; font-size: 0.9rem;"><i class="fas fa-check-circle"></i> ${g.count} Siswa Selesai</p>
            </div>`; 
        });
    }

    window.hapusLangsung = async (coll, id, rowElement) => {
        rowElement.innerHTML = '<td colspan="4" style="text-align:center; color: var(--danger);"><i class="fas fa-spinner fa-spin"></i> Menghapus...</td>';
        try { await deleteDoc(doc(db, coll, id)); window.refreshHasil(); } 
        catch (e) { window.customAlert("Gagal menghapus data", "error"); }
    };

    window.openDetailHasil = (mapel, kelas) => {
        currentMapelDetail = mapel; 
        currentKelasDetail = kelas; 
        window.location.hash = 'section-hasil-detail'; 
        document.getElementById('label-mapel-detail').innerHTML = `${mapel} <span style="font-weight:normal; font-size:0.95rem; color:var(--text-muted);">(Kelas: ${kelas})</span>`;
        
        const tbody = document.querySelector('#table-hasil tbody'); tbody.innerHTML = '';
        const filtered = allHasilUjian.filter(h => h.mataPelajaran === mapel && h.kelas === kelas);
        
        filtered.forEach(h => { 
            let aksiHTML = '<span style="color:var(--text-muted);">-</span>';
            if (isAdmin) { aksiHTML = `<button onclick="window.hapusLangsung('hasil_ujian', '${h.id}', this.parentElement.parentElement)" style="color: var(--danger); border: none; background: none; cursor: pointer; font-size: 1.2rem; transition: 0.2s;" title="Hapus Data Ini Langsung"><i class="fas fa-trash"></i></button>`; }

            tbody.innerHTML += `<tr>
                <td><b>${h.namaSiswa}</b></td>
                <td>${h.benar}/${h.totalSoal}</td>
                <td><b style="color: var(--primary); font-size: 1.1rem;">${h.nilai}</b></td>
                <td style="text-align: center;">${aksiHTML}</td>
            </tr>`; 
        });
    };

    window.refreshHasil = () => { loadDataHasil(); if(currentMapelDetail && currentKelasDetail) window.openDetailHasil(currentMapelDetail, currentKelasDetail); };

    document.getElementById('btn-hapus-semua-hasil')?.addEventListener('click', async () => {
        if (!currentMapelDetail || !currentKelasDetail) return;
        if (await window.customConfirm(`Hapus SEMUA data hasil ujian untuk mapel ${currentMapelDetail} di Kelas ${currentKelasDetail}? Tindakan ini tidak bisa dibatalkan.`, "danger", "Kosongkan Data")) {
            
            const btnHapusAll = document.getElementById('btn-hapus-semua-hasil');
            const origText = btnHapusAll.innerHTML;
            btnHapusAll.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghapus Massal...';
            btnHapusAll.disabled = true;
            
            try {
                const dataAkanDihapus = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && h.kelas === currentKelasDetail);
                await Promise.all(dataAkanDihapus.map(h => deleteDoc(doc(db, "hasil_ujian", h.id))));
                
                await window.customAlert(`${dataAkanDihapus.length} data berhasil dikosongkan!`, "success");
                window.refreshHasil(); 
                window.history.back();
            } catch (e) { await window.customAlert("Terjadi kesalahan saat menghapus data massal.", "error"); }
            btnHapusAll.innerHTML = origText; btnHapusAll.disabled = false;
        }
    });

    window.hapusDokumen = async (coll, id, callback) => { if(await customConfirm("Data akan dihapus permanen. Lanjutkan?", "danger")) { await deleteDoc(doc(db, coll, id)); if(callback) callback(); } };

});
