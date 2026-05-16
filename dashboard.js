import { auth, db, storage } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. STATE MANAGEMENT
// ==========================================
const AppState = {
    user: null,
    isAdmin: false,
    isGuru: false,
    userMapel: [],
    userKelas: [],
    listMapel: [],
    listKelas: [],
    allUsersData: [],
    allHasilUjian: [],
    currentMapelDetail: "",
    currentKelasDetail: "",
    editMasterMode: false
};

// ==========================================
// 2. MODAL & GLOBAL UTILITIES
// ==========================================
window.customAlert = (msg, type = 'info', title = '') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-alert');
        if (!modal) { alert(msg); return resolve(); }
        
        const icon = document.getElementById('alert-icon');
        const btnOk = document.getElementById('btn-alert-ok');
        
        let color = 'var(--info)'; let iconClass = 'fas fa-info-circle'; let defaultTitle = 'Informasi';
        if (type === 'success') { color = 'var(--success)'; iconClass = 'fas fa-check-circle'; defaultTitle = 'Berhasil'; }
        else if (type === 'error') { color = 'var(--danger)'; iconClass = 'fas fa-times-circle'; defaultTitle = 'Gagal'; }
        else if (type === 'warning') { color = 'var(--warning)'; iconClass = 'fas fa-exclamation-triangle'; defaultTitle = 'Peringatan'; }
        
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        icon.className = `${iconClass} fa-4x`; icon.style.color = color;
        btnOk.style.backgroundColor = color;
        document.getElementById('alert-title').innerText = title || defaultTitle;
        document.getElementById('alert-message').innerText = msg;
        
        modal.style.display = 'flex';
        btnOk.onclick = () => { modal.style.display = 'none'; resolve(); };
    });
};

window.customConfirm = (msg, type = 'warning', title = 'Konfirmasi', okText = 'Ya, Lanjutkan') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-confirm');
        if (!modal) return resolve(confirm(msg));
        
        let color = type === 'danger' ? 'var(--danger)' : 'var(--warning)';
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        
        const btnOk = document.getElementById('btn-confirm-ok');
        btnOk.style.backgroundColor = color; btnOk.innerText = okText;
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = msg;
        
        modal.style.display = 'flex';
        btnOk.onclick = () => { modal.style.display = 'none'; resolve(true); };
        document.getElementById('btn-confirm-cancel').onclick = () => { modal.style.display = 'none'; resolve(false); };
    });
};

// GLOBAL ACTIONS (Digunakan oleh tombol yang di-render via InnerHTML)
window.AppActions = {
    hapusMasterItem: async (type, val) => {
        if (!(await window.customConfirm(`Hapus ${type} "${val}"?`, "danger"))) return;
        try {
            if (type === 'mapel') {
                AppState.listMapel = AppState.listMapel.filter(item => item !== val);
                await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: AppState.listMapel }, { merge: true });
            } else {
                AppState.listKelas = AppState.listKelas.filter(item => item !== val);
                await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: AppState.listKelas }, { merge: true });
            }
            DataManager.renderTableMaster();
        } catch (e) { window.customAlert("Gagal menghapus data.", "error"); }
    },
    
    bukaDetailSoal: async (mapel, kelas) => {
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
    },

    bukaDetailHasil: (mapel, kelas) => {
        AppState.currentMapelDetail = mapel;
        AppState.currentKelasDetail = kelas;
        document.getElementById('label-mapel-detail').innerText = `HASIL: ${mapel} - KELAS ${kelas}`;
        window.location.hash = 'section-hasil-detail';
        ResultManager.renderDetailHasil();
    },

    hapusHasil: async (id) => {
        if(await customConfirm("Hapus hasil ujian siswa ini?", "danger")) {
            await deleteDoc(doc(db, "hasil_ujian", id));
            await ResultManager.loadDataHasil();
            ResultManager.renderDetailHasil();
        }
    },
    
    editAkun: async (id) => UserManager.openEditModal(id),
    hapusAkun: async (id) => UserManager.deleteUser(id)
};

// ==========================================
// 3. UI & ROUTING MANAGER
// ==========================================
const UIManager = {
    init: function() {
        if (!window.location.hash) window.location.hash = 'section-beranda';
        window.addEventListener('hashchange', this.handleRouting.bind(this));
        this.handleRouting();

        document.addEventListener('click', (e) => {
            const header = e.target.closest('.toggle-accordion');
            if (!header) return;
            const targetId = header.getAttribute('data-target');
            const target = document.getElementById(targetId);
            const icon = header.querySelector('.toggle-icon');
            
            if (target && (target.style.display === 'none' || target.style.display === '')) {
                target.style.display = 'block';
                if(icon) icon.style.transform = 'rotate(180deg)';
            } else if (target) {
                target.style.display = 'none';
                if(icon) icon.style.transform = 'rotate(0deg)';
            }
        });

        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => { if (e.key === 'F12' || (e.ctrlKey && ['c', 'v', 'u', 'i'].includes(e.key.toLowerCase()))) e.preventDefault(); });
    },

    handleRouting: function() {
        let hash = window.location.hash.substring(1) || 'section-beranda';
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

        if (hash === 'section-hasil-detail') {
            if (!AppState.currentMapelDetail) { window.location.hash = 'section-hasil'; return; }
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
            AppState.currentMapelDetail = ""; AppState.currentKelasDetail = "";
        }
    },

    applyRoleRestrictions: function() {
        if (!AppState.isAdmin) {
            document.getElementById('btn-open-data-master')?.setAttribute('style', 'display:none !important');
            document.getElementById('admin-manajemen-pengguna')?.setAttribute('style', 'display:none !important');
            document.getElementById('btn-hapus-semua-hasil')?.setAttribute('style', 'display:none !important');
        }
    }
};

// ==========================================
// 4. DATA MANAGER (Master Data)
// ==========================================
const DataManager = {
    loadDataMaster: async function() {
        try {
            const docSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
            if (docSnap.exists()) { 
                AppState.listMapel = docSnap.data().list_mapel || []; 
                AppState.listKelas = docSnap.data().list_kelas || []; 
            }
            this.renderTableMaster(); 
            this.populateSemuaDropdown(); 
            ExamManager.loadBankSoalSummary();
        } catch (e) { console.error("Gagal load data master", e); }
    },

    renderTableMaster: function() {
        const tbody = document.getElementById('tbody-master-combined');
        if (!tbody) return;

        let maxLen = Math.max(AppState.listMapel.length, AppState.listKelas.length);
        if (maxLen === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;">Belum ada data master.</td></tr>`;
            return;
        }

        let html = '';
        for (let i = 0; i < maxLen; i++) {
            let m = AppState.listMapel[i]; let k = AppState.listKelas[i];
            let delMapel = (m && AppState.editMasterMode) ? `<button onclick="window.AppActions.hapusMasterItem('mapel', '${m}')" style="color:var(--danger); background:none; border:none; cursor:pointer;"><i class="fas fa-times-circle"></i></button>` : '';
            let delKelas = (k && AppState.editMasterMode) ? `<button onclick="window.AppActions.hapusMasterItem('kelas', '${k}')" style="color:var(--danger); background:none; border:none; cursor:pointer;"><i class="fas fa-times-circle"></i></button>` : '';

            html += `<tr>
                <td>${m ? `<div style="display:flex; justify-content:space-between;">${m} ${delMapel}</div>` : '-'}</td>
                <td>${k ? `<div style="display:flex; justify-content:space-between;">${k} ${delKelas}</div>` : '-'}</td>
            </tr>`;
        }
        tbody.innerHTML = html;
    },

    populateSemuaDropdown: function() {
        const buildOptions = (arr) => arr.map(v => `<option value="${v}">${v}</option>`).join('');
        const buildCheckboxes = (arr, cls) => arr.map(v => `<label style="display:flex; gap:8px;"><input type="checkbox" class="${cls}" value="${v}"> ${v}</label>`).join('');

        const cmbKelasSiswa = document.getElementById('edit-kelas-siswa');
        if (cmbKelasSiswa) cmbKelasSiswa.innerHTML = buildOptions(AppState.listKelas);

        const containerMapel = document.getElementById('edit-mapel-container');
        if (containerMapel) containerMapel.innerHTML = buildCheckboxes(AppState.listMapel, 'edit-mapel-cb');

        const containerKelasGuru = document.getElementById('edit-kelas-guru-container');
        if (containerKelasGuru) containerKelasGuru.innerHTML = buildCheckboxes(AppState.listKelas, 'edit-kelas-guru-cb');
    }
};

// ==========================================
// 5. USER MANAGER
// ==========================================
const UserManager = {
    loadUsers: async function() {
        if(!AppState.isAdmin) return; // Hanya admin yang meload tabel
        const tbGuru = document.querySelector('#table-guru tbody');
        const tbSiswa = document.querySelector('#table-siswa tbody');
        
        try {
            const snap = await getDocs(collection(db, "users"));
            AppState.allUsersData = [];
            let htmlGuru = '', htmlSiswa = '', countGuru = 0, countSiswa = 0;

            snap.forEach(d => {
                const data = d.data();
                AppState.allUsersData.push({ id: d.id, ...data });

                let roles = Array.isArray(data.role) ? data.role : [data.role];
                let isSiswa = roles.includes('siswa');
                let isGuru = roles.includes('guru') || roles.includes('admin');
                
                // Cek Admin Protected Row
                let isRowAdmin = roles.includes('admin');
                let actionButtons = isRowAdmin ? 
                    `<span style="color:var(--text-muted); font-size:0.85rem;"><i class="fas fa-shield-alt"></i> Protected</span>` : 
                    `<button onclick="window.AppActions.editAkun('${d.id}')" class="btn-3d" style="background:var(--warning); padding:6px; font-size:0.8rem; margin-right: 4px;"><i class="fas fa-edit"></i></button>
                     <button onclick="window.AppActions.hapusAkun('${d.id}')" class="btn-3d" style="background:var(--danger); padding:6px; font-size:0.8rem;"><i class="fas fa-trash-alt"></i></button>`;

                if (isGuru) {
                    countGuru++;
                    let m = Array.isArray(data.mapel) ? data.mapel.join(', ') : (data.mapel||'-');
                    let k = Array.isArray(data.kelas) ? data.kelas.join(', ') : (data.kelas||'-');
                    htmlGuru += `<tr>
                        <td>${data.username}</td><td>${data.nama}</td>
                        <td><span class="badge" style="background:var(--info); color:white; padding:3px 8px; border-radius:4px;">${roles.join(', ').toUpperCase()}</span></td>
                        <td><span style="font-size:0.8rem"><b>Mapel:</b> ${m}<br><b>Kelas:</b> ${k}</span></td>
                        <td style="text-align:center; white-space: nowrap;">${actionButtons}</td>
                    </tr>`;
                } 
                if (isSiswa) {
                    countSiswa++;
                    htmlSiswa += `<tr>
                        <td>${data.username}</td><td>${data.nama}</td>
                        <td><span class="badge" style="background:var(--success); color:white; padding:3px 8px; border-radius:4px;">SISWA</span></td>
                        <td>${data.kelas || '-'}</td>
                        <td style="text-align:center; white-space: nowrap;">${actionButtons}</td>
                    </tr>`;
                }
            });

            if(tbGuru) tbGuru.innerHTML = htmlGuru || '<tr><td colspan="5" style="text-align:center;">Tidak ada data guru.</td></tr>';
            if(tbSiswa) tbSiswa.innerHTML = htmlSiswa || '<tr><td colspan="5" style="text-align:center;">Tidak ada data siswa.</td></tr>';
            
            document.getElementById('stat-siswa').innerText = countSiswa + countGuru;

        } catch (e) { console.error("Gagal load users:", e); }
    },

    deleteUser: async function(id) {
        if (await window.customConfirm("Hapus akun ini permanen?", "danger")) {
            await deleteDoc(doc(db, "users", id));
            this.loadUsers();
            window.customAlert("Akun berhasil dihapus!", "success");
        }
    },

    openEditModal: function(id) {
        const user = AppState.allUsersData.find(u => u.id === id);
        if (!user) return;
        
        document.getElementById('edit-uid').value = id;
        document.getElementById('edit-nama').value = user.nama || '';
        document.getElementById('edit-username').value = user.username || '';
        document.getElementById('edit-pass').value = '';
        
        document.querySelectorAll('.edit-role-cb').forEach(cb => cb.checked = false);
        let roles = Array.isArray(user.role) ? user.role : [user.role];
        roles.forEach(r => { let cb = document.querySelector(`.edit-role-cb[value="${r}"]`); if(cb) cb.checked = true; });

        document.querySelectorAll('.edit-mapel-cb').forEach(cb => cb.checked = false);
        if(user.mapel) { (Array.isArray(user.mapel) ? user.mapel : [user.mapel]).forEach(m => { let cb = document.querySelector(`.edit-mapel-cb[value="${m}"]`); if(cb) cb.checked = true; }); }
        
        document.querySelectorAll('.edit-kelas-guru-cb').forEach(cb => cb.checked = false);
        if(user.kelas && roles.includes('guru')) { (Array.isArray(user.kelas) ? user.kelas : [user.kelas]).forEach(k => { let cb = document.querySelector(`.edit-kelas-guru-cb[value="${k}"]`); if(cb) cb.checked = true; }); }

        if (roles.includes('siswa')) document.getElementById('edit-kelas-siswa').value = user.kelas || '';

        this.toggleEditGroups();
        document.getElementById('modal-edit-akun').style.display = 'flex';
    },

    toggleEditGroups: function() {
        const isSiswa = document.querySelector('.edit-role-cb[value="siswa"]').checked;
        const isGuru = document.querySelector('.edit-role-cb[value="guru"]').checked;
        document.getElementById('group-edit-kelas-siswa').style.display = isSiswa ? 'block' : 'none';
        document.getElementById('group-edit-guru').style.display = isGuru ? 'flex' : 'none';
    },

    saveEditUser: async function() {
        const uid = document.getElementById('edit-uid').value;
        const name = document.getElementById('edit-nama').value.trim();
        const username = document.getElementById('edit-username').value.trim();
        const pass = document.getElementById('edit-pass').value;

        let roles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(cb => cb.value);
        if(roles.length === 0) return window.customAlert('Pilih minimal satu role!', 'warning');

        let payload = { nama: name, username: username, role: roles };

        if (roles.includes('siswa')) {
            payload.kelas = document.getElementById('edit-kelas-siswa').value;
        }

        if (roles.includes('guru') || roles.includes('admin')) {
            payload.mapel = Array.from(document.querySelectorAll('.edit-mapel-cb:checked')).map(cb => cb.value);
            payload.kelas = Array.from(document.querySelectorAll('.edit-kelas-guru-cb:checked')).map(cb => cb.value);
        }

        const btnSave = document.getElementById('btn-save-edit-akun');
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN...';
        btnSave.disabled = true;

        try {
            await updateDoc(doc(db, "users", uid), payload);
            
            if (pass) {
                 window.customAlert('Profil diperbarui! Catatan: Pengubahan password via dashboard (Client-Side) memerlukan Firebase Admin SDK agar efektif diterapkan ke Autentikasi.', 'warning');
            } else {
                 window.customAlert('Profil berhasil diperbarui!', 'success');
            }
            
            document.getElementById('modal-edit-akun').style.display = 'none';
            this.loadUsers();
        } catch(e) {
            console.error(e);
            window.customAlert('Gagal menyimpan perubahan.', 'error');
        } finally {
            btnSave.innerHTML = '<i class="fas fa-save"></i> SIMPAN';
            btnSave.disabled = false;
        }
    }
};

// ==========================================
// 6. EXAM & RESULTS MANAGER
// ==========================================
const ExamManager = {
    loadBankSoalSummary: async function() {
        const tbody = document.querySelector('#table-bank-soal-summary tbody');
        if(!tbody) return;
        
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            let summary = {};
            let allowedMapel = AppState.isAdmin ? AppState.listMapel : AppState.listMapel.filter(m => AppState.userMapel.includes(m));

            snap.forEach(d => {
                let { mataPelajaran: mapel, kelas } = d.data();
                if (allowedMapel.includes(mapel)) {
                    let key = `${mapel}_${kelas}`;
                    if(!summary[key]) summary[key] = { mapel, kelas, count: 0 };
                    summary[key].count++;
                }
            });

            const waktuSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
            const jadwalSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian"));
            const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
            
            let html = '';
            for (let key in summary) {
                let d = summary[key];
                let jadwal = (jadwalSnap.exists() && jadwalSnap.data()[key]) ? jadwalSnap.data()[key].replace('T', ' ') : '-';
                let durasi = (waktuSnap.exists() && waktuSnap.data()[key]) ? waktuSnap.data()[key] + ' Mnt' : '-';
                let tokenObj = (tokenSnap.exists() && tokenSnap.data()[`token_${key}`]) ? tokenSnap.data()[`token_${key}`] : null;
                let token = tokenObj ? (typeof tokenObj === 'object' ? tokenObj.code : tokenObj) : '-';

                html += `<tr>
                    <td>${d.mapel}</td><td>${d.kelas}</td><td>${jadwal}</td><td>${durasi}</td>
                    <td style="font-weight:bold; color:var(--danger);">${token}</td><td>${d.count}</td>
                    <td style="text-align:center;">
                        <button onclick="window.AppActions.bukaDetailSoal('${d.mapel}', '${d.kelas}')" class="btn-3d" style="background:var(--info); padding:5px 15px; font-size:0.85rem;"><i class="fas fa-cog"></i> Kelola</button>
                    </td>
                </tr>`;
            }

            tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;">Tidak ada data soal.</td></tr>';
            document.getElementById('stat-soal').innerText = snap.size;

        } catch (e) { console.error(e); }
    }
};

const ResultManager = {
    loadDataHasil: async function() {
        try {
            const snap = await getDocs(collection(db, "hasil_ujian"));
            document.getElementById('stat-ujian').innerText = snap.size;
            
            AppState.allHasilUjian = [];
            snap.forEach(d => AppState.allHasilUjian.push({ id: d.id, ...d.data() }));

            const gridMapel = document.getElementById('grid-mapel-hasil');
            let allowedMapel = AppState.isAdmin ? AppState.listMapel : AppState.listMapel.filter(m => AppState.userMapel.includes(m));

            let summaryMapel = {};
            AppState.allHasilUjian.forEach(h => {
                if (allowedMapel.includes(h.mataPelajaran)) {
                    let key = `${h.mataPelajaran} - Kelas ${h.kelas}`;
                    if(!summaryMapel[key]) summaryMapel[key] = { mapel: h.mataPelajaran, kelas: h.kelas, count: 0, totalNilai: 0 };
                    summaryMapel[key].count++;
                    summaryMapel[key].totalNilai += (h.nilai || 0);
                }
            });

            gridMapel.innerHTML = '';
            for (let key in summaryMapel) {
                let s = summaryMapel[key];
                let avg = (s.totalNilai / s.count).toFixed(2);
                gridMapel.innerHTML += `
                    <div class="stat-card" style="cursor:pointer; border: 1px solid var(--border-color);" onclick="window.AppActions.bukaDetailHasil('${s.mapel}', '${s.kelas}')">
                        <div><p style="color:var(--secondary);">${key}</p>
                            <div style="display:flex; gap:15px; margin-top:10px;">
                                <span style="font-size:0.85rem; color:var(--text-muted);"><i class="fas fa-users"></i> ${s.count} Siswa</span>
                                <span style="font-size:0.85rem; color:var(--success);"><i class="fas fa-chart-line"></i> Avg: ${avg}</span>
                            </div>
                        </div><div style="color: var(--success);"><i class="fas fa-folder-open"></i></div>
                    </div>`;
            }
            if(gridMapel.innerHTML === '') gridMapel.innerHTML = '<p style="grid-column: 1 / -1; text-align:center;">Belum ada data hasil ujian.</p>';
        } catch(e) {}
    },

    renderDetailHasil: function() {
        const tbody = document.querySelector('#table-hasil tbody');
        let filteredHasil = AppState.allHasilUjian.filter(h => h.mataPelajaran === AppState.currentMapelDetail && h.kelas === AppState.currentKelasDetail);
        
        if(filteredHasil.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada data.</td></tr>'; return; }

        let html = '';
        filteredHasil.forEach(h => {
            html += `<tr>
                <td>${h.namaSiswa}</td><td>${h.jumlahBenar} / ${h.totalSoal}</td><td style="font-weight:bold; color:var(--success);">${h.nilai}</td>
                <td style="text-align:center;"><button onclick="window.AppActions.hapusHasil('${h.id}')" class="btn-3d" style="background:var(--danger); padding:5px 10px; font-size:0.8rem;"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
};

// ==========================================
// 7. INISIALISASI UTAMA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    UIManager.init();

    // Event Listener untuk Tombol Simpan Edit Profil
    document.getElementById('btn-save-edit-akun')?.addEventListener('click', () => UserManager.saveEditUser());

    // Event Listeners UI Master
    document.getElementById('btn-open-data-master')?.addEventListener('click', () => { document.getElementById('modal-data-master').style.display = 'flex'; AppState.editMasterMode = false; DataManager.renderTableMaster(); });
    document.getElementById('close-modal-data-master')?.addEventListener('click', () => { document.getElementById('modal-data-master').style.display = 'none'; });
    
    document.getElementById('btn-edit-master-mode')?.addEventListener('click', (e) => {
        AppState.editMasterMode = !AppState.editMasterMode;
        e.target.innerHTML = AppState.editMasterMode ? '<i class="fas fa-check"></i> Selesai Edit' : '<i class="fas fa-edit"></i> Mode Edit';
        DataManager.renderTableMaster();
    });

    document.getElementById('btn-add-master')?.addEventListener('click', async () => {
        const type = document.getElementById('input-master-type').value;
        const val = document.getElementById('input-master-name').value.trim(); 
        if (!val) return window.customAlert("Masukkan nama terlebih dahulu!", "warning");
        
        let targetList = type === 'mapel' ? AppState.listMapel : AppState.listKelas;
        if (targetList.includes(val)) return window.customAlert(`${type} sudah ada!`, "warning");
        
        targetList.push(val);
        await setDoc(doc(db, "pengaturan", "data_akademik"), { [`list_${type}`]: targetList }, { merge: true });
        
        document.getElementById('input-master-name').value = ''; 
        DataManager.loadDataMaster();
        window.customAlert("Data berhasil ditambahkan!", "success");
    });

    document.getElementById('btn-back-mapel-list')?.addEventListener('click', () => {
        document.getElementById('view-summary-bank-soal').style.display = 'block';
        document.getElementById('view-soal-list').style.display = 'none';
        ExamManager.loadBankSoalSummary();
    });

    document.getElementById('btn-logout').onclick = async () => { 
        if (await customConfirm("Yakin ingin keluar?", "warning")) { await signOut(auth); localStorage.clear(); window.location.replace("index.html"); } 
    };

    // Firebase Auth State
    onAuthStateChanged(auth, async (user) => {
        if (!user) return window.location.replace("index.html");
        
        try {
            AppState.user = user;
            AppState.isAdmin = (JSON.parse(localStorage.getItem("userRole") || "[]")).includes("admin");
            AppState.isGuru = (JSON.parse(localStorage.getItem("userRole") || "[]")).includes("guru");
            AppState.userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]");
            AppState.userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]");

            if (!AppState.isAdmin && !AppState.isGuru) return window.location.replace("index.html");

            let finalName = user.displayName;
            if (!finalName) { const ud = await getDoc(doc(db, "users", user.uid)); if (ud.exists()) finalName = ud.data().nama; }
            document.getElementById('greeting-text').innerHTML = `Assalamu'alaikum, <span style="display: inline-block;">${finalName || "Pengguna"}! 🙏</span>`;

            UIManager.applyRoleRestrictions();
            DataManager.loadDataMaster(); 
            ResultManager.loadDataHasil(); 
            UserManager.loadUsers(); 

        } catch (e) { console.error(e); }
    });
});
