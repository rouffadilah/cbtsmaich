import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let listMapel = [];
let listKelas = [];
let allUsersData = []; 
let allSoalData = []; 

document.addEventListener('DOMContentLoaded', () => {

    const userRoles = JSON.parse(localStorage.getItem("userRole") || "[]");
    let userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]");
    let userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
    
    const isAdmin = userRoles.includes("admin");
    const isGuru = userRoles.includes("guru");

    onAuthStateChanged(auth, async (user) => {
        if (!user || (!isAdmin && !isGuru)) {
            window.location.href = "index.html"; return;
        }

        document.getElementById('admin-name').innerText = user.displayName || userRoles.join(", ").toUpperCase();
        const greetingText = document.getElementById('greeting-text');
        if(greetingText) greetingText.innerHTML = `Assalamu'alaikum, ${user.displayName}! 👋`;
        
        if (isAdmin) {
            document.getElementById('panel-title-role').innerText = "PANEL ADMIN";
            fetchStatusReg(); 
        } else if (isGuru && !isAdmin) {
            document.getElementById('panel-title-role').innerText = "PANEL GURU";
            document.getElementById('menu-pengguna').style.display = 'none';
            
            const adminRegStatus = document.getElementById('admin-reg-status');
            if(adminRegStatus) adminRegStatus.style.display = 'none';
            
            const adminDataMaster = document.getElementById('admin-data-master');
            if(adminDataMaster) adminDataMaster.style.display = 'none';
            
            const pengaturanTitle = document.getElementById('pengaturan-title');
            if (pengaturanTitle) pengaturanTitle.innerText = "Pengaturan Token Ujian";
            const menuPengaturan = document.getElementById('menu-pengaturan');
            if (menuPengaturan) menuPengaturan.innerHTML = '<i class="fas fa-key"></i> Token Ujian';
        }

        await loadDataMaster();
        loadDataSoal();
        loadDataHasil();
        loadActiveTokens(); 
        if(isAdmin) loadDataPengguna();
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        if(confirm('Yakin ingin keluar?')) { await signOut(auth); localStorage.clear(); window.location.href = 'index.html'; }
    });

    document.querySelectorAll('.stat-clickable').forEach(box => {
        box.addEventListener('click', (e) => {
            const targetId = e.currentTarget.dataset.target; 
            document.querySelectorAll('.option-item').forEach(opt => opt.classList.remove('selected'));
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
            const targetMenu = document.querySelector(`.option-item[data-section="${targetId}"]`);
            const targetSection = document.getElementById(targetId);
            if (targetMenu) targetMenu.classList.add('selected');
            if (targetSection) targetSection.classList.add('active');
        });
    });

    const menuOptions = document.querySelectorAll('.option-item');
    const contentSections = document.querySelectorAll('.content-section');
    menuOptions.forEach(option => {
        option.addEventListener('click', () => {
            menuOptions.forEach(opt => opt.classList.remove('selected'));
            contentSections.forEach(sec => sec.classList.remove('active'));
            option.classList.add('selected');
            document.getElementById(option.dataset.section).classList.add('active');
        });
    });
    
    setInterval(() => { document.getElementById('live-time').innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + " WIB"; }, 1000);

    // ==========================================
    // DATA MASTER
    // ==========================================
    async function loadDataMaster() {
        try {
            const docSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
            if(docSnap.exists()) {
                listMapel = docSnap.data().list_mapel || [];
                listKelas = docSnap.data().list_kelas || [];
            }
            renderTableMaster();
            populateSemuaDropdown();
        } catch(e) { console.error("Gagal load data master", e); }
    }

    function renderTableMaster() {
        const tbodyMapel = document.querySelector('#table-master-mapel tbody');
        if(tbodyMapel) tbodyMapel.innerHTML = listMapel.length === 0 ? `<tr><td style="text-align:center;">Belum ada Mapel</td></tr>` : 
            listMapel.map((m, i) => `<tr><td>${m}</td><td style="text-align:right;"><button onclick="window.hapusMapel(${i})" class="btn-3d" style="background:var(--danger); padding:4px 8px;"><i class="fas fa-trash"></i></button></td></tr>`).join('');

        const tbodyKelas = document.querySelector('#table-master-kelas tbody');
        if(tbodyKelas) tbodyKelas.innerHTML = listKelas.length === 0 ? `<tr><td style="text-align:center;">Belum ada Kelas</td></tr>` : 
            listKelas.map((k, i) => `<tr><td>${k}</td><td style="text-align:right;"><button onclick="window.hapusKelas(${i})" class="btn-3d" style="background:var(--danger); padding:4px 8px;"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    }

    function populateSemuaDropdown() {
        const mapelCheckboxes = listMapel.map(m => `<label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;"><input type="checkbox" class="new-mapel-cb" value="${m}"> ${m}</label>`).join('');
        const kelasCheckboxes = listKelas.map(k => `<label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;"><input type="checkbox" class="new-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');

        if(document.getElementById('new-mapel-container')) document.getElementById('new-mapel-container').innerHTML = mapelCheckboxes || '<small>Kosong</small>';
        if(document.getElementById('new-kelas-guru-container')) document.getElementById('new-kelas-guru-container').innerHTML = kelasCheckboxes || '<small>Kosong</small>';
        
        if(document.getElementById('edit-mapel-container')) document.getElementById('edit-mapel-container').innerHTML = listMapel.map(m => `<label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;"><input type="checkbox" class="edit-mapel-cb" value="${m}"> ${m}</label>`).join('');
        if(document.getElementById('edit-kelas-guru-container')) document.getElementById('edit-kelas-guru-container').innerHTML = listKelas.map(k => `<label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;"><input type="checkbox" class="edit-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');

        let allowedMapel = listMapel;
        let allowedKelas = listKelas;
        if (!isAdmin && isGuru) {
            allowedMapel = listMapel.filter(m => userMapel.includes(m));
            allowedKelas = listKelas.filter(k => userKelas.includes(k));
        }

        const optionsMapel = '<option value="" disabled selected>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        const optionsMapelFilter = '<option value="semua">Semua Mata Pelajaran</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        const optionsKelasSiswa = '<option value="" disabled selected>Pilih Kelas...</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
        const optionsKelasFilter = '<option value="" disabled selected>-- Pilih Kelas --</option>' + allowedKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        ['soal-mapel', 'import-mapel', 'set-token-mapel'].forEach(id => {
            const el = document.getElementById(id); if(el) el.innerHTML = optionsMapel;
        });

        const filterHasil = document.getElementById('filter-tabel-hasil');
        if(filterHasil) filterHasil.innerHTML = optionsMapelFilter;

        ['new-kelas-siswa', 'edit-kelas-siswa'].forEach(id => {
            const el = document.getElementById(id); if(el) el.innerHTML = optionsKelasSiswa;
        });

        // PERBAIKAN: Menambahkan kelas dropdown untuk Manual dan Import Soal
        ['set-token-kelas', 'soal-kelas', 'import-kelas'].forEach(id => {
            const el = document.getElementById(id); if(el) el.innerHTML = optionsKelasFilter;
        });
    }

    document.getElementById('btn-add-mapel')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-mapel').value.trim();
        if(!val) return; if(listMapel.includes(val)) return alert("Mapel sudah ada!");
        listMapel.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true });
        document.getElementById('input-new-mapel').value = ''; loadDataMaster();
    });

    document.getElementById('btn-add-kelas')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-kelas').value.trim();
        if(!val) return; if(listKelas.includes(val)) return alert("Kelas sudah ada!");
        listKelas.push(val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true });
        document.getElementById('input-new-kelas').value = ''; loadDataMaster();
    });

    window.hapusMapel = async (index) => {
        if(!confirm("Hapus Mapel ini?")) return; listMapel.splice(index, 1);
        await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true }); loadDataMaster();
    };

    window.hapusKelas = async (index) => {
        if(!confirm("Hapus Kelas ini?")) return; listKelas.splice(index, 1);
        await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true }); loadDataMaster();
    };

    async function fetchStatusReg() {
        try {
            const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
            if (regSnap.exists()) {
                document.getElementById('status-reg-siswa').value = regSnap.data().siswa_aktif !== false ? "buka" : "tutup";
                document.getElementById('status-reg-guru').value = regSnap.data().guru_aktif !== false ? "buka" : "tutup";
            } else {
                document.getElementById('status-reg-siswa').value = "buka";
                document.getElementById('status-reg-guru').value = "buka";
            }
        } catch (e) {}
    }

    document.getElementById('btn-save-reg-status')?.addEventListener('click', async () => {
        const statusSiswa = document.getElementById('status-reg-siswa').value === "buka";
        const statusGuru = document.getElementById('status-reg-guru').value === "buka";
        const btn = document.getElementById('btn-save-reg-status'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        try {
            await setDoc(doc(db, "pengaturan", "status_registrasi"), { siswa_aktif: statusSiswa, guru_aktif: statusGuru }, { merge: true });
            alert("Status pendaftaran berhasil diperbarui!");
        } catch (error) { alert("Gagal memperbarui."); }
        btn.innerHTML = '<i class="fas fa-save"></i> Simpan Status';
    });


    // ==========================================
    // MANAJEMEN PENGGUNA DENGAN MULTI-ROLE
    // ==========================================
    async function loadDataPengguna() {
        const tbody = document.querySelector('#table-siswa tbody');
        if(!tbody) return;
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>`;
        try {
            const snap = await getDocs(collection(db, "users"));
            document.getElementById('stat-siswa').innerText = snap.size;
            tbody.innerHTML = ''; allUsersData = []; 
            
            snap.forEach(docSnap => {
                const data = docSnap.data(); data.id = docSnap.id; allUsersData.push(data);
                
                const rls = Array.isArray(data.role) ? data.role : [data.role];
                const roleText = rls.join(', ').toUpperCase();
                const roleColor = rls.includes('admin') ? 'var(--danger)' : (rls.includes('guru') ? 'var(--info)' : 'var(--success)');
                
                let detailText = '-';
                if (rls.includes('guru')) {
                    const mapels = Array.isArray(data.mapel) ? data.mapel.join(', ') : (data.mapel || '-');
                    const kelases = Array.isArray(data.kelas) ? data.kelas.join(', ') : (data.kelas || '-');
                    detailText = `Mapel: ${mapels} <br><span style="font-size:0.75rem; color:var(--text-muted);">Kelas Ajar: ${kelases}</span>`;
                }
                else if (rls.includes('siswa')) detailText = `Kelas: ${data.kelas || '-'}`;
                
                tbody.innerHTML += `<tr>
                    <td>${data.username}</td><td><strong>${data.nama}</strong></td>
                    <td><span style="background: ${roleColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${roleText}</span></td>
                    <td>${detailText}</td>
                    <td style="display: flex; gap: 5px;">
                        <button onclick="window.editPengguna('${docSnap.id}')" class="btn-3d" style="background: var(--warning); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; width:auto;"><i class="fas fa-edit"></i></button>
                        <button onclick="hapusDokumen('users', '${docSnap.id}', window.refreshPengguna)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; width:auto;"><i class="fas fa-trash"></i></button>
                    </td></tr>`;
            });
        } catch (error) { console.error(error); }
    }
    window.refreshPengguna = loadDataPengguna;

    function updateNewFormVisibility() {
        const checkedRoles = Array.from(document.querySelectorAll('.new-role-cb:checked')).map(cb => cb.value);
        document.getElementById('group-new-mapel').style.display = checkedRoles.includes('guru') ? 'block' : 'none';
        document.getElementById('group-new-kelas-guru').style.display = checkedRoles.includes('guru') ? 'block' : 'none';
        document.getElementById('group-new-kelas-siswa').style.display = checkedRoles.includes('siswa') ? 'block' : 'none';
    }
    document.querySelectorAll('.new-role-cb').forEach(cb => cb.addEventListener('change', updateNewFormVisibility));

    document.getElementById('btn-add-user')?.addEventListener('click', async () => {
        const nama = document.getElementById('new-nama').value.trim();
        const username = document.getElementById('new-username').value.trim().replace(/\s+/g, '');
        const pass = document.getElementById('new-pass').value;
        
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
            if (selectedRoles.includes('siswa')) {
                if(!selectedRoles.includes('guru')) payload.kelas = kelasSiswa; 
                else payload.kelas_siswa = kelasSiswa;
            }

            await setDoc(doc(db, "users", userCred.user.uid), payload);
            alert(`Berhasil membuat akun!`);
            
            document.getElementById('new-nama').value = ''; document.getElementById('new-username').value = ''; document.getElementById('new-pass').value = '';
            document.querySelectorAll('.new-role-cb, .new-mapel-cb, .new-kelas-guru-cb').forEach(cb => cb.checked = false); 
            document.getElementById('new-kelas-siswa').value = ''; updateNewFormVisibility();
            
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

                const labelUpload = document.querySelector('label[for="upload-akun-excel"]');
                const origLabel = labelUpload.innerHTML; labelUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat...';
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
                            const detailMapel = row['Detail (Mapel)'];
                            const detailKelas = row['Detail (Kelas)'];
                            if(detailMapel) payload.mapel = detailMapel.split(',').map(s => s.trim());
                            if(detailKelas) payload.kelas = detailKelas.split(',').map(s => s.trim());
                        }
                        if (roleArr.includes('siswa')) {
                            const ks = row['Detail (Kelas)'] || row['Detail (Mapel)'];
                            if(!roleArr.includes('guru')) payload.kelas = ks;
                            else payload.kelas_siswa = ks;
                        }

                        await setDoc(doc(db, "users", userCred.user.uid), payload); successCount++;
                    } catch (err) { failedCount++; }
                }
                
                await secondaryAuth.signOut(); alert(`Selesai!\n✅ Sukses: ${successCount}\n❌ Gagal: ${failedCount}`);
                labelUpload.innerHTML = origLabel; document.getElementById('upload-akun-excel').value = ''; loadDataPengguna();
            } catch (err) { alert("Gagal membaca file Excel."); }
        };
        reader.readAsArrayBuffer(file);
    });

    const modalEditAkun = document.getElementById('modal-edit-akun');
    
    function updateEditFormVisibility() {
        const checkedRoles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(cb => cb.value);
        document.getElementById('group-edit-guru').style.display = checkedRoles.includes('guru') ? 'flex' : 'none';
        document.getElementById('group-edit-kelas-siswa').style.display = checkedRoles.includes('siswa') ? 'block' : 'none';
    }
    document.querySelectorAll('.edit-role-cb').forEach(cb => cb.addEventListener('change', updateEditFormVisibility));

    window.editPengguna = (uid) => {
        const user = allUsersData.find(u => u.id === uid); if(!user) return;
        document.getElementById('edit-uid').value = user.id; 
        document.getElementById('edit-nama').value = user.nama; 
        
        const rls = Array.isArray(user.role) ? user.role : [user.role];
        document.querySelectorAll('.edit-role-cb').forEach(cb => { cb.checked = rls.includes(cb.value); });
        
        updateEditFormVisibility();
        
        if(rls.includes('guru')) {
            const mapelArray = Array.isArray(user.mapel) ? user.mapel : [user.mapel];
            const kelasArray = Array.isArray(user.kelas) ? user.kelas : [user.kelas];
            document.querySelectorAll('.edit-mapel-cb').forEach(cb => { cb.checked = mapelArray.includes(cb.value); });
            document.querySelectorAll('.edit-kelas-guru-cb').forEach(cb => { cb.checked = kelasArray.includes(cb.value); });
        }
        if(rls.includes('siswa')) {
            document.getElementById('edit-kelas-siswa').value = user.kelas_siswa || user.kelas || "";
        }
        modalEditAkun.style.display = 'flex';
    };

    document.getElementById('close-modal-edit-akun')?.addEventListener('click', () => { modalEditAkun.style.display = 'none'; });

    document.getElementById('btn-save-edit-akun')?.addEventListener('click', async () => {
        const uid = document.getElementById('edit-uid').value;
        const nama = document.getElementById('edit-nama').value.trim();
        const selectedRoles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(cb => cb.value);
        
        if(selectedRoles.length === 0) return alert("Pilih minimal 1 Role!");
        let payload = { nama: nama, role: selectedRoles };
        
        if (selectedRoles.includes('guru')) { 
            payload.mapel = Array.from(document.querySelectorAll('.edit-mapel-cb:checked')).map(cb => cb.value); 
            payload.kelas = Array.from(document.querySelectorAll('.edit-kelas-guru-cb:checked')).map(cb => cb.value); 
        } 
        if (selectedRoles.includes('siswa')) { 
            const ks = document.getElementById('edit-kelas-siswa').value;
            if(!selectedRoles.includes('guru')) payload.kelas = ks;
            else payload.kelas_siswa = ks;
        }

        try {
            document.getElementById('btn-save-edit-akun').innerHTML = "Menyimpan...";
            await updateDoc(doc(db, "users", uid), payload); alert("Profil diperbarui!");
            modalEditAkun.style.display = 'none'; document.getElementById('btn-save-edit-akun').innerHTML = '<i class="fas fa-save"></i> SIMPAN PERUBAHAN'; loadDataPengguna();
        } catch (err) { alert("Gagal."); document.getElementById('btn-save-edit-akun').innerHTML = '<i class="fas fa-save"></i> SIMPAN PERUBAHAN'; }
    });

    // ==========================================
    // BANK SOAL & PREVIEW POV SISWA
    // ==========================================
    async function loadDataSoal() {
        const tbodySoal = document.querySelector('#table-soal tbody'); if(!tbodySoal) return;
        tbodySoal.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat bank soal...</td></tr>`;
        try {
            let qSoal = collection(db, "bank_soal");
            if (!isAdmin && isGuru) {
                if (userMapel.length === 0) { tbodySoal.innerHTML = `<tr><td colspan="5" style="text-align:center;">Anda belum ditugaskan ke mapel apapun.</td></tr>`; return; }
                qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "in", userMapel));
            }
            const snap = await getDocs(qSoal); document.getElementById('stat-soal').innerText = snap.size;
            tbodySoal.innerHTML = snap.empty ? `<tr><td colspan="5" style="text-align:center;">Bank soal kosong.</td></tr>` : '';
            
            allSoalData = [];
            snap.forEach(docSnap => {
                const data = docSnap.data();
                data.id = docSnap.id;
                allSoalData.push(data);
                
                // PERBAIKAN: Menampilkan Kelas di Tabel
                tbodySoal.innerHTML += `<tr>
                    <td><span style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${data.mataPelajaran.toUpperCase()}</span></td>
                    <td><span style="color: var(--secondary); font-weight: bold; font-size: 0.85rem;">${data.kelas || '-'}</span></td>
                    <td><span style="color: var(--primary); font-weight: bold;">${data.tipe}</span></td>
                    <td>${data.teks_soal.substring(0, 50)}...</td>
                    <td style="display:flex; gap:5px;">
                        <button onclick="window.previewSoal('${docSnap.id}')" style="background: var(--info); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" title="Preview POV Siswa"><i class="fas fa-eye"></i></button>
                        <button onclick="hapusDokumen('bank_soal', '${docSnap.id}', window.refreshSoal)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            });
        } catch(error) { console.error(error); }
    }
    window.refreshSoal = loadDataSoal;

    window.previewSoal = (id) => {
        const q = allSoalData.find(s => s.id === id);
        if(!q) return alert("Gagal memuat soal untuk preview.");
        
        document.getElementById('preview-badge').innerText = q.tipe || 'PG';
        let html = `<div style="font-size: 1.1rem; margin-bottom: 20px; color: var(--secondary); font-weight:500;">${q.teks_soal}</div>`;

        if(q.tipe === 'PG' || q.tipe === 'PGK' || !q.tipe) {
            const labels = ['A','B','C','D','E'];
            html += `<div style="display:flex; flex-direction:column; gap:10px;">`;
            labels.forEach(lbl => {
                if(q.opsi && q.opsi[lbl]) {
                    let isKunci = false;
                    if(q.tipe === 'PGK') isKunci = (Array.isArray(q.kunci_jawaban) && q.kunci_jawaban.includes(lbl));
                    else isKunci = (q.kunci_jawaban === lbl);

                    let bg = isKunci ? 'background:#d1fae5; border-color:#10b981;' : 'background:#f8fafc; border-color:#e2e8f0;';
                    let type = q.tipe === 'PGK' ? 'checkbox' : 'radio';
                    html += `<label style="display:flex; padding:15px; border:1.5px solid; border-radius:8px; ${bg}">
                        <input type="${type}" disabled ${isKunci?'checked':''} style="margin-right:15px; transform: scale(1.2);">
                        <span style="font-weight:bold; margin-right:10px;">${lbl}.</span>
                        <span>${q.opsi[lbl]}</span>
                    </label>`;
                }
            });
            html += `</div>`;
        } else if (q.tipe === 'Menjodohkan') {
            html += `<div style="display:flex; flex-direction:column; gap:10px;">`;
            if(q.pasangan) {
                q.pasangan.forEach(p => {
                    html += `<div style="display:flex; gap:10px; align-items:center; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="flex:1;">${p.premis}</div>
                        <i class="fas fa-arrow-right" style="color:#94a3b8;"></i>
                        <div style="flex:1; font-weight:bold; color:var(--primary);">${p.target}</div>
                    </div>`;
                });
            }
            html += `</div>`;
        } else if (q.tipe === 'Isian') {
            html += `<input type="text" class="input-text" value="${q.kunci_jawaban}" disabled style="background:#d1fae5; color:#059669; font-weight:bold; padding:15px;">
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:5px;">*Warna hijau adalah kunci jawaban.</p>`;
        } else if (q.tipe === 'Uraian') {
            html += `<textarea class="input-text" rows="4" disabled placeholder="Siswa akan menjawab uraian di sini..." style="padding:15px;"></textarea>
            <div style="margin-top:15px; padding:15px; background:#fffbeb; border:1px solid var(--warning); border-radius:8px;">
                <strong style="color:var(--warning);"><i class="fas fa-info-circle"></i> Rubrik Penilaian:</strong> <br>${q.rubrik || '-'}
            </div>`;
        }

        document.getElementById('preview-content').innerHTML = html;
        document.getElementById('modal-preview-soal').style.display = 'flex';
    };

    document.getElementById('close-modal-preview')?.addEventListener('click', () => {
        document.getElementById('modal-preview-soal').style.display = 'none';
    });

    let allHasilUjian = [];
    async function loadDataHasil() {
        const tbodyHasil = document.querySelector('#table-hasil tbody'); if(!tbodyHasil) return;
        tbodyHasil.innerHTML = `<tr><td colspan="6" style="text-align:center;">Memuat hasil...</td></tr>`;
        try {
            let qHasil = collection(db, "hasil_ujian");
            if (!isAdmin && isGuru) {
                if (userMapel.length === 0) { tbodyHasil.innerHTML = `<tr><td colspan="6" style="text-align:center;">Tidak ada data.</td></tr>`; return; }
                qHasil = query(collection(db, "hasil_ujian"), where("mataPelajaran", "in", userMapel));
            }
            const snap = await getDocs(qHasil); document.getElementById('stat-ujian').innerText = snap.size;
            allHasilUjian = []; snap.forEach(docSnap => allHasilUjian.push({ id: docSnap.id, ...docSnap.data() }));
            renderHasilTable(); 
        } catch(error) { console.error(error); }
    }
    window.refreshHasil = loadDataHasil;

    document.getElementById('filter-tabel-hasil')?.addEventListener('change', renderHasilTable);

    function renderHasilTable() {
        const tbodyHasil = document.querySelector('#table-hasil tbody'); const filterVal = document.getElementById('filter-tabel-hasil').value;
        tbodyHasil.innerHTML = ''; 
        
        let filtered = filterVal === 'semua' ? allHasilUjian : allHasilUjian.filter(h => h.mataPelajaran === filterVal);
        
        if (!isAdmin && isGuru && userKelas.length > 0) {
            filtered = filtered.filter(h => userKelas.includes(h.kelas));
        }

        if(filtered.length === 0) { tbodyHasil.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">Tidak ada hasil ujian.</td></tr>`; return; }

        filtered.forEach(h => {
            tbodyHasil.innerHTML += `<tr><td><strong>${h.namaSiswa}</strong></td><td>${h.kelas || '-'}</td><td>${h.mataPelajaran.toUpperCase()}</td><td>${h.benar || 0} / ${h.totalSoal || 0}</td><td><strong style="color: var(--primary);">${h.nilai || 0}</strong></td><td><button class="btn-detail-hasil btn-secondary btn-3d" data-id="${h.id}" style="padding: 6px 12px; width:auto; font-size:0.8rem;"><i class="fas fa-list"></i></button> <button onclick="hapusDokumen('hasil_ujian', '${h.id}', window.refreshHasil)" style="background: var(--danger); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;"><i class="fas fa-trash"></i></button></td></tr>`;
        });
        document.querySelectorAll('.btn-detail-hasil').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const data = allHasilUjian.find(item => item.id === e.currentTarget.dataset.id);
                document.getElementById('detail-nama').innerText = `: ${data.namaSiswa}`; document.getElementById('detail-kelas').innerText = `: ${data.kelas || '-'}`; document.getElementById('detail-mapel').innerText = `: ${data.mataPelajaran.toUpperCase()}`; document.getElementById('detail-jml-benar').innerText = data.benar; document.getElementById('detail-total-soal').innerText = data.totalSoal; document.getElementById('detail-nilai').innerText = data.nilai;
                document.getElementById('detail-rincian-benar').innerHTML = data.rincianBenar?.length > 0 ? data.rincianBenar.map(n => `<div style="background:var(--success); color:white; font-weight:bold; width:35px; height:35px; display:flex; align-items:center; justify-content:center; border-radius:6px;">${n}</div>`).join('') : '<small>Kosong</small>';
                document.getElementById('modal-detail-hasil').style.display = 'flex';
            });
        });
    }
    document.getElementById('close-modal-detail')?.addEventListener('click', () => document.getElementById('modal-detail-hasil').style.display = 'none');

    // ==========================================
    // SIMPAN SOAL MANUAL & IMPORT EXCEL SOAL
    // ==========================================
    const modalSoal = document.getElementById('modal-tambah-soal'); const tipeSelect = document.getElementById('soal-tipe');
    document.getElementById('btn-tambah-manual')?.addEventListener('click', () => { modalSoal.style.display = 'flex'; renderFormDinamis('PG'); });
    document.getElementById('close-modal-soal')?.addEventListener('click', () => modalSoal.style.display = 'none');
    document.getElementById('tab-manual')?.addEventListener('click', () => { document.getElementById('area-manual').style.display = 'block'; document.getElementById('area-import').style.display = 'none'; });
    document.getElementById('tab-import')?.addEventListener('click', () => { document.getElementById('area-manual').style.display = 'none'; document.getElementById('area-import').style.display = 'block'; });
    tipeSelect?.addEventListener('change', (e) => renderFormDinamis(e.target.value));

    function renderFormDinamis(tipe) {
        const areaOpsi = document.getElementById('area-opsi-dinamis'); areaOpsi.innerHTML = ''; 
        if (tipe === 'PG') areaOpsi.innerHTML = `${['A','B','C','D','E'].map(opt => `<div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;"><input type="radio" name="kunci_pg" value="${opt}" ${opt==='A'?'checked':''}><label style="font-weight: bold; width: 20px;">${opt}</label><input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="padding: 8px;"></div>`).join('')}`;
        else if (tipe === 'PGK') areaOpsi.innerHTML = `${['A','B','C','D','E'].map(opt => `<div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;"><input type="checkbox" class="kunci_pgk" value="${opt}"><label style="font-weight: bold; width: 20px;">${opt}</label><input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="padding: 8px;"></div>`).join('')}`;
        else if (tipe === 'Menjodohkan') areaOpsi.innerHTML = `<div id="container-jodoh">${[1,2,3].map(num => `<div style="display: flex; gap: 10px; margin-bottom: 8px;"><input type="text" class="jodoh-kiri input-text" placeholder="Pernyataan ${num}" style="padding: 8px;"><input type="text" class="jodoh-kanan input-text" placeholder="Jawaban ${num}" style="padding: 8px;"></div>`).join('')}</div>`;
        else if (tipe === 'Isian') areaOpsi.innerHTML = `<label>Kunci Jawaban</label><input type="text" id="kunci_isian" class="input-text" placeholder="Masukkan jawaban singkat">`;
        else if (tipe === 'Uraian') areaOpsi.innerHTML = `<label>Panduan Penilaian</label><textarea id="rubrik_uraian" class="input-text" rows="2" placeholder="Poin utama penilaian..."></textarea>`;
    }

    // PERBAIKAN: Input & Kirim `kelas` saat menyimpan soal manual
    document.getElementById('btn-simpan-soal')?.addEventListener('click', async () => {
        const mapel = document.getElementById('soal-mapel').value; 
        const kelas = document.getElementById('soal-kelas').value;
        const tipe = tipeSelect.value; 
        const teks = document.getElementById('soal-teks').value.trim();
        
        if(!mapel || !kelas || !teks) return alert("Pilih Mapel, Kelas & Isi Pertanyaan!");
        
        let payload = { mataPelajaran: mapel, kelas: kelas, tipe: tipe, teks_soal: teks, createdAt: new Date() };

        if (tipe === 'PG') { payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value }; payload.kunci_jawaban = document.querySelector('input[name="kunci_pg"]:checked').value; } 
        else if (tipe === 'PGK') { payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value }; let kunci = []; document.querySelectorAll('.kunci_pgk:checked').forEach(cb => kunci.push(cb.value)); payload.kunci_jawaban = kunci; } 
        else if (tipe === 'Menjodohkan') { let pasangan = []; document.querySelectorAll('.jodoh-kiri').forEach((el, idx) => { let kanan = document.querySelectorAll('.jodoh-kanan')[idx]; if(el.value) pasangan.push({ premis: el.value, target: kanan.value }); }); payload.pasangan = pasangan; } 
        else if (tipe === 'Isian') { payload.kunci_jawaban = document.getElementById('kunci_isian').value.toLowerCase(); } 
        else if (tipe === 'Uraian') { payload.rubrik = document.getElementById('rubrik_uraian').value; }

        try { await addDoc(collection(db, "bank_soal"), payload); alert("Soal tersimpan!"); modalSoal.style.display = 'none'; loadDataSoal(); } catch (error) { alert("Gagal menyimpan."); }
    });

    let selectedExcelSoal = null;
    
    document.getElementById('file-excel')?.addEventListener('change', (e) => {
        selectedExcelSoal = e.target.files[0];
        const label = document.getElementById('label-file-excel');
        if(selectedExcelSoal) {
            label.innerHTML = `<i class="fas fa-check"></i> ${selectedExcelSoal.name}`;
            label.style.background = "var(--secondary)";
        } else {
            label.innerHTML = `<i class="fas fa-search"></i> Pilih File`;
            label.style.background = "var(--success)";
        }
    });

    // PERBAIKAN: Input & Kirim `kelas` saat memproses import excel
    document.getElementById('btn-proses-import-soal')?.addEventListener('click', () => {
        if (!selectedExcelSoal) return alert("Pilih file Excel terlebih dahulu!");
        const mapel = document.getElementById('import-mapel').value;
        const kelas = document.getElementById('import-kelas').value;
        if(!mapel || !kelas) return alert("Pilih Mapel dan Kelas Terlebih Dahulu!");

        const btn = document.getElementById('btn-proses-import-soal');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                const jsonSoal = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if(!confirm(`Import ${jsonSoal.length} soal ke mapel ${mapel} kelas ${kelas}?`)) {
                    btn.innerHTML = origText; btn.disabled = false; return;
                }

                for (let row of jsonSoal) {
                    const tipe = (row.Tipe || 'PG').toString().toUpperCase();
                    let payload = { mataPelajaran: mapel, kelas: kelas, tipe: tipe, teks_soal: row.Soal, createdAt: new Date() };

                    if(tipe === 'PG') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = (row.Kunci||"A").toString().toUpperCase(); } 
                    else if (tipe === 'PGK') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = row.Kunci ? row.Kunci.toString().replace(/\s/g, '').toUpperCase().split(',') : []; }
                    else if (tipe === 'MENJODOHKAN') { let pasangan = []; ['OpsiA', 'OpsiB', 'OpsiC', 'OpsiD', 'OpsiE'].forEach(opt => { if(row[opt] && row[opt].includes('=')) { let parts = row[opt].split('='); pasangan.push({ premis: parts[0].trim(), target: parts[1].trim() }); } }); payload.pasangan = pasangan; }
                    else if (tipe === 'ISIAN') { payload.kunci_jawaban = (row.Kunci || "").toString().toLowerCase(); }
                    else if (tipe === 'URAIAN') { payload.rubrik = row['Keterangan/Rubrik'] || row.Rubrik || ""; }

                    await addDoc(collection(db, "bank_soal"), payload); 
                }
                alert(`Import Berhasil!`); 
                modalSoal.style.display = 'none'; 
                loadDataSoal();
                
                selectedExcelSoal = null;
                document.getElementById('label-file-excel').innerHTML = `<i class="fas fa-search"></i> Pilih File`;
                document.getElementById('label-file-excel').style.background = "var(--success)";
                document.getElementById('file-excel').value = '';
                
            } catch (err) { alert("Gagal membaca file Excel."); }
            btn.innerHTML = origText; btn.disabled = false;
        };
        reader.readAsArrayBuffer(selectedExcelSoal);
    });

    // ==========================================
    // TABEL DAFTAR TOKEN AKTIF
    // ==========================================
    async function loadActiveTokens() {
        const tbody = document.querySelector('#table-active-tokens tbody');
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px;">Memuat data...</td></tr>';
        
        try {
            const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
            tbody.innerHTML = '';
            
            if(tokenSnap.exists()) {
                const data = tokenSnap.data();
                
                let keys = Object.keys(data);
                if (!isAdmin && isGuru) {
                    keys = keys.filter(k => {
                        const parts = k.replace('token_', '').split('_');
                        const mapel = parts[0] || '';
                        const kelas = parts[1] || '';
                        return userMapel.includes(mapel) && userKelas.includes(kelas);
                    });
                }

                if(keys.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px; color:var(--text-muted);">Tidak ada token aktif.</td></tr>';
                    return;
                }
                
                keys.forEach(key => {
                    const parts = key.replace('token_', '').split('_');
                    const mapel = parts[0] || '-';
                    const kelas = parts[1] || '-';
                    const tokenVal = data[key];
                    
                    tbody.innerHTML += `
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${mapel}</td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${kelas}</td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); font-weight:bold; color:var(--primary); letter-spacing: 1px;">${tokenVal}</td>
                            <td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align:center;">
                                <button onclick="window.hapusTokenUtama('${key}')" style="background:var(--danger); color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;" title="Hapus Token"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px; color:var(--text-muted);">Tidak ada token aktif.</td></tr>';
            }
        } catch(e) { console.error("Error loading tokens", e); }
    }

    document.getElementById('btn-refresh-token')?.addEventListener('click', loadActiveTokens);

    document.getElementById('btn-save-token')?.addEventListener('click', async () => {
        const mapel = document.getElementById('set-token-mapel').value;
        const kelas = document.getElementById('set-token-kelas').value;
        const tokenInput = document.getElementById('input-token-baru').value.trim().toUpperCase();
        
        if(!mapel) return alert("Pilih Mapel dulu!");
        if(!kelas) return alert("Pilih Kelas dulu!");
        if(!tokenInput) return alert("Token kosong!");
        
        try { 
            const tokenKey = `token_${mapel}_${kelas}`;
            await updateDoc(doc(db, "pengaturan", "token_ujian"), { [tokenKey]: tokenInput }); 
            alert(`Berhasil! Token diset menjadi: ${tokenInput}`); document.getElementById('input-token-baru').value = ''; loadActiveTokens(); 
        } 
        catch(error) { 
            try {
                const tokenKey = `token_${mapel}_${kelas}`;
                await setDoc(doc(db, "pengaturan", "token_ujian"), { [tokenKey]: tokenInput }, { merge: true });
                alert(`Berhasil! Token diset menjadi: ${tokenInput}`); document.getElementById('input-token-baru').value = ''; loadActiveTokens(); 
            } catch(e) { console.error(e); alert("Gagal set token!"); }
        }
    });

    window.hapusTokenUtama = async function(tokenKey) {
        if(!confirm("Hapus token ini? Siswa tidak akan bisa masuk ujian untuk mapel & kelas terkait.")) return;
        try { await updateDoc(doc(db, "pengaturan", "token_ujian"), { [tokenKey]: deleteField() }); loadActiveTokens(); } 
        catch(e) { alert("Gagal menghapus token."); }
    };

    window.hapusDokumen = async function(koleksi, id, callback) {
        if(!confirm("Hapus data ini permanen?")) return;
        try { await deleteDoc(doc(db, koleksi, id)); callback(); } catch(err) { console.error(err); alert("Gagal."); }
    };
});
