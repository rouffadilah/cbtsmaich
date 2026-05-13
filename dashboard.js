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

    let userRoles = []; 
    let userMapel = []; 
    let userKelas = [];
    
    try { 
        userRoles = JSON.parse(localStorage.getItem("userRole") || "[]"); 
        userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]"); 
        userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
    } catch (e) {}
    
    const isAdmin = userRoles.includes("admin"); 
    const isGuru = userRoles.includes("guru");

    function handleRouting() {
        let hash = window.location.hash.substring(1) || 'section-beranda';
        
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

        if (hash === 'section-hasil-detail') {
            if (!currentMapelDetail) { 
                window.location.hash = 'section-hasil'; 
                return; 
            }
            document.getElementById('section-hasil').classList.add('active');
            document.getElementById('hasil-summary-view').style.display = 'none'; 
            document.getElementById('hasil-detail-view').style.display = 'block';
            return;
        }

        const target = document.getElementById(hash); 
        if (target) target.classList.add('active');
        
        if (hash === 'section-hasil') { 
            document.getElementById('hasil-summary-view').style.display = 'block'; 
            document.getElementById('hasil-detail-view').style.display = 'none'; 
            currentMapelDetail = ""; 
        }
    }

    window.addEventListener('hashchange', handleRouting);
    document.querySelectorAll('.stat-clickable').forEach(b => {
        b.onclick = (e) => window.location.hash = e.currentTarget.dataset.target
    });

    onAuthStateChanged(auth, async (user) => {
        if (!user || (!isAdmin && !isGuru)) { 
            window.location.href = "index.html"; 
            return; 
        }
        
        let finalDisplayName = user.displayName;
        if (!finalDisplayName) { 
            try { 
                const userDoc = await getDoc(doc(db, "users", user.uid)); 
                if (userDoc.exists()) finalDisplayName = userDoc.data().nama; 
            } catch(e) {} 
        }
        finalDisplayName = finalDisplayName || "Pengguna";

        const adminNameEl = document.getElementById('admin-name'); 
        if (adminNameEl) adminNameEl.innerText = finalDisplayName;
        
        const greetingText = document.getElementById('greeting-text'); 
        if (greetingText) greetingText.innerHTML = `Assalamu'alaikum, ${finalDisplayName}! 🙏`;

        if (isAdmin) { 
            fetchStatusReg(); 
        } else if (isGuru && !isAdmin) {
            document.getElementById('menu-pengguna').style.display = 'none'; 
            document.getElementById('admin-reg-status').style.display = 'none'; 
            document.getElementById('admin-data-master').style.display = 'none';
            const mMenuPeng = document.getElementById('menu-pengaturan'); 
            if (mMenuPeng) { 
                const pTag = mMenuPeng.querySelector('p'); 
                if (pTag) pTag.innerText = 'Token Ujian'; 
            }
        }

        handleRouting(); 
        loadDataMaster(); 
        loadDataHasil(); 
        loadActiveTokens(); 
        if (isAdmin) loadDataPengguna();
    });
    document.getElementById('btn-logout').onclick = async () => { if (await customConfirm("Yakin ingin keluar dari aplikasi?", "warning", "Konfirmasi Keluar", "Ya, Keluar")) { await signOut(auth); localStorage.clear(); window.location.href = "index.html"; } };

    // ==========================================
    // 4. DATA MASTER (MAPEL & KELAS)
    // ==========================================
    async function loadDataMaster() {
        try {
            const docSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
            if (docSnap.exists()) { listMapel = docSnap.data().list_mapel || []; listKelas = docSnap.data().list_kelas || []; }
            renderTableMaster(); populateSemuaDropdown();
        } catch (e) { console.error("Gagal load data master", e); }
    }

    function renderTableMaster() {
        const tbodyMapel = document.querySelector('#table-master-mapel tbody');
        if (tbodyMapel) tbodyMapel.innerHTML = listMapel.length === 0 ? `<tr><td style="text-align:center;">Kosong</td></tr>` : listMapel.map((m, i) => `<tr><td>${m}</td><td style="text-align:right;"><button onclick="window.hapusMapel(${i})" class="btn-3d" style="background:var(--danger); padding:4px 8px;"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        const tbodyKelas = document.querySelector('#table-master-kelas tbody');
        if (tbodyKelas) tbodyKelas.innerHTML = listKelas.length === 0 ? `<tr><td style="text-align:center;">Kosong</td></tr>` : listKelas.map((k, i) => `<tr><td>${k}</td><td style="text-align:right;"><button onclick="window.hapusKelas(${i})" class="btn-3d" style="background:var(--danger); padding:4px 8px;"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    }

    function populateSemuaDropdown() {
        let allowedMapel = listMapel; let allowedKelas = listKelas;
        if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); allowedKelas = listKelas.filter(k => userKelas.includes(k)); }

        const optionsMapel = '<option value="" disabled selected>Pilih Mapel...</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        const optionsKelasSiswa = '<option value="" disabled selected>Pilih Kelas...</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
        const optionsKelasFilter = '<option value="" disabled selected>Pilih Kelas...</option>' + allowedKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        ['soal-mapel', 'import-mapel', 'set-token-mapel', 'filter-soal-mapel', 'edit-soal-mapel'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = optionsMapel; });
        ['set-token-kelas', 'soal-kelas', 'import-kelas', 'filter-soal-kelas', 'edit-soal-kelas'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = optionsKelasFilter; });
        ['new-kelas-siswa', 'edit-kelas-siswa'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = optionsKelasSiswa; });

        const filterHasil = document.getElementById('filter-tabel-hasil'); if (filterHasil) filterHasil.innerHTML = '<option value="semua">Semua Mata Pelajaran</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');

        const mapelCheckboxes = listMapel.map(m => `<label><input type="checkbox" class="new-mapel-cb" value="${m}"> ${m}</label>`).join('');
        const kelasCheckboxes = listKelas.map(k => `<label><input type="checkbox" class="new-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');
        const mc = document.getElementById('new-mapel-container'); if (mc) mc.innerHTML = mapelCheckboxes || '<small>Kosong</small>';
        const kc = document.getElementById('new-kelas-guru-container'); if (kc) kc.innerHTML = kelasCheckboxes || '<small>Kosong</small>';
        
        const emc = document.getElementById('edit-mapel-container'); if (emc) emc.innerHTML = listMapel.map(m => `<label><input type="checkbox" class="edit-mapel-cb" value="${m}"> ${m}</label>`).join('');
        const ekc = document.getElementById('edit-kelas-guru-container'); if (ekc) ekc.innerHTML = listKelas.map(k => `<label><input type="checkbox" class="edit-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');
    }

    document.getElementById('btn-add-mapel')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-mapel').value.trim(); if (!val) return;
        if (listMapel.includes(val)) return await window.customAlert("Mata Pelajaran sudah ada!", "warning");
        listMapel.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true });
        document.getElementById('input-new-mapel').value = ''; loadDataMaster();
    });

    document.getElementById('btn-add-kelas')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-kelas').value.trim(); if (!val) return;
        if (listKelas.includes(val)) return await window.customAlert("Kelas sudah ada!", "warning");
        listKelas.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true });
        document.getElementById('input-new-kelas').value = ''; loadDataMaster();
    });

    window.hapusMapel = async (index) => { if (!(await window.customConfirm("Hapus Mata Pelajaran ini secara permanen?", "danger", "Hapus Mapel"))) return; listMapel.splice(index, 1); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true }); loadDataMaster(); };
    window.hapusKelas = async (index) => { if (!(await window.customConfirm("Hapus Kelas ini secara permanen?", "danger", "Hapus Kelas"))) return; listKelas.splice(index, 1); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true }); loadDataMaster(); };

    async function fetchStatusReg() {
        try {
            const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
            if (regSnap.exists()) {
                const sSiswa = document.getElementById('status-reg-siswa'); const sGuru = document.getElementById('status-reg-guru');
                if (sSiswa) sSiswa.value = regSnap.data().siswa_aktif !== false ? "buka" : "tutup";
                if (sGuru) sGuru.value = regSnap.data().guru_aktif !== false ? "buka" : "tutup";
            }
        } catch (e) {}
    }

    document.getElementById('btn-save-reg-status')?.addEventListener('click', async () => {
        const statusSiswa = document.getElementById('status-reg-siswa').value === "buka"; const statusGuru = document.getElementById('status-reg-guru').value === "buka";
        const btn = document.getElementById('btn-save-reg-status'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        try { await setDoc(doc(db, "pengaturan", "status_registrasi"), { siswa_aktif: statusSiswa, guru_aktif: statusGuru }, { merge: true }); await window.customAlert("Status pendaftaran berhasil diperbarui!", "success"); } catch (error) { await window.customAlert("Gagal memperbarui status.", "error"); }
        btn.innerHTML = '<i class="fas fa-save"></i> SIMPAN PERUBAHAN';
    });

    // ==========================================
    // 5. MANAJEMEN PENGGUNA
    // ==========================================
    async function loadDataPengguna() {
        const tbody = document.querySelector('#table-siswa tbody'); if (!tbody) return;
        
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 20px;">
                        <div class="skeleton-box" style="width: 100%;"></div>
                        <div class="skeleton-box" style="width: 80%; height: 14px;"></div>
                        <div class="skeleton-box" style="width: 90%; height: 14px;"></div>
                    </td>
                </tr>`;
            try {
            const snap = await getDocs(collection(db, "users")); 
            const statSiswa = document.getElementById('stat-siswa'); if (statSiswa) statSiswa.innerText = snap.size; 
            
            tbody.innerHTML = ''; allUsersData = []; 
            snap.forEach(docSnap => {
                const data = docSnap.data(); data.id = docSnap.id; allUsersData.push(data);
                const rls = Array.isArray(data.role) ? data.role : [data.role]; 
                const roleColor = rls.includes('admin') ? 'var(--danger)' : (rls.includes('guru') ? 'var(--info)' : 'var(--success)');
                
                let detailText = '-';
                if (rls.includes('guru')) { detailText = `Mapel: ${Array.isArray(data.mapel) ? data.mapel.join(', ') : (data.mapel || '-')} <br><span style="font-size:0.75rem; color:var(--text-muted);">Kelas Ajar: ${Array.isArray(data.kelas) ? data.kelas.join(', ') : (data.kelas || '-')}</span>`; } 
                else if (rls.includes('siswa')) { detailText = `Kelas: ${data.kelas || '-'}`; }
                
                tbody.innerHTML += `<tr><td>${data.username}</td><td><strong>${data.nama}</strong></td><td><span style="background: ${roleColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${rls.join(', ').toUpperCase()}</span></td><td>${detailText}</td>
                    <td>
                        <button onclick="window.editPengguna('${docSnap.id}')" style="color:var(--warning); background:none; border:none; cursor:pointer; font-size:1.1rem; margin-right:10px;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button onclick="window.hapusDokumen('users', '${docSnap.id}', window.loadDataPengguna)" style="color:var(--danger); background:none; border:none; cursor:pointer; font-size:1.1rem;" title="Hapus"><i class="fas fa-trash"></i></button>
                    </td></tr>`;
            });
        } catch (error) { console.error(error); }
    }
    window.loadDataPengguna = loadDataPengguna;

    function updateNewFormVisibility() {
        const checkedRoles = Array.from(document.querySelectorAll('.new-role-cb:checked')).map(cb => cb.value);
        const gpMapel = document.getElementById('group-new-mapel'); const gpKelasGuru = document.getElementById('group-new-kelas-guru'); const gpKelasSiswa = document.getElementById('group-new-kelas-siswa');
        if (gpMapel) gpMapel.style.display = checkedRoles.includes('guru') ? 'block' : 'none';
        if (gpKelasGuru) gpKelasGuru.style.display = checkedRoles.includes('guru') ? 'block' : 'none';
        if (gpKelasSiswa) gpKelasSiswa.style.display = checkedRoles.includes('siswa') ? 'block' : 'none';
    }
    document.querySelectorAll('.new-role-cb').forEach(cb => cb.addEventListener('change', updateNewFormVisibility));

    document.getElementById('btn-add-user')?.addEventListener('click', async () => {
        const nama = document.getElementById('new-nama').value.trim(); const username = document.getElementById('new-username').value.trim().replace(/\s+/g, ''); const pass = document.getElementById('new-pass').value;
        const selectedRoles = Array.from(document.querySelectorAll('.new-role-cb:checked')).map(cb => cb.value);
        const selectedMapels = Array.from(document.querySelectorAll('.new-mapel-cb:checked')).map(cb => cb.value);
        const selectedKelasGuru = Array.from(document.querySelectorAll('.new-kelas-guru-cb:checked')).map(cb => cb.value);
        const kelasSiswa = document.getElementById('new-kelas-siswa').value;

        if (!nama || !username || !pass) return await window.customAlert("Lengkapi form nama, username, dan password!", "warning");
        if (selectedRoles.length === 0) return await window.customAlert("Pilih minimal 1 Role/Hak Akses!", "warning");
        if (selectedRoles.includes('guru') && (selectedMapels.length === 0 || selectedKelasGuru.length === 0)) return await window.customAlert("Centang minimal 1 Mapel & 1 Kelas untuk Guru!", "warning");
        if (selectedRoles.includes('siswa') && !kelasSiswa) return await window.customAlert("Pilih Kelas untuk Siswa!", "warning");
        if (pass.length < 6) return await window.customAlert("Password minimal 6 karakter!", "warning");

        const btn = document.getElementById('btn-add-user'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses'; btn.disabled = true;

        try {
            const dummyEmail = `${username}@cbt.smaich.id`;
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, pass);
            await updateProfile(userCred.user, { displayName: nama });

            let payload = { nama: nama, username: username, role: selectedRoles, createdAt: new Date() };
            if (selectedRoles.includes('guru')) { payload.mapel = selectedMapels; payload.kelas = selectedKelasGuru; }
            if (selectedRoles.includes('siswa')) { if (!selectedRoles.includes('guru')) payload.kelas = kelasSiswa; else payload.kelas_siswa = kelasSiswa; }

            await setDoc(doc(db, "users", userCred.user.uid), payload); 
            await window.customAlert(`Berhasil membuat akun!`, "success");
            
            document.getElementById('new-nama').value = ''; document.getElementById('new-username').value = ''; document.getElementById('new-pass').value = '';
            document.querySelectorAll('.new-role-cb, .new-mapel-cb, .new-kelas-guru-cb').forEach(cb => cb.checked = false); document.getElementById('new-kelas-siswa').value = ''; updateNewFormVisibility();
            loadDataPengguna(); await secondaryAuth.signOut();
        } catch (error) { await window.customAlert("Gagal: Username mungkin sudah dipakai.", "error"); }
        btn.innerHTML = '<i class="fas fa-save"></i> SIMPAN AKUN'; btn.disabled = false;
    });

    document.getElementById('upload-akun-excel')?.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const jsonAkun = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if (jsonAkun.length === 0) return await window.customAlert("File Excel kosong atau format tidak sesuai!", "warning");
                if (!(await window.customConfirm(`Import Massal ${jsonAkun.length} akun?\n(Mohon jangan tutup halaman ini selama proses berjalan)`, "info", "Konfirmasi Import"))) return;

                const labelUpload = document.querySelector('label[for="upload-akun-excel"]'); const origLabel = labelUpload.innerHTML; labelUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat...';
                let successCount = 0; let failedCount = 0;

                for (let row of jsonAkun) {
                    const nama = row['Nama Lengkap']; const username = row['Username'] ? row['Username'].toString().replace(/\s+/g, '') : null;
                    const roleStr = row['Role'] ? row['Role'].toString().toLowerCase() : 'siswa'; const password = row['Password'] ? row['Password'].toString() : '123456';
                    if (!nama || !username) { failedCount++; continue; } 

                    try {
                        const dummyEmail = `${username}@cbt.smaich.id`;
                        const userCred = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, password);
                        await updateProfile(userCred.user, { displayName: nama });

                        const roleArr = roleStr.split(',').map(s => s.trim());
                        let payload = { nama: nama, username: username, role: roleArr, createdAt: new Date() };
                        
                        if (roleArr.includes('guru')) {
                            const detailMapel = row['Detail (Mapel)']; const detailKelas = row['Detail (Kelas)'];
                            if (detailMapel) payload.mapel = detailMapel.split(',').map(s => s.trim());
                            if (detailKelas) payload.kelas = detailKelas.split(',').map(s => s.trim());
                        }
                        if (roleArr.includes('siswa')) {
                            const ks = row['Detail (Kelas)'] || row['Detail (Mapel)'];
                            if (!roleArr.includes('guru')) payload.kelas = ks; else payload.kelas_siswa = ks;
                        }

                        await setDoc(doc(db, "users", userCred.user.uid), payload); successCount++;
                    } catch (err) { failedCount++; }
                }
                await secondaryAuth.signOut(); 
                await window.customAlert(`Proses Selesai!\n✅ Sukses: ${successCount} Akun\n❌ Gagal: ${failedCount} Akun`, "success", "Hasil Import Massal"); 
                labelUpload.innerHTML = origLabel; document.getElementById('upload-akun-excel').value = ''; loadDataPengguna();
            } catch (err) { await window.customAlert("Gagal membaca file Excel.", "error"); }
        };
        reader.readAsArrayBuffer(file);
    });

    window.editPengguna = (uid) => {
        const user = allUsersData.find(u => u.id === uid); if (!user) return;
        document.getElementById('edit-uid').value = user.id; document.getElementById('edit-nama').value = user.nama; 
        
        const rls = Array.isArray(user.role) ? user.role : [user.role];
        document.querySelectorAll('.edit-role-cb').forEach(cb => { cb.checked = rls.includes(cb.value); });
        
        const egGuru = document.getElementById('group-edit-guru'); const egKelasSiswa = document.getElementById('group-edit-kelas-siswa');
        if (egGuru) egGuru.style.display = rls.includes('guru') ? 'flex' : 'none';
        if (egKelasSiswa) egKelasSiswa.style.display = rls.includes('siswa') ? 'block' : 'none';
        
        if (rls.includes('guru')) {
            const mapelArray = Array.isArray(user.mapel) ? user.mapel : [user.mapel]; const kelasArray = Array.isArray(user.kelas) ? user.kelas : [user.kelas];
            document.querySelectorAll('.edit-mapel-cb').forEach(cb => { cb.checked = mapelArray.includes(cb.value); });
            document.querySelectorAll('.edit-kelas-guru-cb').forEach(cb => { cb.checked = kelasArray.includes(cb.value); });
        }
        if (rls.includes('siswa')) { document.getElementById('edit-kelas-siswa').value = user.kelas_siswa || user.kelas || ""; }
        
        document.getElementById('modal-edit-akun').style.display = 'flex';
    };

    document.getElementById('close-modal-edit-akun')?.addEventListener('click', () => { document.getElementById('modal-edit-akun').style.display = 'none'; });

    document.getElementById('btn-save-edit-akun')?.addEventListener('click', async () => {
        const uid = document.getElementById('edit-uid').value; const nama = document.getElementById('edit-nama').value.trim(); const selectedRoles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(cb => cb.value);
        if (selectedRoles.length === 0) return await window.customAlert("Pilih minimal 1 Role Akses!", "warning");
        
        let payload = { nama: nama, role: selectedRoles };
        if (selectedRoles.includes('guru')) { payload.mapel = Array.from(document.querySelectorAll('.edit-mapel-cb:checked')).map(cb => cb.value); payload.kelas = Array.from(document.querySelectorAll('.edit-kelas-guru-cb:checked')).map(cb => cb.value); } 
        if (selectedRoles.includes('siswa')) { const ks = document.getElementById('edit-kelas-siswa').value; if (!selectedRoles.includes('guru')) payload.kelas = ks; else payload.kelas_siswa = ks; }

        try { 
            document.getElementById('btn-save-edit-akun').innerHTML = "Menyimpan..."; 
            await updateDoc(doc(db, "users", uid), payload); 
            await window.customAlert("Profil pengguna diperbarui!", "success"); 
            document.getElementById('modal-edit-akun').style.display = 'none'; 
            document.getElementById('btn-save-edit-akun').innerHTML = '<i class="fas fa-save"></i> SIMPAN PERUBAHAN'; loadDataPengguna();
        } catch (err) { await window.customAlert("Gagal menyimpan perubahan.", "error"); document.getElementById('btn-save-edit-akun').innerHTML = '<i class="fas fa-save"></i> SIMPAN PERUBAHAN'; }
    });

    // ==========================================
    // 6. BANK SOAL & SET WAKTU UJIAN
    // ==========================================
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
            
            allSoalData = []; snap.forEach(d => allSoalData.push({id: d.id, ...d.data()}));
            allSoalData.sort((a,b) => a.nomor_soal - b.nomor_soal);
            filteredSoalData = allSoalData;
            
            document.getElementById('stat-soal').innerText = allSoalData.length;

            // Load Waktu Ujian Terkini
            try {
                const timeSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
                if (timeSnap.exists() && timeSnap.data()[`${m}_${k}`]) {
                    document.getElementById('input-waktu-ujian').value = timeSnap.data()[`${m}_${k}`];
                } else {
                    document.getElementById('input-waktu-ujian').value = ''; 
                }
            } catch(e) { console.error("Gagal load waktu", e); }

            tbody.innerHTML = '';
            if(allSoalData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">Belum ada soal untuk kategori ini.</td></tr>';
                document.getElementById('btn-preview-full').style.display = 'none'; return;
            }

            allSoalData.forEach(dat => {
                let statusMedia = dat.media_soal ? '<i class="fas fa-paperclip" style="color:var(--success); margin-left:5px;"></i>' : '';
                tbody.innerHTML += `
                    <tr>
                        <td style="text-align:center; font-weight:bold;">${dat.nomor_soal === 999 ? '-' : dat.nomor_soal}</td>
                        <td>${dat.mataPelajaran}</td><td>${dat.kelas}</td>
                        <td><span style="background:var(--primary-light); color:var(--primary-hover); font-weight:bold; padding:4px 8px; border-radius:4px; font-size:0.8rem;">${dat.tipe}</span></td>
                        <td>${dat.teks_soal.substring(0,40)}... ${statusMedia}</td>
                        <td>
                            <button onclick="window.editSoal('${dat.id}')" style="color:var(--warning); background:none; border:none; cursor:pointer; font-size:1.1rem;" title="Edit"><i class="fas fa-edit"></i></button>
                            <button onclick="window.hapusDokumen('bank_soal', '${dat.id}', window.loadDataSoal)" style="color:var(--danger); background:none; border:none; cursor:pointer; font-size:1.1rem; margin-left:10px;" title="Hapus"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
            document.getElementById('btn-preview-full').style.display = 'inline-block';
        } catch(e) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data dari database.</td></tr>'; }
    }
    window.loadDataSoal = loadDataSoal; 

    const btnSimpanWaktu = document.getElementById('btn-simpan-waktu');
    if (btnSimpanWaktu) {
        btnSimpanWaktu.onclick = async () => {
            const m = document.getElementById('filter-soal-mapel').value;
            const k = document.getElementById('filter-soal-kelas').value;
            const w = document.getElementById('input-waktu-ujian').value;

            if(!m || !k) return window.customAlert("Pilih Mapel dan Kelas terlebih dahulu!", "warning");
            if(!w || w <= 0) return window.customAlert("Masukkan waktu ujian (menit) yang valid!", "warning");

            const origText = btnSimpanWaktu.innerHTML;
            btnSimpanWaktu.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btnSimpanWaktu.disabled = true;

            try {
                await setDoc(doc(db, "pengaturan", "waktu_ujian"), { [`${m}_${k}`]: parseInt(w) }, { merge: true });
                await window.customAlert(`Waktu ujian berhasil diatur menjadi ${w} Menit!`, "success");
            } catch(e) { await window.customAlert("Gagal menyimpan waktu.", "error"); }
            btnSimpanWaktu.innerHTML = origText; btnSimpanWaktu.disabled = false;
        };
    }

    document.getElementById('btn-tambah-manual')?.addEventListener('click', () => { document.getElementById('modal-tambah-soal').style.display = 'flex'; renderFormDinamis('PG'); });
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
            await window.customAlert("Soal berhasil ditambahkan!", "success"); 
            document.getElementById('modal-tambah-soal').style.display = 'none'; loadDataSoal(); 
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
                    await window.customAlert(`Import Berhasil!`, "success"); document.getElementById('modal-tambah-soal').style.display = 'none'; loadDataSoal(); 
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
                    await window.customAlert(`Import Word Berhasil!`, "success"); document.getElementById('modal-tambah-soal').style.display = 'none'; loadDataSoal(); 
                } catch (err) { console.error(err); await window.customAlert("Format Word tidak sesuai template.", "error"); }
                btn.innerHTML = origText; btn.disabled = false;
            };
            reader.readAsArrayBuffer(selectedWordSoal);
        }
    });

    // --- Edit & Preview Soal ---
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
            await updateDoc(doc(db, "bank_soal", id), payload); await window.customAlert("Berhasil diperbarui!", "success"); document.getElementById('modal-edit-soal').style.display = 'none'; loadDataSoal();
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
    // 7. HASIL UJIAN
    // ==========================================
    async function loadDataHasil() {
        const snap = await getDocs(collection(db, "hasil_ujian")); document.getElementById('stat-ujian').innerText = snap.size;
        allHasilUjian = []; snap.forEach(d => allHasilUjian.push({id: d.id, ...d.data()}));
        const grid = document.getElementById('grid-mapel-hasil'); if(!grid) return; grid.innerHTML = '';
        let maps = [...new Set(allHasilUjian.map(h => h.mataPelajaran))]; maps.forEach(m => { grid.innerHTML += `<div class="mapel-card" onclick="window.openDetailHasil('${m}')"><h3>${m}</h3><p>${allHasilUjian.filter(h=>h.mataPelajaran===m).length} Selesai</p></div>`; });
    }
    window.openDetailHasil = (mapel) => {
        currentMapelDetail = mapel; window.location.hash = 'section-hasil-detail'; document.getElementById('label-mapel-detail').innerText = mapel;
        const tbody = document.querySelector('#table-hasil tbody'); tbody.innerHTML = '';
        const filtered = allHasilUjian.filter(h => h.mataPelajaran === mapel);
        filtered.forEach(h => { tbody.innerHTML += `<tr><td><b>${h.namaSiswa}</b></td><td>${h.kelas}</td><td>${h.benar}/${h.totalSoal}</td><td><b>${h.nilai}</b></td><td><button onclick="window.hapusDokumen('hasil_ujian', '${h.id}', window.refreshHasil)" style="color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td></tr>`; });
    };
    window.refreshHasil = () => { loadDataHasil(); if(currentMapelDetail) window.openDetailHasil(currentMapelDetail); };
    document.getElementById('btn-back-hasil').onclick = () => window.history.back();

    // ==========================================
    // 8. MANAJEMEN TOKEN UJIAN (HAPUS & PERPANJANG AMAN)
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
                    let badge = timeLeft > 0 ? `<span style="background: var(--success); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 10px; font-weight: bold;">Sisa ${timeLeft} mnt</span>` : `<span style="background: var(--danger); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 10px; font-weight: bold;">Habis</span>`;

                    tbody.innerHTML += `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 12px 10px; color: var(--secondary); font-size: 0.9rem;">${mapelKelas}</td>
                            <td style="padding: 12px 10px; font-weight: bold; color: var(--primary); font-size: 1rem;">${tokenCode} ${badge}</td>
                            <td style="padding: 12px 10px; text-align: right; white-space: nowrap;">
                                <button onclick="window.perpanjangToken('${k}')" style="color: var(--success); background: #ecfdf5; border: 1px solid #a7f3d0; padding: 6px 10px; border-radius: 6px; cursor: pointer; margin-right: 5px; transition: 0.2s;" title="Perpanjang 15 Menit"><i class="fas fa-clock"></i></button>
                                <button onclick="window.hapusTokenUtama('${k}')" style="color: var(--danger); background: #fee2e2; border: 1px solid #fecaca; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: 0.2s;" title="Hapus Token"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>`; 
                }); 
            } else { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 30px; color: var(--text-muted); font-size: 0.95rem;">Belum ada token aktif.</td></tr>`; }
        } catch (e) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 30px; color: var(--danger); font-size: 0.95rem;">Gagal memuat token dari database.</td></tr>`; }
    }

    const btnRefreshToken = document.getElementById('btn-refresh-token');
    if(btnRefreshToken) btnRefreshToken.onclick = loadActiveTokens;

    const btnSaveToken = document.getElementById('btn-save-token');
    if(btnSaveToken) {
        btnSaveToken.onclick = async () => {
            const m = document.getElementById('set-token-mapel').value; const k = document.getElementById('set-token-kelas').value; const t = document.getElementById('input-token-baru').value.toUpperCase().trim();
            if(!m || !k || !t) return window.customAlert("Pilih Mapel, Kelas, dan ketik Token terlebih dahulu!", "warning");
            
            const origText = btnSaveToken.innerHTML; btnSaveToken.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btnSaveToken.disabled = true;

            try { 
                await setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${m}_${k}`]: { code: t, expiresAt: Date.now() + (15 * 60000) } }, { merge: true }); 
                await window.customAlert("Token berhasil diaktifkan selama 15 Menit!", "success"); 
                document.getElementById('input-token-baru').value = ''; loadActiveTokens(); 
            } catch(e) { await window.customAlert("Gagal menyimpan token.", "error"); }
            
            btnSaveToken.innerHTML = origText; btnSaveToken.disabled = false;
        };
    }

    window.hapusTokenUtama = async (k) => { 
        if(await window.customConfirm("Hapus token ujian ini? Siswa tidak akan bisa login lagi ke mapel tersebut.", "danger", "Hapus Token")) { 
            try { 
                const snap = await getDoc(doc(db, "pengaturan", "token_ujian"));
                if(snap.exists()) {
                    let dataTokens = snap.data(); delete dataTokens[k]; // Hapus Kunci Lokal
                    await setDoc(doc(db, "pengaturan", "token_ujian"), dataTokens); // Replace (Aman dr string titik)
                    await window.customAlert("Token berhasil dihapus!", "success"); loadActiveTokens(); 
                }
            } catch (e) { window.customAlert("Gagal menghapus token.", "error"); }
        } 
    };

    window.perpanjangToken = async (k) => {
        if(await window.customConfirm("Tambahkan waktu 15 menit untuk token ini dihitung dari sekarang?", "info", "Perpanjang Waktu")) {
            try {
                const snap = await getDoc(doc(db, "pengaturan", "token_ujian"));
                if (snap.exists() && snap.data()[k]) {
                    let currentData = snap.data()[k];
                    let payload = (typeof currentData === 'object' && currentData !== null) ? { code: currentData.code, expiresAt: Date.now() + (15 * 60000) } : { code: currentData, expiresAt: Date.now() + (15 * 60000) };
                    await setDoc(doc(db, "pengaturan", "token_ujian"), { [k]: payload }, { merge: true });
                    await window.customAlert("Waktu ujian berhasil diperpanjang 15 Menit!", "success"); loadActiveTokens();
                } else { await window.customAlert("Data token tidak ditemukan di sistem.", "error"); }
            } catch(e) { await window.customAlert("Gagal memperpanjang waktu token. Coba buat ulang token baru.", "error"); }
        }
    };

    window.hapusDokumen = async (coll, id, callback) => { if(await customConfirm("Data akan dihapus permanen. Lanjutkan?", "danger")) { await deleteDoc(doc(db, coll, id)); if(callback) callback(); } };
});
