import { auth, db, storage, functions } from './firebase-config.js'; 
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-functions.js";

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

        if (!isAdmin) {
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

        if (isAdmin) { fetchStatusReg(); } 

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
    // PORTAL REGISTRASI
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
    let editMasterMode = false; 

    document.getElementById('btn-open-data-master')?.addEventListener('click', () => { 
        document.getElementById('modal-data-master').style.display = 'flex'; 
        editMasterMode = false; 
        renderTableMaster();
    });

    document.getElementById('close-modal-data-master')?.addEventListener('click', () => { 
        document.getElementById('modal-data-master').style.display = 'none'; 
    });

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
            
            let delMapel = (m && editMasterMode) ? `<button onclick="window.hapusMasterItem('mapel', '${m}')" style="color:var(--danger); background:none; border:none; cursor:pointer; margin-left:10px;"><i class="fas fa-times-circle"></i></button>` : '';
            let delKelas = (k && editMasterMode) ? `<button onclick="window.hapusMasterItem('kelas', '${k}')" style="color:var(--danger); background:none; border:none; cursor:pointer; margin-left:10px;"><i class="fas fa-times-circle"></i></button>` : '';

            let cellMapel = m ? `<td style="font-weight:600; display:flex; justify-content:space-between;">${m} ${delMapel}</td>` : `<td>-</td>`;
            let cellKelas = k ? `<td style="font-weight:600; display:flex; justify-content:space-between;">${k} ${delKelas}</td>` : `<td>-</td>`;
            
            html += `<tr>${cellMapel}${cellKelas}</tr>`;
        }
        tbody.innerHTML = html;
    }

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
            loadDataMaster();
        } catch (e) {
            window.customAlert("Gagal menghapus data.", "error");
        }
    };

    function populateSemuaDropdown() {
        const cmbKelasSiswa = document.getElementById('edit-kelas-siswa');
        if (cmbKelasSiswa) cmbKelasSiswa.innerHTML = listKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        const containerMapel = document.getElementById('edit-mapel-container');
        if (containerMapel) containerMapel.innerHTML = listMapel.map(m => `<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="edit-mapel-cb" value="${m}"> ${m}</label>`).join('');

        const containerKelasGuru = document.getElementById('edit-kelas-guru-container');
        if (containerKelasGuru) containerKelasGuru.innerHTML = listKelas.map(k => `<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="edit-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');
    }

    // ==========================================
    // 5. MANAJEMEN PENGGUNA (ADMIN & GURU EDIT DIRI SENDIRI)
    // ==========================================
    async function loadDataPengguna() {
        const tbodyGuru = document.querySelector('#table-guru tbody');
        const tbodySiswa = document.querySelector('#table-siswa tbody');
        
        let colCount = 5; 

        if (tbodyGuru) tbodyGuru.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;">Memuat data...</td></tr>`;
        if (tbodySiswa) tbodySiswa.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;">Memuat data...</td></tr>`;

        // Pastikan header Aksi ditampilkan
        const thGuru = document.querySelector('#table-guru th:nth-child(5)');
        const thSiswa = document.querySelector('#table-siswa th:nth-child(5)');
        if (thGuru) thGuru.style.display = 'table-cell';
        if (thSiswa) thSiswa.style.display = 'table-cell';

        try {
            const snap = await getDocs(collection(db, "users"));
            let countSiswa = 0;
            let countGuru = 0;
            let htmlGuru = '';
            let htmlSiswa = '';

            allUsersData = [];
            const currentUserUid = auth.currentUser.uid;

            snap.forEach(d => {
                const data = d.data();
                const id = d.id;
                allUsersData.push({ id, ...data });

                let roleArray = typeof data.role === 'string' ? [data.role] : (Array.isArray(data.role) ? data.role : []);
                let roleStr = roleArray.join(', ');
                let isSiswa = roleArray.includes('siswa');
                let isGuruAcc = roleArray.includes('guru') || roleArray.includes('admin');

                let isOwnAccount = (id === currentUserUid);
                let actionCell = '';

                // Aksi HANYA muncul untuk Admin ATAU pada akun milik user itu sendiri
                if (isAdmin || isOwnAccount) {
                    let isRowAdmin = roleArray.includes('admin');
                    let actionButtons = '';
                    
                    if (isAdmin && isRowAdmin && !isOwnAccount) {
                        actionButtons = `<span style="color:var(--text-muted); font-size:0.85rem;"><i class="fas fa-shield-alt"></i> Protected</span>`;
                    } else {
                        actionButtons = `<button onclick="window.editAkun('${id}')" class="btn-3d" style="background:var(--warning); margin:2px; padding:6px 10px; font-size:0.8rem;" title="Edit Akun"><i class="fas fa-edit"></i></button>`;
                        
                        // Guru biasa TIDAK boleh hapus akun (termasuk dirinya sendiri)
                        if (isAdmin && !isOwnAccount) {
                            actionButtons += ` <button onclick="window.hapusAkun('${id}')" class="btn-3d" style="background:var(--danger); margin:2px; padding:6px 10px; font-size:0.8rem;" title="Hapus Akun"><i class="fas fa-trash-alt"></i></button>`;
                        }
                    }
                    actionCell = `<td style="text-align:center; white-space: nowrap;">${actionButtons}</td>`;
                } else {
                    actionCell = `<td style="text-align:center; color:var(--text-muted); font-size:0.8rem;">-</td>`;
                }

                if (isGuruAcc) {
                    countGuru++;
                    let mapelStr = data.mapel ? (Array.isArray(data.mapel) ? data.mapel.join(', ') : data.mapel) : '-';
                    let kelasStr = data.kelas ? (Array.isArray(data.kelas) ? data.kelas.join(', ') : data.kelas) : '-';
                    let detail = `<span style="font-size:0.8rem"><b>Mapel:</b> ${mapelStr}<br><b>Kelas:</b> ${kelasStr}</span>`;
                    
                    htmlGuru += `<tr>
                        <td>${data.username || '-'}</td>
                        <td>${data.nama || '-'}</td>
                        <td><span class="badge" style="background:var(--info); color:white; padding:3px 8px; border-radius:4px; font-size:0.75rem;">${roleStr.toUpperCase()}</span></td>
                        <td>${detail}</td>
                        ${actionCell}
                    </tr>`;
                } 
                if (isSiswa) {
                    countSiswa++;
                    htmlSiswa += `<tr>
                        <td>${data.username || '-'}</td>
                        <td>${data.nama || '-'}</td>
                        <td><span class="badge" style="background:var(--success); color:white; padding:3px 8px; border-radius:4px; font-size:0.75rem;">SISWA</span></td>
                        <td>${data.kelas || '-'}</td>
                        ${actionCell}
                    </tr>`;
                }
            });

            if (tbodyGuru) tbodyGuru.innerHTML = countGuru > 0 ? htmlGuru : `<tr><td colspan="${colCount}" style="text-align:center;">Belum ada data guru.</td></tr>`;
            if (tbodySiswa) tbodySiswa.innerHTML = countSiswa > 0 ? htmlSiswa : `<tr><td colspan="${colCount}" style="text-align:center;">Belum ada data siswa.</td></tr>`;
            
            let statSiswaEl = document.getElementById('stat-siswa');
            if (statSiswaEl) statSiswaEl.innerText = countSiswa + countGuru;

        } catch (e) {
            console.error("Gagal memuat data pengguna:", e);
        }
    }

    window.hapusAkun = async (id) => {
        if (await window.customConfirm("Hapus akun ini secara permanen?", "danger")) {
            try {
                await deleteDoc(doc(db, "users", id));
                await window.customAlert("Akun berhasil dihapus!", "success");
                loadDataPengguna();
            } catch (e) {
                console.error(e);
                await window.customAlert("Gagal menghapus akun.", "error");
            }
        }
    };

    window.editAkun = async (id) => {
        const user = allUsersData.find(u => u.id === id);
        if (!user) return;
        document.getElementById('edit-uid').value = id;
        document.getElementById('edit-nama').value = user.nama || '';
        document.getElementById('edit-username').value = user.username || '';
        document.getElementById('edit-pass').value = '';
        
        document.querySelectorAll('.edit-role-cb').forEach(cb => { cb.checked = false; cb.disabled = !isAdmin; });
        
        let roles = Array.isArray(user.role) ? user.role : (typeof user.role === 'string' ? [user.role] : []);
        roles.forEach(r => {
            let cb = document.querySelector(`.edit-role-cb[value="${r}"]`);
            if(cb) cb.checked = true;
        });

        document.querySelectorAll('.edit-mapel-cb').forEach(cb => { cb.checked = false; cb.disabled = !isAdmin; });
        if(user.mapel) {
            let userMapels = Array.isArray(user.mapel) ? user.mapel : [user.mapel];
            userMapels.forEach(m => { let cb = document.querySelector(`.edit-mapel-cb[value="${m}"]`); if(cb) cb.checked = true; });
        }
        
        document.querySelectorAll('.edit-kelas-guru-cb').forEach(cb => { cb.checked = false; cb.disabled = !isAdmin; });
        if(user.kelas && roles.includes('guru')) {
            let userKelasGuru = Array.isArray(user.kelas) ? user.kelas : [user.kelas];
            userKelasGuru.forEach(k => { let cb = document.querySelector(`.edit-kelas-guru-cb[value="${k}"]`); if(cb) cb.checked = true; });
        }

        const editKelasSiswa = document.getElementById('edit-kelas-siswa');
        if(editKelasSiswa) editKelasSiswa.disabled = !isAdmin;
        
        if (roles.includes('siswa')) {
            editKelasSiswa.value = user.kelas || '';
        }

        toggleEditGroup();
        document.getElementById('modal-edit-akun').style.display = 'flex';
    };

    document.getElementById('close-modal-edit-akun')?.addEventListener('click', () => { 
        document.getElementById('modal-edit-akun').style.display = 'none'; 
    });

    document.querySelectorAll('.edit-role-cb').forEach(cb => {
        cb.addEventListener('change', toggleEditGroup);
    });

    function toggleEditGroup() {
        const isSiswa = document.querySelector('.edit-role-cb[value="siswa"]').checked;
        const isGuru = document.querySelector('.edit-role-cb[value="guru"]').checked;
        
        document.getElementById('group-edit-kelas-siswa').style.display = isSiswa ? 'block' : 'none';
        document.getElementById('group-edit-guru').style.display = isGuru ? 'flex' : 'none';
    }

    // UPDATE PROFIL KE DATABASE FIRESTORE & FIREBASE AUTH MELALUI CLOUD FUNCTIONS
    document.getElementById('btn-save-edit-akun')?.addEventListener('click', async () => {
        const uid = document.getElementById('edit-uid').value;
        const name = document.getElementById('edit-nama').value.trim();
        const username = document.getElementById('edit-username').value.trim();
        const pass = document.getElementById('edit-pass').value;

        const btnSave = document.getElementById('btn-save-edit-akun');
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...';
        btnSave.disabled = true;

        // Payload dasar untuk Firestore
        let payload = { nama: name, username: username };

        if (isAdmin) {
            let roles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(cb => cb.value);
            if(roles.length === 0) {
                btnSave.innerHTML = originalText; btnSave.disabled = false;
                return window.customAlert('Pilih minimal satu role!', 'warning');
            }
            payload.role = roles;

            if (roles.includes('siswa')) {
                payload.kelas = document.getElementById('edit-kelas-siswa').value;
            }

            if (roles.includes('guru') || roles.includes('admin')) {
                payload.mapel = Array.from(document.querySelectorAll('.edit-mapel-cb:checked')).map(cb => cb.value);
                payload.kelas = Array.from(document.querySelectorAll('.edit-kelas-guru-cb:checked')).map(cb => cb.value);
            }
        }

        try {
            // 1. UPDATE DATA DI FIRESTORE (Data Profil)
            await updateDoc(doc(db, "users", uid), payload);
            
            // 2. UPDATE AUTENTIKASI MELALUI CLOUD FUNCTION (Khusus Admin)
            if (isAdmin) {
                const updateAkunAdmin = httpsCallable(functions, 'updateAkunAdmin');
                await updateAkunAdmin({
                    targetUid: uid,
                    newUsername: username, // Akan diubah menjadi email di backend
                    newPassword: pass || null // Hanya update jika password diisi
                });
            }

            await window.customAlert('Profil dan Autentikasi berhasil diperbarui sepenuhnya!', 'success');
            document.getElementById('modal-edit-akun').style.display = 'none';
            loadDataPengguna();
            
        } catch(e) {
            console.error("Error Update Akun:", e);
            window.customAlert(`Gagal menyimpan perubahan. Pastikan koneksi stabil. Error: ${e.message}`, 'error');
        } finally {
            btnSave.innerHTML = originalText;
            btnSave.disabled = false;
        }
    });

    // ==========================================
    // 6. BANK SOAL & SUMMARY (GURU MELIHAT SEMUA MAPEL)
    // ==========================================
    async function loadBankSoalSummary() {
        const tbody = document.querySelector('#table-bank-soal-summary tbody');
        if(!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Memuat data...</td></tr>';
        
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            let summary = {};
            let uniqueMapel = new Set(); 

            // Tampilkan SEMUA MAPEL baik untuk Admin maupun Guru
            snap.forEach(d => {
                let mapel = d.data().mataPelajaran; let kelas = d.data().kelas;
                uniqueMapel.add(mapel);
                let key = `${mapel}_${kelas}`;
                if(!summary[key]) summary[key] = { mapel, kelas, count: 0 };
                summary[key].count++;
            });

            // Tampilkan jumlah mapel pada kartu statistik
            let statSoalEl = document.getElementById('stat-soal');
            if (statSoalEl) statSoalEl.innerText = uniqueMapel.size;

            const waktuSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
            const waktuData = waktuSnap.exists() ? waktuSnap.data() : {};
            
            const jadwalSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian"));
            const jadwalData = jadwalSnap.exists() ? jadwalSnap.data() : {};
            
            const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
            const tokenData = tokenSnap.exists() ? tokenSnap.data() : {};

            let html = '';
            for (let key in summary) {
                let d = summary[key];
                let jadwal = jadwalData[key] ? jadwalData[key].replace('T', ' ') : '-';
                let durasi = waktuData[key] ? waktuData[key] + ' Mnt' : '-';
                
                let token = '-';
                if(tokenData[`token_${key}`]) {
                    token = typeof tokenData[`token_${key}`] === 'object' ? tokenData[`token_${key}`].code : tokenData[`token_${key}`];
                }

                // Cek hak kelola: Guru hanya bisa Kelola mapel yang dimilikinya
                let isMapelGuru = isGuru && userMapel.includes(d.mapel);
                let actionBtn = '';
                if (isAdmin || isMapelGuru) {
                    actionBtn = `<button onclick="window.bukaDetailSoal('${d.mapel}', '${d.kelas}')" class="btn-3d" style="background:var(--info); padding:5px 15px; font-size:0.85rem;"><i class="fas fa-cog"></i> Kelola</button>`;
                } else {
                    actionBtn = `<span style="color:var(--text-muted); font-size:0.85rem;"><i class="fas fa-lock"></i> Terkunci</span>`;
                }

                html += `<tr>
                    <td>${d.mapel}</td>
                    <td>${d.kelas}</td>
                    <td>${jadwal}</td>
                    <td>${durasi}</td>
                    <td style="font-weight:bold; color:var(--danger);">${token}</td>
                    <td>${d.count}</td>
                    <td style="text-align:center;">${actionBtn}</td>
                </tr>`;
            }

            if(html === '') html = '<tr><td colspan="7" style="text-align:center;">Tidak ada data soal.</td></tr>';
            tbody.innerHTML = html;
            
        } catch (e) {
            console.error("Gagal memuat summary soal:", e);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Gagal memuat data</td></tr>';
        }
    }

    // Fungsi Global untuk membuka Modal Tambah Soal
    window.bukaModalTambahSoal = (mapelParams = "", kelasParams = "") => {
        const mapelSelect = document.getElementById('soal-mapel');
        const kelasSelect = document.getElementById('soal-kelas');

        // Batasi pilihan mapel jika yang login adalah guru
        let allowedMapel = listMapel;
        if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }

        // Isi dropdown
        mapelSelect.innerHTML = '<option value="" disabled selected>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        kelasSelect.innerHTML = '<option value="" disabled selected>-- Pilih Kelas --</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        // Cek darimana modal ini dibuka
        if (mapelParams && kelasParams) {
            // Jika dibuka dari menu "Kelola" (detail mapel tertentu)
            mapelSelect.value = mapelParams;
            kelasSelect.value = kelasParams;
            
            // Kunci dropdown agar tidak salah input
            mapelSelect.style.pointerEvents = 'none'; mapelSelect.style.backgroundColor = '#e2e8f0';
            kelasSelect.style.pointerEvents = 'none'; kelasSelect.style.backgroundColor = '#e2e8f0';
        } else {
            // Jika dibuka langsung dari "Input Soal" (halaman utama)
            mapelSelect.value = "";
            kelasSelect.value = "";
            
            // Buka dropdown agar bisa milih mapel dan kelas
            mapelSelect.style.pointerEvents = 'auto'; mapelSelect.style.backgroundColor = '#fafafa';
            kelasSelect.style.pointerEvents = 'auto'; kelasSelect.style.backgroundColor = '#fafafa';
        }

        document.getElementById('modal-tambah-soal').style.display = 'flex';
    };

    // Tombol Input Soal Langsung (Halaman Depan)
    document.getElementById('btn-tambah-langsung')?.addEventListener('click', () => {
        window.bukaModalTambahSoal();
    });

    window.bukaDetailSoal = async (mapel, kelas) => {
        document.getElementById('view-summary-bank-soal').style.display = 'none';
        document.getElementById('view-soal-list').style.display = 'block';
        document.getElementById('label-mapel-edit').innerText = `${mapel} - ${kelas}`;
        
        document.getElementById('filter-soal-mapel').value = mapel;
        document.getElementById('filter-soal-kelas').value = kelas;
        
        let key = `${mapel}_${kelas}`;
        try {
            const wSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
            document.getElementById('input-waktu-ujian').value = (wSnap.exists() && wSnap.data()[key]) ? wSnap.data()[key] : '';
            
            const jSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian"));
            document.getElementById('input-jadwal-ujian').value = (jSnap.exists() && jSnap.data()[key]) ? jSnap.data()[key] : '';
            
            const tSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
            if(tSnap.exists() && tSnap.data()[`token_${key}`]) {
                let tData = tSnap.data()[`token_${key}`];
                document.getElementById('input-token-ujian').value = typeof tData === 'object' ? tData.code : tData;
            } else {
                document.getElementById('input-token-ujian').value = '';
            }
        } catch(e) {}
        
        window.loadDaftarSoal(mapel, kelas);
    };

    window.loadDaftarSoal = async (mapel, kelas) => {
        const container = document.getElementById('list-soal');
        container.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Memuat soal...</div>';
        
        try {
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel), where("kelas", "==", kelas));
            const snap = await getDocs(q);
            if(snap.empty) {
                container.innerHTML = '<div style="text-align:center; padding: 30px; background: white; border: 1px dashed var(--border-color); border-radius: 8px;">Belum ada soal untuk mata pelajaran ini.</div>';
                return;
            }
            let soalArr = [];
            snap.forEach(doc => soalArr.push({id: doc.id, ...doc.data()}));
            soalArr.sort((a,b) => (a.nomor_soal || 0) - (b.nomor_soal || 0)); 

            let html = '';
            soalArr.forEach((s, idx) => {
                html += `
                <div style="background: white; border: 1px solid var(--border-color); padding: 15px 20px; border-radius: var(--radius-md); margin-bottom: 12px; display:flex; justify-content:space-between; align-items:flex-start; box-shadow: var(--shadow-sm);">
                    <div style="flex:1; padding-right:15px;">
                        <span style="font-weight:800; color:var(--primary); display:block; margin-bottom:5px;">Soal ${idx+1} <span style="background:var(--info); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:5px;">${s.tipe || 'PG'}</span></span>
                        <div style="color:var(--secondary); line-height:1.6;">${s.teks_soal}</div>
                        ${s.tipe === 'PG' ? `<div style="font-size:0.85rem; background:#f0fdf4; color:#166534; padding:5px 10px; border-radius:4px; display:inline-block; margin-top:8px;">Kunci: <b>${s.kunci_jawaban}</b></div>` : ''}
                    </div>
                    <button onclick="window.hapusSoal('${s.id}')" class="btn-3d" style="background:var(--danger); padding:8px 12px; font-size:0.85rem; margin:0;" title="Hapus Soal"><i class="fas fa-trash-alt"></i></button>
                </div>
                `;
            });
            container.innerHTML = html;
        } catch(e) {
            container.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Gagal memuat soal</div>';
        }
    };

    window.hapusSoal = async (id) => {
        if(await window.customConfirm("Apakah Anda yakin ingin menghapus soal ini?", "danger")) {
            try {
                await deleteDoc(doc(db, "bank_soal", id));
                window.loadDaftarSoal(document.getElementById('filter-soal-mapel').value, document.getElementById('filter-soal-kelas').value);
                loadBankSoalSummary(); // Update count di summary
            } catch(e) {
                window.customAlert("Gagal menghapus soal", "error");
            }
        }
    };

    // Form Tambah Soal Logic
    document.getElementById('soal-tipe')?.addEventListener('change', (e) => {
        document.getElementById('pg-options').style.display = e.target.value === 'PG' ? 'block' : 'none';
    });

    document.getElementById('form-tambah-soal')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mapel = document.getElementById('soal-mapel').value;
        const kelas = document.getElementById('soal-kelas').value;
        const tipe = document.getElementById('soal-tipe').value;
        const teks = document.getElementById('soal-teks').value;
        
        let payload = { mataPelajaran: mapel, kelas: kelas, tipe: tipe, teks_soal: teks, createdAt: new Date() };
        
        if(tipe === 'PG') {
            payload.opsi = {
                A: document.getElementById('soal-opsi-A').value || 'A',
                B: document.getElementById('soal-opsi-B').value || 'B',
                C: document.getElementById('soal-opsi-C').value || 'C',
                D: document.getElementById('soal-opsi-D').value || 'D',
                E: document.getElementById('soal-opsi-E').value || 'E'
            };
            payload.kunci_jawaban = document.getElementById('soal-kunci').value;
        }

        const btnSubmitSoal = e.target.querySelector('button[type="submit"]');
        const originalText = btnSubmitSoal.innerHTML;
        btnSubmitSoal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...';
        btnSubmitSoal.disabled = true;

        try {
            // SIMPAN SOAL KE DATABASE FIRESTORE
            await addDoc(collection(db, "bank_soal"), payload);
            document.getElementById('form-tambah-soal').reset();
            document.getElementById('modal-tambah-soal').style.display = 'none';
            window.customAlert("Soal berhasil ditambahkan!", "success");
            
            // Perbarui tampilan soal sesuai dengan darimana user membuka form (dari detail / luar)
            if(document.getElementById('view-soal-list').style.display === 'block') {
                window.loadDaftarSoal(document.getElementById('filter-soal-mapel').value, document.getElementById('filter-soal-kelas').value);
            }
            loadBankSoalSummary(); 
            
        } catch(err) {
            window.customAlert("Gagal menyimpan soal.", "error");
        } finally {
            btnSubmitSoal.innerHTML = originalText;
            btnSubmitSoal.disabled = false;
        }
    });

    document.getElementById('btn-back-mapel-list')?.addEventListener('click', () => {
        document.getElementById('view-summary-bank-soal').style.display = 'block';
        document.getElementById('view-soal-list').style.display = 'none';
        loadBankSoalSummary();
    });

    document.getElementById('btn-simpan-pengaturan-ujian')?.addEventListener('click', async () => {
        const mapel = document.getElementById('filter-soal-mapel').value;
        const kelas = document.getElementById('filter-soal-kelas').value;
        if(!mapel || !kelas) return;
        const key = `${mapel}_${kelas}`;
        
        const waktu = document.getElementById('input-waktu-ujian').value;
        const jadwal = document.getElementById('input-jadwal-ujian').value;
        const token = document.getElementById('input-token-ujian').value.trim().toUpperCase();

        const btn = document.getElementById('btn-simpan-pengaturan-ujian');
        const origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            // SIMPAN PENGATURAN (Waktu, Jadwal, Token) KE DATABASE FIRESTORE
            if(waktu) await setDoc(doc(db, "pengaturan", "waktu_ujian"), { [key]: waktu }, { merge: true });
            if(jadwal) await setDoc(doc(db, "pengaturan", "jadwal_ujian"), { [key]: jadwal }, { merge: true });
            if(token) {
                await setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${key}`]: { code: token, active: true } }, { merge: true });
            }
            window.customAlert("Pengaturan ujian berhasil disimpan!", "success");
            loadBankSoalSummary();
        } catch(e) { window.customAlert("Gagal menyimpan pengaturan.", "error"); }
        
        btn.innerHTML = origHtml;
        btn.disabled = false;
    });

    // ==========================================
    // 7. HASIL UJIAN (PER MAPEL & KELAS)
    // ==========================================
    async function loadDataHasil() {
        try {
            const snap = await getDocs(collection(db, "hasil_ujian"));
            document.getElementById('stat-ujian').innerText = snap.size;
            
            allHasilUjian = [];
            snap.forEach(d => allHasilUjian.push({ id: d.id, ...d.data() }));

            const gridMapel = document.getElementById('grid-mapel-hasil');
            if(!gridMapel) return;

            let allowedMapel = listMapel;
            if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }

            let summaryMapel = {};
            allHasilUjian.forEach(h => {
                if (allowedMapel.includes(h.mataPelajaran)) {
                    let key = `${h.mataPelajaran} - Kelas ${h.kelas}`;
                    if(!summaryMapel[key]) summaryMapel[key] = { mapel: h.mataPelajaran, kelas: h.kelas, count: 0, avg: 0, totalNilai: 0 };
                    summaryMapel[key].count++;
                    summaryMapel[key].totalNilai += (h.nilai || 0);
                }
            });

            gridMapel.innerHTML = '';
            for (let key in summaryMapel) {
                let s = summaryMapel[key];
                let rataRata = (s.totalNilai / s.count).toFixed(2);
                gridMapel.innerHTML += `
                    <div class="stat-card" style="cursor:pointer; border: 1px solid var(--border-color);" onclick="window.bukaDetailHasil('${s.mapel}', '${s.kelas}')">
                        <div>
                            <p style="font-weight:bold; color:var(--secondary);">${key}</p>
                            <div style="display:flex; gap:15px; margin-top:10px;">
                                <span style="font-size:0.85rem; color:var(--text-muted);"><i class="fas fa-users"></i> ${s.count} Siswa</span>
                                <span style="font-size:0.85rem; color:var(--success);"><i class="fas fa-chart-line"></i> Avg: ${rataRata}</span>
                            </div>
                        </div>
                        <div style="color: var(--success);"><i class="fas fa-folder-open"></i></div>
                    </div>
                `;
            }

            if(gridMapel.innerHTML === '') gridMapel.innerHTML = '<p style="grid-column: 1 / -1; text-align:center; color:var(--text-muted);">Belum ada data hasil ujian.</p>';

        } catch(e) {}
    }

    window.bukaDetailHasil = (mapel, kelas) => {
        currentMapelDetail = mapel;
        currentKelasDetail = kelas;
        document.getElementById('label-mapel-detail').innerText = `HASIL: ${mapel} - KELAS ${kelas}`;
        window.location.hash = 'section-hasil-detail';
        renderDetailHasil();
    };

    function renderDetailHasil() {
        const tbody = document.querySelector('#table-hasil tbody');
        if(!tbody) return;
        
        let filteredHasil = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && h.kelas === currentKelasDetail);
        
        if(filteredHasil.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada data.</td></tr>';
            return;
        }

        let html = '';
        filteredHasil.forEach(h => {
            html += `<tr>
                <td>${h.namaSiswa}</td>
                <td>${h.jumlahBenar} / ${h.totalSoal}</td>
                <td style="font-weight:bold; color:var(--success);">${h.nilai}</td>
                <td style="text-align:center;">
                    <button onclick="window.hapusHasil('${h.id}')" class="btn-3d" style="background:var(--danger); padding:5px 10px; font-size:0.8rem;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }

    window.hapusHasil = async (id) => {
        if(await customConfirm("Hapus hasil ujian siswa ini?", "danger")) {
            await deleteDoc(doc(db, "hasil_ujian", id));
            loadDataHasil();
            renderDetailHasil();
        }
    };

    document.getElementById('btn-hapus-semua-hasil')?.addEventListener('click', async () => {
        if (!currentMapelDetail || !currentKelasDetail) return;
        if (await window.customConfirm(`Hapus SEMUA data hasil ujian untuk mapel ${currentMapelDetail} di Kelas ${currentKelasDetail}? Tindakan ini tidak bisa dibatalkan.`, "danger", "Kosongkan Data")) {
            
            const btnHapusAll = document.getElementById('btn-hapus-semua-hasil');
            const origText = btnHapusAll.innerHTML;
            btnHapusAll.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghapus Massal...';
            btnHapusAll.disabled = true;
            
            try {
                // HAPUS SEMUA DATA HASIL UJIAN DARI DATABASE FIRESTORE
                const dataAkanDihapus = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && h.kelas === currentKelasDetail);
                await Promise.all(dataAkanDihapus.map(h => deleteDoc(doc(db, "hasil_ujian", h.id))));
                
                await window.customAlert(`${dataAkanDihapus.length} data berhasil dikosongkan!`, "success");
                loadDataHasil(); 
                window.location.hash = 'section-hasil';
            } catch (e) { await window.customAlert("Terjadi kesalahan saat menghapus data massal.", "error"); }
            btnHapusAll.innerHTML = origText; btnHapusAll.disabled = false;
        }
    });

});
