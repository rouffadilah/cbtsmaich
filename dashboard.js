import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// VARIABEL GLOBAL
let listMapel = [];
let listKelas = [];
let allUsersData = []; 

document.addEventListener('DOMContentLoaded', () => {

    const userRole = localStorage.getItem("userRole");
    // Parse Array Mapel dari Local Storage
    let userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]");

    // 1. CEK AUTENTIKASI DAN ROLE
    onAuthStateChanged(auth, async (user) => {
        if (!user || (userRole !== "admin" && userRole !== "guru")) {
            window.location.href = "index.html"; return;
        }

        document.getElementById('admin-name').innerText = user.displayName || userRole.toUpperCase();
        
        if (userRole === "admin") {
            document.getElementById('panel-title-role').innerText = "PANEL ADMIN";
        } else if (userRole === "guru") {
            document.getElementById('panel-title-role').innerText = "PANEL GURU";
            document.getElementById('menu-pengguna').style.display = 'none';
            document.getElementById('menu-pengaturan').style.display = 'none';
        }

        await loadDataMaster();
        loadDataSoal();
        loadDataHasil();
        if(userRole === "admin") loadDataPengguna();
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        if(confirm('Yakin ingin keluar?')) { await signOut(auth); localStorage.clear(); window.location.href = 'index.html'; }
    });

    // 2. NAVIGASI DASHBOARD
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
    // 3. FITUR DATA MASTER (MAPEL & KELAS)
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
        // UI Checkboxes untuk Admin (Pilih Banyak Mapel)
        const mapelCheckboxes = listMapel.map(m => `
            <label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;">
                <input type="checkbox" class="new-mapel-cb" value="${m}"> ${m}
            </label>
        `).join('');
        const newMapelContainer = document.getElementById('new-mapel-container');
        if(newMapelContainer) newMapelContainer.innerHTML = mapelCheckboxes || '<small>Belum ada master mapel</small>';

        const editMapelContainer = document.getElementById('edit-mapel-container');
        if(editMapelContainer) editMapelContainer.innerHTML = listMapel.map(m => `
            <label style="display:flex; align-items:center; gap:5px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;">
                <input type="checkbox" class="edit-mapel-cb" value="${m}"> ${m}
            </label>
        `).join('');

        // UI Dropdown Guru & Hasil Ujian (Memfilter berdasarkan akses mapel array)
        let allowedMapel = listMapel;
        if (userRole === "guru") {
            allowedMapel = listMapel.filter(m => userMapel.includes(m)); // Guru hanya melihat mapel miliknya
        }

        const optionsMapel = '<option value="" disabled selected>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        const optionsMapelFilter = '<option value="semua">Semua Mata Pelajaran</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        const optionsKelas = '<option value="" disabled selected>-- Pilih Kelas --</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        ['soal-mapel', 'import-mapel', 'set-token-mapel'].forEach(id => {
            const el = document.getElementById(id); if(el) el.innerHTML = optionsMapel;
        });

        const filterHasil = document.getElementById('filter-tabel-hasil');
        if(filterHasil) filterHasil.innerHTML = optionsMapelFilter;

        ['new-kelas', 'edit-kelas'].forEach(id => {
            const el = document.getElementById(id); if(el) el.innerHTML = optionsKelas;
        });
    }

    document.getElementById('btn-add-mapel')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-mapel').value.trim();
        if(!val) return; if(listMapel.includes(val)) return alert("Mapel sudah ada!");
        listMapel.push(val);
        await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true });
        document.getElementById('input-new-mapel').value = ''; loadDataMaster();
    });

    document.getElementById('btn-add-kelas')?.addEventListener('click', async () => {
        const val = document.getElementById('input-new-kelas').value.trim();
        if(!val) return; if(listKelas.includes(val)) return alert("Kelas sudah ada!");
        listKelas.push(val);
        await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true });
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


    // ==========================================
    // 4. MANAJEMEN PENGGUNA (TAMBAH, IMPORT EXCEL, EDIT)
    // ==========================================
    async function loadDataPengguna() {
        const tbody = document.querySelector('#table-siswa tbody');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>`;
        try {
            const snap = await getDocs(collection(db, "users"));
            document.getElementById('stat-siswa').innerText = snap.size;
            tbody.innerHTML = '';
            allUsersData = []; 
            
            snap.forEach(docSnap => {
                const data = docSnap.data();
                data.id = docSnap.id; 
                allUsersData.push(data);

                const roleColor = data.role === 'admin' ? 'var(--danger)' : (data.role === 'guru' ? 'var(--info)' : 'var(--success)');
                
                // Menampilkan Array Mapel dengan rapi
                let detailText = '-';
                if (data.role === 'guru') {
                    const strMapel = Array.isArray(data.mapel) ? data.mapel.join(', ') : (data.mapel || '-');
                    detailText = `Mapel: ${strMapel}`;
                } else if (data.role === 'siswa') {
                    detailText = `Kelas: ${data.kelas || '-'}`;
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td>${data.username}</td>
                        <td><strong>${data.nama}</strong></td>
                        <td><span style="background: ${roleColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight:bold; text-transform:uppercase;">${data.role}</span></td>
                        <td>${detailText}</td>
                        <td style="display: flex; gap: 5px;">
                            <button onclick="window.editPengguna('${docSnap.id}')" class="btn-3d" style="background: var(--warning); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; width:auto;"><i class="fas fa-edit"></i></button>
                            <button onclick="hapusDokumen('users', '${docSnap.id}', window.refreshPengguna)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; width:auto;"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        } catch (error) { console.error(error); }
    }
    window.refreshPengguna = loadDataPengguna;

    // Toggle Dropdown & Checkboxes
    document.getElementById('new-role')?.addEventListener('change', (e) => {
        const role = e.target.value;
        document.getElementById('new-mapel-container').style.display = (role === 'guru') ? 'block' : 'none';
        document.getElementById('new-kelas').style.display = (role === 'siswa') ? 'block' : 'none';
    });

    // A. Tambah Manual 1 Akun (Dengan Multi Mapel)
    document.getElementById('btn-add-user')?.addEventListener('click', async () => {
        const nama = document.getElementById('new-nama').value.trim();
        const username = document.getElementById('new-username').value.trim().replace(/\s+/g, '');
        const role = document.getElementById('new-role').value;
        const pass = document.getElementById('new-pass').value;
        const kelas = document.getElementById('new-kelas').value;

        // Ambil semua mapel yang dicentang
        const selectedMapels = Array.from(document.querySelectorAll('.new-mapel-cb:checked')).map(cb => cb.value);

        if(!nama || !username || !pass) return alert("Lengkapi nama, username, dan password!");
        if(role === 'guru' && selectedMapels.length === 0) return alert("Centang minimal 1 Mapel untuk Guru!");
        if(role === 'siswa' && !kelas) return alert("Pilih Kelas untuk Siswa!");
        if(pass.length < 6) return alert("Password minimal 6 karakter!");

        const btn = document.getElementById('btn-add-user');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses'; btn.disabled = true;

        try {
            const dummyEmail = `${username}@cbt.smaich.id`;
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, pass);
            await updateProfile(userCred.user, { displayName: nama });

            let payload = { nama: nama, username: username, role: role, createdAt: new Date() };
            if (role === 'guru') payload.mapel = selectedMapels; // Simpan sebagai Array
            if (role === 'siswa') payload.kelas = kelas;

            await setDoc(doc(db, "users", userCred.user.uid), payload);
            
            alert(`Berhasil membuat akun ${role.toUpperCase()}`);
            document.getElementById('new-nama').value = ''; document.getElementById('new-username').value = ''; document.getElementById('new-pass').value = '';
            document.querySelectorAll('.new-mapel-cb').forEach(cb => cb.checked = false); // Reset Centang
            loadDataPengguna();
            await secondaryAuth.signOut();
        } catch (error) { console.error(error); alert("Gagal: Username sudah dipakai atau format salah."); }
        btn.innerHTML = '<i class="fas fa-save"></i> Tambah'; btn.disabled = false;
    });

    // B. Import Massal Akun via Excel
    document.getElementById('upload-akun-excel')?.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                const jsonAkun = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                if(jsonAkun.length === 0) return alert("File Excel kosong!");
                if(!confirm(`Ditemukan ${jsonAkun.length} calon akun. Lanjutkan proses Import Massal? \n(Mohon jangan tutup halaman saat proses berjalan)`)) return;

                const labelUpload = document.querySelector('label[for="upload-akun-excel"]');
                const origLabel = labelUpload.innerHTML;
                labelUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sedang Membuat Akun...';

                let successCount = 0;
                let failedCount = 0;

                for (let row of jsonAkun) {
                    const nama = row['Nama Lengkap'];
                    const username = row['Username'] ? row['Username'].toString().replace(/\s+/g, '') : null;
                    const role = row['Role'] ? row['Role'].toString().toLowerCase() : 'siswa';
                    const password = row['Password'] ? row['Password'].toString() : '123456';
                    const detail = row['Detail (Kelas/Mapel)'];

                    if(!nama || !username) { failedCount++; continue; } 

                    try {
                        const dummyEmail = `${username}@cbt.smaich.id`;
                        const userCred = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, password);
                        await updateProfile(userCred.user, { displayName: nama });

                        let payload = { nama: nama, username: username, role: role, createdAt: new Date() };
                        if (role === 'guru' && detail) {
                            // Pecah mapel berdasarkan koma agar tersimpan sebagai Array
                            payload.mapel = detail.split(',').map(s => s.trim());
                        }
                        if (role === 'siswa' && detail) payload.kelas = detail;

                        await setDoc(doc(db, "users", userCred.user.uid), payload);
                        successCount++;
                    } catch (err) {
                        console.error(`Gagal membuat akun ${username}:`, err);
                        failedCount++;
                    }
                }
                
                await secondaryAuth.signOut();
                alert(`Import Selesai!\n✅ Berhasil: ${successCount} Akun\n❌ Gagal/Sudah Ada: ${failedCount} Akun`);
                labelUpload.innerHTML = origLabel;
                document.getElementById('upload-akun-excel').value = '';
                loadDataPengguna();

            } catch (err) { console.error(err); alert("Gagal membaca file Excel. Pastikan menggunakan format Template."); }
        };
        reader.readAsArrayBuffer(file);
    });

    // C. Edit Akun (Role, Nama, Multi-Mapel/Kelas)
    const modalEditAkun = document.getElementById('modal-edit-akun');
    const editRoleSelect = document.getElementById('edit-role');

    window.editPengguna = (uid) => {
        const user = allUsersData.find(u => u.id === uid);
        if(!user) return alert("Data user tidak ditemukan.");

        document.getElementById('edit-uid').value = user.id;
        document.getElementById('edit-nama').value = user.nama;
        editRoleSelect.value = user.role;

        document.getElementById('group-edit-mapel').style.display = (user.role === 'guru') ? 'block' : 'none';
        document.getElementById('group-edit-kelas').style.display = (user.role === 'siswa') ? 'block' : 'none';
        
        if(user.role === 'guru') {
            const mapelArray = Array.isArray(user.mapel) ? user.mapel : [user.mapel];
            document.querySelectorAll('.edit-mapel-cb').forEach(cb => {
                cb.checked = mapelArray.includes(cb.value);
            });
        }
        if(user.role === 'siswa') document.getElementById('edit-kelas').value = user.kelas || "";

        modalEditAkun.style.display = 'flex';
    };

    document.getElementById('close-modal-edit-akun')?.addEventListener('click', () => { modalEditAkun.style.display = 'none'; });

    editRoleSelect?.addEventListener('change', (e) => {
        const role = e.target.value;
        document.getElementById('group-edit-mapel').style.display = (role === 'guru') ? 'block' : 'none';
        document.getElementById('group-edit-kelas').style.display = (role === 'siswa') ? 'block' : 'none';
    });

    document.getElementById('btn-save-edit-akun')?.addEventListener('click', async () => {
        const uid = document.getElementById('edit-uid').value;
        const nama = document.getElementById('edit-nama').value.trim();
        const role = editRoleSelect.value;
        
        let payload = { nama: nama, role: role };
        
        if (role === 'guru') {
            const selectedMapels = Array.from(document.querySelectorAll('.edit-mapel-cb:checked')).map(cb => cb.value);
            payload.mapel = selectedMapels; // Simpan Mapel sebagai Array
            payload.kelas = null; 
        } else if (role === 'siswa') {
            payload.kelas = document.getElementById('edit-kelas').value;
            payload.mapel = null; 
        } else {
            payload.kelas = null; payload.mapel = null; 
        }

        try {
            document.getElementById('btn-save-edit-akun').innerHTML = "Menyimpan...";
            await updateDoc(doc(db, "users", uid), payload);
            alert("Profil Pengguna berhasil diperbarui!");
            modalEditAkun.style.display = 'none';
            document.getElementById('btn-save-edit-akun').innerHTML = '<i class="fas fa-save"></i> SIMPAN PERUBAHAN';
            loadDataPengguna();
        } catch (err) {
            console.error(err); alert("Gagal mengupdate profil.");
            document.getElementById('btn-save-edit-akun').innerHTML = '<i class="fas fa-save"></i> SIMPAN PERUBAHAN';
        }
    });


    // ==========================================
    // 5. LOAD BANK SOAL & HASIL UJIAN
    // ==========================================
    async function loadDataSoal() {
        const tbodySoal = document.querySelector('#table-soal tbody');
        if(!tbodySoal) return;
        tbodySoal.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat bank soal...</td></tr>`;
        try {
            let qSoal = collection(db, "bank_soal");
            if (userRole === "guru") {
                if (userMapel.length === 0) {
                    tbodySoal.innerHTML = `<tr><td colspan="4" style="text-align:center;">Anda belum ditugaskan ke mata pelajaran apapun.</td></tr>`;
                    return;
                }
                // Filter menggunakan "in" untuk membaca array mapel
                qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "in", userMapel));
            }

            const snap = await getDocs(qSoal);
            document.getElementById('stat-soal').innerText = snap.size;
            tbodySoal.innerHTML = snap.empty ? `<tr><td colspan="4" style="text-align:center;">Bank soal kosong.</td></tr>` : '';

            snap.forEach(docSnap => {
                const data = docSnap.data();
                tbodySoal.innerHTML += `<tr>
                    <td><span style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${data.mataPelajaran.toUpperCase()}</span></td>
                    <td><span style="color: var(--primary); font-weight: bold;">${data.tipe}</span></td>
                    <td>${data.teks_soal.substring(0, 50)}...</td>
                    <td><button onclick="hapusDokumen('bank_soal', '${docSnap.id}', window.refreshSoal)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>
                </tr>`;
            });
        } catch(error) { console.error(error); }
    }
    window.refreshSoal = loadDataSoal;

    let allHasilUjian = [];
    async function loadDataHasil() {
        const tbodyHasil = document.querySelector('#table-hasil tbody');
        if(!tbodyHasil) return;
        tbodyHasil.innerHTML = `<tr><td colspan="6" style="text-align:center;">Memuat hasil...</td></tr>`;
        try {
            let qHasil = collection(db, "hasil_ujian");
            if (userRole === "guru") {
                if (userMapel.length === 0) {
                    tbodyHasil.innerHTML = `<tr><td colspan="6" style="text-align:center;">Tidak ada data.</td></tr>`;
                    return;
                }
                qHasil = query(collection(db, "hasil_ujian"), where("mataPelajaran", "in", userMapel));
            }
            
            const snap = await getDocs(qHasil);
            document.getElementById('stat-ujian').innerText = snap.size;
            allHasilUjian = [];
            snap.forEach(docSnap => allHasilUjian.push({ id: docSnap.id, ...docSnap.data() }));
            renderHasilTable(); 
        } catch(error) { console.error(error); }
    }
    window.refreshHasil = loadDataHasil;

    document.getElementById('filter-tabel-hasil')?.addEventListener('change', renderHasilTable);

    function renderHasilTable() {
        const tbodyHasil = document.querySelector('#table-hasil tbody');
        const filterVal = document.getElementById('filter-tabel-hasil').value;
        tbodyHasil.innerHTML = '';
        let filtered = filterVal === 'semua' ? allHasilUjian : allHasilUjian.filter(h => h.mataPelajaran === filterVal);

        if(filtered.length === 0) { tbodyHasil.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">Tidak ada hasil ujian.</td></tr>`; return; }

        filtered.forEach(h => {
            tbodyHasil.innerHTML += `<tr>
                <td><strong>${h.namaSiswa}</strong></td>
                <td>${h.kelas || '-'}</td>
                <td>${h.mataPelajaran.toUpperCase()}</td>
                <td>${h.benar || 0} / ${h.totalSoal || 0}</td>
                <td><strong style="color: var(--primary);">${h.nilai || 0}</strong></td>
                <td>
                    <button class="btn-detail-hasil btn-secondary btn-3d" data-id="${h.id}" style="padding: 6px 12px; width:auto; font-size:0.8rem;"><i class="fas fa-list"></i></button> 
                    <button onclick="hapusDokumen('hasil_ujian', '${h.id}', window.refreshHasil)" style="background: var(--danger); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });

        document.querySelectorAll('.btn-detail-hasil').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const data = allHasilUjian.find(item => item.id === e.currentTarget.dataset.id);
                document.getElementById('detail-nama').innerText = `: ${data.namaSiswa}`;
                document.getElementById('detail-kelas').innerText = `: ${data.kelas || '-'}`;
                document.getElementById('detail-mapel').innerText = `: ${data.mataPelajaran.toUpperCase()}`;
                document.getElementById('detail-jml-benar').innerText = data.benar;
                document.getElementById('detail-total-soal').innerText = data.totalSoal;
                document.getElementById('detail-nilai').innerText = data.nilai;
                document.getElementById('detail-rincian-benar').innerHTML = data.rincianBenar?.length > 0 ? data.rincianBenar.map(n => `<div style="background:var(--success); color:white; font-weight:bold; width:35px; height:35px; display:flex; align-items:center; justify-content:center; border-radius:6px;">${n}</div>`).join('') : '<small>Kosong</small>';
                document.getElementById('modal-detail-hasil').style.display = 'flex';
            });
        });
    }
    document.getElementById('close-modal-detail')?.addEventListener('click', () => document.getElementById('modal-detail-hasil').style.display = 'none');


    // ==========================================
    // 6. SIMPAN SOAL MANUAL & IMPORT EXCEL SOAL
    // ==========================================
    const modalSoal = document.getElementById('modal-tambah-soal');
    const tipeSelect = document.getElementById('soal-tipe');
    
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

    document.getElementById('btn-simpan-soal')?.addEventListener('click', async () => {
        const mapel = document.getElementById('soal-mapel').value;
        const tipe = tipeSelect.value;
        const teks = document.getElementById('soal-teks').value.trim();
        if(!mapel) return alert("Mohon pilih Mapel!");
        if(!teks) return alert("Mohon isi pertanyaan!");

        let payload = { mataPelajaran: mapel, tipe: tipe, teks_soal: teks, createdAt: new Date() };

        if (tipe === 'PG') { payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value }; payload.kunci_jawaban = document.querySelector('input[name="kunci_pg"]:checked').value; } 
        else if (tipe === 'PGK') { payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value }; let kunci = []; document.querySelectorAll('.kunci_pgk:checked').forEach(cb => kunci.push(cb.value)); payload.kunci_jawaban = kunci; } 
        else if (tipe === 'Menjodohkan') { let pasangan = []; document.querySelectorAll('.jodoh-kiri').forEach((el, idx) => { let kanan = document.querySelectorAll('.jodoh-kanan')[idx]; if(el.value) pasangan.push({ premis: el.value, target: kanan.value }); }); payload.pasangan = pasangan; } 
        else if (tipe === 'Isian') { payload.kunci_jawaban = document.getElementById('kunci_isian').value.toLowerCase(); } 
        else if (tipe === 'Uraian') { payload.rubrik = document.getElementById('rubrik_uraian').value; }

        try { await addDoc(collection(db, "bank_soal"), payload); alert("Soal berhasil disimpan!"); modalSoal.style.display = 'none'; loadDataSoal(); } 
        catch (error) { console.error(error); alert("Gagal menyimpan."); }
    });

    document.getElementById('file-excel')?.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const mapel = document.getElementById('import-mapel').value;
        if(!mapel) return alert("Pilih Mapel Terlebih Dahulu!");

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                const jsonSoal = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if(!confirm(`Import ${jsonSoal.length} soal ke mapel ${mapel}?`)) return;

                for (let row of jsonSoal) {
                    const tipe = (row.Tipe || 'PG').toString().toUpperCase();
                    let payload = { mataPelajaran: mapel, tipe: tipe, teks_soal: row.Soal, createdAt: new Date() };

                    if(tipe === 'PG') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = (row.Kunci||"A").toString().toUpperCase(); } 
                    else if (tipe === 'PGK') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = row.Kunci ? row.Kunci.toString().replace(/\s/g, '').toUpperCase().split(',') : []; }
                    else if (tipe === 'MENJODOHKAN') { let pasangan = []; ['OpsiA', 'OpsiB', 'OpsiC', 'OpsiD', 'OpsiE'].forEach(opt => { if(row[opt] && row[opt].includes('=')) { let parts = row[opt].split('='); pasangan.push({ premis: parts[0].trim(), target: parts[1].trim() }); } }); payload.pasangan = pasangan; }
                    else if (tipe === 'ISIAN') { payload.kunci_jawaban = (row.Kunci || "").toString().toLowerCase(); }
                    else if (tipe === 'URAIAN') { payload.rubrik = row['Keterangan/Rubrik'] || row.Rubrik || ""; }

                    await addDoc(collection(db, "bank_soal"), payload); 
                }
                alert(`Import Berhasil!`); modalSoal.style.display = 'none'; loadDataSoal();
            } catch (err) { console.error(err); alert("Gagal membaca file Excel."); }
        };
        reader.readAsArrayBuffer(file);
    });

    // 7. PENGATURAN TOKEN UJIAN & HAPUS DOKUMEN GLOBAL
    document.getElementById('btn-save-token')?.addEventListener('click', async () => {
        const mapel = document.getElementById('set-token-mapel').value;
        const tokenInput = document.getElementById('input-token-baru').value.trim().toUpperCase();
        if(!mapel) return alert("Pilih Mapel dulu!");
        if(!tokenInput) return alert("Token kosong!");
        try { await setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${mapel}`]: tokenInput }, { merge: true }); alert(`Token ${mapel.toUpperCase()} diset menjadi: ${tokenInput}`); document.getElementById('input-token-baru').value = ''; } 
        catch(error) { console.error(error); alert("Gagal set token!"); }
    });

    window.hapusDokumen = async function(koleksi, id, callback) {
        if(!confirm("Hapus data ini permanen?")) return;
        try { await deleteDoc(doc(db, koleksi, id)); callback(); } catch(err) { console.error(err); alert("Gagal."); }
    };
});
