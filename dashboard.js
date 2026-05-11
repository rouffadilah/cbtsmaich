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
let previewCurrentIdx = 0; let allHasilUjian = []; let currentMapelDetail = ""; 

// Helper Render Media
function renderMediaHTML(mediaObj) {
    if(!mediaObj) return '';
    if(mediaObj.type === 'image') return `<img src="${mediaObj.url}" style="max-width:100%; max-height:300px; border-radius:8px; margin-bottom:15px; display:block;">`;
    if(mediaObj.type === 'audio') return `<audio controls src="${mediaObj.url}" style="width:100%; max-width:400px; margin-bottom:15px; display:block; outline:none;"></audio>`;
    if(mediaObj.type === 'video') return `<video controls src="${mediaObj.url}" style="max-width:100%; max-height:300px; border-radius:8px; margin-bottom:15px; display:block;"></video>`;
    return '';
}

document.addEventListener('DOMContentLoaded', () => {

    let userRoles = []; let userMapel = []; let userKelas = [];
    try {
        userRoles = JSON.parse(localStorage.getItem("userRole") || "[]");
        userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]");
        userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
    } catch(e) { console.warn("Cache parsing error"); }
    
    const isAdmin = userRoles.includes("admin");
    const isGuru = userRoles.includes("guru");

    function handleRouting() {
        let isModalOpen = false;
        document.querySelectorAll('.modal').forEach(m => {
            if (m.style.display === 'flex') { m.style.display = 'none'; isModalOpen = true; }
        });
        if (isModalOpen) return; 

        let hash = window.location.hash.substring(1);
        if (!hash) hash = 'section-beranda'; 

        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

        if (hash === 'section-hasil-detail') {
            if (!currentMapelDetail) { window.location.hash = 'section-hasil'; return; }
            const secHasil = document.getElementById('section-hasil');
            if (secHasil) secHasil.classList.add('active');
            
            const summaryView = document.getElementById('hasil-summary-view');
            const detailView = document.getElementById('hasil-detail-view');
            if(summaryView) summaryView.style.display = 'none'; 
            if(detailView) detailView.style.display = 'block';
            return;
        }

        const targetSection = document.getElementById(hash);
        if (targetSection) targetSection.classList.add('active');

        if (hash === 'section-hasil') {
            const summaryView = document.getElementById('hasil-summary-view');
            const detailView = document.getElementById('hasil-detail-view');
            if(summaryView) summaryView.style.display = 'block';
            if(detailView) detailView.style.display = 'none';
            currentMapelDetail = "";
        }
    }

    window.addEventListener('hashchange', handleRouting);
    
    document.querySelectorAll('.stat-clickable').forEach(box => { 
        box.addEventListener('click', (e) => { window.location.hash = e.currentTarget.dataset.target; }); 
    });

    onAuthStateChanged(auth, async (user) => {
        if (!user || (!isAdmin && !isGuru)) { window.location.href = "index.html"; return; }

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
            const mPengguna = document.getElementById('menu-pengguna');
            if (mPengguna) mPengguna.style.display = 'none'; 
            
            const mRegStatus = document.getElementById('admin-reg-status');
            if (mRegStatus) mRegStatus.style.display = 'none'; 
            
            const mDataMaster = document.getElementById('admin-data-master');
            if (mDataMaster) mDataMaster.style.display = 'none';
            
            const mMenuPeng = document.getElementById('menu-pengaturan');
            if (mMenuPeng) {
                const pTag = mMenuPeng.querySelector('p');
                if (pTag) pTag.innerText = 'Token Ujian';
            }
        }

        handleRouting(); 
        await loadDataMaster(); 
        loadDataHasil(); 
        loadActiveTokens(); 
        if (isAdmin) loadDataPengguna();
    });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => { 
            if(confirm('Yakin ingin keluar?')) { await signOut(auth); localStorage.clear(); window.location.href = 'index.html'; } 
        });
    }

    // ==========================================
    // DATA MASTER
    // ==========================================
    async function loadDataMaster() {
        try {
            const docSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
            if(docSnap.exists()) { listMapel = docSnap.data().list_mapel || []; listKelas = docSnap.data().list_kelas || []; }
            renderTableMaster(); populateSemuaDropdown();
        } catch(e) { console.error("Gagal load data master", e); }
    }

    function renderTableMaster() {
        const tbodyMapel = document.querySelector('#table-master-mapel tbody');
        if(tbodyMapel) tbodyMapel.innerHTML = listMapel.length === 0 ? `<tr><td style="text-align:center;">Belum ada Mapel</td></tr>` : listMapel.map((m, i) => `<tr><td>${m}</td><td style="text-align:right;"><button onclick="window.hapusMapel(${i})" class="btn-3d" style="background:var(--danger); padding:4px 8px;"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        const tbodyKelas = document.querySelector('#table-master-kelas tbody');
        if(tbodyKelas) tbodyKelas.innerHTML = listKelas.length === 0 ? `<tr><td style="text-align:center;">Belum ada Kelas</td></tr>` : listKelas.map((k, i) => `<tr><td>${k}</td><td style="text-align:right;"><button onclick="window.hapusKelas(${i})" class="btn-3d" style="background:var(--danger); padding:4px 8px;"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    }

    function populateSemuaDropdown() {
        const mapelCheckboxes = listMapel.map(m => `<label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;"><input type="checkbox" class="new-mapel-cb" value="${m}"> ${m}</label>`).join('');
        const kelasCheckboxes = listKelas.map(k => `<label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;"><input type="checkbox" class="new-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');
        if(document.getElementById('new-mapel-container')) document.getElementById('new-mapel-container').innerHTML = mapelCheckboxes || '<small>Kosong</small>';
        if(document.getElementById('new-kelas-guru-container')) document.getElementById('new-kelas-guru-container').innerHTML = kelasCheckboxes || '<small>Kosong</small>';
        if(document.getElementById('edit-mapel-container')) document.getElementById('edit-mapel-container').innerHTML = listMapel.map(m => `<label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;"><input type="checkbox" class="edit-mapel-cb" value="${m}"> ${m}</label>`).join('');
        if(document.getElementById('edit-kelas-guru-container')) document.getElementById('edit-kelas-guru-container').innerHTML = listKelas.map(k => `<label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;"><input type="checkbox" class="edit-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');

        let allowedMapel = listMapel; let allowedKelas = listKelas;
        if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); allowedKelas = listKelas.filter(k => userKelas.includes(k)); }

        const optionsMapel = '<option value="" disabled selected>Pilih Mapel...</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        const optionsKelasSiswa = '<option value="" disabled selected>Pilih Kelas...</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
        const optionsKelasFilter = '<option value="" disabled selected>Pilih Kelas...</option>' + allowedKelas.map(k => `<option value="${k}">${k}</option>`).join('');
        const optionsMapelFilterHasil = '<option value="semua">Semua Mata Pelajaran</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');

        ['soal-mapel', 'import-mapel', 'set-token-mapel', 'filter-soal-mapel', 'edit-soal-mapel'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = optionsMapel; });
        const filterHasil = document.getElementById('filter-tabel-hasil'); if(filterHasil) filterHasil.innerHTML = optionsMapelFilterHasil;
        ['new-kelas-siswa', 'edit-kelas-siswa'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = optionsKelasSiswa; });
        ['set-token-kelas', 'soal-kelas', 'import-kelas', 'filter-soal-kelas', 'edit-soal-kelas'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = optionsKelasFilter; });
    }

    document.getElementById('btn-add-mapel')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-mapel').value.trim(); if(!val) return; if(listMapel.includes(val)) return alert("Mapel sudah ada!");
        listMapel.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true });
        document.getElementById('input-new-mapel').value = ''; loadDataMaster();
    });

    document.getElementById('btn-add-kelas')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-kelas').value.trim(); if(!val) return; if(listKelas.includes(val)) return alert("Kelas sudah ada!");
        listKelas.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true });
        document.getElementById('input-new-kelas').value = ''; loadDataMaster();
    });

    window.hapusMapel = async (index) => { if(!confirm("Hapus Mapel ini?")) return; listMapel.splice(index, 1); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true }); loadDataMaster(); };
    window.hapusKelas = async (index) => { if(!confirm("Hapus Kelas ini?")) return; listKelas.splice(index, 1); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true }); loadDataMaster(); };

    async function fetchStatusReg() {
        try {
            const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
            if (regSnap.exists()) {
                const sSiswa = document.getElementById('status-reg-siswa');
                const sGuru = document.getElementById('status-reg-guru');
                if (sSiswa) sSiswa.value = regSnap.data().siswa_aktif !== false ? "buka" : "tutup";
                if (sGuru) sGuru.value = regSnap.data().guru_aktif !== false ? "buka" : "tutup";
            }
        } catch (e) {}
    }

    document.getElementById('btn-save-reg-status')?.addEventListener('click', async () => {
        const statusSiswa = document.getElementById('status-reg-siswa').value === "buka"; const statusGuru = document.getElementById('status-reg-guru').value === "buka";
        const btn = document.getElementById('btn-save-reg-status'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        try { await setDoc(doc(db, "pengaturan", "status_registrasi"), { siswa_aktif: statusSiswa, guru_aktif: statusGuru }, { merge: true }); alert("Status pendaftaran berhasil diperbarui!"); } catch (error) { alert("Gagal memperbarui."); }
        btn.innerHTML = '<i class="fas fa-save"></i> Simpan Status';
    });


    // ==========================================
    // MANAJEMEN PENGGUNA
    // ==========================================
    async function loadDataPengguna() {
        const tbody = document.querySelector('#table-siswa tbody'); if(!tbody) return; tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>`;
        try {
            const snap = await getDocs(collection(db, "users")); 
            const statSiswa = document.getElementById('stat-siswa');
            if (statSiswa) statSiswa.innerText = snap.size; 
            
            tbody.innerHTML = ''; allUsersData = []; 
            snap.forEach(docSnap => {
                const data = docSnap.data(); data.id = docSnap.id; allUsersData.push(data);
                const rls = Array.isArray(data.role) ? data.role : [data.role]; const roleColor = rls.includes('admin') ? 'var(--danger)' : (rls.includes('guru') ? 'var(--info)' : 'var(--success)');
                
                let detailText = '-';
                if (rls.includes('guru')) {
                    const mapels = Array.isArray(data.mapel) ? data.mapel.join(', ') : (data.mapel || '-'); const kelases = Array.isArray(data.kelas) ? data.kelas.join(', ') : (data.kelas || '-');
                    detailText = `Mapel: ${mapels} <br><span style="font-size:0.75rem; color:var(--text-muted);">Kelas Ajar: ${kelases}</span>`;
                } else if (rls.includes('siswa')) { detailText = `Kelas: ${data.kelas || '-'}`; }
                
                tbody.innerHTML += `<tr><td>${data.username}</td><td><strong>${data.nama}</strong></td><td><span style="background: ${roleColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${rls.join(', ').toUpperCase()}</span></td><td>${detailText}</td>
                    <td style="display: flex; gap: 5px;"><button onclick="window.editPengguna('${docSnap.id}')" class="btn-3d" style="background: var(--warning); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin: 0;"><i class="fas fa-edit"></i></button>
                    <button onclick="hapusDokumen('users', '${docSnap.id}', window.refreshPengguna)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin: 0;"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        } catch (error) { console.error(error); }
    }
    window.refreshPengguna = loadDataPengguna;

    function updateNewFormVisibility() {
        const checkedRoles = Array.from(document.querySelectorAll('.new-role-cb:checked')).map(cb => cb.value);
        const gpMapel = document.getElementById('group-new-mapel');
        const gpKelasGuru = document.getElementById('group-new-kelas-guru');
        const gpKelasSiswa = document.getElementById('group-new-kelas-siswa');
        if(gpMapel) gpMapel.style.display = checkedRoles.includes('guru') ? 'block' : 'none';
        if(gpKelasGuru) gpKelasGuru.style.display = checkedRoles.includes('guru') ? 'block' : 'none';
        if(gpKelasSiswa) gpKelasSiswa.style.display = checkedRoles.includes('siswa') ? 'block' : 'none';
    }
    document.querySelectorAll('.new-role-cb').forEach(cb => cb.addEventListener('change', updateNewFormVisibility));

    document.getElementById('btn-add-user')?.addEventListener('click', async () => {
        const nama = document.getElementById('new-nama').value.trim(); const username = document.getElementById('new-username').value.trim().replace(/\s+/g, ''); const pass = document.getElementById('new-pass').value;
        const selectedRoles = Array.from(document.querySelectorAll('.new-role-cb:checked')).map(cb => cb.value);
        const selectedMapels = Array.from(document.querySelectorAll('.new-mapel-cb:checked')).map(cb => cb.value);
        const selectedKelasGuru = Array.from(document.querySelectorAll('.new-kelas-guru-cb:checked')).map(cb => cb.value);
        const kelasSiswa = document.getElementById('new-kelas-siswa').value;

        if(!nama || !username || !pass) return alert("Lengkapi form nama, username, dan password!");
        if(selectedRoles.length === 0) return alert("Pilih minimal 1 Role/Hak Akses!");
        if(selectedRoles.includes('guru') && (selectedMapels.length === 0 || selectedKelasGuru.length === 0)) return alert("Centang minimal 1 Mapel & 1 Kelas untuk Guru!");
        if(selectedRoles.includes('siswa') && !kelasSiswa) return alert("Pilih Kelas untuk Siswa!");
        if(pass.length < 6) return alert("Password minimal 6 karakter!");

        const btn = document.getElementById('btn-add-user'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses'; btn.disabled = true;

        try {
            const dummyEmail = `${username}@cbt.smaich.id`;
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, pass);
            await updateProfile(userCred.user, { displayName: nama });

            let payload = { nama: nama, username: username, role: selectedRoles, createdAt: new Date() };
            if (selectedRoles.includes('guru')) { payload.mapel = selectedMapels; payload.kelas = selectedKelasGuru; }
            if (selectedRoles.includes('siswa')) { if(!selectedRoles.includes('guru')) payload.kelas = kelasSiswa; else payload.kelas_siswa = kelasSiswa; }

            await setDoc(doc(db, "users", userCred.user.uid), payload); alert(`Berhasil membuat akun!`);
            document.getElementById('new-nama').value = ''; document.getElementById('new-username').value = ''; document.getElementById('new-pass').value = '';
            document.querySelectorAll('.new-role-cb, .new-mapel-cb, .new-kelas-guru-cb').forEach(cb => cb.checked = false); document.getElementById('new-kelas-siswa').value = ''; updateNewFormVisibility();
            loadDataPengguna(); await secondaryAuth.signOut();
        } catch (error) { alert("Gagal: Username sudah dipakai atau format salah."); }
        btn.innerHTML = '<i class="fas fa-save"></i> SIMPAN AKUN'; btn.disabled = false;
    });

    document.getElementById('upload-akun-excel')?.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                const jsonAkun = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if(jsonAkun.length === 0) return alert("Excel kosong!");
                if(!confirm(`Import Massal ${jsonAkun.length} akun? \n(Jangan tutup halaman ini)`)) return;

                const labelUpload = document.querySelector('label[for="upload-akun-excel"]'); const origLabel = labelUpload.innerHTML; labelUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat...';
                let successCount = 0; let failedCount = 0;

                for (let row of jsonAkun) {
                    const nama = row['Nama Lengkap']; const username = row['Username'] ? row['Username'].toString().replace(/\s+/g, '') : null;
                    const roleStr = row['Role'] ? row['Role'].toString().toLowerCase() : 'siswa'; const password = row['Password'] ? row['Password'].toString() : '123456';
                    if(!nama || !username) { failedCount++; continue; } 

                    try {
                        const dummyEmail = `${username}@cbt.smaich.id`;
                        const userCred = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, password);
                        await updateProfile(userCred.user, { displayName: nama });

                        const roleArr = roleStr.split(',').map(s => s.trim());
                        let payload = { nama: nama, username: username, role: roleArr, createdAt: new Date() };
                        
                        if (roleArr.includes('guru')) {
                            const detailMapel = row['Detail (Mapel)']; const detailKelas = row['Detail (Kelas)'];
                            if(detailMapel) payload.mapel = detailMapel.split(',').map(s => s.trim());
                            if(detailKelas) payload.kelas = detailKelas.split(',').map(s => s.trim());
                        }
                        if (roleArr.includes('siswa')) {
                            const ks = row['Detail (Kelas)'] || row['Detail (Mapel)'];
                            if(!roleArr.includes('guru')) payload.kelas = ks; else payload.kelas_siswa = ks;
                        }

                        await setDoc(doc(db, "users", userCred.user.uid), payload); successCount++;
                    } catch (err) { failedCount++; }
                }
                await secondaryAuth.signOut(); alert(`Selesai!\n✅ Sukses: ${successCount}\n❌ Gagal: ${failedCount}`); labelUpload.innerHTML = origLabel; document.getElementById('upload-akun-excel').value = ''; loadDataPengguna();
            } catch (err) { alert("Gagal membaca file Excel."); }
        };
        reader.readAsArrayBuffer(file);
    });

    const modalEditAkun = document.getElementById('modal-edit-akun');
    
    function updateEditFormVisibility() {
        const checkedRoles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(cb => cb.value);
        const egGuru = document.getElementById('group-edit-guru');
        const egKelasSiswa = document.getElementById('group-edit-kelas-siswa');
        if(egGuru) egGuru.style.display = checkedRoles.includes('guru') ? 'flex' : 'none';
        if(egKelasSiswa) egKelasSiswa.style.display = checkedRoles.includes('siswa') ? 'block' : 'none';
    }
    document.querySelectorAll('.edit-role-cb').forEach(cb => cb.addEventListener('change', updateEditFormVisibility));

    window.editPengguna = (uid) => {
        const user = allUsersData.find(u => u.id === uid); if(!user) return;
        document.getElementById('edit-uid').value = user.id; document.getElementById('edit-nama').value = user.nama; 
        
        const rls = Array.isArray(user.role) ? user.role : [user.role];
        document.querySelectorAll('.edit-role-cb').forEach(cb => { cb.checked = rls.includes(cb.value); });
        
        updateEditFormVisibility();
        
        if(rls.includes('guru')) {
            const mapelArray = Array.isArray(user.mapel) ? user.mapel : [user.mapel]; const kelasArray = Array.isArray(user.kelas) ? user.kelas : [user.kelas];
            document.querySelectorAll('.edit-mapel-cb').forEach(cb => { cb.checked = mapelArray.includes(cb.value); });
            document.querySelectorAll('.edit-kelas-guru-cb').forEach(cb => { cb.checked = kelasArray.includes(cb.value); });
        }
        if(rls.includes('siswa')) { document.getElementById('edit-kelas-siswa').value = user.kelas_siswa || user.kelas || ""; }
        if (modalEditAkun) modalEditAkun.style.display = 'flex';
    };

    document.getElementById('close-modal-edit-akun')?.addEventListener('click', () => { if(modalEditAkun) modalEditAkun.style.display = 'none'; });

    document.getElementById('btn-save-edit-akun')?.addEventListener('click', async () => {
        const uid = document.getElementById('edit-uid').value; const nama = document.getElementById('edit-nama').value.trim(); const selectedRoles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(cb => cb.value);
        if(selectedRoles.length === 0) return alert("Pilih minimal 1 Role!");
        let payload = { nama: nama, role: selectedRoles };
        
        if (selectedRoles.includes('guru')) { payload.mapel = Array.from(document.querySelectorAll('.edit-mapel-cb:checked')).map(cb => cb.value); payload.kelas = Array.from(document.querySelectorAll('.edit-kelas-guru-cb:checked')).map(cb => cb.value); } 
        if (selectedRoles.includes('siswa')) { const ks = document.getElementById('edit-kelas-siswa').value; if(!selectedRoles.includes('guru')) payload.kelas = ks; else payload.kelas_siswa = ks; }

        try { document.getElementById('btn-save-edit-akun').innerHTML = "Menyimpan..."; await updateDoc(doc(db, "users", uid), payload); alert("Profil diperbarui!"); if(modalEditAkun) modalEditAkun.style.display = 'none'; document.getElementById('btn-save-edit-akun').innerHTML = '<i class="fas fa-save"></i> SIMPAN PERUBAHAN'; loadDataPengguna();
        } catch (err) { alert("Gagal."); document.getElementById('btn-save-edit-akun').innerHTML = '<i class="fas fa-save"></i> SIMPAN PERUBAHAN'; }
    });

    // ==========================================
    // BANK SOAL & PREVIEW DENGAN MEDIA
    // ==========================================
    document.getElementById('btn-tampil-soal')?.addEventListener('click', loadDataSoal);

    async function loadDataSoal() {
        const tbodySoal = document.querySelector('#table-soal tbody'); if(!tbodySoal) return;
        const filterMapel = document.getElementById('filter-soal-mapel').value; const filterKelas = document.getElementById('filter-soal-kelas').value;

        if (!filterMapel || !filterKelas) { tbodySoal.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--text-muted);">Silakan pilih <b>Mata Pelajaran</b> dan <b>Kelas</b> terlebih dahulu.</td></tr>`; document.getElementById('btn-preview-full').style.display = 'none'; return; }
        tbodySoal.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Memuat soal... <i class="fas fa-spinner fa-spin"></i></td></tr>`;
        
        try {
            const qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", filterMapel), where("kelas", "==", filterKelas));
            const snap = await getDocs(qSoal); 
            const statSoal = document.getElementById('stat-soal');
            if (statSoal) statSoal.innerText = snap.size;
            
            allSoalData = [];
            snap.forEach(docSnap => { const data = docSnap.data(); data.id = docSnap.id; data.nomor_soal = parseInt(data.nomor_soal) || 999; allSoalData.push(data); });
            allSoalData.sort((a, b) => a.nomor_soal - b.nomor_soal); filteredSoalData = allSoalData;

            if (filteredSoalData.length === 0) { tbodySoal.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--danger);">Bank soal kosong untuk mapel dan kelas ini.</td></tr>`; document.getElementById('btn-preview-full').style.display = 'none'; return; }

            document.getElementById('btn-preview-full').style.display = 'inline-flex'; tbodySoal.innerHTML = '';
            filteredSoalData.forEach(data => {
                let statusMedia = data.media_soal ? '<i class="fas fa-paperclip" title="Ada Media" style="color:var(--success); margin-left:5px;"></i>' : '';
                tbodySoal.innerHTML += `<tr><td style="text-align:center; font-weight:bold;">${data.nomor_soal === 999 ? '-' : data.nomor_soal}</td><td><span style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${data.mataPelajaran.toUpperCase()}</span></td><td><span style="color: var(--secondary); font-weight: bold; font-size: 0.85rem;">${data.kelas || '-'}</span></td><td><span style="color: var(--primary); font-weight: bold;">${data.tipe}</span></td><td>${data.teks_soal.substring(0, 40)}... ${statusMedia}</td><td style="display:flex; gap:5px;"><button onclick="window.editSoal('${data.id}')" style="background: var(--warning); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin: 0;"><i class="fas fa-edit"></i></button><button onclick="hapusDokumen('bank_soal', '${data.id}', window.refreshSoal)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin: 0;"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        } catch(error) { console.error(error); tbodySoal.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data.</td></tr>`; }
    }
    window.refreshSoal = loadDataSoal;

    document.getElementById('btn-preview-full')?.addEventListener('click', () => {
        if(filteredSoalData.length === 0) return alert("Pilih mapel dan kelas yang ada soalnya!");
        const mdl = document.getElementById('modal-preview-full');
        if(mdl) mdl.style.display = 'flex'; previewCurrentIdx = 0; buildPreviewGrid(); renderPreviewSoal(0);
    });

    document.getElementById('close-preview-full')?.addEventListener('click', () => { 
        const mdl = document.getElementById('modal-preview-full');
        if (mdl) mdl.style.display = 'none'; 
    });

    function buildPreviewGrid() {
        const grid = document.getElementById('prev-q-grid'); 
        if(!grid) return;
        grid.innerHTML = '';
        filteredSoalData.forEach((data, i) => { const box = document.createElement('div'); box.className = 'q-box'; box.innerText = data.nomor_soal === 999 ? i + 1 : data.nomor_soal; box.onclick = () => renderPreviewSoal(i); grid.appendChild(box); });
    }

    function renderPreviewSoal(idx) {
        previewCurrentIdx = idx; const qContainer = document.getElementById('prev-q-container'); const q = filteredSoalData[idx];
        if(!qContainer) return;
        const cn = document.getElementById('prev-current-q-num'); if(cn) cn.innerText = q.nomor_soal === 999 ? idx + 1 : q.nomor_soal; 
        const bt = document.getElementById('prev-badge-tipe'); if(bt) bt.innerText = q.tipe || 'PG';
        
        let html = `<div class="q-text" style="font-size: 1.1rem; margin-bottom: 25px;">${q.teks_soal}</div>`;
        html += renderMediaHTML(q.media_soal);
        
        if (q.tipe === 'PG' || q.tipe === 'PGK' || !q.tipe) {
            html += `<div class="options-container" style="display: flex; flex-direction: column; gap: 12px;">`;
            ['A', 'B', 'C', 'D', 'E'].forEach(lbl => {
                if((q.opsi && q.opsi[lbl]) || (q.opsi_media && q.opsi_media[lbl])) {
                    let isKunci = false; if(q.tipe === 'PGK') isKunci = (Array.isArray(q.kunci_jawaban) && q.kunci_jawaban.includes(lbl)); else isKunci = (q.kunci_jawaban === lbl);
                    let bg = isKunci ? 'background:#d1fae5; border-color:#10b981;' : 'background:#f8fafc; border-color:#e2e8f0;'; let type = q.tipe === 'PGK' ? 'checkbox' : 'radio';
                    let mediaOpsiHTML = q.opsi_media && q.opsi_media[lbl] ? renderMediaHTML(q.opsi_media[lbl]) : '';
                    let teksOpsiHTML = (q.opsi && q.opsi[lbl]) ? `<span>${q.opsi[lbl]}</span>` : '';
                    
                    html += `<label class="option-item" style="display: flex; padding: 15px; border: 1.5px solid; border-radius: var(--radius-md); ${bg} margin: 0;"><input type="${type}" disabled ${isKunci ? 'checked' : ''} style="margin-right: 15px; transform: scale(1.2);"><span style="font-weight: bold; margin-right: 10px;">${lbl}.</span><div style="display:flex; flex-direction:column; width: 100%;">${mediaOpsiHTML}${teksOpsiHTML}</div></label>`;
                }
            }); html += `</div>`;
        } 
        else if (q.tipe === 'Menjodohkan') {
            html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
            if(q.pasangan) { q.pasangan.forEach(p => { html += `<div style="display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);"><div style="flex: 1; font-weight: 500;">${p.premis}</div><i class="fas fa-arrow-right" style="color: var(--text-muted);"></i><div style="flex: 1; font-weight:bold; color:var(--primary);">${p.target}</div></div>`; }); } html += `</div>`;
        }
        else if (q.tipe === 'Isian') { html += `<input type="text" class="input-text" value="${q.kunci_jawaban}" disabled style="background:#d1fae5; color:#059669; font-weight:bold; padding:15px; font-size: 1.1rem;"><p style="font-size:0.8rem; color:var(--text-muted); margin-top:5px;">*Warna hijau adalah kunci jawaban yang dideteksi sistem.</p>`; }
        else if (q.tipe === 'Uraian') { html += `<textarea class="input-text" rows="4" disabled placeholder="(Siswa akan mengisi jawaban uraian di sini)" style="font-size: 1rem; padding: 15px;"></textarea><div style="margin-top:15px; padding:15px; background:#fffbeb; border:1px solid var(--warning); border-radius:8px;"><strong style="color:var(--warning);"><i class="fas fa-info-circle"></i> Rubrik / Panduan Penilaian Anda:</strong> <br>${q.rubrik || '-'}</div>`; }

        qContainer.innerHTML = html; updatePreviewUI();
    }

    function updatePreviewUI() {
        const bp = document.getElementById('prev-btn-prev'); if(bp) bp.style.visibility = previewCurrentIdx === 0 ? 'hidden' : 'visible'; 
        const bn = document.getElementById('prev-btn-next'); if(bn) bn.style.visibility = previewCurrentIdx === filteredSoalData.length - 1 ? 'hidden' : 'visible';
        const boxes = document.querySelectorAll('#prev-q-grid .q-box'); boxes.forEach((box, i) => { box.className = 'q-box'; if (i === previewCurrentIdx) box.classList.add('active-q'); });
    }

    document.getElementById('prev-btn-next')?.addEventListener('click', () => { if (previewCurrentIdx < filteredSoalData.length - 1) renderPreviewSoal(previewCurrentIdx + 1); });
    document.getElementById('prev-btn-prev')?.addEventListener('click', () => { if (previewCurrentIdx > 0) renderPreviewSoal(previewCurrentIdx - 1); });

    const modalSoal = document.getElementById('modal-tambah-soal'); const tipeSelect = document.getElementById('soal-tipe');
    document.getElementById('btn-tambah-manual')?.addEventListener('click', () => { if(modalSoal) modalSoal.style.display = 'flex'; renderFormDinamis('PG'); });
    document.getElementById('close-modal-soal')?.addEventListener('click', () => { if(modalSoal) modalSoal.style.display = 'none'; });
    document.getElementById('tab-manual')?.addEventListener('click', () => { const am = document.getElementById('area-manual'); const ai = document.getElementById('area-import'); if(am) am.style.display = 'block'; if(ai) ai.style.display = 'none'; });
    document.getElementById('tab-import')?.addEventListener('click', () => { const am = document.getElementById('area-manual'); const ai = document.getElementById('area-import'); if(am) am.style.display = 'none'; if(ai) ai.style.display = 'block'; });
    tipeSelect?.addEventListener('change', (e) => renderFormDinamis(e.target.value));

    function renderFormDinamis(tipe) {
        const areaOpsi = document.getElementById('area-opsi-dinamis'); 
        if(!areaOpsi) return;
        areaOpsi.innerHTML = ''; 
        if (tipe === 'PG') areaOpsi.innerHTML = `${['A','B','C','D','E'].map(opt => `<div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; flex-wrap: wrap; background: white; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);"><input type="radio" name="kunci_pg" value="${opt}" ${opt==='A'?'checked':''}><label style="font-weight: bold; width: 20px;">${opt}</label><input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="flex: 1; min-width: 200px;"><input type="file" id="media-opsi-${opt}" class="input-text" accept="image/*, audio/*, video/*" style="flex: 1; min-width: 200px;" title="Media Opsi ${opt}"></div>`).join('')}`;
        else if (tipe === 'PGK') areaOpsi.innerHTML = `${['A','B','C','D','E'].map(opt => `<div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; flex-wrap: wrap; background: white; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);"><input type="checkbox" class="kunci_pgk" value="${opt}"><label style="font-weight: bold; width: 20px;">${opt}</label><input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="flex: 1; min-width: 200px;"><input type="file" id="media-opsi-${opt}" class="input-text" accept="image/*, audio/*, video/*" style="flex: 1; min-width: 200px;" title="Media Opsi ${opt}"></div>`).join('')}`;
        else if (tipe === 'Menjodohkan') areaOpsi.innerHTML = `<div id="container-jodoh">${[1,2,3].map(num => `<div style="display: flex; gap: 10px; margin-bottom: 8px;"><input type="text" class="jodoh-kiri input-text" placeholder="Pernyataan ${num}" style="padding: 8px;"><input type="text" class="jodoh-kanan input-text" placeholder="Jawaban ${num}" style="padding: 8px;"></div>`).join('')}</div>`;
        else if (tipe === 'Isian') areaOpsi.innerHTML = `<label>Kunci Jawaban</label><input type="text" id="kunci_isian" class="input-text" placeholder="Masukkan jawaban singkat">`;
        else if (tipe === 'Uraian') areaOpsi.innerHTML = `<label>Panduan Penilaian</label><textarea id="rubrik_uraian" class="input-text" rows="2" placeholder="Poin utama penilaian..."></textarea>`;
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

    document.getElementById('btn-simpan-soal')?.addEventListener('click', async () => {
        const mapel = document.getElementById('soal-mapel').value; const kelas = document.getElementById('soal-kelas').value; const noSoal = document.getElementById('soal-nomor').value; const tipe = tipeSelect.value; const teks = document.getElementById('soal-teks').value.trim();
        if(!mapel || !kelas || !noSoal) return alert("Pilih Mapel, Kelas, dan Isi Nomor Soal!");
        
        if (tipe === 'PG') {
            const cekKunci = document.querySelector('input[name="kunci_pg"]:checked');
            if (!cekKunci) return alert("Pilih Kunci Jawaban terlebih dahulu!");
        }

        const btnSimpan = document.getElementById('btn-simpan-soal');
        const origBtnText = btnSimpan.innerHTML;
        btnSimpan.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENGUNGGAH & MENYIMPAN...';
        btnSimpan.disabled = true;

        try {
            let mediaSoalObj = null;
            const fileSoal = document.getElementById('soal-media')?.files[0];
            if(fileSoal) mediaSoalObj = await uploadFileKeStorage(fileSoal);

            let opsiMediaObj = {};
            if (tipe === 'PG' || tipe === 'PGK') {
               for(let opt of ['A','B','C','D','E']) {
                   let fileOpsi = document.getElementById(`media-opsi-${opt}`)?.files[0];
                   if(fileOpsi) opsiMediaObj[opt] = await uploadFileKeStorage(fileOpsi);
               }
            }

            let payload = { mataPelajaran: mapel, kelas: kelas, nomor_soal: parseInt(noSoal), tipe: tipe, teks_soal: teks, createdAt: new Date() };
            if (mediaSoalObj) payload.media_soal = mediaSoalObj;
            if (Object.keys(opsiMediaObj).length > 0) payload.opsi_media = opsiMediaObj;

            if (tipe === 'PG') { payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value }; payload.kunci_jawaban = document.querySelector('input[name="kunci_pg"]:checked').value; } 
            else if (tipe === 'PGK') { payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value }; let kunci = []; document.querySelectorAll('.kunci_pgk:checked').forEach(cb => kunci.push(cb.value)); payload.kunci_jawaban = kunci; } 
            else if (tipe === 'Menjodohkan') { let pasangan = []; document.querySelectorAll('.jodoh-kiri').forEach((el, idx) => { let kanan = document.querySelectorAll('.jodoh-kanan')[idx]; if(el.value) pasangan.push({ premis: el.value, target: kanan.value }); }); payload.pasangan = pasangan; } 
            else if (tipe === 'Isian') { payload.kunci_jawaban = document.getElementById('kunci_isian').value.toLowerCase(); } 
            else if (tipe === 'Uraian') { payload.rubrik = document.getElementById('rubrik_uraian').value; }

            await addDoc(collection(db, "bank_soal"), payload); 
            
            const fileInputs = document.querySelectorAll('input[type="file"]');
            fileInputs.forEach(input => input.value = '');
            document.getElementById('soal-teks').value = '';

            alert("Soal berhasil disimpan!"); 
            if(modalSoal) modalSoal.style.display = 'none'; 
            loadDataSoal(); 
        } catch (error) { 
            console.error(error);
            alert("GAGAL MENYIMPAN: " + error.message); 
        }

        btnSimpan.innerHTML = origBtnText;
        btnSimpan.disabled = false;
    });

    let selectedExcelSoal = null;
    document.getElementById('file-excel')?.addEventListener('change', (e) => {
        selectedExcelSoal = e.target.files[0]; const label = document.getElementById('label-file-excel');
        if(selectedExcelSoal) { label.innerHTML = `<i class="fas fa-check"></i> ${selectedExcelSoal.name}`; label.style.background = "var(--secondary)"; } 
        else { label.innerHTML = `<i class="fas fa-search"></i> Pilih File`; label.style.background = "var(--success)"; }
    });

    document.getElementById('btn-proses-import-soal')?.addEventListener('click', () => {
        if (!selectedExcelSoal) return alert("Pilih file Excel terlebih dahulu!");
        const mapel = document.getElementById('import-mapel').value; const kelas = document.getElementById('import-kelas').value;
        if(!mapel || !kelas) return alert("Pilih Mapel dan Kelas Terlebih Dahulu!");

        const btn = document.getElementById('btn-proses-import-soal'); const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...'; btn.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'}); const jsonSoal = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if(!confirm(`Import ${jsonSoal.length} soal ke mapel ${mapel} kelas ${kelas}?`)) { btn.innerHTML = origText; btn.disabled = false; return; }

                for (let [index, row] of jsonSoal.entries()) {
                    const tipe = (row.Tipe || 'PG').toString().toUpperCase(); const nomorSoal = parseInt(row['Nomor Soal'] || row['No'] || (index + 1));
                    let payload = { mataPelajaran: mapel, kelas: kelas, nomor_soal: nomorSoal, tipe: tipe, teks_soal: row.Soal, createdAt: new Date() };

                    if(tipe === 'PG') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = (row.Kunci||"A").toString().toUpperCase(); } 
                    else if (tipe === 'PGK') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = row.Kunci ? row.Kunci.toString().replace(/\s/g, '').toUpperCase().split(',') : []; }
                    else if (tipe === 'MENJODOHKAN') { let pasangan = []; ['OpsiA', 'OpsiB', 'OpsiC', 'OpsiD', 'OpsiE'].forEach(opt => { if(row[opt] && row[opt].includes('=')) { let parts = row[opt].split('='); pasangan.push({ premis: parts[0].trim(), target: parts[1].trim() }); } }); payload.pasangan = pasangan; }
                    else if (tipe === 'ISIAN') { payload.kunci_jawaban = (row.Kunci || "").toString().toLowerCase(); }
                    else if (tipe === 'URAIAN') { payload.rubrik = row['Keterangan/Rubrik'] || row.Rubrik || ""; }

                    await addDoc(collection(db, "bank_soal"), payload); 
                }
                alert(`Import Berhasil!`); if(modalSoal) modalSoal.style.display = 'none'; loadDataSoal(); selectedExcelSoal = null; const lfe = document.getElementById('label-file-excel'); if(lfe){ lfe.innerHTML = `<i class="fas fa-search"></i> Pilih File`; lfe.style.background = "var(--success)"; } document.getElementById('file-excel').value = '';
            } catch (err) { alert("Gagal membaca file Excel."); }
            btn.innerHTML = origText; btn.disabled = false;
        };
        reader.readAsArrayBuffer(selectedExcelSoal);
    });

    document.getElementById('close-modal-edit-soal')?.addEventListener('click', () => {
        const md = document.getElementById('modal-edit-soal');
        if(md) md.style.display = 'none';
    });

    document.getElementById('edit-soal-tipe')?.addEventListener('change', (e) => {
        renderFormEditDinamis(e.target.value); 
    });

    function renderFormEditDinamis(tipe, qData = null) {
        const areaOpsi = document.getElementById('edit-area-opsi-dinamis'); 
        if(!areaOpsi) return;
        areaOpsi.innerHTML = ''; 
        
        let opsiTeks = { A:'', B:'', C:'', D:'', E:'' };
        let kunciPG = 'A'; let kunciPGK = []; let pasangan = [{premis:'', target:''}, {premis:'', target:''}, {premis:'', target:''}];
        let kunciIsian = ''; let rubrikUraian = '';

        if (qData) {
            if (qData.opsi) opsiTeks = { ...opsiTeks, ...qData.opsi };
            if (qData.tipe === 'PG' && qData.kunci_jawaban) kunciPG = qData.kunci_jawaban;
            if (qData.tipe === 'PGK' && Array.isArray(qData.kunci_jawaban)) kunciPGK = qData.kunci_jawaban;
            if (qData.tipe === 'Menjodohkan' && Array.isArray(qData.pasangan)) { for(let i=0; i<3; i++) { if (qData.pasangan[i]) pasangan[i] = qData.pasangan[i]; } }
            if (qData.tipe === 'Isian') kunciIsian = qData.kunci_jawaban || '';
            if (qData.tipe === 'Uraian') rubrikUraian = qData.rubrik || '';
        }

        if (tipe === 'PG' || tipe === 'PGK') {
            const isPG = tipe === 'PG';
            areaOpsi.innerHTML = `${['A','B','C','D','E'].map(opt => {
                let mediaExisting = '';
                if (qData && qData.opsi_media && qData.opsi_media[opt]) {
                    mediaExisting = `<div style="flex-basis: 100%; margin-top: 5px; font-size: 0.8rem; display:flex; align-items:center; gap:10px;"><span style="color:var(--success);"><i class="fas fa-check"></i> Media Tersimpan (${qData.opsi_media[opt].type.toUpperCase()})</span> <label style="color:var(--danger); cursor:pointer;"><input type="checkbox" id="edit-hapus-media-opsi-${opt}"> Hapus Media Ini</label></div>`;
                }
                
                let checkedAttr = '';
                if(isPG && kunciPG === opt) checkedAttr = 'checked';
                if(!isPG && kunciPGK.includes(opt)) checkedAttr = 'checked';
                let nameClassAttr = isPG ? 'name="edit_kunci_pg"' : 'class="edit_kunci_pgk"';
                
                return `<div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; flex-wrap: wrap; background: white; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <input type="${isPG ? 'radio' : 'checkbox'}" ${nameClassAttr} value="${opt}" ${checkedAttr} style="transform: scale(1.2);">
                    <label style="font-weight: bold; width: 20px;">${opt}</label>
                    <input type="text" id="edit-opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" value="${opsiTeks[opt] || ''}" style="flex: 1; min-width: 200px;">
                    <input type="file" id="edit-media-opsi-${opt}" class="input-text" accept="image/*, audio/*, video/*" style="flex: 1; min-width: 200px;" title="Update Media Opsi ${opt}">
                    ${mediaExisting}
                </div>`;
            }).join('')}`;
        }
        else if (tipe === 'Menjodohkan') areaOpsi.innerHTML = `<div id="edit-container-jodoh">${pasangan.map((p, idx) => `<div style="display: flex; gap: 10px; margin-bottom: 8px;"><input type="text" class="edit-jodoh-kiri input-text" placeholder="Pernyataan ${idx+1}" value="${p.premis}" style="padding: 8px;"><input type="text" class="edit-jodoh-kanan input-text" placeholder="Jawaban ${idx+1}" value="${p.target}" style="padding: 8px;"></div>`).join('')}</div>`;
        else if (tipe === 'Isian') areaOpsi.innerHTML = `<label>Kunci Jawaban</label><input type="text" id="edit_kunci_isian" class="input-text" placeholder="Masukkan jawaban singkat" value="${kunciIsian}">`;
        else if (tipe === 'Uraian') areaOpsi.innerHTML = `<label>Panduan Penilaian</label><textarea id="edit_rubrik_uraian" class="input-text" rows="2" placeholder="Poin utama penilaian...">${rubrikUraian}</textarea>`;
    }

    window.editSoal = (id) => {
        const qData = filteredSoalData.find(s => s.id === id); if (!qData) return;

        document.getElementById('edit-soal-id').value = qData.id;
        document.getElementById('edit-soal-mapel').value = qData.mataPelajaran;
        document.getElementById('edit-soal-kelas').value = qData.kelas || '';
        document.getElementById('edit-soal-nomor').value = qData.nomor_soal === 999 ? '' : qData.nomor_soal;
        document.getElementById('edit-soal-tipe').value = qData.tipe || 'PG';
        document.getElementById('edit-soal-teks').value = qData.teks_soal || '';

        const mediaPrev = document.getElementById('edit-soal-media-preview');
        const hapusMediaCb = document.getElementById('edit-hapus-media');
        document.getElementById('edit-soal-media').value = '';
        if(hapusMediaCb) hapusMediaCb.checked = false;

        if (mediaPrev && hapusMediaCb) {
            if (qData.media_soal) {
                mediaPrev.innerHTML = `<span style="font-size: 0.85rem; color: var(--success);"><i class="fas fa-check"></i> Media saat ini: ${qData.media_soal.type.toUpperCase()} (Tersimpan)</span>`;
                hapusMediaCb.parentElement.style.display = 'flex';
            } else {
                mediaPrev.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Tidak ada media pada soal ini.</span>`;
                hapusMediaCb.parentElement.style.display = 'none';
            }
        }

        renderFormEditDinamis(qData.tipe || 'PG', qData);
        const md = document.getElementById('modal-edit-soal');
        if(md) md.style.display = 'flex';
    };

    document.getElementById('btn-update-soal')?.addEventListener('click', async () => {
        const id = document.getElementById('edit-soal-id').value; const mapel = document.getElementById('edit-soal-mapel').value; const kelas = document.getElementById('edit-soal-kelas').value; const noSoal = document.getElementById('edit-soal-nomor').value; const tipe = document.getElementById('edit-soal-tipe').value; const teks = document.getElementById('edit-soal-teks').value.trim();
        
        if(!mapel || !kelas || !noSoal) return alert("Pilih Mapel, Kelas, dan Isi Nomor Soal!");
        
        if (tipe === 'PG') {
            const cekKunci = document.querySelector('input[name="edit_kunci_pg"]:checked');
            if (!cekKunci) return alert("Pilih Kunci Jawaban terlebih dahulu!");
        }

        const btnUpdate = document.getElementById('btn-update-soal'); const origBtnText = btnUpdate.innerHTML;
        btnUpdate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMPERBARUI...'; btnUpdate.disabled = true;

        try {
            let payload = { mataPelajaran: mapel, kelas: kelas, nomor_soal: parseInt(noSoal), tipe: tipe, teks_soal: teks };
            
            const hapusMediaCb = document.getElementById('edit-hapus-media');
            const hapusMedia = hapusMediaCb ? hapusMediaCb.checked : false;
            if (hapusMedia) { payload.media_soal = deleteField(); } 
            else {
                const fileSoal = document.getElementById('edit-soal-media')?.files[0];
                if(fileSoal) { payload.media_soal = await uploadFileKeStorage(fileSoal); }
            }

            const qExisting = filteredSoalData.find(s => s.id === id);
            let opsiMediaObj = qExisting && qExisting.opsi_media ? { ...qExisting.opsi_media } : {};

            if (tipe === 'PG') { 
                payload.opsi = { A: document.getElementById('edit-opsi-A').value, B: document.getElementById('edit-opsi-B').value, C: document.getElementById('edit-opsi-C').value, D: document.getElementById('edit-opsi-D').value, E: document.getElementById('edit-opsi-E').value }; 
                payload.kunci_jawaban = document.querySelector('input[name="edit_kunci_pg"]:checked').value; 
            } else if (tipe === 'PGK') { 
                payload.opsi = { A: document.getElementById('edit-opsi-A').value, B: document.getElementById('edit-opsi-B').value, C: document.getElementById('edit-opsi-C').value, D: document.getElementById('edit-opsi-D').value, E: document.getElementById('edit-opsi-E').value }; 
                let kunci = []; document.querySelectorAll('.edit_kunci_pgk:checked').forEach(cb => kunci.push(cb.value)); payload.kunci_jawaban = kunci; 
            } 
            
            if (tipe === 'PG' || tipe === 'PGK') {
                for (let opt of ['A','B','C','D','E']) {
                    const cbHapus = document.getElementById(`edit-hapus-media-opsi-${opt}`);
                    if (cbHapus && cbHapus.checked) {
                        delete opsiMediaObj[opt];
                    }
                    
                    let fileOpsi = document.getElementById(`edit-media-opsi-${opt}`)?.files[0];
                    if (fileOpsi) {
                        opsiMediaObj[opt] = await uploadFileKeStorage(fileOpsi);
                    }
                }
                if (Object.keys(opsiMediaObj).length > 0) { payload.opsi_media = opsiMediaObj; } 
                else { payload.opsi_media = deleteField(); }
            }

            if (tipe === 'Menjodohkan') { let pasangan = []; document.querySelectorAll('.edit-jodoh-kiri').forEach((el, idx) => { let kanan = document.querySelectorAll('.edit-jodoh-kanan')[idx]; if(el.value) pasangan.push({ premis: el.value, target: kanan.value }); }); payload.pasangan = pasangan; } 
            else if (tipe === 'Isian') { payload.kunci_jawaban = document.getElementById('edit_kunci_isian').value.toLowerCase(); } 
            else if (tipe === 'Uraian') { payload.rubrik = document.getElementById('edit_rubrik_uraian').value; }

            await updateDoc(doc(db, "bank_soal", id), payload); 
            
            alert("Soal berhasil diperbarui!"); 
            const md = document.getElementById('modal-edit-soal');
            if(md) md.style.display = 'none'; 
            loadDataSoal(); 
        } catch (error) { 
            console.error(error); 
            alert("GAGAL MEMPERBARUI: " + error.message); 
        }

        btnUpdate.innerHTML = origBtnText; btnUpdate.disabled = false;
    });

    // ==========================================
    // HASIL UJIAN (HIERARKI & NAVIGASI BACK BROWSER)
    // ==========================================
    async function loadDataHasil() {
        try {
            let qHasil = collection(db, "hasil_ujian");
            if (!isAdmin && isGuru) {
                if (userMapel.length === 0) return;
                qHasil = query(collection(db, "hasil_ujian"), where("mataPelajaran", "in", userMapel));
            }
            const snap = await getDocs(qHasil); 
            const stUjian = document.getElementById('stat-ujian');
            if (stUjian) stUjian.innerText = snap.size;
            
            allHasilUjian = []; snap.forEach(docSnap => allHasilUjian.push({ id: docSnap.id, ...docSnap.data() })); 
            renderSummaryHasil(); 
        } catch(error) { console.error(error); }
    }

    function renderSummaryHasil() {
        const gridMapel = document.getElementById('grid-mapel-hasil'); 
        if(!gridMapel) return;
        gridMapel.innerHTML = '';

        if (allHasilUjian.length === 0) { gridMapel.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--danger); padding: 30px; background: #fee2e2; border-radius: 8px; border: 1px solid #f87171;">Belum ada satupun data hasil ujian yang masuk.</div>`; return; }

        const grouped = {};
        allHasilUjian.forEach(h => {
            if(!grouped[h.mataPelajaran]) grouped[h.mataPelajaran] = { total: 0, classes: new Set() };
            grouped[h.mataPelajaran].total++; if(h.kelas) grouped[h.mataPelajaran].classes.add(h.kelas);
        });

        for (const [mapel, data] of Object.entries(grouped)) {
            gridMapel.innerHTML += `<div class="mapel-card" onclick="window.openDetailHasil('${mapel}')">
                    <i class="fas fa-file-alt mapel-card-icon"></i><h3 style="color: var(--secondary); font-size: 1.25rem; margin: 0; text-transform: uppercase;">${mapel}</h3>
                    <p style="color: var(--primary); font-size: 1rem; font-weight: 700; margin: 5px 0 0 0;"><i class="fas fa-check-circle"></i> ${data.total} Selesai</p>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin: 5px 0 0 0;"><i class="fas fa-chalkboard"></i> Kelas Tersedia: ${Array.from(data.classes).join(', ') || '-'}</p>
                </div>`;
        }
    }

    window.openDetailHasil = (mapel, isPushState = true) => {
        currentMapelDetail = mapel;
        if (isPushState) { window.location.hash = 'section-hasil-detail'; }
        
        const lbMapel = document.getElementById('label-mapel-detail');
        if(lbMapel) lbMapel.innerText = mapel.toUpperCase();
        
        const filterKelas = document.getElementById('filter-kelas-hasil'); 
        const classes = new Set();
        allHasilUjian.forEach(h => { if(h.mataPelajaran === mapel && h.kelas) classes.add(h.kelas); });
        
        if (filterKelas) {
            filterKelas.innerHTML = '<option value="semua">Semua Kelas</option>' + Array.from(classes).map(c => `<option value="${c}">${c}</option>`).join('');
        }
        renderHasilTable();
    };

    document.getElementById('btn-back-hasil')?.addEventListener('click', () => { window.history.back(); });
    document.getElementById('filter-kelas-hasil')?.addEventListener('change', renderHasilTable);

    function renderHasilTable() {
        const tbodyHasil = document.querySelector('#table-hasil tbody'); 
        const filterKelas = document.getElementById('filter-kelas-hasil');
        if(!tbodyHasil || !filterKelas) return;
        
        const fv = filterKelas.value;
        tbodyHasil.innerHTML = ''; 
        let filtered = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail);
        if (fv !== 'semua') { filtered = filtered.filter(h => h.kelas === fv); }

        if(filtered.length === 0) { tbodyHasil.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding:20px;">Tidak ada hasil ujian untuk filter ini.</td></tr>`; return; }

        filtered.forEach(h => {
            tbodyHasil.innerHTML += `<tr><td><strong>${h.namaSiswa}</strong></td><td>${h.kelas || '-'}</td><td>${h.mataPelajaran.toUpperCase()}</td><td>${h.benar || 0} / ${h.totalSoal || 0}</td><td><strong style="color: var(--primary); font-size:1.1rem;">${h.nilai || 0}</strong></td>
                <td><button class="btn-detail-hasil btn-secondary btn-3d" data-id="${h.id}" style="padding: 6px 12px; width:auto; font-size:0.8rem;"><i class="fas fa-list"></i></button> <button onclick="hapusDokumen('hasil_ujian', '${h.id}', window.refreshHasilData)" style="background: var(--danger); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;"><i class="fas fa-trash"></i></button></td></tr>`;
        });

        document.querySelectorAll('.btn-detail-hasil').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const data = allHasilUjian.find(item => item.id === e.currentTarget.dataset.id);
                document.getElementById('detail-nama').innerText = `: ${data.namaSiswa}`; document.getElementById('detail-kelas').innerText = `: ${data.kelas || '-'}`; document.getElementById('detail-mapel').innerText = `: ${data.mataPelajaran.toUpperCase()}`; document.getElementById('detail-jml-benar').innerText = data.benar; document.getElementById('detail-total-soal').innerText = data.totalSoal; document.getElementById('detail-nilai').innerText = data.nilai;
                document.getElementById('detail-rincian-benar').innerHTML = data.rincianBenar?.length > 0 ? data.rincianBenar.map(n => `<div style="background:var(--success); color:white; font-weight:bold; width:35px; height:35px; display:flex; align-items:center; justify-content:center; border-radius:6px;">${n}</div>`).join('') : '<small>Kosong</small>';
                const md = document.getElementById('modal-detail-hasil');
                if(md) md.style.display = 'flex';
            });
        });
    }

    document.getElementById('close-modal-detail')?.addEventListener('click', () => {
        const md = document.getElementById('modal-detail-hasil');
        if (md) md.style.display = 'none';
    });
    
    window.refreshHasilData = async () => { 
        await loadDataHasil(); 
        if (currentMapelDetail !== "") {
            const sumV = document.getElementById('hasil-summary-view');
            const detV = document.getElementById('hasil-detail-view');
            if (sumV) sumV.style.display = 'none'; 
            if (detV) detV.style.display = 'block';
            renderHasilTable(); 
        }
        alert("Data hasil ujian berhasil dihapus!");
    };

    // ==========================================
    // TOKEN UJIAN AKTIF (DENGAN WAKTU 15 MENIT)
    // ==========================================
    async function loadActiveTokens() {
        const tbody = document.querySelector('#table-active-tokens tbody'); if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px;">Memuat data...</td></tr>';
        
        try {
            const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian")); tbody.innerHTML = '';
            
            if(tokenSnap.exists()) {
                const data = tokenSnap.data(); let keys = Object.keys(data);
                if (!isAdmin && isGuru) { keys = keys.filter(k => { const parts = k.replace('token_', '').split('_'); const mapel = parts[0] || ''; const kelas = parts[1] || ''; return userMapel.includes(mapel) && userKelas.includes(kelas); }); }
                if(keys.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px; color:var(--text-muted);">Tidak ada token aktif.</td></tr>'; return; }
                
                keys.forEach(key => {
                    const parts = key.replace('token_', '').split('_'); const mapel = parts[0] || '-'; const kelas = parts[1] || '-'; 
                    let tokenVal = ""; let statusBadge = "";
                    
                    if (typeof data[key] === 'object' && data[key] !== null) {
                        tokenVal = data[key].code;
                        let timeLeft = Math.floor((data[key].expiresAt - Date.now()) / 60000);
                        if (timeLeft > 0) { statusBadge = `<br><span style="font-size: 0.7rem; background: var(--success); color: white; padding: 2px 6px; border-radius: 4px;">Sisa: ${timeLeft} Menit</span>`; } 
                        else { statusBadge = `<br><span style="font-size: 0.7rem; background: var(--danger); color: white; padding: 2px 6px; border-radius: 4px;">Kadaluarsa</span>`; }
                    } else { tokenVal = data[key]; }

                    tbody.innerHTML += `<tr><td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${mapel}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${kelas}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color); font-weight:bold; color:var(--primary); letter-spacing: 1px;">${tokenVal} ${statusBadge}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align:center;"><button onclick="window.hapusTokenUtama('${key}')" style="background:var(--danger); color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;" title="Hapus Token"><i class="fas fa-trash"></i></button></td></tr>`;
                });
            } else { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px; color:var(--text-muted);">Tidak ada token aktif.</td></tr>'; }
        } catch(e) {}
    }

    document.getElementById('btn-refresh-token')?.addEventListener('click', loadActiveTokens);

    document.getElementById('btn-save-token')?.addEventListener('click', async () => {
        const mapel = document.getElementById('set-token-mapel').value; const kelas = document.getElementById('set-token-kelas').value; const tokenInput = document.getElementById('input-token-baru').value.trim().toUpperCase();
        if(!mapel || !kelas || !tokenInput) return alert("Isi form dengan lengkap!");
        
        const expTime = Date.now() + (15 * 60 * 1000); 
        const payload = { code: tokenInput, expiresAt: expTime };

        try { 
            const tokenKey = `token_${mapel}_${kelas}`; 
            await updateDoc(doc(db, "pengaturan", "token_ujian"), { [tokenKey]: payload }); 
            alert(`Berhasil! Token diset menjadi: ${tokenInput} (Berlaku 15 Menit)`); document.getElementById('input-token-baru').value = ''; loadActiveTokens(); 
        } catch(error) { 
            try {
                const tokenKey = `token_${mapel}_${kelas}`; await setDoc(doc(db, "pengaturan", "token_ujian"), { [tokenKey]: payload }, { merge: true });
                alert(`Berhasil! Token diset menjadi: ${tokenInput} (Berlaku 15 Menit)`); document.getElementById('input-token-baru').value = ''; loadActiveTokens(); 
            } catch(e) { alert("Gagal set token!"); }
        }
    });

    window.hapusTokenUtama = async function(tokenKey) {
        if(!confirm("Hapus token ini?")) return;
        try { await updateDoc(doc(db, "pengaturan", "token_ujian"), { [tokenKey]: deleteField() }); loadActiveTokens(); } catch(e) { alert("Gagal menghapus token."); }
    };

    window.hapusDokumen = async function(koleksi, id, callback) {
        if(!confirm("Hapus data ini permanen?")) return;
        try { await deleteDoc(doc(db, koleksi, id)); callback(); } catch(err) { alert("Gagal."); }
    };
});
