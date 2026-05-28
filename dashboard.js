import { auth, db, storage, functions } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ==========================================
// 0. INJEKSI CSS CUSTOM UNTUK DROPDOWN CHECKBOX
// ==========================================
if (!document.getElementById('cbt-custom-css')) {
    const style = document.createElement('style');
    style.id = 'cbt-custom-css';
    style.innerHTML = `
        .dropdown-check { position: relative; display: inline-block; width: 100%; min-width: 140px; }
        .dropdown-check-btn { width: 100%; padding: 8px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 600; color: var(--secondary); transition: 0.2s; }
        .dropdown-check-btn:hover { border-color: var(--primary); }
        .dropdown-check-content { display: none; position: absolute; background-color: white; width: 100%; min-width: 180px; box-shadow: 0px 10px 25px rgba(0,0,0,0.15); z-index: 1000; border-radius: 8px; border: 1px solid #e2e8f0; max-height: 220px; overflow-y: auto; padding: 8px 0; top: 100%; margin-top: 5px; left: 0; }
        .dropdown-check-content label { display: flex; align-items: center; padding: 8px 15px; cursor: pointer; gap: 10px; font-size: 0.85rem; font-weight: 600; color: var(--text-main); transition: 0.2s; margin: 0; }
        .dropdown-check-content label:hover { background-color: #f1f5f9; color: var(--primary); }
        .dropdown-check-content input[type="checkbox"] { transform: scale(1.3); cursor: pointer; }
        .dropdown-check.show .dropdown-check-content { display: block; }
        .card { overflow: visible !important; }
        #view-summary-bank-soal .table-container { min-height: 350px; padding-bottom: 120px; }
    `;
    document.head.appendChild(style);
}

// ==========================================
// 1. VARIABEL GLOBAL & STATE APLIKASI
// ==========================================
let listMapel = []; let listKelas = []; let allUsersData = []; let allHasilUjian = []; 
let currentMapelDetail = ""; let currentKelasDetail = ""; let isAdmin = false; let isGuru = false; 
let userMapel = []; let userKelas = []; let editMasterMode = false;

// ==========================================
// 2. PEMBACAAN SESI & KEAMANAN AWAL
// ==========================================
try { 
    let userRoles = JSON.parse(localStorage.getItem("userRole") || "[]"); 
    userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]"); 
    userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
    isAdmin = userRoles.includes("admin"); isGuru = userRoles.includes("guru");
} catch (e) { isAdmin = false; isGuru = false; }

// ==========================================
// 3. KOMPONEN MODAL GLOBAL
// ==========================================
window.customAlert = (msg, type = 'info', title = '') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-alert');
        if (!modal) { alert(msg); return resolve(); }
        const icon = document.getElementById('alert-icon'); const titleEl = document.getElementById('alert-title'); const messageEl = document.getElementById('alert-message'); const btnOk = document.getElementById('btn-alert-ok');
        let color = 'var(--info)'; let iconClass = 'fas fa-info-circle'; let defaultTitle = 'Informasi';
        if (type === 'success') { color = 'var(--success)'; iconClass = 'fas fa-check-circle'; defaultTitle = 'Berhasil'; }
        else if (type === 'error') { color = 'var(--danger)'; iconClass = 'fas fa-times-circle'; defaultTitle = 'Gagal / Error'; }
        else if (type === 'warning') { color = 'var(--warning)'; iconClass = 'fas fa-exclamation-triangle'; defaultTitle = 'Peringatan'; }
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        if(icon) { icon.className = `${iconClass} fa-4x`; icon.style.color = color; }
        if(btnOk) btnOk.style.backgroundColor = color;
        if(titleEl) titleEl.innerText = title || defaultTitle;
        if(messageEl) messageEl.innerText = msg;
        modal.style.display = 'flex';
        if(btnOk) btnOk.onclick = () => { modal.style.display = 'none'; resolve(); };
    });
};

window.customConfirm = (msg, type = 'warning', title = 'Konfirmasi', okText = 'Ya, Lanjutkan') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-confirm');
        if (!modal) { return resolve(confirm(msg)); }
        const icon = document.getElementById('confirm-icon'); const titleEl = document.getElementById('confirm-title'); const messageEl = document.getElementById('confirm-message'); const btnOk = document.getElementById('btn-confirm-ok'); const btnCancel = document.getElementById('btn-confirm-cancel');
        let color = 'var(--warning)'; let iconClass = 'fas fa-question-circle';
        if (type === 'danger') { color = 'var(--danger)'; iconClass = 'fas fa-exclamation-triangle'; }
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        if(icon) { icon.className = `${iconClass} fa-4x`; icon.style.color = color; }
        if(btnOk) { btnOk.style.backgroundColor = color; btnOk.innerText = okText; }
        if(titleEl) titleEl.innerText = title;
        if(messageEl) messageEl.innerText = msg;
        modal.style.display = 'flex';
        if(btnOk) btnOk.onclick = () => { modal.style.display = 'none'; resolve(true); };
        if(btnCancel) btnCancel.onclick = () => { modal.style.display = 'none'; resolve(false); };
    });
};

// ==========================================
// 4. ROUTING MENU UTAMA (SPA)
// ==========================================
function handleRouting() {
    let hash = window.location.hash.substring(1) || 'section-beranda';
    if (hash === 'section-pengaturan' && !isAdmin) hash = 'section-beranda';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

    if (hash === 'section-hasil-detail') {
        if (!currentMapelDetail || !currentKelasDetail) { window.location.hash = 'section-hasil'; return; }
        const secHasil = document.getElementById('section-hasil'); if(secHasil) secHasil.classList.add('active');
        const sView = document.getElementById('hasil-summary-view'); const dView = document.getElementById('hasil-detail-view');
        if(sView) sView.style.display = 'none'; if(dView) dView.style.display = 'block';
        return;
    }

    const target = document.getElementById(hash); if (target) target.classList.add('active');
    
    if (hash === 'section-hasil') { 
        if(typeof window.loadDataHasil === "function") window.loadDataHasil();
        const sView = document.getElementById('hasil-summary-view'); const dView = document.getElementById('hasil-detail-view');
        if(sView) sView.style.display = 'block'; if(dView) dView.style.display = 'none'; 
        currentMapelDetail = ""; currentKelasDetail = "";
    }
}
window.addEventListener('hashchange', handleRouting);
if (!window.location.hash) { window.location.hash = 'section-beranda'; }
window.addEventListener('popstate', function() { if (!window.location.hash || window.location.hash === '') { window.location.hash = 'section-beranda'; }});

// ==========================================
// 5. INISIALISASI HALAMAN (DOM)
// ==========================================

// Fungsi Update Tampilan Role berdasarkan Checkbox (Siswa/Guru/Admin/Custom)
window.handleRoleChange = () => {
    const selectedRoles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(el => el.value);
    document.getElementById('group-edit-guru').style.display = (selectedRoles.includes('guru') || selectedRoles.some(r => r !== 'siswa' && r !== 'admin')) ? 'flex' : 'none';
    document.getElementById('group-edit-kelas-siswa').style.display = selectedRoles.includes('siswa') ? 'block' : 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    const filterKelas = document.getElementById('filter-kelas-pengguna');
    if (filterKelas) filterKelas.addEventListener('change', window.renderTablePengguna);

    const filterGuruInputs = ['search-guru-id', 'search-guru-nama', 'search-guru-role', 'search-guru-detail'];
    filterGuruInputs.forEach(id => { document.getElementById(id)?.addEventListener('input', window.renderTablePengguna); });

    const filterSiswaInputs = ['search-siswa-nis', 'search-siswa-nama', 'search-siswa-role', 'search-siswa-kelas'];
    filterSiswaInputs.forEach(id => { document.getElementById(id)?.addEventListener('input', window.renderTablePengguna); });

    document.getElementById('close-modal-edit-akun')?.addEventListener('click', () => { document.getElementById('modal-edit-akun').style.display = 'none'; });

    // Tambah Role Kustom Khusus Admin
    document.getElementById('btn-add-custom-role')?.addEventListener('click', () => {
        const roleVal = document.getElementById('input-custom-role').value.trim().toLowerCase();
        if (!roleVal) return;
        const container = document.getElementById('edit-role-container');
        if (!container.querySelector(`input[value="${roleVal}"]`)) {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" class="edit-role-cb" value="${roleVal}" checked> <span style="text-transform:capitalize;">${roleVal}</span>`;
            container.appendChild(label);
            label.querySelector('input').addEventListener('change', window.handleRoleChange);
        }
        document.getElementById('input-custom-role').value = '';
        window.handleRoleChange();
    });

    document.addEventListener('click', (e) => {
        const header = e.target.closest('.toggle-accordion');
        if (header) {
            const targetId = header.getAttribute('data-target'); const target = document.getElementById(targetId); const icon = header.querySelector('.toggle-icon');
            if (!target) return;
            if (target.style.display === 'none' || target.style.display === '') { target.style.display = 'block'; if (icon) icon.style.transform = 'rotate(180deg)'; header.style.background = '#f8fafc'; } 
            else { target.style.display = 'none'; if (icon) icon.style.transform = 'rotate(0deg)'; header.style.background = '#ffffff'; }
        }
        if (!e.target.closest('.dropdown-check')) {
            document.querySelectorAll('.dropdown-check.show').forEach(d => d.classList.remove('show'));
        }
    });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = async () => { 
            if (await window.customConfirm("Yakin ingin keluar dari aplikasi?", "warning", "Konfirmasi Keluar", "Ya, Keluar")) { 
                await signOut(auth); localStorage.clear(); window.location.replace("index.html"); 
            } 
        };
    }

    document.getElementById('btn-open-data-master')?.addEventListener('click', () => { document.getElementById('modal-data-master').style.display = 'flex'; editMasterMode = false; window.renderTableMaster(); });
    document.getElementById('btn-tambah-langsung')?.addEventListener('click', () => { window.bukaModalTambahSoal(); });
    document.getElementById('close-modal-data-master')?.addEventListener('click', () => { document.getElementById('modal-data-master').style.display = 'none'; });
    
    document.getElementById('btn-edit-master-mode')?.addEventListener('click', () => { 
        editMasterMode = !editMasterMode;
        const btn = document.getElementById('btn-edit-master-mode');
        if (editMasterMode) { btn.innerHTML = '<i class="fas fa-check"></i> Selesai Edit'; btn.classList.remove('btn-secondary'); btn.style.backgroundColor = 'var(--success)'; } 
        else { btn.innerHTML = '<i class="fas fa-edit"></i> Mode Hapus Data'; btn.classList.add('btn-secondary'); btn.style.backgroundColor = ''; }
        window.renderTableMaster();
    });

    document.getElementById('btn-add-master')?.addEventListener('click', async () => {
        const type = document.getElementById('input-master-type').value; const val = document.getElementById('input-master-name').value.trim(); 
        if (!val) return window.customAlert("Masukkan nama terlebih dahulu!", "warning");
        if (type === 'mapel') {
            if (listMapel.includes(val)) return await window.customAlert("Mata Pelajaran sudah ada!", "warning");
            listMapel.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true });
        } else {
            if (listKelas.includes(val)) return await window.customAlert("Kelas sudah ada!", "warning");
            listKelas.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true });
        }
        document.getElementById('input-master-name').value = ''; window.loadDataMaster(); await window.customAlert("Data berhasil ditambahkan!", "success");
    });
    
    document.getElementById('soal-tipe')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const pgOpts = document.getElementById('pg-options'); const menjodohkanOpts = document.getElementById('menjodohkan-options'); const essayOpts = document.getElementById('essay-options'); 
        const kunciPg = document.querySelectorAll('.kunci-pg-container'); const kunciPgk = document.querySelectorAll('.kunci-pgk-container');
        
        if (val !== 'Menjodohkan') { document.getElementById('pasangan-container').innerHTML = ''; }
        
        if (val === 'PG' || val === 'PGK') {
            if(pgOpts) pgOpts.style.display = 'block'; if(menjodohkanOpts) menjodohkanOpts.style.display = 'none'; if(essayOpts) essayOpts.style.display = 'none';
            kunciPg.forEach(c => c.style.display = (val === 'PG') ? 'inline-block' : 'none'); kunciPgk.forEach(c => c.style.display = (val === 'PGK') ? 'inline-block' : 'none');
        } else if (val === 'Menjodohkan') {
            if(pgOpts) pgOpts.style.display = 'none'; if(menjodohkanOpts) menjodohkanOpts.style.display = 'block'; if(essayOpts) essayOpts.style.display = 'none';
        } else { 
            if(pgOpts) pgOpts.style.display = 'none'; if(menjodohkanOpts) menjodohkanOpts.style.display = 'none'; if(essayOpts) essayOpts.style.display = 'block';
        }
    });

    document.getElementById('btn-tambah-pasangan')?.addEventListener('click', () => {
        const container = document.getElementById('pasangan-container'); const row = document.createElement('div');
        row.className = 'pasangan-item'; row.style.cssText = 'display:flex; gap:10px; margin-bottom:10px;';
        row.innerHTML = `<input type="text" class="input-text m-kiri" placeholder="Pernyataan Kiri" required><input type="text" class="input-text m-kanan" placeholder="Pasangan Kanan" required><button type="button" class="btn-hapus-pasangan" style="background:var(--danger); color:white; border:none; padding:0 15px; border-radius:8px; cursor:pointer;"><i class="fas fa-trash"></i></button>`;
        container.appendChild(row);
    });
    document.getElementById('pasangan-container')?.addEventListener('click', (e) => { if(e.target.closest('.btn-hapus-pasangan')) { e.target.closest('.pasangan-item').remove(); } });

    document.getElementById('btn-back-mapel-list')?.addEventListener('click', () => {
        document.getElementById('view-summary-bank-soal').style.display = 'block'; document.getElementById('view-soal-list').style.display = 'none'; window.loadBankSoalSummary();
    });

    handleRouting();
});

// ==========================================
// 6. FIREBASE AUTHENTICATION LISTENER
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user || (!isAdmin && !isGuru)) { window.location.replace("index.html"); return; }
    let finalDisplayName = user.displayName;
    if (!finalDisplayName) { 
        try { const userDoc = await getDoc(doc(db, "users", user.uid)); if (userDoc.exists()) finalDisplayName = userDoc.data().nama; } catch(e) {} 
    }
    finalDisplayName = finalDisplayName || "Pengguna";

    const greetingText = document.getElementById('greeting-text'); 
    if (greetingText) greetingText.innerHTML = `Assalamu'alaikum, <span style="display: inline-block;">${finalDisplayName}! 🙏</span>`;

    if (!isAdmin) {
        const btnMaster = document.getElementById('btn-open-data-master'); if (btnMaster) btnMaster.style.display = 'none';
        const btnAddUser = document.getElementById('btn-open-manajemen'); if (btnAddUser) btnAddUser.style.display = 'none';
        const wrapRegAll = document.getElementById('wrap-reg-all'); if (wrapRegAll) wrapRegAll.style.display = 'none';
        const btnHapusAll = document.getElementById('btn-hapus-semua-hasil'); if (btnHapusAll) btnHapusAll.style.display = 'none';
    } else {
        window.fetchStatusReg();
    }

    handleRouting(); 
    await window.loadDataMaster(); 
    window.loadDataHasil(); 
    window.loadDataPengguna(); 
});

// ==========================================
// 7. FUNGSI DATA MASTER
// ==========================================
window.fetchStatusReg = async () => {
    try {
        const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
        if (regSnap.exists()) {
            const sAll = document.getElementById('status-reg-all'); 
            if (sAll) sAll.checked = regSnap.data().siswa_aktif !== false;
        }
    } catch (e) {}
};

window.loadDataMaster = async () => {
    try {
        const docRef = doc(db, "pengaturan", "data_akademik");
        const docSnap = await getDoc(docRef);
        let currentMapel = []; let currentKelas = [];
        
        if (docSnap.exists()) {
            currentMapel = docSnap.data().list_mapel || [];
            currentKelas = docSnap.data().list_kelas || [];
        }

        const usersSnap = await getDocs(collection(db, "users"));
        let masterBerubah = false;

        usersSnap.forEach((uDoc) => {
            const uData = uDoc.data();
            if (uData.mapel) {
                const mapelArr = Array.isArray(uData.mapel) ? uData.mapel : [uData.mapel];
                mapelArr.forEach(m => {
                    const mTrim = String(m).trim();
                    if (mTrim && !currentMapel.includes(mTrim)) { currentMapel.push(mTrim); masterBerubah = true; }
                });
            }
            if (uData.kelas) {
                const kelasArr = Array.isArray(uData.kelas) ? uData.kelas : [uData.kelas];
                kelasArr.forEach(k => {
                    const kTrim = String(k).trim();
                    if (kTrim && !currentKelas.includes(kTrim)) { currentKelas.push(kTrim); masterBerubah = true; }
                });
            }
        });

        if (masterBerubah) await setDoc(docRef, { list_mapel: currentMapel, list_kelas: currentKelas }, { merge: true });

        listMapel = currentMapel; listKelas = currentKelas;
        window.renderTableMaster(); window.populateSemuaDropdown(); window.loadBankSoalSummary();
    } catch (e) { console.error("Gagal sinkronisasi otomatis data master:", e); }
};

window.renderTableMaster = () => {
    const containerMapel = document.getElementById('list-master-mapel'); const containerKelas = document.getElementById('list-master-kelas');
    if (!containerMapel || !containerKelas) return;
    
    document.getElementById('count-mapel').innerText = listMapel.length; document.getElementById('count-kelas').innerText = listKelas.length;
    
    containerMapel.innerHTML = listMapel.length === 0 ? `<div style="text-align:center; padding:20px; color:var(--text-muted);">Kosong</div>` : listMapel.map(m => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
            <span>${m}</span> ${editMasterMode ? `<button onclick="window.hapusMasterItem('mapel', '${m}')" style="color:var(--danger); background:#fee2e2; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>`).join('');
        
    containerKelas.innerHTML = listKelas.length === 0 ? `<div style="text-align:center; padding:20px; color:var(--text-muted);">Kosong</div>` : listKelas.map(k => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px;">
            <span>${k}</span> ${editMasterMode ? `<button onclick="window.hapusMasterItem('kelas', '${k}')" style="color:var(--danger); background:#fee2e2; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>`).join('');
};

window.hapusMasterItem = async (type, val) => {
    if (!(await window.customConfirm(`Hapus ${type === 'mapel' ? 'Mapel' : 'Kelas'} "${val}"?`, "danger"))) return;
    try {
        if (type === 'mapel') { listMapel = listMapel.filter(item => item !== val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true }); } 
        else { listKelas = listKelas.filter(item => item !== val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true }); }
        window.loadDataMaster();
    } catch (e) { window.customAlert("Gagal menghapus data.", "error"); }
};

window.populateSemuaDropdown = () => {
    const cmbKelasSiswa = document.getElementById('edit-kelas-siswa');
    if (cmbKelasSiswa) cmbKelasSiswa.innerHTML = listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
    const containerMapel = document.getElementById('edit-mapel-container');
    if (containerMapel) containerMapel.innerHTML = listMapel.map(m => `<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="edit-mapel-cb" value="${m}"> ${m}</label>`).join('');
    const containerKelasGuru = document.getElementById('edit-kelas-guru-container');
    if (containerKelasGuru) containerKelasGuru.innerHTML = listKelas.map(k => `<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="edit-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');
    const filterKelasPengguna = document.getElementById('filter-kelas-pengguna');
    if (filterKelasPengguna) filterKelasPengguna.innerHTML = '<option value="all">Semua Kelas</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
};

// ==========================================
// 8. FUNGSI PENGGUNA (GURU & SISWA)
// ==========================================
window.loadDataPengguna = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsersData = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data(); data.uid = doc.id; allUsersData.push(data);
        });
        allUsersData.sort((a, b) => {
            const namaA = (a.nama || "").toLowerCase(); const namaB = (b.nama || "").toLowerCase();
            if (namaA < namaB) return -1; if (namaA > namaB) return 1;
            return (a.username || "").toLowerCase().localeCompare((b.username || "").toLowerCase());
        });
        const elStatSiswa = document.getElementById("stat-siswa"); if (elStatSiswa) elStatSiswa.innerText = allUsersData.length;
        window.renderTablePengguna();
    } catch (error) { console.error("Gagal memuat data pengguna:", error); }
};

window.renderTablePengguna = () => {
    const tbodyGuru = document.querySelector("#table-guru tbody"); const tbodySiswa = document.querySelector("#table-siswa tbody");
    if (!tbodyGuru || !tbodySiswa) return;

    const filterGId = (document.getElementById('search-guru-id')?.value || '').toLowerCase();
    const filterGNama = (document.getElementById('search-guru-nama')?.value || '').toLowerCase();
    const filterGRole = (document.getElementById('search-guru-role')?.value || '').toLowerCase();
    const filterGDetail = (document.getElementById('search-guru-detail')?.value || '').toLowerCase();

    const filterKelasEl = document.getElementById("filter-kelas-pengguna");
    const filterKelas = filterKelasEl ? filterKelasEl.value : "all";
    const filterSNis = (document.getElementById('search-siswa-nis')?.value || '').toLowerCase();
    const filterSNama = (document.getElementById('search-siswa-nama')?.value || '').toLowerCase();
    const filterSRole = (document.getElementById('search-siswa-role')?.value || '').toLowerCase();
    const filterSKelas = (document.getElementById('search-siswa-kelas')?.value || '').toLowerCase();
    
    let htmlGuru = ''; let htmlSiswa = ''; let countGuru = 0; let countSiswa = 0;

    allUsersData.forEach((user) => {
        const roles = Array.isArray(user.role) ? user.role : [user.role];
        const roleDisplay = roles.join(", ");
        const kelas = Array.isArray(user.kelas) ? user.kelas.join(", ") : (user.kelas || "-");
        const mapel = Array.isArray(user.mapel) ? user.mapel.join(", ") : (user.mapel || "-");

        const actionButtons = isAdmin ? `
            <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                <button onclick="window.bukaModalEditAkun('${user.uid}')" class="btn-3d" style="background-color: var(--info); padding: 6px 12px; font-size: 0.85rem; margin: 0; min-width: auto;" title="Edit Pengguna"><i class="fas fa-edit"></i></button>
                <button onclick="window.hapusPengguna('${user.uid}')" class="btn-exit-modern" style="padding: 6px 12px; font-size: 0.85rem; margin: 0; min-width: auto;" title="Hapus Pengguna"><i class="fas fa-trash"></i></button>
            </div>
        ` : '-';

        if (roles.some(r => r !== 'siswa')) { // Guru, Admin, atau Custom Role
            if ((user.username || "").toLowerCase().includes(filterGId) && (user.nama || "").toLowerCase().includes(filterGNama) && roleDisplay.toLowerCase().includes(filterGRole) && `${mapel} ${kelas}`.toLowerCase().includes(filterGDetail)) {
                countGuru++;
                htmlGuru += `<tr><td><strong>${user.username || "-"}</strong></td><td>${user.nama || "-"}</td><td><span style="text-transform: capitalize; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${roleDisplay}</span></td><td><small><b>Mapel:</b> ${mapel}<br><b>Kelas:</b> ${kelas}</small></td>${isAdmin ? `<td style="text-align:center;">${actionButtons}</td>` : ''}</tr>`;
            }
        } else if (roles.includes("siswa")) {
            const kelasArr = Array.isArray(user.kelas) ? user.kelas : [user.kelas];
            if ((filterKelas === "all" || filterKelas === "" || kelasArr.includes(filterKelas)) && (user.username || "").toLowerCase().includes(filterSNis) && (user.nama || "").toLowerCase().includes(filterSNama) && roleDisplay.toLowerCase().includes(filterSRole) && kelas.toLowerCase().includes(filterSKelas)) {
                countSiswa++;
                htmlSiswa += `<tr><td><strong>${user.username || "-"}</strong></td><td>${user.nama || "-"}</td><td><span style="text-transform: capitalize; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${roleDisplay}</span></td><td>${kelas}</td>${isAdmin ? `<td style="text-align:center;">${actionButtons}</td>` : ''}</tr>`;
            }
        }
    });

    if (countGuru === 0) htmlGuru = `<tr><td colspan="${isAdmin ? 5 : 4}" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada data staf yang cocok.</td></tr>`;
    if (countSiswa === 0) htmlSiswa = `<tr><td colspan="${isAdmin ? 5 : 4}" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada data siswa yang cocok.</td></tr>`;

    tbodyGuru.innerHTML = htmlGuru; tbodySiswa.innerHTML = htmlSiswa;

    const thAksiGuru = document.getElementById('th-aksi-guru'); const thFilterAksiGuru = document.getElementById('th-filter-aksi-guru');
    const thAksiSiswa = document.getElementById('th-aksi-siswa'); const thFilterAksiSiswa = document.getElementById('th-filter-aksi-siswa');
    if (thAksiGuru) thAksiGuru.style.display = isAdmin ? 'table-cell' : 'none';
    if (thFilterAksiGuru) thFilterAksiGuru.style.display = isAdmin ? 'table-cell' : 'none';
    if (thAksiSiswa) thAksiSiswa.style.display = isAdmin ? 'table-cell' : 'none';
    if (thFilterAksiSiswa) thFilterAksiSiswa.style.display = isAdmin ? 'table-cell' : 'none';
};

window.hapusPengguna = async (uid) => {
    if(await window.customConfirm("Apakah Anda yakin ingin menghapus akun pengguna ini secara permanen?", "danger", "Hapus Pengguna", "Ya, Hapus!")) {
        try { await deleteDoc(doc(db, "users", uid)); window.loadDataPengguna(); window.customAlert("Data akun berhasil dihapus dari database!", "success"); } 
        catch (error) { window.customAlert(`Gagal menghapus pengguna. Error: ${error.message}`, "error", "Gagal"); }
    }
};

window.bukaModalEditAkun = async (uid) => {
    try {
        const userDoc = await getDoc(doc(db, "users", uid)); if(!userDoc.exists()) return;
        const data = userDoc.data();
        
        document.getElementById('edit-uid').value = uid; document.getElementById('edit-nama').value = data.nama || '';
        document.getElementById('edit-username').value = data.username || ''; document.getElementById('edit-pass').value = ''; 
        
        const roles = Array.isArray(data.role) ? data.role : [data.role];
        
        // Tampilkan Custom Role Add Section Jika Admin
        document.getElementById('admin-custom-role-group').style.display = isAdmin ? 'flex' : 'none';
        
        // Populate standard + existing custom roles in the UI
        const container = document.getElementById('edit-role-container');
        container.innerHTML = `
            <label><input type="checkbox" class="edit-role-cb" value="siswa"> Siswa</label>
            <label><input type="checkbox" class="edit-role-cb" value="guru"> Guru</label>
            <label><input type="checkbox" class="edit-role-cb" value="admin"> Admin</label>
        `;
        const standardRoles = ['siswa', 'guru', 'admin'];
        roles.forEach(r => {
            if (!standardRoles.includes(r)) {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" class="edit-role-cb" value="${r}" checked> <span style="text-transform:capitalize;">${r}</span>`;
                container.appendChild(label);
            }
        });

        // Set checks & attach events
        document.querySelectorAll('.edit-role-cb').forEach(cb => { 
            cb.checked = roles.includes(cb.value); 
            cb.addEventListener('change', window.handleRoleChange);
        });

        if (roles.includes('siswa')) {
            document.getElementById('edit-kelas-siswa').value = Array.isArray(data.kelas) ? data.kelas[0] : (data.kelas || '');
        }

        if (roles.some(r => r !== 'siswa')) {
            const mapelArr = Array.isArray(data.mapel) ? data.mapel : [];
            document.querySelectorAll('.edit-mapel-cb').forEach(cb => { cb.checked = mapelArr.includes(cb.value); });
            const kelasArr = Array.isArray(data.kelas) ? data.kelas : [];
            document.querySelectorAll('.edit-kelas-guru-cb').forEach(cb => { cb.checked = kelasArr.includes(cb.value); });
        }
        
        window.handleRoleChange(); // Update view visibility
        document.getElementById('modal-edit-akun').style.display = 'flex';
    } catch(e) { console.error(e); }
};

document.getElementById('btn-save-edit-akun')?.addEventListener('click', async () => {
    const uid = document.getElementById('edit-uid').value;
    if(!uid) return;

    const btn = document.getElementById('btn-save-edit-akun');
    const origText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const newNama = document.getElementById('edit-nama').value.trim();
        const newUsername = document.getElementById('edit-username').value.trim().toUpperCase();
        const newPass = document.getElementById('edit-pass').value;
        const roles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(el => el.value);

        if(!newNama || !newUsername || roles.length === 0) {
            throw new Error("Nama, Username, dan minimal 1 Role harus diisi!");
        }

        let payload = { nama: newNama, username: newUsername, role: roles };

        if (roles.includes('siswa')) {
            payload.kelas = [document.getElementById('edit-kelas-siswa').value];
        } else {
            payload.mapel = Array.from(document.querySelectorAll('.edit-mapel-cb:checked')).map(el => el.value);
            payload.kelas = Array.from(document.querySelectorAll('.edit-kelas-guru-cb:checked')).map(el => el.value);
        }

        await updateDoc(doc(db, "users", uid), payload);

        if(newPass) {
            window.customAlert("Data profil diperbarui!\n\nCatatan: Update password tidak dapat diterapkan otomatis dari halaman ini. Gunakan konsol Admin Firebase untuk reset password.", "warning", "Info Pembaruan");
        } else {
            window.customAlert("Data akun berhasil diperbarui!", "success");
        }

        document.getElementById('modal-edit-akun').style.display = 'none';
        window.loadDataPengguna();
    } catch (error) {
        console.error(error); window.customAlert("Gagal menyimpan: " + error.message, "error");
    } finally {
        btn.innerHTML = origText; btn.disabled = false;
    }
});

window.downloadDaftarPengguna = () => {
    const data = allUsersData.map(u => ({ "Nama": u.nama, "Username": u.username, "Role": Array.isArray(u.role) ? u.role.join(', ') : u.role, "Kelas": Array.isArray(u.kelas) ? u.kelas.join(', ') : (u.kelas || "-") }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Daftar Pengguna"); XLSX.writeFile(wb, "Daftar_Pengguna_SMAICH.xlsx");
};


// ==========================================
// 9. FUNGSI BANK SOAL & UJIAN
// ==========================================

window.getTingkatan = (kelas) => {
    if (!kelas) return "Lainnya"; let k = String(kelas).toUpperCase().trim();
    if (k.startsWith("XII")) return "XII"; if (k.startsWith("XI")) return "XI"; if (k.startsWith("X")) return "X";
    return "Lainnya";
};

// Logika Filter Tingkatan di Checkbox Roll (Menu Edit Baris Tabel)
window.toggleDropdownCheck = (id) => {
    const el = document.getElementById(id);
    const isShowing = el.classList.contains('show');
    document.querySelectorAll('.dropdown-check.show').forEach(d => d.classList.remove('show'));
    if (!isShowing) el.classList.add('show');
};

window.updateMapelKelasToggled = async (mapel, kelasTarget, isChecked, dropdownId) => {
    try {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            const checkedBoxes = dropdown.querySelectorAll('input[type="checkbox"]:checked');
            const btnSpan = dropdown.querySelector('.dropdown-check-btn span');
            if (btnSpan) { btnSpan.innerText = checkedBoxes.length > 0 ? `${checkedBoxes.length} Kelas Dipilih` : 'Pilih Kelas'; }
        }

        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
        const snap = await getDocs(q); 
        const updatePromises = [];
        
        snap.forEach(d => {
            let data = d.data();
            let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
            
            if (isChecked) {
                if (!arrKelas.includes(kelasTarget)) {
                    arrKelas.push(kelasTarget);
                    updatePromises.push(updateDoc(doc(db, "bank_soal", d.id), { kelas: arrKelas }));
                }
            } else {
                if (arrKelas.includes(kelasTarget)) {
                    arrKelas = arrKelas.filter(k => k !== kelasTarget);
                    updatePromises.push(updateDoc(doc(db, "bank_soal", d.id), { kelas: arrKelas }));
                }
            }
        });
        await Promise.all(updatePromises);

        if (!isChecked) {
            const key = `${mapel}_${kelasTarget}`;
            await updateDoc(doc(db, "pengaturan", "waktu_ujian"), { [key]: deleteField() }).catch(()=>{});
            await updateDoc(doc(db, "pengaturan", "jadwal_ujian"), { [key]: deleteField() }).catch(()=>{});
            await updateDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${key}`]: deleteField() }).catch(()=>{});
        }
    } catch (e) {
        console.error("Gagal mengupdate kelas:", e); window.customAlert("Gagal menerapkan perubahan kelas.", "error");
    }
};

window.simpanPengaturanBaris = async (mapel, jadwalId, durasiId, tokenId, btnEl) => {
    const jadwalVal = document.getElementById(jadwalId).value;
    const durasiVal = document.getElementById(durasiId).value;
    const tokenVal = document.getElementById(tokenId).value.toUpperCase().trim();

    const origHtml = btnEl.innerHTML;
    btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btnEl.disabled = true;

    try {
        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
        const snap = await getDocs(q);
        let assignedClasses = new Set();
        snap.forEach(d => {
            let arr = Array.isArray(d.data().kelas) ? d.data().kelas : [d.data().kelas];
            arr.forEach(c => assignedClasses.add(c));
        });

        if (assignedClasses.size > 0) {
            let wUpdates = {}; let jUpdates = {}; let tUpdates = {};
            const expiredAt = new Date().getTime() + (15 * 60 * 1000); 

            assignedClasses.forEach(cls => { 
                if(durasiVal) wUpdates[`${mapel}_${cls}`] = durasiVal; 
                if(jadwalVal) jUpdates[`${mapel}_${cls}`] = jadwalVal;
                if(tokenVal) tUpdates[`token_${mapel}_${cls}`] = { code: tokenVal, active: true, expiredAt }; 
            });

            if(Object.keys(wUpdates).length > 0) await setDoc(doc(db, "pengaturan", "waktu_ujian"), wUpdates, { merge: true });
            if(Object.keys(jUpdates).length > 0) await setDoc(doc(db, "pengaturan", "jadwal_ujian"), jUpdates, { merge: true });
            if(Object.keys(tUpdates).length > 0) await setDoc(doc(db, "pengaturan", "token_ujian"), tUpdates, { merge: true });
        }
        
        const icon = btnEl.querySelector('i');
        if(icon) {
            icon.className = 'fas fa-check';
            setTimeout(() => { icon.className = 'fas fa-save'; }, 2000);
        }
    } catch (e) {
        console.error(e); window.customAlert("Gagal menyimpan pengaturan: " + e.message, "error");
    } finally {
        btnEl.innerHTML = origHtml;
        btnEl.disabled = false;
    }
};

window.loadBankSoalSummary = async () => {
    const tbody = document.querySelector('#table-bank-soal-summary tbody'); if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Memuat data...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, "bank_soal"));
        let summary = {}; 
        
        snap.forEach(d => {
            let data = d.data();
            let mapel = data.mataPelajaran; 
            let kelasArray = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
            
            if(!summary[mapel]) {
                summary[mapel] = { mapel: mapel, classes: new Set(), count: 0 };
            }
            summary[mapel].count++;
            kelasArray.forEach(c => summary[mapel].classes.add(c));
        });
        
        let statSoalEl = document.getElementById('stat-soal'); if (statSoalEl) statSoalEl.innerText = Object.keys(summary).length;
        
        const waktuSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian")); const waktuData = waktuSnap.exists() ? waktuSnap.data() : {};
        const jadwalSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian")); const jadwalData = jadwalSnap.exists() ? jadwalSnap.data() : {};
        const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian")); const tokenData = tokenSnap.exists() ? tokenSnap.data() : {};
        
        let html = ''; let rowIdx = 0;
        let sortedMapels = Object.keys(summary).sort((a, b) => a.localeCompare(b));

        sortedMapels.forEach(mapel => {
            rowIdx++; 
            let d = summary[mapel]; 
            let assignedClasses = Array.from(d.classes);
            
            let mainClass = assignedClasses.length > 0 ? assignedClasses[0] : '';
            let jadwalKey = mainClass ? `${mapel}_${mainClass}` : '';
            
            let jadwal = jadwalKey && jadwalData[jadwalKey] ? jadwalData[jadwalKey] : '';
            let durasi = jadwalKey && waktuData[jadwalKey] ? waktuData[jadwalKey] : '';
            let token = '';
            if(jadwalKey && tokenData[`token_${jadwalKey}`]) { 
                let tData = tokenData[`token_${jadwalKey}`]; 
                token = typeof tData === 'object' ? tData.code : tData; 
            }
            
            let isMapelGuru = isGuru && userMapel.includes(mapel);
            let canEdit = isAdmin || isMapelGuru;
            
           // Menampilkan kelas sebagai teks dipisah koma
            let kelasDropdownHtml = assignedClasses.length > 0 ? assignedClasses.join(', ') : '-';

            let jadwalInputId = `jadwal-${rowIdx}`;
            let durasiInputId = `durasi-${rowIdx}`;
            let tokenInputId = `token-${rowIdx}`;

            let jadwalInput = canEdit ? `<input type="datetime-local" id="${jadwalInputId}" class="ghost-input" value="${jadwal}">` : (jadwal || '-');
            let durasiInput = canEdit ? `<input type="number" id="${durasiInputId}" class="ghost-input" value="${durasi}" placeholder="Menit">` : (durasi || '-');
            let tokenInput = canEdit ? `<input type="text" id="${tokenInputId}" class="ghost-input" value="${token}" placeholder="KODE" style="text-transform:uppercase; font-weight:bold; color:var(--danger);">` : (token || '-');

            let actionBtn = '';
            if (canEdit) {
                actionBtn = `
                    <div style="display:flex; gap:5px; justify-content:center;">
                        <button onclick="window.simpanPengaturanBaris('${mapel}', '${jadwalInputId}', '${durasiInputId}', '${tokenInputId}', this)" class="btn-icon" style="color: var(--success);" title="Simpan Jadwal, Durasi & Token"><i class="fas fa-save"></i></button>
                        <button onclick="window.bukaDetailSoal('${mapel}')" class="btn-icon" title="Kelola Soal"><i class="fas fa-cog"></i></button>
                        <button onclick="window.hapusBankSoalKeseluruhan('${mapel}', 'SEMUA')" class="btn-icon text-danger" title="Hapus Mapel Ini"><i class="fas fa-trash-alt"></i></button>
                    </div>`;
            } else {
                actionBtn = `<span style="color:var(--text-muted);"><i class="fas fa-lock"></i></span>`;
            }
            
            html += `<tr>
                <td style="vertical-align: middle;">
                    <b style="color: var(--secondary); font-size: 1.05rem;">${mapel}</b>
                </td>
                <td>${kelasDropdownHtml}</td>
                <td>${jadwalInput}</td>
                <td>${durasiInput}</td>
                <td>${tokenInput}</td>
                <td style="text-align: center; color: var(--text-muted); font-weight: 600; font-size: 0.9rem;">${d.count} Soal</td>
                <td style="text-align: center;">${actionBtn}</td>
            </tr>`;
        });
        
        if(html === '') html = '<tr><td colspan="7" style="text-align:center;">Tidak ada data soal.</td></tr>';
        tbody.innerHTML = html;
        
    } catch (e) { 
        console.error(e); 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Gagal memuat data</td></tr>'; 
    }
};

window.hapusBankSoalKeseluruhan = async (mapel, kelas) => {
    let confirmMsg = `PENGHAPUSAN MAPEL!\n\nApakah Anda YAKIN ingin menghapus SELURUH soal untuk mapel "${mapel}" di semua kelas?`;
    if (!(await window.customConfirm(confirmMsg, "danger", "Konfirmasi Hapus"))) { return; }

    const btnHtmlOriginal = event.currentTarget.innerHTML;
    const btn = event.currentTarget;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
        const snap = await getDocs(q); 
        const updatePromises = [];
        
        snap.forEach(d => { updatePromises.push(deleteDoc(doc(db, "bank_soal", d.id))); });
        await Promise.all(updatePromises);

        const wSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
        if(wSnap.exists()) { let fields = {}; Object.keys(wSnap.data()).forEach(k => { if(k.startsWith(mapel+"_")) fields[k] = deleteField(); }); if(Object.keys(fields).length > 0) await updateDoc(doc(db, "pengaturan", "waktu_ujian"), fields).catch(()=>{}); }
        const jSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian"));
        if(jSnap.exists()) { let fields = {}; Object.keys(jSnap.data()).forEach(k => { if(k.startsWith(mapel+"_")) fields[k] = deleteField(); }); if(Object.keys(fields).length > 0) await updateDoc(doc(db, "pengaturan", "jadwal_ujian"), fields).catch(()=>{}); }
        const tSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
        if(tSnap.exists()) { let fields = {}; Object.keys(tSnap.data()).forEach(k => { if(k.startsWith("token_"+mapel+"_")) fields[k] = deleteField(); }); if(Object.keys(fields).length > 0) await updateDoc(doc(db, "pengaturan", "token_ujian"), fields).catch(()=>{}); }

        await window.customAlert(`Berhasil menghapus seluruh data soal mapel ${mapel}.`, "success");
        window.loadBankSoalSummary();
    } catch (e) {
        console.error(e); window.customAlert("Terjadi kesalahan saat menghapus data.", "error");
    } finally {
        if(btn) { btn.innerHTML = btnHtmlOriginal; btn.disabled = false; }
    }
};

window.uploadMediaToStorage = async (file, folderPath) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop(); const fileName = `${Date.now()}_${Math.random().toString(36).substring(2,8)}.${fileExt}`;
    const storageRef = ref(storage, `${folderPath}/${fileName}`); const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    let type = 'image'; if(file.type.startsWith('audio')) type = 'audio'; else if(file.type.startsWith('video')) type = 'video';
    return { url, type };
};

window.normalizeUrutanSoal = async (mapel) => {
    const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
    const snap = await getDocs(q); let soalArr = []; 
    snap.forEach(doc => { soalArr.push({id: doc.id, ...doc.data()}); });
    soalArr.sort((a, b) => {
        if (a.nomor_soal === b.nomor_soal) {
            let timeA = a.updatedAt || a.createdAt; timeA = timeA ? (timeA.toMillis ? timeA.toMillis() : new Date(timeA).getTime()) : 0;
            let timeB = b.updatedAt || b.createdAt; timeB = timeB ? (timeB.toMillis ? timeB.toMillis() : new Date(timeB).getTime()) : 0;
            return timeB - timeA; 
        }
        return (a.nomor_soal || 0) - (b.nomor_soal || 0);
    });
    let updates = [];
    soalArr.forEach((s, idx) => {
        let correctNum = idx + 1;
        if (s.nomor_soal !== correctNum) { updates.push(updateDoc(doc(db, "bank_soal", s.id), { nomor_soal: correctNum })); }
    });
    if (updates.length > 0) { await Promise.all(updates); }
};

// Filter Kelas (Khusus 1 Tingkatan di Input Soal Baru)
window.handleSoalKelasToggle = () => {
    const cbs = document.querySelectorAll('.cb-soal-kelas');
    const checked = Array.from(cbs).filter(cb => cb.checked);
    const label = document.getElementById('soal-kelas-label');
    
    if (checked.length === 0) {
        cbs.forEach(cb => { cb.disabled = false; cb.parentElement.style.opacity = '1'; cb.parentElement.style.cursor = 'pointer'; });
        label.innerText = "-- Pilih Kelas --"; return;
    }

    const targetTingkatan = window.getTingkatan(checked[0].value);
    
    cbs.forEach(cb => {
        if (!cb.checked) {
            const isSameTingkat = window.getTingkatan(cb.value) === targetTingkatan;
            cb.disabled = !isSameTingkat; cb.parentElement.style.opacity = isSameTingkat ? '1' : '0.4'; cb.parentElement.style.cursor = isSameTingkat ? 'pointer' : 'not-allowed';
        }
    });

    label.innerText = `${checked.length} Kelas (Tk. ${targetTingkatan})`;
};

window.bukaModalTambahSoal = async (mapelParams = "", targetNomor = "") => {
    document.getElementById('edit-soal-id').value = ''; document.getElementById('form-tambah-soal').reset();
    document.getElementById('soal-media').style.display = 'block'; document.getElementById('soal-media-url').style.display = 'none';
    const secMassal = document.getElementById('section-import-massal'); const divManual = document.getElementById('divider-import-manual');
    if (secMassal) secMassal.style.display = 'block'; if (divManual) divManual.style.display = 'flex';
    
    const mapelSelect = document.getElementById('soal-mapel'); 
    const modalTitle = document.getElementById('title-modal-soal');
    const groupKelas = document.getElementById('group-soal-kelas');
    const containerKelas = document.getElementById('soal-kelas-container');
    const labelKelas = document.getElementById('soal-kelas-label');
    
    let allowedMapel = listMapel; if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }
    mapelSelect.innerHTML = '<option value="" disabled selected>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
    
    containerKelas.innerHTML = listKelas.map(k => `
        <label>
            <input type="checkbox" class="cb-soal-kelas" value="${k}" onchange="window.handleSoalKelasToggle()"> 
            ${k}
        </label>
    `).join('');
    labelKelas.innerText = "-- Pilih Kelas --";

    if (mapelParams) {
        modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Soal (Mapel Ini)'; mapelSelect.value = mapelParams;
        mapelSelect.style.pointerEvents = 'none'; mapelSelect.style.backgroundColor = '#e2e8f0'; 
        groupKelas.style.display = 'none';
    } else {
        modalTitle.innerHTML = '<i class="fas fa-file-import"></i> Input Soal'; mapelSelect.value = "";
        mapelSelect.style.pointerEvents = 'auto'; mapelSelect.style.backgroundColor = '#fafafa';
        groupKelas.style.display = 'block';
    }
    
    const inputNomor = document.getElementById('soal-nomor');
    inputNomor.value = targetNomor; document.getElementById('modal-tambah-soal').style.display = 'flex'; document.getElementById('soal-tipe').dispatchEvent(new Event('change'));
};

window.editDataSoal = (id) => {
    const soal = window.tempDataSoalKelola.find(s => s.id === id); if (!soal) return;
    const secMassal = document.getElementById('section-import-massal'); const divManual = document.getElementById('divider-import-manual');
    if (secMassal) secMassal.style.display = 'none'; if (divManual) divManual.style.display = 'none';
    const mapelSelect = document.getElementById('soal-mapel'); 
    const groupKelas = document.getElementById('group-soal-kelas');
    
    let allowedMapel = listMapel; if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }
    mapelSelect.innerHTML = '<option value="" disabled>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
    mapelSelect.style.pointerEvents = 'none'; mapelSelect.style.backgroundColor = '#e2e8f0'; 
    groupKelas.style.display = 'none'; 
    
    document.getElementById('edit-soal-id').value = id; document.getElementById('soal-mapel').value = soal.mataPelajaran; 
    document.getElementById('soal-nomor').value = soal.nomor_soal || ''; document.getElementById('soal-bobot').value = soal.bobot || 1; 
    document.getElementById('soal-tipe').value = soal.tipe || 'PG'; document.getElementById('soal-teks').value = soal.teks_soal || '';
    
    if (soal.media_soal) {
        const urlStr = typeof soal.media_soal === 'object' ? soal.media_soal.url : soal.media_soal;
        if (!urlStr.includes('firebasestorage.googleapis.com')) {
            document.querySelector('input[name="tipe_media_utama"][value="url"]').checked = true; document.getElementById('soal-media').style.display = 'none'; document.getElementById('soal-media-url').style.display = 'block'; document.getElementById('soal-media-url').value = urlStr;
        } else {
             document.querySelector('input[name="tipe_media_utama"][value="file"]').checked = true; document.getElementById('soal-media').style.display = 'block'; document.getElementById('soal-media-url').style.display = 'none'; document.getElementById('soal-media-url').value = '';
        }
    } else {
        document.querySelector('input[name="tipe_media_utama"][value="file"]').checked = true; document.getElementById('soal-media').style.display = 'block'; document.getElementById('soal-media-url').style.display = 'none'; document.getElementById('soal-media-url').value = '';
    }

    document.getElementById('soal-tipe').dispatchEvent(new Event('change'));

    if (soal.tipe === 'PG' || soal.tipe === 'PGK') {
        ['A', 'B', 'C', 'D', 'E'].forEach(k => { 
            document.getElementById(`soal-opsi-${k}`).value = (soal.opsi && soal.opsi[k]) ? soal.opsi[k] : ''; 
            if (soal.opsi_media && soal.opsi_media[k]) {
                const mData = soal.opsi_media[k]; const urlStr = typeof mData === 'object' ? mData.url : mData;
                if (urlStr.includes('firebasestorage.googleapis.com')) {
                    document.getElementById(`tipe-media-opsi-${k}`).value = 'file'; document.getElementById(`media-opsi-${k}`).style.display = 'block'; document.getElementById(`media-url-opsi-${k}`).style.display = 'none';
                } else {
                    document.getElementById(`tipe-media-opsi-${k}`).value = 'url'; document.getElementById(`media-opsi-${k}`).style.display = 'none'; document.getElementById(`media-url-opsi-${k}`).style.display = 'block'; document.getElementById(`media-url-opsi-${k}`).value = urlStr;
                }
            } else {
                document.getElementById(`tipe-media-opsi-${k}`).value = 'file'; document.getElementById(`media-opsi-${k}`).style.display = 'block'; document.getElementById(`media-url-opsi-${k}`).style.display = 'none'; document.getElementById(`media-url-opsi-${k}`).value = '';
            }
        });
        if (soal.tipe === 'PG') {
            const radio = document.querySelector(`input[name="kunci-pg"][value="${soal.kunci_jawaban}"]`); if (radio) radio.checked = true;
        } else {
            document.querySelectorAll('.kunci-pgk').forEach(cb => { cb.checked = Array.isArray(soal.kunci_jawaban) && soal.kunci_jawaban.includes(cb.value); });
        }
    } else if (soal.tipe === 'Menjodohkan') {
        const container = document.getElementById('pasangan-container'); container.innerHTML = '';
        if (soal.pasangan) {
            soal.pasangan.forEach(p => {
                const row = document.createElement('div'); row.className = 'pasangan-item'; row.style.cssText = 'display:flex; gap:10px; margin-bottom:10px;';
                row.innerHTML = `<input type="text" class="input-text m-kiri" value="${p.kiri}" required><input type="text" class="input-text m-kanan" value="${p.kanan}" required><button type="button" class="btn-hapus-pasangan" style="background:var(--danger); color:white; border:none; padding:0 15px; border-radius:8px; cursor:pointer;"><i class="fas fa-trash"></i></button>`;
                container.appendChild(row);
            });
        }
    } else if (soal.tipe === 'Essay') {
        const fieldEssay = document.getElementById('soal-kunci-essay'); if (fieldEssay) fieldEssay.value = soal.kunci_jawaban || '';
    }
    document.getElementById('title-modal-soal').innerHTML = '<i class="fas fa-edit"></i> Update Soal'; document.getElementById('modal-tambah-soal').style.display = 'flex';
};

window.bukaDetailSoal = async (mapel) => {
    document.getElementById('view-summary-bank-soal').style.display = 'none'; 
    document.getElementById('view-soal-list').style.display = 'block';
    document.getElementById('label-mapel-edit').innerText = `Kelola Soal: ${mapel}`;
    document.getElementById('filter-soal-mapel').value = mapel;
    window.loadDaftarSoal(mapel);
};

window.loadDaftarSoal = async (mapel) => {
    const container = document.getElementById('list-soal'); container.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Memuat soal...</div>';
    try {
        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
        const snap = await getDocs(q); let soalArr = []; 
        snap.forEach(doc => { soalArr.push({id: doc.id, ...doc.data()}); });
        soalArr.sort((a,b) => (a.nomor_soal || 0) - (b.nomor_soal || 0)); window.tempDataSoalKelola = soalArr; 

        if(soalArr.length === 0) { 
            container.innerHTML = `
            <div style="text-align:center; padding: 30px; background: white; border: 1px dashed var(--border-color); border-radius: 8px;">
                Belum ada soal untuk mata pelajaran ini.<br><br>
                <button onclick="window.bukaModalTambahSoal('${mapel}', 1)" class="btn-3d" style="background:var(--success); padding:8px 20px; border-radius:20px; font-size:0.9rem; margin:0 auto;"><i class="fas fa-plus"></i> Buat Soal Pertama</button>
            </div>`; return; 
        }

        let html = `
        <div style="display:flex; justify-content:center; position:relative; margin-bottom: 15px; margin-top: 5px;">
            <hr style="position:absolute; width:100%; top:50%; border:none; border-top:1px dashed #cbd5e1; z-index:1;">
            <button onclick="window.bukaModalTambahSoal('${mapel}', 1)" class="btn-3d" style="background:white; color:var(--success); border:1px solid var(--success); padding:4px 15px; border-radius:20px; font-size:0.8rem; z-index:2; box-shadow:0 2px 5px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='var(--success)'; this.style.color='white'" onmouseout="this.style.background='white'; this.style.color='var(--success)'"><i class="fas fa-plus"></i> Sisipkan Soal di Sini</button>
        </div>`;
        
        soalArr.forEach((s, idx) => {
            html += `
            <div style="background: white; border: 1px solid var(--border-color); border-left: 4px solid transparent; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); cursor: pointer; transition: all 0.2s ease; position: relative;"
                 onmouseover="this.style.borderLeftColor='var(--info)'; this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateY(-2px)'"
                 onmouseout="this.style.borderLeftColor='transparent'; this.style.boxShadow='var(--shadow-sm)'; this.style.transform='translateY(0)'"
                 onclick="window.editDataSoal('${s.id}')">
                <div style="position:absolute; right:15px; top:15px; z-index:10;">
                    <button onclick="event.stopPropagation(); window.hapusSoal('${s.id}')" style="background:#fee2e2; color:var(--danger); border:none; width:32px; height:32px; border-radius:8px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='var(--danger)'; this.style.color='white'" onmouseout="this.style.background='#fee2e2'; this.style.color='var(--danger)'" title="Hapus Soal"><i class="fas fa-trash-alt"></i></button>
                </div>
                <div style="padding: 20px 25px;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                        <span style="font-weight:800; color:var(--primary); display:block; margin-bottom:8px;">Soal ${s.nomor_soal || (idx+1)} 
                            <span style="background:var(--info); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:5px;">${s.tipe || 'PG'}</span>
                            <span style="background:var(--warning); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:5px;">Bobot: ${s.bobot || 1}</span>
                        </span>
                    </div>
                    <div style="color:var(--text-main); line-height:1.6; font-size: 1rem; margin-bottom:15px;">${s.teks_soal}</div>`;
            
            if(s.media_soal){
                const mUrl = typeof s.media_soal === 'object' ? s.media_soal.url : s.media_soal;
                const mType = typeof s.media_soal === 'object' && s.media_soal.type ? s.media_soal.type : 'image';
                if(mType === 'video'){ html += `<div style="margin-bottom:15px;"><video src="${mUrl}" controls style="max-height:200px; border-radius:8px; background:#000;"></video></div>`; } 
                else if(mType === 'audio'){ html += `<div style="margin-bottom:15px;"><audio src="${mUrl}" controls></audio></div>`; } 
                else { html += `<div style="margin-bottom:15px;"><img src="${mUrl}" style="max-height:200px; border-radius:8px; border:1px solid #e2e8f0;"></div>`; }
            }
            
            if (s.tipe === 'PG' || s.tipe === 'PGK' || !s.tipe) {
                html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
                ['A','B','C','D','E'].forEach(o => {
                    let teksOpsi = (s.opsi && s.opsi[o]) ? s.opsi[o] : '';
                    if(teksOpsi || (s.opsi_media && s.opsi_media[o])) {
                        let isBenar = (s.tipe === 'PG' || !s.tipe) ? s.kunci_jawaban === o : Array.isArray(s.kunci_jawaban) && s.kunci_jawaban.includes(o);
                        let mHtml = '';
                        if(s.opsi_media && s.opsi_media[o]){
                            const moData = s.opsi_media[o]; const moUrl = typeof moData === 'object' ? moData.url : moData; const moType = typeof moData === 'object' && moData.type ? moData.type : 'image';
                            if(moType === 'video') mHtml = `<video src="${moUrl}" controls style="max-height:100px; margin-top:5px; border-radius:6px; background:#000;"></video><br>`;
                            else if(moType === 'audio') mHtml = `<audio src="${moUrl}" controls style="max-width:200px; margin-top:5px;"></audio><br>`;
                            else mHtml = `<img src="${moUrl}" style="max-height:100px; margin-top:5px; border-radius:6px; border:1px solid #e2e8f0;"><br>`;
                        }
                        if (isBenar) { html += `<div style="display:flex; align-items:flex-start; gap:10px; padding:8px 12px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; color:var(--success); font-weight:600; font-size:0.9rem;"><i class="fas fa-check-circle" style="margin-top:3px;"></i> <div><span>${o}. ${teksOpsi}</span><br>${mHtml}</div></div>`; } 
                        else { html += `<div style="display:flex; align-items:flex-start; gap:10px; padding:8px 12px; border:1px solid #f1f5f9; border-radius:6px; color:var(--text-muted); font-size:0.9rem;"><span style="font-weight:600; width:20px; margin-top:1px;">${o}.</span> <div><span>${teksOpsi}</span><br>${mHtml}</div></div>`; }
                    }
                });
                html += `</div>`;
            } else if (s.tipe === 'Menjodohkan') {
                html += `<div style="font-size:0.9rem; background:#eff6ff; border: 1px solid #bfdbfe; color:#1e40af; padding:15px; border-radius:8px; display:inline-block; width:100%;"><b>Pasangan Jawaban Benar:</b><div style="margin-top: 10px; display:flex; flex-direction:column; gap:8px;">`;
                if(s.pasangan) { s.pasangan.forEach(p => { html += `<div style="display:flex; align-items:center; gap:10px;"><span style="flex:1; background:white; padding:10px 15px; border-radius:6px; border:1px solid #bfdbfe; color:var(--secondary);">${p.kiri}</span> <i class="fas fa-arrow-right" style="color:#60a5fa;"></i> <span style="flex:1; background:#dcfce7; padding:10px 15px; border-radius:6px; border:1px solid #bbf7d0; color:var(--success); font-weight:bold;">${p.kanan}</span></div>`; }); }
                html += `</div></div>`;
            } else if (s.tipe === 'Essay' && s.kunci_jawaban) {
                html += `<div style="font-size:0.9rem; background:#f0fdf4; border: 1px solid #bbf7d0; color:#166534; padding:15px; border-radius:8px; display:inline-block; width:100%; margin-top: 10px;"><b>Referensi Jawaban:</b><div style="margin-top: 8px; color: #15803d; line-height: 1.5;">${s.kunci_jawaban}</div></div>`;
            }
            html += `</div></div>`; 
            let targetNext = (s.nomor_soal || (idx+1)) + 1;
            html += `
            <div style="display:flex; justify-content:center; position:relative; margin: 15px 0;">
                <hr style="position:absolute; width:100%; top:50%; border:none; border-top:1px dashed #cbd5e1; z-index:1;">
                <button onclick="window.bukaModalTambahSoal('${mapel}', ${targetNext})" class="btn-3d" style="background:white; color:var(--success); border:1px solid var(--success); padding:4px 15px; border-radius:20px; font-size:0.8rem; z-index:2; box-shadow:0 2px 5px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='var(--success)'; this.style.color='white'" onmouseout="this.style.background='white'; this.style.color='var(--success)'"><i class="fas fa-plus"></i> Sisipkan Soal di Sini</button>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Gagal memuat soal</div>'; }
};

document.getElementById('form-tambah-soal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mapel = document.getElementById('soal-mapel').value; 
    const selectedKelasCbs = Array.from(document.querySelectorAll('.cb-soal-kelas:checked')).map(cb => cb.value);
    const tipe = document.getElementById('soal-tipe').value; 
    const teks = document.getElementById('soal-teks').value;
    const nomorSoalTarget = parseInt(document.getElementById('soal-nomor').value) || 1;
    const bobotSoal = parseFloat(document.getElementById('soal-bobot').value) || 1;

    if(!mapel) return window.customAlert("Silakan pilih Mata Pelajaran terlebih dahulu!", "warning");
    if(!document.getElementById('edit-soal-id').value && document.getElementById('group-soal-kelas').style.display !== 'none' && selectedKelasCbs.length === 0) {
        return window.customAlert("Silakan pilih minimal satu kelas pada form Kelas Sasaran!", "warning");
    }

    const btnSubmitSoal = e.target.querySelector('button[type="submit"]'); 
    const originalText = btnSubmitSoal.innerHTML;
    btnSubmitSoal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENGUNGGAH & MENYIMPAN...'; btnSubmitSoal.disabled = true;

    try {
        let mediaSoal = null;
        const tipeMediaUtama = document.querySelector('input[name="tipe_media_utama"]:checked')?.value || 'file';
        
        if (tipeMediaUtama === 'file') {
            const fileSoal = document.getElementById('soal-media').files[0];
            if (fileSoal) { mediaSoal = await window.uploadMediaToStorage(fileSoal, `bank_soal/${mapel}`); }
        } else if (tipeMediaUtama === 'url') {
            const urlVal = document.getElementById('soal-media-url').value.trim();
            if (urlVal) {
                let mType = 'image'; const lowerUrl = urlVal.toLowerCase();
                if (lowerUrl.match(/\.(mp4|webm|ogg|mov)$/) || lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) mType = 'video';
                else if (lowerUrl.match(/\.(mp3|wav|ogg)$/)) mType = 'audio';
                mediaSoal = { url: urlVal, type: mType };
            }
        }
        
        const qC = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
        const snapC = await getDocs(qC);
        let currentClasses = new Set();
        snapC.forEach(d => { let arr = Array.isArray(d.data().kelas) ? d.data().kelas : [d.data().kelas]; arr.forEach(c => currentClasses.add(c)); });
        
        let kelasArrayToSave = Array.from(currentClasses);
        if (kelasArrayToSave.length === 0 && selectedKelasCbs.length > 0) { kelasArrayToSave = selectedKelasCbs; }

        let payload = { mataPelajaran: mapel, kelas: kelasArrayToSave, nomor_soal: nomorSoalTarget, bobot: bobotSoal, tipe: tipe, teks_soal: teks, updatedAt: new Date() };
        if (mediaSoal) payload.media_soal = mediaSoal;

        if (tipe === 'PG' || tipe === 'PGK') {
            let opsiKeys = ['A', 'B', 'C', 'D', 'E']; let opsi = {}; let opsi_media = {};
            for (let k of opsiKeys) {
                opsi[k] = document.getElementById(`soal-opsi-${k}`).value;
                let tipeMediaOpsi = document.getElementById(`tipe-media-opsi-${k}`).value;
                if (tipeMediaOpsi === 'file') {
                    let fileOpsi = document.getElementById(`media-opsi-${k}`).files[0];
                    if (fileOpsi) { opsi_media[k] = await window.uploadMediaToStorage(fileOpsi, `bank_soal/${mapel}/opsi`); }
                } else {
                    let urlOpsi = document.getElementById(`media-url-opsi-${k}`).value.trim();
                    if (urlOpsi) {
                        let mTypeOpsi = 'image'; const lowerUrlOpsi = urlOpsi.toLowerCase();
                        if (lowerUrlOpsi.match(/\.(mp4|webm|ogg|mov)$/) || lowerUrlOpsi.includes('youtube') || lowerUrlOpsi.includes('youtu.be')) mTypeOpsi = 'video';
                        else if (lowerUrlOpsi.match(/\.(mp3|wav|ogg)$/)) mTypeOpsi = 'audio';
                        opsi_media[k] = { url: urlOpsi, type: mTypeOpsi };
                    }
                }
            }
            payload.opsi = opsi; if (Object.keys(opsi_media).length > 0) payload.opsi_media = opsi_media;

            if (tipe === 'PG') {
                const checkedRadio = document.querySelector('input[name="kunci-pg"]:checked');
                if (!checkedRadio) throw new Error("Pilih kunci jawaban untuk PG!");
                payload.kunci_jawaban = checkedRadio.value;
            } else {
                const checkedCBs = document.querySelectorAll('.kunci-pgk:checked');
                if (checkedCBs.length === 0) throw new Error("Pilih minimal satu kunci jawaban untuk PGK!");
                payload.kunci_jawaban = Array.from(checkedCBs).map(cb => cb.value);
            }
        } else if (tipe === 'Menjodohkan') {
            let pasangan = [];
            document.querySelectorAll('.pasangan-item').forEach(item => {
                let kiri = item.querySelector('.m-kiri').value.trim(); let kanan = item.querySelector('.m-kanan').value.trim();
                if (kiri && kanan) pasangan.push({ kiri, kanan });
            });
            if (pasangan.length === 0) throw new Error("Masukkan minimal satu pasangan untuk soal tipe Menjodohkan!");
            payload.pasangan = pasangan;
        } else if (tipe === 'Essay') {
            const kunciEssay = document.getElementById('soal-kunci-essay').value.trim();
            if (kunciEssay) { payload.kunci_jawaban = kunciEssay; }
        }

        const editId = document.getElementById('edit-soal-id').value;
        if (editId) { await updateDoc(doc(db, "bank_soal", editId), payload); } 
        else { payload.createdAt = new Date(); await addDoc(collection(db, "bank_soal"), payload); }

        await window.normalizeUrutanSoal(mapel);
        document.getElementById('form-tambah-soal').reset();
        document.getElementById('edit-soal-id').value = '';
        document.getElementById('modal-tambah-soal').style.display = 'none';

        const curMapel = document.getElementById('filter-soal-mapel').value;
        if(document.getElementById('view-soal-list').style.display === 'block') { window.loadDaftarSoal(curMapel); }
        window.loadBankSoalSummary();
        window.customAlert("Soal berhasil disimpan!", "success");
    } catch(err) { window.customAlert(err.message || "Gagal menyimpan soal.", "error"); } 
    finally { btnSubmitSoal.innerHTML = originalText; btnSubmitSoal.disabled = false; }
});

window.parseDocTextToJSON = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0); const jsonData = [];
    let currentTipe = 'PG'; let currentSoal = null; let nomorPG = 1; let nomorEssay = 1;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.match(/^[A-Z]\.\s*(Pilihan Ganda|PG)/i)) { currentTipe = 'PG'; continue; }
        if (line.match(/^[A-Z]\.\s*(Esai|Essay|Uraian)/i)) { currentTipe = 'Essay'; continue; }
        const questionMatch = line.match(/^(\d+)\.\s*(.*)/);
        if (questionMatch) {
            if (currentSoal) jsonData.push(currentSoal);
            currentSoal = { "Tipe Soal (PG / PGK / Menjodohkan / Essay)": currentTipe, "Nomor Soal": currentTipe === 'PG' ? nomorPG++ : nomorEssay++, "Bobot Soal": currentTipe === 'PG' ? 1 : 5, "Teks Pertanyaan": questionMatch[2], "Kunci Jawaban / Pasangan Menjodohkan": "" };
            continue;
        }
        const optionMatch = line.match(/^-?\s*([A-Ea-e])\.\s*(.*)/);
        if (optionMatch && currentSoal && currentSoal["Tipe Soal (PG / PGK / Menjodohkan / Essay)"] === 'PG') {
            currentSoal[`Opsi ${optionMatch[1].toUpperCase()}`] = optionMatch[2]; continue;
        }
        const kunciMatch = line.match(/^(?:Kunci|Jawaban|Kunci Jawaban)\s*:\s*(.*)/i);
        if (kunciMatch && currentSoal) { currentSoal["Kunci Jawaban / Pasangan Menjodohkan"] = kunciMatch[1].trim().toUpperCase(); continue; }
        if (currentSoal) {
            let hasOptions = currentSoal['Opsi A'] || currentSoal['Opsi B'];
            if (!hasOptions) { currentSoal["Teks Pertanyaan"] += '\n' + line; } 
            else { let lastOpt = ['E', 'D', 'C', 'B', 'A'].find(o => currentSoal[`Opsi ${o}`]); if (lastOpt) currentSoal[`Opsi ${lastOpt}`] += '\n' + line; }
        }
    }
    if (currentSoal) jsonData.push(currentSoal); return jsonData;
};

window.prosesUploadMassal = async (jsonData, mapel, kelasArray) => {
    if (jsonData.length === 0) throw new Error("File kosong atau tidak sesuai format Template!");
    let updates = []; let timestampAwal = new Date().getTime();
    
    const qC = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
    const snapC = await getDocs(qC);
    let currentClasses = new Set();
    snapC.forEach(d => { let arr = Array.isArray(d.data().kelas) ? d.data().kelas : [d.data().kelas]; arr.forEach(c => currentClasses.add(c)); });
    let kelasArrayToSave = Array.from(currentClasses);
    if (kelasArrayToSave.length === 0) { kelasArrayToSave = kelasArray; }

    for (let row of jsonData) {
        let tipeRaw = String(row["Tipe Soal (PG / PGK / Menjodohkan / Essay)"] || "PG").toUpperCase().trim();
        let tipeFormat = "PG"; if (tipeRaw.includes('ESSAY')) tipeFormat = 'Essay'; else if (tipeRaw.includes('PGK')) tipeFormat = 'PGK'; else if (tipeRaw.includes('JODOH') || tipeRaw.includes('MENJODOHKAN')) tipeFormat = 'Menjodohkan';
        timestampAwal += 10;
        let payload = { mataPelajaran: mapel, kelas: kelasArrayToSave, nomor_soal: parseInt(row["Nomor Soal"]) || 1, bobot: parseFloat(row["Bobot Soal"]) || 1, tipe: tipeFormat, teks_soal: String(row["Teks Pertanyaan"] || ""), createdAt: new Date(timestampAwal), updatedAt: new Date(timestampAwal) };
        let linkMediaPertanyaan = row["Link Media Pertanyaan (URL Gambar/Audio/Video)"] ? String(row["Link Media Pertanyaan (URL Gambar/Audio/Video)"]).trim() : "";
        if (linkMediaPertanyaan) {
            let mType = "image"; if (linkMediaPertanyaan.toLowerCase().includes('.mp3') || linkMediaPertanyaan.toLowerCase().includes('.wav')) mType = "audio"; else if (linkMediaPertanyaan.toLowerCase().includes('.mp4') || linkMediaPertanyaan.toLowerCase().includes('.mkv')) mType = "video";
            payload.media_soal = { url: linkMediaPertanyaan, type: mType };
        }
        if (tipeFormat === 'PG' || tipeFormat === 'PGK') {
            payload.opsi = { A: row["Opsi A"] ? String(row["Opsi A"]) : "", B: row["Opsi B"] ? String(row["Opsi B"]) : "", C: row["Opsi C"] ? String(row["Opsi C"]) : "", D: row["Opsi D"] ? String(row["Opsi D"]) : "", E: row["Opsi E"] ? String(row["Opsi E"]) : "" };
            let opsiMediaObj = {}; ['A', 'B', 'C', 'D', 'E'].forEach(k => { let linkMediaOpsi = row[`Link Media Opsi ${k} (URL Gambar)`] ? String(row[`Link Media Opsi ${k} (URL Gambar)`]).trim() : ""; if (linkMediaOpsi) { opsiMediaObj[k] = { url: linkMediaOpsi, type: "image" }; } });
            if (Object.keys(opsiMediaObj).length > 0) { payload.opsi_media = opsiMediaObj; }
            let kunci = String(row["Kunci Jawaban / Pasangan Menjodohkan"] || "").trim().toUpperCase();
            if (tipeFormat === 'PGK') { payload.kunci_jawaban = kunci.split(',').map(k => k.trim()); } else { payload.kunci_jawaban = kunci; }
        } else if (tipeFormat === 'Menjodohkan') {
            let kunciRaw = row["Kunci Jawaban / Pasangan Menjodohkan"] ? String(row["Kunci Jawaban / Pasangan Menjodohkan"]).trim() : ""; let pasanganArr = [];
            if (kunciRaw) { kunciRaw.split(';').forEach(p => { let splitPair = p.split('='); if (splitPair.length === 2) { pasanganArr.push({ kiri: splitPair[0].trim(), kanan: splitPair[1].trim() }); } }); }
            payload.pasangan = pasanganArr;
        } else if (tipeFormat === 'Essay') { payload.kunci_jawaban = String(row["Kunci Jawaban / Pasangan Menjodohkan"] || ""); }
        updates.push(addDoc(collection(db, "bank_soal"), payload));
    }
    await Promise.all(updates); await window.normalizeUrutanSoal(mapel);
    window.customAlert(`Sukses! ${jsonData.length} Soal berhasil diunggah dengan aman.`, "success"); 
    window.bukaDetailSoal(mapel); window.loadBankSoalSummary();
};

document.getElementById('btn-import-gdrive')?.addEventListener('click', () => {
    const mapel = document.getElementById('soal-mapel').value;
    if(!mapel) return window.customAlert("Silakan Pilih Mata Pelajaran terlebih dahulu!", "warning");
    const selectedKelasCbs = Array.from(document.querySelectorAll('.cb-soal-kelas:checked')).map(cb => cb.value);
    if(document.getElementById('group-soal-kelas').style.display !== 'none' && selectedKelasCbs.length === 0) { return window.customAlert("Silakan pilih minimal satu kelas!", "warning"); }
    document.getElementById('input-gdrive-url').value = ''; document.getElementById('modal-import-gdrive').style.display = 'flex';
});

document.getElementById('btn-proses-gdrive')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('input-gdrive-url').value.trim(); 
    if (!urlInput) return window.customAlert("Masukkan link Google Sheets/Docs terlebih dahulu!", "warning");
    const match = urlInput.match(/\/d\/([a-zA-Z0-9-_]+)/); if (!match || !match[1]) return window.customAlert("Link tidak valid!", "error");
    const fileId = match[1]; const isDocs = urlInput.includes('/document/d/');
    document.getElementById('modal-import-gdrive').style.display = 'none';
    
    const mapel = document.getElementById('soal-mapel').value; 
    const selectedKelasCbs = Array.from(document.querySelectorAll('.cb-soal-kelas:checked')).map(cb => cb.value);
    
    document.getElementById('modal-tambah-soal').style.display = 'none'; document.getElementById('view-summary-bank-soal').style.display = 'none'; document.getElementById('view-soal-list').style.display = 'block'; document.getElementById('label-mapel-edit').innerText = `Kelola Soal: ${mapel}`;
    const container = document.getElementById('list-soal'); container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--info); font-weight:bold;"><i class="fas fa-spinner fa-spin fa-3x" style="margin-bottom:15px;"></i><br>Sedang menyedot data dari Google Drive...</div>';
    try {
        if (isDocs) {
            const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`; const response = await fetch(exportUrl);
            if (!response.ok) throw new Error("Akses ditolak. Pastikan dibagikan publik (Anyone with the link).");
            const textData = await response.text(); if (textData.includes('<!DOCTYPE html>')) throw new Error("Terdeteksi HTML. Set publik tanpa login.");
            const jsonData = window.parseDocTextToJSON(textData); await window.prosesUploadMassal(jsonData, mapel, selectedKelasCbs);
        } else {
            const exportUrl = `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv`; const response = await fetch(exportUrl);
            if (!response.ok) throw new Error("Akses ditolak. Pastikan dibagikan publik (Anyone with the link).");
            const csvText = await response.text(); if (csvText.includes('<!DOCTYPE html>')) throw new Error("Terdeteksi HTML. Set publik tanpa login.");
            const workbook = XLSX.read(csvText, { type: 'string' }); const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet); await window.prosesUploadMassal(jsonData, mapel, selectedKelasCbs);
        }
    } catch (err) { window.customAlert("Gagal Import G-Drive: " + err.message, "error"); window.bukaDetailSoal(mapel); }
});

document.getElementById('upload-excel-soal')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const mapel = document.getElementById('soal-mapel').value; 
    const selectedKelasCbs = Array.from(document.querySelectorAll('.cb-soal-kelas:checked')).map(cb => cb.value);
    
    if(!mapel) { e.target.value = ''; return window.customAlert("Silakan Pilih Mata Pelajaran terlebih dahulu!", "error"); }
    if(document.getElementById('group-soal-kelas').style.display !== 'none' && selectedKelasCbs.length === 0) { e.target.value = ''; return window.customAlert("Silakan pilih minimal satu kelas!", "error"); }
    
    document.getElementById('modal-tambah-soal').style.display = 'none'; document.getElementById('view-summary-bank-soal').style.display = 'none'; document.getElementById('view-soal-list').style.display = 'block'; document.getElementById('label-mapel-edit').innerText = `Kelola Soal: ${mapel}`;
    const container = document.getElementById('list-soal'); container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--info); font-weight:bold;"><i class="fas fa-spinner fa-spin fa-3x" style="margin-bottom:15px;"></i><br>Membaca file lokal & Menyimpan...</div>';
    const reader = new FileReader();
    if (file.name.endsWith('.docx')) {
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                mammoth.extractRawText({arrayBuffer: arrayBuffer}).then(async function(result) {
                        const text = result.value; const jsonData = window.parseDocTextToJSON(text); await window.prosesUploadMassal(jsonData, mapel, selectedKelasCbs);
                }).catch(function(err) { window.customAlert("Gagal membaca Word: " + err.message, "error"); window.bukaDetailSoal(mapel); });
            } catch (err) { window.customAlert("Error: " + err.message, "error"); window.bukaDetailSoal(mapel); }
        };
        reader.readAsArrayBuffer(file);
    } else {
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData = XLSX.utils.sheet_to_json(worksheet);
                await window.prosesUploadMassal(jsonData, mapel, selectedKelasCbs);
            } catch (err) { window.customAlert("Gagal memproses file: " + err.message, "error"); window.bukaDetailSoal(mapel); }
        };
        reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
});

// ==========================================
// 10. HASIL UJIAN (CAPAIAN SISWA)
// ==========================================
window.loadDataHasil = async () => {
    try {
        const snap = await getDocs(collection(db, "hasil_ujian")); 
        const statUjian = document.getElementById('stat-ujian');
        if (statUjian) statUjian.innerText = snap.size;
        
        allHasilUjian = []; 
        snap.forEach(d => allHasilUjian.push({ id: d.id, ...d.data() }));

        const gridMapel = document.getElementById('grid-mapel-hasil'); 
        if(!gridMapel) return;

        let summaryMapel = {};
        
        allHasilUjian.forEach(h => {
            const isAuthorized = isAdmin || (isGuru && userMapel.includes(h.mataPelajaran));
            
            if (isAuthorized) {
                const kelasStr = Array.isArray(h.kelas) ? h.kelas.join(', ') : (h.kelas || "-");
                let key = `${h.mataPelajaran} - Kelas ${kelasStr}`;
                
                if(!summaryMapel[key]) summaryMapel[key] = { mapel: h.mataPelajaran, kelas: kelasStr, count: 0, totalNilai: 0 };
                
                summaryMapel[key].count++; 
                let nilaiSiswa = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : (h.nilai || 0));
                summaryMapel[key].totalNilai += parseFloat(nilaiSiswa);
            }
        });

        gridMapel.innerHTML = '';
        for (let key in summaryMapel) {
            let s = summaryMapel[key]; 
            let rataRata = s.count > 0 ? (s.totalNilai / s.count).toFixed(2) : "0.00";
            gridMapel.innerHTML += `
            <div class="stat-card" style="cursor:pointer; border: 1px solid var(--border-color);" onclick="window.bukaDetailHasil('${s.mapel}', '${s.kelas}')">
                <div>
                    <p style="font-weight:bold; color:var(--secondary);">${key}</p>
                    <div style="display:flex; gap:15px; margin-top:10px;">
                        <span style="font-size:0.85rem; color:var(--text-muted);"><i class="fas fa-users"></i> ${s.count} Siswa</span>
                        <span style="font-size:0.85rem; color:var(--success);"><i class="fas fa-chart-line"></i> Avg: ${rataRata}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button onclick="event.stopPropagation(); window.downloadExcelHasil('${s.mapel}', '${s.kelas}')" class="btn-3d" style="background-color: #16a34a; margin: 0; padding: 6px 10px; font-size: 0.80rem;" title="Unduh Excel"><i class="fas fa-download"></i></button>
                    <div style="color: var(--success);"><i class="fas fa-folder-open"></i></div>
                </div>
            </div>`;
        }
        
        if(gridMapel.innerHTML === '') {
            gridMapel.innerHTML = '<p style="grid-column: 1 / -1; text-align:center; color:var(--text-muted);">Belum ada data hasil ujian untuk mapel yang Anda ampu.</p>';
        }
    } catch(e) { console.error("Gagal memuat hasil ujian:", e); }
};

window.bukaDetailHasil = (mapel, kelas) => { 
    currentMapelDetail = mapel; 
    currentKelasDetail = kelas; 
    document.getElementById('label-mapel-detail').innerText = `HASIL: ${mapel} - KELAS ${kelas}`; 
    window.location.hash = 'section-hasil-detail'; 
    window.renderDetailHasil(); 
};

window.lihatDetailStatus = (status, pelanggaran) => {
    let title = "Detail Status Ujian"; let msg = ""; let type = "info";
    if (status === 'NORMAL') { type = "success"; title = "Status: NORMAL"; msg = `Ujian diselesaikan dengan baik oleh siswa.\n\nTotal pelanggaran terdeteksi: ${pelanggaran} kali.`; } 
    else if (status === 'DISKUALIFIKASI' || status === 'DIHENTIKAN PAKSA') { type = "error"; title = `Status: ${status}`; msg = `Ujian dihentikan paksa oleh sistem keamanan CBT.\n\nSiswa telah melakukan pelanggaran sebanyak ${pelanggaran} kali.`; } 
    else if (status === 'WAKTU HABIS') { type = "warning"; title = "Status: WAKTU HABIS"; msg = `Durasi ujian telah habis.\nSistem otomatis mengumpulkan jawaban terakhir.`; } 
    else { type = "info"; title = `Status Ujian: ${status}`; msg = `Ujian disubmit dengan status: ${status}.\n\nTotal pelanggaran terdeteksi: ${pelanggaran} kali.`; }
    window.customAlert(msg, type, title);
};

window.renderDetailHasil = () => {
    const tbody = document.querySelector('#table-hasil tbody'); if (!tbody) return;
    
    const dataFiltered = allHasilUjian.filter(h => {
        const mapelMatch = h.mataPelajaran === currentMapelDetail;
        const kelasSiswaStr = Array.isArray(h.kelas) ? h.kelas.join(', ') : (h.kelas || "-");
        const kelasMatch = kelasSiswaStr === currentKelasDetail;
        return mapelMatch && kelasMatch;
    });
    
    dataFiltered.sort((a, b) => new Date(b.waktuSubmit) - new Date(a.waktuSubmit));

    if (dataFiltered.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Belum ada data hasil ujian.</td></tr>'; 
    } else {
        let html = '';
        dataFiltered.forEach((h, index) => {
            const namaSiswa = h.nama || "Nama Tidak Terdata"; const nisSiswa = h.username || h.uid || "-";
            const nilai = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : 0);
            const jmlPelanggaran = h.pelanggaran || 0; const status = h.statusPelanggaran || 'NORMAL';
            
            let warnaStatus = '#10b981'; if (status === 'DISKUALIFIKASI' || status === 'DIHENTIKAN PAKSA') warnaStatus = '#ef4444'; else if (status === 'WAKTU HABIS') warnaStatus = '#f59e0b';
            let waktu = '-'; if (h.waktuSubmit) { const dateObj = new Date(h.waktuSubmit); waktu = !isNaN(dateObj) ? dateObj.toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : h.waktuSubmit; }
            
            html += `<tr>
                    <td>${index + 1}</td>
                    <td>${namaSiswa} <br><small style="color:var(--text-muted)">${nisSiswa}</small></td>
                    <td style="text-align:center; font-weight:bold; font-size:1.1rem;">${nilai}</td>
                    <td style="text-align:center;"><span class="badge ${jmlPelanggaran > 0 ? 'badge-danger' : 'badge-success'}">${jmlPelanggaran}</span></td>
                    <td style="text-align:center;"><span onclick="window.lihatDetailStatus('${status}', ${jmlPelanggaran})" style="background: ${warnaStatus}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; display: inline-block; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${status}</span></td>
                    <td style="text-align:center; font-size:0.85rem;">${waktu}</td>
                    <td style="text-align:center;"><div style="display: flex; gap: 5px; justify-content: center;"><button onclick="window.lihatDetailJawaban('${h.id}')" class="btn-3d" style="background:var(--info); padding:6px 10px; font-size:0.85rem;" title="Lihat Detail & Edit Nilai"><i class="fas fa-eye"></i></button><button onclick="window.hapusHasil('${h.id}')" class="btn-3d" style="background:var(--danger); padding:6px 10px; font-size:0.85rem;" title="Hapus Data"><i class="fas fa-trash-alt"></i></button></div></td>
                </tr>`;
        });
        tbody.innerHTML = html;
    }
};

window.downloadExcelHasil = async (mapel = currentMapelDetail, kelas = currentKelasDetail) => {
    const dataFiltered = allHasilUjian.filter(h => {
        const mapelMatch = h.mataPelajaran === mapel;
        const kelasSiswaStr = Array.isArray(h.kelas) ? h.kelas.join(', ') : (h.kelas || "-");
        const kelasMatch = kelasSiswaStr === kelas;
        return mapelMatch && kelasMatch;
    });
    
    if (dataFiltered.length === 0) { window.customAlert("Tidak ada data hasil ujian.", "warning"); return; }
    
    const btn = document.querySelector(`button[onclick="window.downloadExcelHasil()"]`) || document.querySelector(`button[onclick*="downloadExcelHasil('${mapel}'"]`);
    let origText = ""; if (btn) { origText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan Bank Soal...'; btn.disabled = true; }

    try {
        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel)); const soalSnap = await getDocs(q); let soalArr = [];
        soalSnap.forEach(doc => { let data = doc.data(); let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas]; if (arrKelas.includes(kelas) || kelas.includes(arrKelas[0])) { soalArr.push({ id: doc.id, ...data }); } }); 
        soalArr.sort((a, b) => (a.nomor_soal || 0) - (b.nomor_soal || 0));

        const rowsForExcel = dataFiltered.map((h, index) => {
            let nilaiSiswa = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : 0);
            let waktu = '-'; if (h.waktuSubmit) { const dObj = new Date(h.waktuSubmit); waktu = !isNaN(dObj) ? dObj.toLocaleString('id-ID') : h.waktuSubmit; }
            let rowData = { "No": index + 1, "Nama Siswa": h.nama || "Nama Tidak Terdata", "NIS / Username": h.username || h.uid || "-", "Mata Pelajaran": h.mataPelajaran, "Kelas": h.kelas, "Nilai Akhir": nilaiSiswa, "Jumlah Pelanggaran": h.pelanggaran || 0, "Status Ujian": h.statusPelanggaran || 'NORMAL', "Waktu Submit": waktu };
            soalArr.forEach((s, idx) => {
                const tipe = s.tipe || 'PG'; const jawabanSiswa = h.jawaban || {}; const jwbSiswa = jawabanSiswa[s.id] || '-'; const jwbBenar = s.kunci_jawaban || s.jawaban_benar || '-';
                let teksBersih = (s.teks_soal || s.pertanyaan || '').replace(/<[^>]*>/g, ''); if (teksBersih.length > 45) teksBersih = teksBersih.substring(0, 45) + '...';
                const keyKolomSoal = `Soal ${idx + 1} (${tipe}): ${teksBersih}`;
                if (tipe === 'PG' || tipe === 'PGK') {
                    const isBenar = Array.isArray(jwbBenar) ? (Array.isArray(jwbSiswa) && jwbSiswa.sort().join(',') === jwbBenar.sort().join(',')) : (jwbSiswa === jwbBenar);
                    rowData[keyKolomSoal] = `${jwbSiswa} [Kunci: ${Array.isArray(jwbBenar) ? jwbBenar.join('-') : jwbBenar}] (${isBenar ? 'BENAR' : 'SALAH'})`;
                } else { rowData[keyKolomSoal] = jwbSiswa; }
            });
            return rowData;
        });

        const worksheet = XLSX.utils.json_to_sheet(rowsForExcel); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Analisis Hasil Ujian");
        let colsConfig = [ {wch: 5}, {wch: 25}, {wch: 15}, {wch: 20}, {wch: 10}, {wch: 12}, {wch: 18}, {wch: 15}, {wch: 20} ];
        soalArr.forEach(() => { colsConfig.push({wch: 45}); }); worksheet['!cols'] = colsConfig;
        XLSX.writeFile(workbook, `Hasil_Lengkap_CBT_${mapel}_${kelas}.xlsx`);
    } catch (e) { window.customAlert("Terjadi kesalahan sistem rekap.", "error"); } finally { if (btn) { btn.innerHTML = origText; btn.disabled = false; } }
};

window.hapusHasil = async (id) => { 
    if (await customConfirm("Hapus hasil ujian siswa ini?", "danger")) { 
        await deleteDoc(doc(db, "hasil_ujian", id)); 
        await window.loadDataHasil(); // Tambahkan kata await di baris ini
        window.renderDetailHasil(); 
    } 
};

document.getElementById('btn-hapus-semua-hasil')?.addEventListener('click', async () => {
    if (!currentMapelDetail || !currentKelasDetail) return;
    if (await window.customConfirm(`Hapus SEMUA data hasil ujian untuk mapel ${currentMapelDetail} di Kelas ${currentKelasDetail}?`, "danger", "Kosongkan Data")) {
        const btnHapusAll = document.getElementById('btn-hapus-semua-hasil'); const origText = btnHapusAll.innerHTML;
        btnHapusAll.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghapus Massal...'; btnHapusAll.disabled = true;
        try {
            const dataAkanDihapus = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && (Array.isArray(h.kelas) ? h.kelas.includes(currentKelasDetail) : h.kelas === currentKelasDetail));
            await Promise.all(dataAkanDihapus.map(h => deleteDoc(doc(db, "hasil_ujian", h.id))));
            await window.customAlert(`${dataAkanDihapus.length} data berhasil dikosongkan!`, "success"); window.loadDataHasil(); window.location.hash = 'section-hasil';
        } catch (e) { await window.customAlert("Terjadi kesalahan saat menghapus data massal.", "error"); }
        btnHapusAll.innerHTML = origText; btnHapusAll.disabled = false;
    }
});

// ==========================================
// 11. PREVIEW SOAL MODERN
// ==========================================
window.previewSoal = (id) => {
    const s = window.tempDataSoalKelola.find(x => x.id === id); if(!s) return;
    const content = document.getElementById('preview-content'); content.dataset.dark = '0'; content.style.background = 'white'; content.style.borderColor = '#e2e8f0'; content.style.color = '';
    const btn = document.getElementById('btn-dark-toggle'); if(btn){ btn.innerHTML = '<i class="fas fa-moon" style="font-size:0.9rem;"></i>'; btn.style.background = '#f1f5f9'; btn.style.color = '#475569'; }

    document.getElementById('preview-title').innerText = `Soal ${s.nomor_soal || ''} - ${s.tipe || 'PG'}`; document.getElementById('preview-subtitle').innerText = `${s.mataPelajaran} • ${s.bobot || 1} poin`;
    
    let html = `<div style="margin-bottom:22px;"><div style="display:inline-flex; align-items:center; gap:8px; background:#f0f9ff; color:#0369a1; padding:6px 12px; border-radius:8px; font-size:0.8rem; font-weight:600; margin-bottom:14px; border:1px solid #bae6fd;"><i class="fas fa-user-graduate"></i> Tampilan Siswa</div><div style="font-size:1.08rem; line-height:1.75; color:#0f172a; font-weight:500;">${s.teks_soal || ''}</div></div>`;
    
    if(s.media_soal){
        const mUrl = typeof s.media_soal === 'object' ? s.media_soal.url : s.media_soal;
        const mType = typeof s.media_soal === 'object' && s.media_soal.type ? s.media_soal.type : 'image';
        if(mType === 'video'){ html += `<div style="margin:20px 0; text-align:center;"><video src="${mUrl}" controls style="max-width:100%; max-height:320px; border-radius:12px; background:#000;"></video></div>`; } 
        else if(mType === 'audio'){ html += `<div style="margin:20px 0; text-align:center;"><audio src="${mUrl}" controls></audio></div>`; }
        else { html += `<div style="margin:20px 0; text-align:center;"><img src="${mUrl}" style="max-width:100%; max-height:320px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.08);"></div>`; }
    }
    
    if(s.tipe === 'PG' || s.tipe === 'PGK'){
        html += '<div style="display:flex; flex-direction:column; gap:12px; margin-top:24px;">';
        ['A','B','C','D','E'].forEach(k => {
            if(s.opsi && (s.opsi[k] || (s.opsi_media && s.opsi_media[k]))){
                const isCorrect = s.tipe === 'PG' ? s.kunci_jawaban === k : (Array.isArray(s.kunci_jawaban) && s.kunci_jawaban.includes(k));
                
                let mHtml = '';
                if(s.opsi_media && s.opsi_media[k]){
                    const moData = s.opsi_media[k]; const moUrl = typeof moData === 'object' ? moData.url : moData; const moType = typeof moData === 'object' && moData.type ? moData.type : 'image';
                    if(moType === 'video') mHtml = `<video src="${moUrl}" controls style="max-width:180px; margin-top:8px; border-radius:8px; background:#000;"></video>`;
                    else if(moType === 'audio') mHtml = `<audio src="${moUrl}" controls style="margin-top:8px;"></audio>`;
                    else mHtml = `<img src="${moUrl}" style="max-width:180px; margin-top:8px; border-radius:8px; border:1px solid #e2e8f0;">`;
                }

                html += `<div style="display:flex; align-items:flex-start; gap:14px; padding:14px 16px; border:1.5px solid ${isCorrect ? '#86efac' : '#e2e8f0'}; border-radius:12px; background:${isCorrect ? '#f0fdf4' : 'white'}; transition:all 0.2s;"><div style="width:32px; height:32px; background:${isCorrect ? '#10b981' : '#f1f5f9'}; color:${isCorrect ? 'white' : '#475569'}; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0;">${k}</div><div style="flex:1; padding-top:2px;"><div style="color:#1e293b; line-height:1.6;">${s.opsi[k]}</div>${mHtml}</div>${isCorrect ? '<div style="color:#10b981; font-size:1.1rem;"><i class="fas fa-check-circle"></i></div>' : ''}</div>`;
            }
        });
        html += '</div>';
    } else if(s.tipe === 'Menjodohkan'){ html += '<div style="margin-top:20px; padding:16px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; color:#92400e; font-size:0.9rem;"><i class="fas fa-link"></i> Soal Menjodohkan - siswa akan memasangkan jawaban di aplikasi</div>'; } else if(s.tipe === 'Essay'){ html += `<div style="margin-top:24px;"><label style="display:block; font-weight:600; margin-bottom:8px; color:#475569; font-size:0.9rem;">Jawaban siswa:</label><div style="min-height:120px; border:1.5px dashed #cbd5e1; border-radius:10px; background:#f8fafc;"></div>${s.kunci_jawaban ? `<div style="margin-top:16px; padding:12px; background:#f0f9ff; border-left:3px solid #0ea5e9; border-radius:6px;"><strong style="font-size:0.85rem; color:#0369a1;">Kunci/Rubrik:</strong><div style="margin-top:4px; color:#0c4a6e; font-size:0.9rem;">${s.kunci_jawaban}</div></div>` : ''}</div>`; }
    
    document.getElementById('preview-content').innerHTML = html; document.getElementById('modal-preview-soal').style.display = 'flex';
};

window.togglePreviewDark = () => {
    const content = document.getElementById('preview-content'); const modal = document.getElementById('modal-preview-soal'); const btn = document.getElementById('btn-dark-toggle'); const isDark = content.dataset.dark === '1';
    if(!isDark){
        content.dataset.dark = '1'; content.style.background = '#0f172a'; content.style.borderColor = '#334155'; content.style.color = '#e2e8f0'; modal.querySelector('[style*="background:#f8fafc"]').style.background = '#020617'; btn.innerHTML = '<i class="fas fa-sun" style="font-size:0.9rem;"></i>'; btn.style.background = '#1e293b'; btn.style.color = '#fbbf24'; btn.style.borderColor = '#334155';
        content.querySelectorAll('div').forEach(el => {
            const style = el.getAttribute('style') || '';
            if(style.includes('color:#0f172a') || style.includes('color:#1e293b')){ el.style.color = '#e2e8f0'; }
            if(style.includes('background:white') && !style.includes('border')){ el.style.background = '#1e293b'; el.style.borderColor = '#334155'; }
            if(style.includes('background:#f8fafc')){ el.style.background = '#0f172a'; }
            if(style.includes('border:1.5px solid #e2e8f0')){ el.style.borderColor = '#334155'; el.style.background = '#1e293b'; }
            if(style.includes('background:#f0f9ff')){ el.style.background = '#1e293b'; el.style.borderColor = '#334155'; }
        });
    } else {
        content.dataset.dark = '0'; content.style.background = 'white'; content.style.borderColor = '#e2e8f0'; content.style.color = ''; modal.querySelector('[style*="background:#020617"]').style.background = '#f8fafc'; btn.innerHTML = '<i class="fas fa-moon" style="font-size:0.9rem;"></i>'; btn.style.background = '#f1f5f9'; btn.style.color = '#475569'; btn.style.borderColor = '#e2e8f0';
        const currentId = window.tempDataSoalKelola.find(s => document.getElementById('preview-title').innerText.includes(s.nomor_soal))?.id; if(currentId) { window.previewSoal(currentId); content.dataset.dark = '0'; }
    }
};

// ==========================================
// 12. EVENT LISTENER SIMULASI SISWA
// ==========================================
document.getElementById('btn-mode-siswa')?.addEventListener('click', () => {
    const selectKelas = document.getElementById('simulasi-kelas');
    selectKelas.innerHTML = listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
    document.getElementById('modal-simulasi-siswa').style.display = 'flex';
});

document.getElementById('btn-mulai-simulasi')?.addEventListener('click', async () => {
    const kelasTarget = document.getElementById('simulasi-kelas').value;
    if(!kelasTarget) return window.customAlert("Pilih kelas terlebih dahulu!", "warning");
    
    const btn = document.getElementById('btn-mulai-simulasi');
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mempersiapkan...';
    btn.disabled = true;

    try {
        const user = auth.currentUser;
        if(user) {
            await updateDoc(doc(db, "users", user.uid), { kelas: [kelasTarget] });
            window.location.href = "attempt.html";
        }
    } catch(e) {
        console.error(e); window.customAlert("Gagal memulai simulasi. Periksa koneksi Anda.", "error");
        btn.innerHTML = origHtml; btn.disabled = false;
    }
});
