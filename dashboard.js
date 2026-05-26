import { auth, db, storage, functions } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ==========================================
// 1. VARIABEL GLOBAL
// ==========================================
let listMapel = []; 
let listKelas = []; 
let allUsersData = []; 
let allHasilUjian = []; 
let currentMapelDetail = ""; 
let currentKelasDetail = "";
let isAdmin = false; 
let isGuru = false; 
let userMapel = []; 
let userKelas = [];

// ==========================================
// 2. MODAL CUSTOM & NOTIFIKASI
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
// 3. INISIALISASI HALAMAN (DOM) & AUTENTIKASI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // Manajemen Hash (URL)
    if (!window.location.hash) { window.location.hash = 'section-beranda'; }
    window.addEventListener('popstate', function() {
        if (!window.location.hash || window.location.hash === '') { window.location.hash = 'section-beranda'; }
    });

    // Filter Dropdown Cepat Kelas Listener (Khusus Siswa)
    const filterKelas = document.getElementById('filter-kelas-pengguna');
    if (filterKelas) {
        filterKelas.addEventListener('change', () => {
            if (typeof renderTablePengguna === 'function') {
                renderTablePengguna(); 
            }
        });
    }

    // Input Per-Kolom Listener untuk Tabel Guru
    const filterGuruInputs = ['search-guru-id', 'search-guru-nama', 'search-guru-role', 'search-guru-detail'];
    filterGuruInputs.forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            if (typeof renderTablePengguna === 'function') renderTablePengguna();
        });
    });

    // Input Per-Kolom Listener untuk Tabel Siswa
    const filterSiswaInputs = ['search-siswa-nis', 'search-siswa-nama', 'search-siswa-role', 'search-siswa-kelas'];
    filterSiswaInputs.forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            if (typeof renderTablePengguna === 'function') renderTablePengguna();
        });
    });

    // Logika UI Untuk Modal Edit Akun
    document.querySelectorAll('.edit-role-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const selectedRoles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(el => el.value);
            document.getElementById('group-edit-guru').style.display = selectedRoles.includes('guru') ? 'flex' : 'none';
            document.getElementById('group-edit-kelas-siswa').style.display = selectedRoles.includes('siswa') ? 'block' : 'none';
        });
    });

    document.getElementById('close-modal-edit-akun')?.addEventListener('click', () => {
        document.getElementById('modal-edit-akun').style.display = 'none';
    });

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
                throw new Error("Nama, Username, dan Role harus diisi!");
            }

            let payload = { nama: newNama, username: newUsername, role: roles };

            if (roles.includes('siswa')) {
                payload.kelas = [document.getElementById('edit-kelas-siswa').value];
            } else if (roles.includes('guru')) {
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
            loadDataPengguna();
        } catch (error) {
            console.error(error);
            window.customAlert("Gagal menyimpan: " + error.message, "error");
        } finally {
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    });

    // Ambil Data Sesi (Session) User
    try { 
        let userRoles = JSON.parse(localStorage.getItem("userRole") || "[]"); 
        userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]"); 
        userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
        isAdmin = userRoles.includes("admin"); 
        isGuru = userRoles.includes("guru");
    } catch (e) {
        console.warn("Gagal parsing local storage:", e);
    }

    // Routing Content Section
    function handleRouting() {
        let hash = window.location.hash.substring(1) || 'section-beranda';
        if (hash === 'section-pengaturan' && !isAdmin) hash = 'section-beranda';
        
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

    // Cek Status Autentikasi Pengguna
    onAuthStateChanged(auth, async (user) => {
        if (!user || (!isAdmin && !isGuru)) { window.location.replace("index.html"); return; }
        
        let finalDisplayName = user.displayName;
        if (!finalDisplayName) { 
            try { 
                const userDoc = await getDoc(doc(db, "users", user.uid)); 
                if (userDoc.exists()) finalDisplayName = userDoc.data().nama; 
            } catch(e) {} 
        }
        finalDisplayName = finalDisplayName || "Pengguna";

        const greetingText = document.getElementById('greeting-text'); 
        if (greetingText) greetingText.innerHTML = `Assalamu'alaikum, <span style="display: inline-block;">${finalDisplayName}! 🙏</span>`;

        // Hak Akses UI (Guru vs Admin)
        if (!isAdmin) {
            const btnMaster = document.getElementById('btn-open-data-master'); if (btnMaster) btnMaster.style.display = 'none';
            const btnAddUser = document.getElementById('btn-open-manajemen'); if (btnAddUser) btnAddUser.style.display = 'none';
            const wrapRegGuru = document.getElementById('wrap-reg-guru'); if (wrapRegGuru) wrapRegGuru.style.display = 'none';
            const wrapRegSiswa = document.getElementById('wrap-reg-siswa'); if (wrapRegSiswa) wrapRegSiswa.style.display = 'none';
            const btnHapusAll = document.getElementById('btn-hapus-semua-hasil'); if (btnHapusAll) btnHapusAll.style.display = 'none';
        } else {
            if(typeof fetchStatusReg === "function") fetchStatusReg();
        }

        // Jalankan Routing
        handleRouting(); 
        
        // Panggil Fungsi Load Data Utama
        if(typeof loadDataMaster === "function") loadDataMaster(); 
        if(typeof loadDataHasil === "function") loadDataHasil(); 
        if(typeof loadDataPengguna === "function") loadDataPengguna(); 
    });

    // Event Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = async () => { 
            if (await customConfirm("Yakin ingin keluar dari aplikasi?", "warning", "Konfirmasi Keluar", "Ya, Keluar")) { 
                await signOut(auth); 
                localStorage.clear(); 
                window.location.replace("index.html"); 
            } 
        };
    }

    // Toggle Accordion / Dropdown Table
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

    window.lihatDetailJawaban = async (hasilId) => {
        const h = allHasilUjian.find(item => item.id === hasilId);
        if (!h) return;

        document.getElementById('edit-id-hasil').value = hasilId;
        document.getElementById('detail-nama-siswa').innerText = `${h.nama} (${h.username || '-'}) | Kelas: ${h.kelas}`;
        
        let nilaiSiswa = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : (h.nilai || 0));
        document.getElementById('edit-nilai-siswa').value = nilaiSiswa;

        const container = document.getElementById('container-jawaban-siswa');
        container.innerHTML = '<div style="text-align:center; padding: 30px; color:var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Memuat data jawaban...</div>';
        
        document.getElementById('modal-detail-jawaban').style.display = 'flex';

        try {
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", h.mataPelajaran));
            const snap = await getDocs(q);
            
            let soalArr = []; 
            snap.forEach(doc => {
                let data = doc.data();
                let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
                if (arrKelas.includes(h.kelas)) {
                    soalArr.push({id: doc.id, ...data});
                }
            });
            
            if(soalArr.length === 0) { 
                container.innerHTML = '<div style="text-align:center; color:var(--danger); padding: 20px; background: white; border-radius: 8px;">Soal ujian tidak ditemukan di database. (Mungkin sudah dihapus)</div>'; 
                return; 
            }

            soalArr.sort((a,b) => (a.nomor_soal || 0) - (b.nomor_soal || 0)); 

            let html = '';
            const jawabanSiswa = h.jawaban || {}; 

            soalArr.forEach((s, idx) => {
                const jwbSiswa = jawabanSiswa[s.id] || '(Tidak Menjawab)';
                const jwbBenar = s.kunci_jawaban || s.jawaban_benar || '-';
                const tipe = s.tipe || 'PG';
                
                let statusWarna = 'var(--text-muted)';
                let statusIcon = '<i class="fas fa-minus-circle"></i> Tidak Dijawab';
                
                if(tipe === 'PG') {
                    if(jwbSiswa === jwbBenar) {
                        statusWarna = 'var(--success)'; statusIcon = '<i class="fas fa-check-circle"></i> Benar';
                    } else if(jwbSiswa !== '(Tidak Menjawab)') {
                        statusWarna = 'var(--danger)'; statusIcon = '<i class="fas fa-times-circle"></i> Salah';
                    }
                } else if (tipe === 'Essay') {
                    statusWarna = 'var(--warning)'; statusIcon = '<i class="fas fa-pen"></i> Tipe Uraian';
                }

                html += `
                <div style="background: white; border: 1px solid var(--border-color); padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                        <span style="font-weight: 800; font-size: 1rem; color: var(--secondary);">Soal ${idx + 1} <span style="background: #e2e8f0; color: var(--text-muted); padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; margin-left: 5px;">${tipe}</span></span>
                        <span style="color: ${statusWarna}; font-weight: 700; font-size: 0.85rem; background: ${statusWarna}15; padding: 5px 10px; border-radius: 6px;">${statusIcon}</span>
                    </div>
                    <div style="font-size: 0.95rem; margin-bottom: 15px; color: var(--text-main); line-height: 1.6;">
                        ${s.teks_soal || s.pertanyaan || ''}
                    </div>
                    <div style="background: #f8fafc; padding: 12px 15px; border-radius: 6px; font-size: 0.9rem; border-left: 4px solid ${statusWarna};">
                        <div style="margin-bottom: 6px;">
                            <span style="color: var(--text-muted); font-size: 0.8rem; display: block; margin-bottom: 2px;">Jawaban Siswa:</span> 
                            <span style="color: ${jwbSiswa === jwbBenar && tipe === 'PG' ? 'var(--success)' : (tipe === 'PG' ? 'var(--danger)' : 'var(--secondary)')}; font-weight: 700;">${jwbSiswa}</span>
                        </div>
                        ${tipe === 'PG' ? `
                        <div style="margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
                            <span style="color: var(--text-muted); font-size: 0.8rem; display: block; margin-bottom: 2px;">Kunci Jawaban:</span> 
                            <span style="color: var(--success); font-weight: 700;">${jwbBenar}</span>
                        </div>` : ''}
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        } catch(e) { container.innerHTML = '<div style="text-align:center; color:var(--danger); font-weight: bold;">Terjadi kesalahan saat memuat detail jawaban.</div>'; }
    };

    const btnSimpanNilai = document.getElementById('btn-simpan-nilai-baru');
    if (btnSimpanNilai) {
        btnSimpanNilai.onclick = async () => {
            const id = document.getElementById('edit-id-hasil').value;
            const nilaiBaru = parseFloat(document.getElementById('edit-nilai-siswa').value);

            if (!id || isNaN(nilaiBaru)) { return window.customAlert("Angka nilai tidak valid!", "warning"); }
            if (await window.customConfirm(`Apakah Anda yakin ingin mengubah nilai akhir siswa ini secara manual menjadi ${nilaiBaru}?`, "warning", "Konfirmasi Edit Nilai")) {
                const origText = btnSimpanNilai.innerHTML;
                btnSimpanNilai.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
                btnSimpanNilai.disabled = true;

                try {
                    await updateDoc(doc(db, "hasil_ujian", id), { skorPG: nilaiBaru, skor: nilaiBaru });
                    const hIndex = allHasilUjian.findIndex(item => item.id === id);
                    if(hIndex > -1) {
                        allHasilUjian[hIndex].skorPG = nilaiBaru;
                        allHasilUjian[hIndex].skor = nilaiBaru;
                        allHasilUjian[hIndex].nilai = nilaiBaru;
                    }
                    document.getElementById('modal-detail-jawaban').style.display = 'none';
                    await window.customAlert("Nilai berhasil diperbarui di database!", "success");
                    renderDetailHasil();
                } catch (e) {
                    window.customAlert(`Gagal menyimpan nilai. Error: ${e.message}`, "error");
                } finally {
                    btnSimpanNilai.innerHTML = origText; btnSimpanNilai.disabled = false;
                }
            }
        };
    }
    
    // ==========================================
    // 3. REGISTRASI & PENGATURAN ADMIN
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
        try { await setDoc(doc(db, "pengaturan", "status_registrasi"), { guru_aktif: e.target.checked }, { merge: true }); } catch (err) {}
    });
    document.getElementById('status-reg-siswa')?.addEventListener('change', async (e) => {
        try { await setDoc(doc(db, "pengaturan", "status_registrasi"), { siswa_aktif: e.target.checked }, { merge: true }); } catch (err) {}
    });

    let editMasterMode = false; 
    document.getElementById('btn-open-data-master')?.addEventListener('click', () => { document.getElementById('modal-data-master').style.display = 'flex'; editMasterMode = false; renderTableMaster(); });
    document.getElementById('close-modal-data-master')?.addEventListener('click', () => { document.getElementById('modal-data-master').style.display = 'none'; });
    document.getElementById('btn-edit-master-mode')?.addEventListener('click', () => { 
        editMasterMode = !editMasterMode;
        const btn = document.getElementById('btn-edit-master-mode');
        if (editMasterMode) { btn.innerHTML = '<i class="fas fa-check"></i> Selesai Edit'; btn.classList.remove('btn-secondary'); btn.style.backgroundColor = 'var(--success)'; } 
        else { btn.innerHTML = '<i class="fas fa-edit"></i> Mode Hapus Data'; btn.classList.add('btn-secondary'); btn.style.backgroundColor = ''; }
        renderTableMaster();
    });

    async function loadDataMaster() {
        try {
            // 1. Ambil data master pusat yang sudah ada saat ini
            const docRef = doc(db, "pengaturan", "data_akademik");
            const docSnap = await getDoc(docRef);
            
            let currentMapel = [];
            let currentKelas = [];
            
            if (docSnap.exists()) {
                currentMapel = docSnap.data().list_mapel || [];
                currentKelas = docSnap.data().list_kelas || [];
            }

            // 2. OTOMATISASI: Scan seluruh data dari koleksi "users"
            const usersSnap = await getDocs(collection(db, "users"));
            let masterBerubah = false;

            usersSnap.forEach((uDoc) => {
                const uData = uDoc.data();
                
                // Ambil data mapel dari akun guru jika belum ada di master data
                if (uData.mapel) {
                    const mapelArr = Array.isArray(uData.mapel) ? uData.mapel : [uData.mapel];
                    mapelArr.forEach(m => {
                        const mTrim = String(m).trim();
                        if (mTrim && !currentMapel.includes(mTrim)) {
                            currentMapel.push(mTrim);
                            masterBerubah = true;
                        }
                    });
                }

                // Ambil data kelas dari akun siswa/guru jika belum ada di master data
                if (uData.kelas) {
                    const kelasArr = Array.isArray(uData.kelas) ? uData.kelas : [uData.kelas];
                    kelasArr.forEach(k => {
                        const kTrim = String(k).trim();
                        if (kTrim && !currentKelas.includes(kTrim)) {
                            currentKelas.push(kTrim);
                            masterBerubah = true;
                        }
                    });
                }
            });

            // 3. Jika ditemukan mapel atau kelas baru di akun pengguna, simpan otomatis ke database
            if (masterBerubah) {
                await setDoc(docRef, {
                    list_mapel: currentMapel,
                    list_kelas: currentKelas
                }, { merge: true });
            }

            // 4. Masukkan ke variabel global dashboard agar dapat dirender oleh UI
            listMapel = currentMapel;
            listKelas = currentKelas;

            // 5. Perbarui tampilan UI komponen dashboard
            renderTableMaster(); 
            populateSemuaDropdown(); 
            loadBankSoalSummary();
        } catch (e) {
            console.error("Gagal sinkronisasi otomatis data master:", e);
        }
    }

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
        document.getElementById('input-master-name').value = ''; loadDataMaster(); await window.customAlert("Data berhasil ditambahkan!", "success");
    });

    function renderTableMaster() {
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
    }

    window.hapusMasterItem = async (type, val) => {
        if (!(await window.customConfirm(`Hapus ${type === 'mapel' ? 'Mapel' : 'Kelas'} "${val}"?`, "danger"))) return;
        try {
            if (type === 'mapel') { listMapel = listMapel.filter(item => item !== val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true }); } 
            else { listKelas = listKelas.filter(item => item !== val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true }); }
            loadDataMaster();
        } catch (e) { window.customAlert("Gagal menghapus data.", "error"); }
    };

    function populateSemuaDropdown() {
        const cmbKelasSiswa = document.getElementById('edit-kelas-siswa');
        if (cmbKelasSiswa) cmbKelasSiswa.innerHTML = listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
        
        const containerMapel = document.getElementById('edit-mapel-container');
        if (containerMapel) containerMapel.innerHTML = listMapel.map(m => `<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="edit-mapel-cb" value="${m}"> ${m}</label>`).join('');
        
        const containerKelasGuru = document.getElementById('edit-kelas-guru-container');
        if (containerKelasGuru) containerKelasGuru.innerHTML = listKelas.map(k => `<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="edit-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');
        
        const filterKelasPengguna = document.getElementById('filter-kelas-pengguna');
        if (filterKelasPengguna) {
            filterKelasPengguna.innerHTML = '<option value="all">Semua Kelas</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
        }
    }

    // ==========================================
    // 4. MANAJEMEN PENGGUNA (AKSES & PENGGUNA)
    // ==========================================

    window.loadDataPengguna = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            allUsersData = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.uid = doc.id;
                allUsersData.push(data);
            });

            // --- PROSES PENGURUTAN ABJAD (SORTING) ---
            allUsersData.sort((a, b) => {
                const namaA = (a.nama || "").toLowerCase();
                const namaB = (b.nama || "").toLowerCase();
                
                // Urutkan berdasarkan Nama terlebih dahulu
                if (namaA < namaB) return -1;
                if (namaA > namaB) return 1;
                
                // Jika namanya sama, urutkan berdasarkan Username (NIS/NIP)
                const idA = (a.username || "").toLowerCase();
                const idB = (b.username || "").toLowerCase();
                return idA.localeCompare(idB);
            });
            // ----------------------------------------

            const elStatSiswa = document.getElementById("stat-siswa");
            if (elStatSiswa) {
                elStatSiswa.innerText = allUsersData.length;
            }

            if (typeof window.renderTablePengguna === "function") {
                window.renderTablePengguna();
            }
        } catch (error) {
            console.error("Gagal memuat data pengguna:", error);
        }
    };

    window.renderTablePengguna = () => {
        const tbodyGuru = document.querySelector("#table-guru tbody");
        const tbodySiswa = document.querySelector("#table-siswa tbody");
        
        if (!tbodyGuru || !tbodySiswa) return;

        // Ambil nilai filter kolom Guru
        const filterGId = (document.getElementById('search-guru-id')?.value || '').toLowerCase();
        const filterGNama = (document.getElementById('search-guru-nama')?.value || '').toLowerCase();
        const filterGRole = (document.getElementById('search-guru-role')?.value || '').toLowerCase();
        const filterGDetail = (document.getElementById('search-guru-detail')?.value || '').toLowerCase();

        // Ambil nilai filter kolom & Dropdown Siswa
        const filterKelasEl = document.getElementById("filter-kelas-pengguna");
        const filterKelas = filterKelasEl ? filterKelasEl.value : "all";
        const filterSNis = (document.getElementById('search-siswa-nis')?.value || '').toLowerCase();
        const filterSNama = (document.getElementById('search-siswa-nama')?.value || '').toLowerCase();
        const filterSRole = (document.getElementById('search-siswa-role')?.value || '').toLowerCase();
        const filterSKelas = (document.getElementById('search-siswa-kelas')?.value || '').toLowerCase();
        
        let htmlGuru = '';
        let htmlSiswa = '';
        let countGuru = 0;
        let countSiswa = 0;

        allUsersData.forEach((user) => {
            const roles = Array.isArray(user.role) ? user.role : [user.role];
            const roleDisplay = roles.join(", ");
            const kelas = Array.isArray(user.kelas) ? user.kelas.join(", ") : (user.kelas || "-");
            const mapel = Array.isArray(user.mapel) ? user.mapel.join(", ") : (user.mapel || "-");

            // KODE BARU: Tombol Edit & Tombol Hapus (Hanya icon)
            const actionButtons = isAdmin ? `
                <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                    <button onclick="window.bukaModalEditAkun('${user.uid}')" class="btn-3d" style="background-color: var(--info); padding: 6px 12px; font-size: 0.85rem; margin: 0; min-width: auto;" title="Edit Pengguna">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="hapusPengguna('${user.uid}')" class="btn-exit-modern" style="padding: 6px 12px; font-size: 0.85rem; margin: 0; min-width: auto;" title="Hapus Pengguna">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : '-';

            // Logika Rendering & Filtering Tabel Guru
            if (roles.includes("guru") || roles.includes("admin")) {
                const usernameStr = (user.username || "").toLowerCase();
                const namaStr = (user.nama || "").toLowerCase();
                const detailStr = `${mapel} ${kelas}`.toLowerCase();

                const matchId = usernameStr.includes(filterGId);
                const matchNama = namaStr.includes(filterGNama);
                const matchRole = roleDisplay.toLowerCase().includes(filterGRole);
                const matchDetail = detailStr.includes(filterGDetail);

                if (matchId && matchNama && matchRole && matchDetail) {
                    countGuru++;
                    htmlGuru += `
                        <tr>
                            <td><strong>${user.username || "-"}</strong></td>
                            <td>${user.nama || "-"}</td>
                            <td><span style="text-transform: capitalize; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${roleDisplay}</span></td>
                            <td><small><b>Mapel:</b> ${mapel}<br><b>Kelas:</b> ${kelas}</small></td>
                            ${isAdmin ? `<td style="text-align:center;">${actionButtons}</td>` : ''}
                        </tr>
                    `;
                }
            } 
            // Logika Rendering & Filtering Tabel Siswa
            else if (roles.includes("siswa")) {
                const kelasArr = Array.isArray(user.kelas) ? user.kelas : [user.kelas];
                const usernameStr = (user.username || "").toLowerCase();
                const namaStr = (user.nama || "").toLowerCase();
                const kelasStr = kelas.toLowerCase();

                const matchDropdownKelas = (filterKelas === "all" || filterKelas === "" || kelasArr.includes(filterKelas));
                const matchNis = usernameStr.includes(filterSNis);
                const matchNama = namaStr.includes(filterSNama);
                const matchRole = roleDisplay.toLowerCase().includes(filterSRole);
                const matchKelas = kelasStr.includes(filterSKelas);

                if (matchDropdownKelas && matchNis && matchNama && matchRole && matchKelas) {
                    countSiswa++;
                    htmlSiswa += `
                        <tr>
                            <td><strong>${user.username || "-"}</strong></td>
                            <td>${user.nama || "-"}</td>
                            <td><span style="text-transform: capitalize; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${roleDisplay}</span></td>
                            <td>${kelas}</td>
                            ${isAdmin ? `<td style="text-align:center;">${actionButtons}</td>` : ''}
                        </tr>
                    `;
                }
            }
        });

        if (countGuru === 0) htmlGuru = `<tr><td colspan="${isAdmin ? 5 : 4}" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada data guru yang cocok.</td></tr>`;
        if (countSiswa === 0) htmlSiswa = `<tr><td colspan="${isAdmin ? 5 : 4}" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada data siswa yang cocok.</td></tr>`;

        tbodyGuru.innerHTML = htmlGuru;
        tbodySiswa.innerHTML = htmlSiswa;

        // Sinkronisasi Visibilitas Kolom Aksi
        const thAksiGuru = document.getElementById('th-aksi-guru');
        const thFilterAksiGuru = document.getElementById('th-filter-aksi-guru');
        const thAksiSiswa = document.getElementById('th-aksi-siswa');
        const thFilterAksiSiswa = document.getElementById('th-filter-aksi-siswa');
        
        if (thAksiGuru) thAksiGuru.style.display = isAdmin ? 'table-cell' : 'none';
        if (thFilterAksiGuru) thFilterAksiGuru.style.display = isAdmin ? 'table-cell' : 'none';
        if (thAksiSiswa) thAksiSiswa.style.display = isAdmin ? 'table-cell' : 'none';
        if (thFilterAksiSiswa) thFilterAksiSiswa.style.display = isAdmin ? 'table-cell' : 'none';
    };

    window.hapusPengguna = async (uid) => {
        if(await window.customConfirm("Apakah Anda yakin ingin menghapus akun pengguna ini secara permanen?", "danger", "Hapus Pengguna", "Ya, Hapus!")) {
            try {
                await deleteDoc(doc(db, "users", uid));
                loadDataPengguna();
                window.customAlert("Data akun berhasil dihapus dari database!", "success");
            } catch (error) {
                window.customAlert(`Gagal menghapus pengguna. Error: ${error.message}`, "error", "Gagal");
            }
        }
    };

    window.bukaModalEditAkun = async (uid) => {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if(!userDoc.exists()) return;
            const data = userDoc.data();
            
            // Set Form Text & Input Biasa
            document.getElementById('edit-uid').value = uid;
            document.getElementById('edit-nama').value = data.nama || '';
            document.getElementById('edit-username').value = data.username || '';
            document.getElementById('edit-pass').value = ''; 
            
            // Set Checkbox Roles
            const roles = Array.isArray(data.role) ? data.role : [data.role];
            document.querySelectorAll('.edit-role-cb').forEach(cb => {
                cb.checked = roles.includes(cb.value);
            });

            // Tampilkan/Sembunyikan Menu berdasarkan Role
            const isGuruEdit = roles.includes('guru');
            const isSiswaEdit = roles.includes('siswa');
            
            document.getElementById('group-edit-guru').style.display = isGuruEdit ? 'flex' : 'none';
            document.getElementById('group-edit-kelas-siswa').style.display = isSiswaEdit ? 'block' : 'none';

            // Checkbox/Select Kelas & Mapel
            if (isSiswaEdit) {
                const klsSiswa = Array.isArray(data.kelas) ? data.kelas[0] : data.kelas;
                document.getElementById('edit-kelas-siswa').value = klsSiswa || '';
            }

            if (isGuruEdit) {
                const mapelArr = Array.isArray(data.mapel) ? data.mapel : [];
                document.querySelectorAll('.edit-mapel-cb').forEach(cb => { 
                    cb.checked = mapelArr.includes(cb.value); 
                });

                const kelasArr = Array.isArray(data.kelas) ? data.kelas : [];
                document.querySelectorAll('.edit-kelas-guru-cb').forEach(cb => { 
                    cb.checked = kelasArr.includes(cb.value); 
                });
            }
            
            // Buka Modal Edit Akun
            document.getElementById('modal-edit-akun').style.display = 'flex';
        } catch(e) {
            console.error(e);
        }
    };

    // =================================================================
    // 6. BANK SOAL & FITUR BARU: GROUP BY MAPEL & TINGKAT
    // =================================================================
    function getTingkatan(kelas) {
        if (!kelas) return "Lainnya";
        let k = String(kelas).toUpperCase().trim();
        if (k.startsWith("XII")) return "XII";
        if (k.startsWith("XI")) return "XI";
        if (k.startsWith("X")) return "X";
        return "Lainnya";
    }

    async function loadBankSoalSummary() {
        const tbody = document.querySelector('#table-bank-soal-summary tbody'); if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Memuat data...</td></tr>';
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            let summary = {}; let uniqueMapel = new Set(); 
            
            snap.forEach(d => {
                let mapel = d.data().mataPelajaran; 
                let kelasData = d.data().kelas; 
                let kelasArray = Array.isArray(kelasData) ? kelasData : [kelasData];
                
                uniqueMapel.add(mapel);
                
                kelasArray.forEach(cls => {
                    let tingkatan = getTingkatan(cls);
                    let key = `${mapel}_${tingkatan}`;
                    
                    if(!summary[key]) summary[key] = { mapel, tingkatan, classes: {} };
                    if(!summary[key].classes[cls]) summary[key].classes[cls] = 0;
                    summary[key].classes[cls]++;
                });
            });
            
            let statSoalEl = document.getElementById('stat-soal'); if (statSoalEl) statSoalEl.innerText = uniqueMapel.size;
            
            const waktuSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian")); const waktuData = waktuSnap.exists() ? waktuSnap.data() : {};
            const jadwalSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian")); const jadwalData = jadwalSnap.exists() ? jadwalSnap.data() : {};
            const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian")); const tokenData = tokenSnap.exists() ? tokenSnap.data() : {};
            
            window.bankSoalRowCache = {};
            let html = ''; let rowIdx = 0;
            
            for (let key in summary) {
                rowIdx++;
                let d = summary[key];
                
                let classList = Object.keys(d.classes).sort();
                if (classList.length === 0) continue;
                
                window.bankSoalRowCache[rowIdx] = { mapel: d.mapel, tingkatan: d.tingkatan, classData: {} };
                
                classList.forEach(cls => {
                    let clsKey = `${d.mapel}_${cls}`;
                    let jadwal = jadwalData[clsKey] ? jadwalData[clsKey].replace('T', ' ') : '-';
                    let durasi = waktuData[clsKey] ? waktuData[clsKey] + ' Mnt' : '-';
                    let token = '-';
                    if(tokenData[`token_${clsKey}`]) {
                        let tData = tokenData[`token_${clsKey}`];
                        token = typeof tData === 'object' ? tData.code : tData;
                    }
                    window.bankSoalRowCache[rowIdx].classData[cls] = { jadwal, durasi, token, count: d.classes[cls] };
                });
                
                let defaultClass = classList[0];
                let defaultData = window.bankSoalRowCache[rowIdx].classData[defaultClass];
                let isMapelGuru = isGuru && userMapel.includes(d.mapel);
                
                let selectHtml = `<select id="select-cls-${rowIdx}" onchange="window.updateBankSoalRowData(this, ${rowIdx})" class="input-text" style="padding: 4px 8px; font-size: 0.85rem; width: auto; min-width: 90px; margin: 0;">`;
                classList.forEach(cls => { selectHtml += `<option value="${cls}">${cls}</option>`; });
                selectHtml += `</select>`;
                
                let actionBtn = (isAdmin || isMapelGuru) ? 
                    `<div style="display:flex; gap:5px; justify-content:center;">
                        <button onclick="window.bukaDetailSoal('${d.mapel}', '${defaultClass}')" class="btn-3d" style="background:var(--info); padding:5px 15px; font-size:0.85rem;"><i class="fas fa-cog"></i> Kelola</button>
                        <button onclick="window.bukaModalPindahBankSoal('${d.mapel}', '${defaultClass}')" class="btn-3d" style="background:var(--warning); padding:5px 12px; font-size:0.85rem;" title="Terapkan Akses ke Kelas Lain"><i class="fas fa-share-alt"></i></button>
                        <button onclick="window.hapusBankSoalKeseluruhan('${d.mapel}', '${defaultClass}')" class="btn-3d" style="background:var(--danger); padding:5px 12px; font-size:0.85rem;" title="Hapus Mapel dari Kelas Ini"><i class="fas fa-trash-alt"></i></button>
                    </div>` : 
                    `<span style="color:var(--text-muted); font-size:0.85rem;"><i class="fas fa-lock"></i> Terkunci</span>`;
                
                html += `
                <tr id="bs-row-${rowIdx}">
                    <td><b>${d.mapel}</b> <span style="color:var(--text-muted); font-size:0.8rem; display:block;">Tingkat ${d.tingkatan}</span></td>
                    <td>${selectHtml}</td>
                    <td class="cell-jadwal-${rowIdx}">${defaultData.jadwal}</td>
                    <td class="cell-durasi-${rowIdx}">${defaultData.durasi}</td>
                    <td class="cell-token-${rowIdx}" style="font-weight:bold; color:var(--danger);">${defaultData.token}</td>
                    <td class="cell-count-${rowIdx}">${defaultData.count} Soal</td>
                    <td style="text-align:center;" class="cell-action-${rowIdx}">${actionBtn}</td>
                </tr>`;
            }
            if(html === '') html = '<tr><td colspan="7" style="text-align:center;">Tidak ada data soal.</td></tr>';
            tbody.innerHTML = html;
        } catch (e) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Gagal memuat data</td></tr>'; }
    }

    window.updateBankSoalRowData = (selectEl, rowIdx) => {
        let selectedClass = selectEl.value;
        let cache = window.bankSoalRowCache[rowIdx];
        if (!cache) return;
        let data = cache.classData[selectedClass];
        if (!data) return;
        
        document.querySelector(`.cell-jadwal-${rowIdx}`).innerText = data.jadwal;
        document.querySelector(`.cell-durasi-${rowIdx}`).innerText = data.durasi;
        document.querySelector(`.cell-token-${rowIdx}`).innerText = data.token;
        document.querySelector(`.cell-count-${rowIdx}`).innerText = `${data.count} Soal`;
        
        let isMapelGuru = isGuru && userMapel.includes(cache.mapel);
        let actionCell = document.querySelector(`.cell-action-${rowIdx}`);
        if (isAdmin || isMapelGuru) {
            actionCell.innerHTML = `
                <div style="display:flex; gap:5px; justify-content:center;">
                    <button onclick="window.bukaDetailSoal('${cache.mapel}', '${selectedClass}')" class="btn-3d" style="background:var(--info); padding:5px 15px; font-size:0.85rem;"><i class="fas fa-cog"></i> Kelola</button>
                    <button onclick="window.bukaModalPindahBankSoal('${cache.mapel}', '${selectedClass}')" class="btn-3d" style="background:var(--warning); padding:5px 12px; font-size:0.85rem;" title="Terapkan Akses ke Kelas Lain"><i class="fas fa-share-alt"></i></button>
                    <button onclick="window.hapusBankSoalKeseluruhan('${cache.mapel}', '${selectedClass}')" class="btn-3d" style="background:var(--danger); padding:5px 12px; font-size:0.85rem;" title="Hapus Mapel dari Kelas Ini"><i class="fas fa-trash-alt"></i></button>
                </div>`;
        }
    };

    window.hapusBankSoalKeseluruhan = async (mapel, kelas) => {
        if (!(await window.customConfirm(`PENGHAPUSAN MAPEL DI KELAS ${kelas}!\n\nApakah Anda YAKIN ingin menghapus soal, jadwal, dan token untuk mapel "${mapel}" khusus di kelas "${kelas}" ini?\n\n(Jika soal ini digunakan kelas lain, kelas lain tidak akan terpengaruh)`, "danger", "Konfirmasi Hapus"))) { 
            return; 
        }

        const btnHtmlOriginal = event.currentTarget.innerHTML;
        const btn = event.currentTarget;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
        btn.disabled = true;

        try {
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
            const snap = await getDocs(q);
            
            const updatePromises = [];
            snap.forEach(d => {
                let data = d.data();
                let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
                
                if (arrKelas.includes(kelas)) {
                    let remainingKelas = arrKelas.filter(k => k !== kelas);
                    if (remainingKelas.length === 0) {
                        updatePromises.push(deleteDoc(doc(db, "bank_soal", d.id)));
                    } else {
                        updatePromises.push(updateDoc(doc(db, "bank_soal", d.id), { kelas: remainingKelas }));
                    }
                }
            });
            await Promise.all(updatePromises);

            const key = `${mapel}_${kelas}`;
            await updateDoc(doc(db, "pengaturan", "waktu_ujian"), { [key]: deleteField() }).catch(()=>{});
            await updateDoc(doc(db, "pengaturan", "jadwal_ujian"), { [key]: deleteField() }).catch(()=>{});
            await updateDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${key}`]: deleteField() }).catch(()=>{});

            await window.customAlert(`Berhasil menghapus data soal beserta pengaturan ujian untuk ${mapel} - ${kelas}.`, "success");
            loadBankSoalSummary();
        } catch (e) {
            console.error(e); window.customAlert("Terjadi kesalahan saat menghapus data.", "error");
        } finally {
            if(btn) { btn.innerHTML = btnHtmlOriginal; btn.disabled = false; }
        }
    };

    window.bukaModalPindahBankSoal = (mapelLama, kelasLama) => {
        document.getElementById('edit-bs-old-mapel').value = mapelLama;
        document.getElementById('edit-bs-old-kelas').value = kelasLama;
        
        const selMapel = document.getElementById('edit-bs-new-mapel');
        const containerKelas = document.getElementById('edit-bs-new-kelas-container');
        
        let allowedMapel = listMapel; 
        if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }
        
        selMapel.innerHTML = allowedMapel.map(m => `<option value="${m}" ${m === mapelLama ? 'selected' : ''}>${m}</option>`).join('');
        
        containerKelas.innerHTML = listKelas.map(k => `
            <label style="display:flex; align-items:center; gap:10px; padding: 6px 0; cursor: pointer; border-bottom: 1px dashed #e2e8f0;">
                <input type="checkbox" class="cb-pindah-kelas" value="${k}" ${k === kelasLama ? 'checked' : ''} style="transform: scale(1.3);">
                <span style="font-size: 0.95rem; font-weight: 600;">${k}</span>
            </label>
        `).join('');
        
        document.getElementById('modal-edit-bank-soal').style.display = 'flex';
    };

    document.getElementById('btn-simpan-pindah-bs')?.addEventListener('click', async () => {
        const oldMapel = document.getElementById('edit-bs-old-mapel').value;
        const oldKelas = document.getElementById('edit-bs-old-kelas').value;
        const newMapel = document.getElementById('edit-bs-new-mapel').value;
        const selectedKelas = Array.from(document.querySelectorAll('.cb-pindah-kelas:checked')).map(cb => cb.value);

        if (selectedKelas.length === 0) { return window.customAlert("Pilih minimal satu kelas sasaran!", "warning"); }

        if (!(await window.customConfirm(`Terapkan soal ${oldMapel} ini agar dapat diakses oleh kelas-kelas berikut:\n\n${selectedKelas.join(', ')}?\n\n(Sistem tidak akan menduplikasi soal, melainkan membagikan aksesnya)`, "warning", "Konfirmasi Distribusi"))) { return; }

        const btn = document.getElementById('btn-simpan-pindah-bs'); const origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses Data...'; btn.disabled = true;

        try {
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", oldMapel));
            const snap = await getDocs(q); 
            
            let promises = [];
            
            snap.forEach(d => {
                let data = d.data();
                let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
                
                if(arrKelas.includes(oldKelas)) {
                    let baseKelas = arrKelas.filter(k => k !== oldKelas); 
                    let combinedKelas = [...new Set([...baseKelas, ...selectedKelas])];
                    
                    let updateData = { kelas: combinedKelas };
                    if (newMapel !== oldMapel) updateData.mataPelajaran = newMapel;
                    promises.push(updateDoc(doc(db, "bank_soal", d.id), updateData));
                }
            });

            const oldKey = `${oldMapel}_${oldKelas}`;
            const wSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
            const jSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian"));
            const tSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
            
            let oldWaktu = wSnap.exists() ? wSnap.data()[oldKey] : undefined;
            let oldJadwal = jSnap.exists() ? jSnap.data()[oldKey] : undefined;
            let oldToken = tSnap.exists() ? tSnap.data()[`token_${oldKey}`] : undefined;

            selectedKelas.forEach(tc => {
                const tcKey = `${newMapel}_${tc}`;
                if(oldWaktu !== undefined) promises.push(setDoc(doc(db, "pengaturan", "waktu_ujian"), { [tcKey]: oldWaktu }, { merge: true }));
                if(oldJadwal !== undefined) promises.push(setDoc(doc(db, "pengaturan", "jadwal_ujian"), { [tcKey]: oldJadwal }, { merge: true }));
                if(oldToken !== undefined) promises.push(setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${tcKey}`]: oldToken }, { merge: true }));
            });

            if (!selectedKelas.includes(oldKelas) && oldMapel === newMapel) {
                 promises.push(updateDoc(doc(db, "pengaturan", "waktu_ujian"), { [oldKey]: deleteField() }).catch(()=>{}));
                 promises.push(updateDoc(doc(db, "pengaturan", "jadwal_ujian"), { [oldKey]: deleteField() }).catch(()=>{}));
                 promises.push(updateDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${oldKey}`]: deleteField() }).catch(()=>{}));
            }

            await Promise.all(promises);
            document.getElementById('modal-edit-bank-soal').style.display = 'none';
            await window.customAlert(`Berhasil membagikan akses paket soal ke kelas sasaran (tanpa menduplikasi soal).`, "success");
            loadBankSoalSummary();
        } catch (e) {
            console.error(e); window.customAlert("Terjadi kesalahan sistem.", "error");
        } finally { btn.innerHTML = origHtml; btn.disabled = false; }
    });

    document.getElementById('soal-tipe')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const pgOpts = document.getElementById('pg-options'); const menjodohkanOpts = document.getElementById('menjodohkan-options'); const essayOpts = document.getElementById('essay-options'); 
        const kunciPg = document.querySelectorAll('.kunci-pg-container'); const kunciPgk = document.querySelectorAll('.kunci-pgk-container');
        
        if (val !== 'Menjodohkan') { document.getElementById('pasangan-container').innerHTML = ''; }
        
        if (val === 'PG' || val === 'PGK') {
            pgOpts.style.display = 'block'; menjodohkanOpts.style.display = 'none'; if(essayOpts) essayOpts.style.display = 'none';
            kunciPg.forEach(c => c.style.display = (val === 'PG') ? 'inline-block' : 'none'); kunciPgk.forEach(c => c.style.display = (val === 'PGK') ? 'inline-block' : 'none');
        } else if (val === 'Menjodohkan') {
            pgOpts.style.display = 'none'; menjodohkanOpts.style.display = 'block'; if(essayOpts) essayOpts.style.display = 'none';
        } else { 
            pgOpts.style.display = 'none'; menjodohkanOpts.style.display = 'none'; if(essayOpts) essayOpts.style.display = 'block';
        }
    });

    document.getElementById('btn-tambah-pasangan')?.addEventListener('click', () => {
        const container = document.getElementById('pasangan-container'); const row = document.createElement('div');
        row.className = 'pasangan-item'; row.style.cssText = 'display:flex; gap:10px; margin-bottom:10px;';
        row.innerHTML = `<input type="text" class="input-text m-kiri" placeholder="Pernyataan Kiri" required><input type="text" class="input-text m-kanan" placeholder="Pasangan Kanan" required><button type="button" class="btn-hapus-pasangan" style="background:var(--danger); color:white; border:none; padding:0 15px; border-radius:8px; cursor:pointer;"><i class="fas fa-trash"></i></button>`;
        container.appendChild(row);
    });
    document.getElementById('pasangan-container')?.addEventListener('click', (e) => { if(e.target.closest('.btn-hapus-pasangan')) { e.target.closest('.pasangan-item').remove(); } });

    async function uploadMediaToStorage(file, folderPath) {
        if (!file) return null;
        const fileExt = file.name.split('.').pop(); const fileName = `${Date.now()}_${Math.random().toString(36).substring(2,8)}.${fileExt}`;
        const storageRef = ref(storage, `${folderPath}/${fileName}`); const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        let type = 'image'; if(file.type.startsWith('audio')) type = 'audio'; else if(file.type.startsWith('video')) type = 'video';
        return { url, type };
    }

    async function normalizeUrutanSoal(mapel, kelas) {
        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
        const snap = await getDocs(q); 
        let soalArr = []; 
        snap.forEach(doc => {
            let data = doc.data();
            let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
            if (arrKelas.includes(kelas)) {
                soalArr.push({id: doc.id, ...data});
            }
        });
        
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
    }

    document.getElementById('form-tambah-soal')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mapel = document.getElementById('soal-mapel').value; 
        const kelas = document.getElementById('soal-kelas').value;
        const tipe = document.getElementById('soal-tipe').value; 
        const teks = document.getElementById('soal-teks').value;
        const nomorSoalTarget = parseInt(document.getElementById('soal-nomor').value) || 1;
        const bobotSoal = parseFloat(document.getElementById('soal-bobot').value) || 1;

        if(!mapel || !kelas) return window.customAlert("Silakan pilih Mata Pelajaran dan Kelas terlebih dahulu!", "warning");

        const btnSubmitSoal = e.target.querySelector('button[type="submit"]'); 
        const originalText = btnSubmitSoal.innerHTML;
        btnSubmitSoal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENGUNGGAH & MENYIMPAN...'; btnSubmitSoal.disabled = true;

        try {
            let mediaSoal = null;
            const tipeMediaUtama = document.querySelector('input[name="tipe_media_utama"]:checked')?.value || 'file';
            
            if (tipeMediaUtama === 'file') {
                const fileSoal = document.getElementById('soal-media').files[0];
                if (fileSoal) { mediaSoal = await uploadMediaToStorage(fileSoal, `bank_soal/${mapel}_${kelas}`); }
            } else if (tipeMediaUtama === 'url') {
                const urlVal = document.getElementById('soal-media-url').value.trim();
                if (urlVal) {
                    let mType = 'image';
                    if (urlVal.toLowerCase().includes('.mp4') || urlVal.toLowerCase().includes('drive')) mType = 'video';
                    if (urlVal.toLowerCase().includes('.mp3')) mType = 'audio';
                    mediaSoal = { url: urlVal, type: mType };
                }
            }
            
            let payload = { mataPelajaran: mapel, kelas: [kelas], nomor_soal: nomorSoalTarget, bobot: bobotSoal, tipe: tipe, teks_soal: teks, updatedAt: new Date() };
            if (mediaSoal) payload.media_soal = mediaSoal;

            if (tipe === 'PG' || tipe === 'PGK') {
                let opsiKeys = ['A', 'B', 'C', 'D', 'E']; let opsi = {}; let opsi_media = {};
                for (let k of opsiKeys) {
                    opsi[k] = document.getElementById(`soal-opsi-${k}`).value;
                    let fileOpsi = document.getElementById(`media-opsi-${k}`).files[0];
                    if (fileOpsi) { opsi_media[k] = await uploadMediaToStorage(fileOpsi, `bank_soal/${mapel}_${kelas}/opsi`); }
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

            await normalizeUrutanSoal(mapel, kelas);
            document.getElementById('form-tambah-soal').reset();
            document.getElementById('edit-soal-id').value = '';
            document.getElementById('modal-tambah-soal').style.display = 'none';

            const curMapel = document.getElementById('filter-soal-mapel').value;
            const curKelas = document.getElementById('filter-soal-kelas').value;
            if(document.getElementById('view-soal-list').style.display === 'block') { window.loadDaftarSoal(curMapel, curKelas); }
            loadBankSoalSummary();
            window.customAlert("Soal berhasil disimpan & diurutkan!", "success");
        } catch(err) { window.customAlert(err.message || "Gagal menyimpan soal.", "error"); } 
        finally { btnSubmitSoal.innerHTML = originalText; btnSubmitSoal.disabled = false; }
    });

    window.bukaModalTambahSoal = (mapelParams = "", kelasParams = "", targetNomor = "") => {
        document.getElementById('edit-soal-id').value = ''; 
        document.getElementById('form-tambah-soal').reset();
        
        document.getElementById('soal-media').style.display = 'block';
        document.getElementById('soal-media-url').style.display = 'none';
        
        document.getElementById('section-import-massal').style.display = 'block';
        document.getElementById('divider-import-manual').style.display = 'flex';

        const mapelSelect = document.getElementById('soal-mapel'); const kelasSelect = document.getElementById('soal-kelas');
        const inputNomor = document.getElementById('soal-nomor'); const modalTitle = document.getElementById('title-modal-soal');

        let allowedMapel = listMapel; if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }
        mapelSelect.innerHTML = '<option value="" disabled selected>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        kelasSelect.innerHTML = '<option value="" disabled selected>-- Pilih Kelas --</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        if (mapelParams && kelasParams) {
            modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Soal (Mapel Ini)';
            mapelSelect.value = mapelParams; kelasSelect.value = kelasParams;
            mapelSelect.style.pointerEvents = 'none'; mapelSelect.style.backgroundColor = '#e2e8f0';
            kelasSelect.style.pointerEvents = 'none'; kelasSelect.style.backgroundColor = '#e2e8f0';
        } else {
            modalTitle.innerHTML = '<i class="fas fa-file-import"></i> Input Soal Baru';
            mapelSelect.value = ""; kelasSelect.value = "";
            mapelSelect.style.pointerEvents = 'auto'; mapelSelect.style.backgroundColor = '#fafafa';
            kelasSelect.style.pointerEvents = 'auto'; kelasSelect.style.backgroundColor = '#fafafa';
        }
        inputNomor.value = targetNomor;
        document.getElementById('modal-tambah-soal').style.display = 'flex';
        document.getElementById('soal-tipe').dispatchEvent(new Event('change'));
    };

    window.editDataSoal = (id) => {
        const soal = window.tempDataSoalKelola.find(s => s.id === id); if (!soal) return;
        
        document.getElementById('section-import-massal').style.display = 'none';
        document.getElementById('divider-import-manual').style.display = 'none';

        const mapelSelect = document.getElementById('soal-mapel'); const kelasSelect = document.getElementById('soal-kelas');

        let allowedMapel = listMapel; if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }
        mapelSelect.innerHTML = '<option value="" disabled>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        kelasSelect.innerHTML = '<option value="" disabled>-- Pilih Kelas --</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        mapelSelect.style.pointerEvents = 'none'; mapelSelect.style.backgroundColor = '#e2e8f0';
        kelasSelect.style.pointerEvents = 'none'; kelasSelect.style.backgroundColor = '#e2e8f0';
        
        document.getElementById('edit-soal-id').value = id;
        document.getElementById('soal-mapel').value = soal.mataPelajaran; 
        
        let klsDisplay = Array.isArray(soal.kelas) ? soal.kelas[0] : soal.kelas;
        document.getElementById('soal-kelas').value = klsDisplay; 
        
        document.getElementById('soal-nomor').value = soal.nomor_soal || ''; document.getElementById('soal-bobot').value = soal.bobot || 1; 
        document.getElementById('soal-tipe').value = soal.tipe || 'PG'; document.getElementById('soal-teks').value = soal.teks_soal || '';
        
        document.getElementById('soal-tipe').dispatchEvent(new Event('change'));

        if (soal.tipe === 'PG' || soal.tipe === 'PGK') {
            ['A', 'B', 'C', 'D', 'E'].forEach(k => { document.getElementById(`soal-opsi-${k}`).value = (soal.opsi && soal.opsi[k]) ? soal.opsi[k] : ''; });
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
        document.getElementById('title-modal-soal').innerHTML = '<i class="fas fa-edit"></i> Update Soal';
        document.getElementById('modal-tambah-soal').style.display = 'flex';
    };

    window.bukaDetailSoal = async (mapel, kelas) => {
        document.getElementById('view-summary-bank-soal').style.display = 'none'; document.getElementById('view-soal-list').style.display = 'block';
        document.getElementById('label-mapel-edit').innerText = `${mapel} - ${kelas}`;
        document.getElementById('filter-soal-mapel').value = mapel; document.getElementById('filter-soal-kelas').value = kelas;
        
        let key = `${mapel}_${kelas}`;
        try {
            const wSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian")); document.getElementById('input-waktu-ujian').value = (wSnap.exists() && wSnap.data()[key]) ? wSnap.data()[key] : '';
            const jSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian")); document.getElementById('input-jadwal-ujian').value = (jSnap.exists() && jSnap.data()[key]) ? jSnap.data()[key] : '';
            const tSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
            if(tSnap.exists() && tSnap.data()[`token_${key}`]) { let tData = tSnap.data()[`token_${key}`]; document.getElementById('input-token-ujian').value = typeof tData === 'object' ? tData.code : tData; } 
            else { document.getElementById('input-token-ujian').value = ''; }
        } catch(e) {}
        window.loadDaftarSoal(mapel, kelas);
    };

    window.loadDaftarSoal = async (mapel, kelas) => {
        const container = document.getElementById('list-soal');
        container.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Memuat soal...</div>';
        try {
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
            const snap = await getDocs(q); 
            
            let soalArr = []; 
            snap.forEach(doc => {
                let data = doc.data();
                let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
                if (arrKelas.includes(kelas)) {
                    soalArr.push({id: doc.id, ...data});
                }
            });
            
            soalArr.sort((a,b) => (a.nomor_soal || 0) - (b.nomor_soal || 0)); window.tempDataSoalKelola = soalArr; 

            if(soalArr.length === 0) { 
                container.innerHTML = `
                <div style="text-align:center; padding: 30px; background: white; border: 1px dashed var(--border-color); border-radius: 8px;">
                    Belum ada soal untuk mata pelajaran ini di kelas ${kelas}.<br><br>
                    <button onclick="window.bukaModalTambahSoal('${mapel}', '${kelas}', 1)" class="btn-3d" style="background:var(--success); padding:8px 20px; border-radius:20px; font-size:0.9rem; margin:0 auto;"><i class="fas fa-plus"></i> Buat Soal Pertama</button>
                </div>`; return; 
            }

            let html = `
            <div style="display:flex; justify-content:center; position:relative; margin-bottom: 15px; margin-top: 5px;">
                <hr style="position:absolute; width:100%; top:50%; border:none; border-top:1px dashed #cbd5e1; z-index:1;">
                <button onclick="window.bukaModalTambahSoal('${mapel}', '${kelas}', 1)" class="btn-3d" style="background:white; color:var(--success); border:1px solid var(--success); padding:4px 15px; border-radius:20px; font-size:0.8rem; z-index:2; box-shadow:0 2px 5px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='var(--success)'; this.style.color='white'" onmouseout="this.style.background='white'; this.style.color='var(--success)'"><i class="fas fa-plus"></i> Sisipkan Soal di Sini</button>
            </div>`;
            
            soalArr.forEach((s, idx) => {
                let badgeMultikelas = '';
                if(Array.isArray(s.kelas) && s.kelas.length > 1) {
                    badgeMultikelas = `<span style="background:#f1f5f9; color:var(--secondary); border: 1px solid #cbd5e1; padding:2px 6px; border-radius:4px; font-size:0.65rem; margin-left:5px;" title="Soal ini digunakan oleh ${s.kelas.length} kelas"><i class="fas fa-share-alt"></i> Dipakai Multi Kelas</span>`;
                }

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
                                ${badgeMultikelas}
                            </span>
                        </div>
                        <div style="color:var(--text-main); line-height:1.6; font-size: 1rem; margin-bottom:15px;">${s.teks_soal}</div>
                        ${s.media_soal ? `<div style="margin-bottom:15px; font-size:0.85rem; color:var(--info); background:#eff6ff; padding:8px 12px; border-radius:6px; display:inline-block;"><i class="fas fa-paperclip"></i> Terlampir File Media (${s.media_soal.type.toUpperCase()})</div><br>` : ''}`;
                
                if (s.tipe === 'PG' || s.tipe === 'PGK' || !s.tipe) {
                    html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
                    ['A','B','C','D','E'].forEach(o => {
                        let teksOpsi = (s.opsi && s.opsi[o]) ? s.opsi[o] : '';
                        if(teksOpsi) {
                            let isBenar = (s.tipe === 'PG' || !s.tipe) ? s.kunci_jawaban === o : Array.isArray(s.kunci_jawaban) && s.kunci_jawaban.includes(o);
                            if (isBenar) { html += `<div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; color:var(--success); font-weight:600; font-size:0.9rem;"><i class="fas fa-check-circle"></i> <span>${o}. ${teksOpsi}</span></div>`; } 
                            else { html += `<div style="display:flex; align-items:center; gap:10px; padding:8px 12px; border:1px solid #f1f5f9; border-radius:6px; color:var(--text-muted); font-size:0.9rem;"><span style="font-weight:600; width:20px;">${o}.</span> <span>${teksOpsi}</span></div>`; }
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
                    <button onclick="window.bukaModalTambahSoal('${mapel}', '${kelas}', ${targetNext})" class="btn-3d" style="background:white; color:var(--success); border:1px solid var(--success); padding:4px 15px; border-radius:20px; font-size:0.8rem; z-index:2; box-shadow:0 2px 5px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='var(--success)'; this.style.color='white'" onmouseout="this.style.background='white'; this.style.color='var(--success)'"><i class="fas fa-plus"></i> Sisipkan Soal di Sini</button>
                </div>`;
            });
            container.innerHTML = html;
        } catch(e) { container.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Gagal memuat soal</div>'; }
    };

    window.hapusSoal = async (id) => {
        if(await window.customConfirm("Apakah Anda yakin ingin menghapus soal ini beserta medianya?", "danger")) {
            try { 
                await deleteDoc(doc(db, "bank_soal", id)); const curMapel = document.getElementById('filter-soal-mapel').value; const curKelas = document.getElementById('filter-soal-kelas').value;
                await normalizeUrutanSoal(curMapel, curKelas); window.loadDaftarSoal(curMapel, curKelas); loadBankSoalSummary(); 
            } catch(e) { window.customAlert("Gagal menghapus soal", "error"); }
        }
    };

    document.getElementById('btn-back-mapel-list')?.addEventListener('click', () => {
        document.getElementById('view-summary-bank-soal').style.display = 'block'; document.getElementById('view-soal-list').style.display = 'none'; loadBankSoalSummary();
    });

    document.getElementById('btn-simpan-pengaturan-ujian')?.addEventListener('click', async () => {
        const mapel = document.getElementById('filter-soal-mapel').value; const kelas = document.getElementById('filter-soal-kelas').value;
        if(!mapel || !kelas) return; const key = `${mapel}_${kelas}`;
        const waktu = document.getElementById('input-waktu-ujian').value; const jadwal = document.getElementById('input-jadwal-ujian').value; const token = document.getElementById('input-token-ujian').value.trim().toUpperCase();

        const btn = document.getElementById('btn-simpan-pengaturan-ujian'); const origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; btn.disabled = true;

        try {
            if(waktu) await setDoc(doc(db, "pengaturan", "waktu_ujian"), { [key]: waktu }, { merge: true });
            if(jadwal) await setDoc(doc(db, "pengaturan", "jadwal_ujian"), { [key]: jadwal }, { merge: true });
            if(token) { 
                const expiredAt = new Date().getTime() + (15 * 60 * 1000); 
                await setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${key}`]: { code: token, active: true, expiredAt } }, { merge: true });
            }
            window.customAlert("Pengaturan jadwal, durasi, dan token berhasil disimpan!", "success"); loadBankSoalSummary();
        } catch(e) { window.customAlert("Gagal menyimpan pengaturan.", "error"); }
        btn.innerHTML = origHtml; btn.disabled = false;
    });
    
    // =======================================================
    // FUNGSI IMPORT MASSAL EXCEL / G-DRIVE
    // =======================================================
    window.downloadTemplateExcel = () => {
        const templateData = [
            { "Nomor Soal": 1, "Tipe Soal (PG / PGK / Menjodohkan / Essay)": "PG", "Bobot Soal": 10, "Teks Pertanyaan": "Contoh Soal PG?", "Link Media Pertanyaan (URL Gambar/Audio/Video)": "", "Opsi A": "A", "Link Media Opsi A (URL Gambar)": "", "Opsi B": "B", "Link Media Opsi B (URL Gambar)": "", "Opsi C": "C", "Link Media Opsi C (URL Gambar)": "", "Opsi D": "D", "Link Media Opsi D (URL Gambar)": "", "Opsi E": "E", "Link Media Opsi E (URL Gambar)": "", "Kunci Jawaban / Pasangan Menjodohkan": "C" },
            { "Nomor Soal": 2, "Tipe Soal (PG / PGK / Menjodohkan / Essay)": "PGK", "Bobot Soal": 15, "Teks Pertanyaan": "Contoh Soal PGK?", "Link Media Pertanyaan (URL Gambar/Audio/Video)": "", "Opsi A": "Benar 1", "Link Media Opsi A (URL Gambar)": "", "Opsi B": "Salah 1", "Link Media Opsi B (URL Gambar)": "", "Opsi C": "Benar 2", "Link Media Opsi C (URL Gambar)": "", "Opsi D": "Salah 2", "Link Media Opsi D (URL Gambar)": "", "Opsi E": "Benar 3", "Link Media Opsi E (URL Gambar)": "", "Kunci Jawaban / Pasangan Menjodohkan": "A,C,E" }
        ];
        const worksheet = XLSX.utils.json_to_sheet(templateData); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Format Input Soal");
        worksheet['!cols'] = [ {wch: 12}, {wch: 25}, {wch: 12}, {wch: 45}, {wch: 35}, {wch: 20}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 45} ];
        XLSX.writeFile(workbook, "Template_Upload_Soal_SMAICH.xlsx");
    };

    async function prosesUploadMassal(jsonData, mapel, kelas) {
        if (jsonData.length === 0) throw new Error("File kosong atau tidak sesuai format Template!");
        let updates = []; let timestampAwal = new Date().getTime();
        
        for (let row of jsonData) {
            let tipeRaw = String(row["Tipe Soal (PG / PGK / Menjodohkan / Essay)"] || "PG").toUpperCase().trim();
            let tipeFormat = "PG"; if (tipeRaw.includes('ESSAY')) tipeFormat = 'Essay'; else if (tipeRaw.includes('PGK')) tipeFormat = 'PGK'; else if (tipeRaw.includes('JODOH') || tipeRaw.includes('MENJODOHKAN')) tipeFormat = 'Menjodohkan';
            timestampAwal += 10;

            let payload = { mataPelajaran: mapel, kelas: [kelas], nomor_soal: parseInt(row["Nomor Soal"]) || 1, bobot: parseFloat(row["Bobot Soal"]) || 1, tipe: tipeFormat, teks_soal: String(row["Teks Pertanyaan"] || ""), createdAt: new Date(timestampAwal), updatedAt: new Date(timestampAwal) };
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
        await Promise.all(updates); await normalizeUrutanSoal(mapel, kelas);
        window.customAlert(`Sukses! ${jsonData.length} Soal berhasil diunggah dengan aman.`, "success");
        window.bukaDetailSoal(mapel, kelas);
        loadBankSoalSummary();
    }

    document.getElementById('btn-import-gdrive')?.addEventListener('click', () => {
        const mapel = document.getElementById('soal-mapel').value; 
        const kelas = document.getElementById('soal-kelas').value;
        if(!mapel || !kelas) return window.customAlert("Silakan Pilih Mata Pelajaran & Kelas di form bawah terlebih dahulu untuk menentukan letak mapel!", "warning");
        document.getElementById('input-gdrive-url').value = ''; document.getElementById('modal-import-gdrive').style.display = 'flex';
    });

    document.getElementById('btn-proses-gdrive')?.addEventListener('click', async () => {
        const urlInput = document.getElementById('input-gdrive-url').value.trim(); if (!urlInput) return window.customAlert("Masukkan link Google Sheets terlebih dahulu!", "warning");
        const match = urlInput.match(/\/d\/([a-zA-Z0-9-_]+)/); if (!match || !match[1]) return window.customAlert("Link tidak valid!", "error");
        
        const sheetId = match[1]; document.getElementById('modal-import-gdrive').style.display = 'none';
        
        const mapel = document.getElementById('soal-mapel').value; 
        const kelas = document.getElementById('soal-kelas').value;
        
        document.getElementById('modal-tambah-soal').style.display = 'none';
        document.getElementById('view-summary-bank-soal').style.display = 'none';
        document.getElementById('view-soal-list').style.display = 'block';
        document.getElementById('label-mapel-edit').innerText = `${mapel} - ${kelas}`;

        const container = document.getElementById('list-soal');
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--info); font-weight:bold;"><i class="fas fa-spinner fa-spin fa-3x" style="margin-bottom:15px;"></i><br>Sedang menyedot data dari Google Drive...</div>';

        try {
            const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`; const response = await fetch(exportUrl);
            if (!response.ok) throw new Error("Akses ditolak. Pastikan dibagikan publik (Anyone with the link).");
            const csvText = await response.text(); if (csvText.includes('<!DOCTYPE html>')) throw new Error("Terdeteksi HTML. Set publik tanpa login.");

            const workbook = XLSX.read(csvText, { type: 'string' }); const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet); await prosesUploadMassal(jsonData, mapel, kelas);
        } catch (err) { window.customAlert("Gagal Import G-Drive: " + err.message, "error"); window.bukaDetailSoal(mapel, kelas); }
    });

    document.getElementById('upload-excel-soal')?.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const mapel = document.getElementById('soal-mapel').value; 
        const kelas = document.getElementById('soal-kelas').value;
        
        if(!mapel || !kelas) { 
            e.target.value = ''; 
            return window.customAlert("Silakan Pilih Mata Pelajaran dan Kelas di form bawah terlebih dahulu untuk menentukan letak mapel!", "error"); 
        }

        document.getElementById('modal-tambah-soal').style.display = 'none';
        document.getElementById('view-summary-bank-soal').style.display = 'none';
        document.getElementById('view-soal-list').style.display = 'block';
        document.getElementById('label-mapel-edit').innerText = `${mapel} - ${kelas}`;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const container = document.getElementById('list-soal'); container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--info); font-weight:bold;"><i class="fas fa-spinner fa-spin fa-3x" style="margin-bottom:15px;"></i><br>Membaca file Excel lokal & Menyimpan...</div>';
                const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData = XLSX.utils.sheet_to_json(worksheet);
                await prosesUploadMassal(jsonData, mapel, kelas);
            } catch (err) { window.customAlert("Gagal memproses Excel: " + err.message, "error"); window.bukaDetailSoal(mapel, kelas); }
        };
        reader.readAsArrayBuffer(file); e.target.value = '';
    });
    
    // ==========================================
    // 7. HASIL UJIAN
    // ==========================================
    async function loadDataHasil() {
        try {
            const snap = await getDocs(collection(db, "hasil_ujian")); document.getElementById('stat-ujian').innerText = snap.size;
            allHasilUjian = []; snap.forEach(d => allHasilUjian.push({ id: d.id, ...d.data() }));

            const gridMapel = document.getElementById('grid-mapel-hasil'); if(!gridMapel) return;
            let allowedMapel = listMapel; if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }
            let summaryMapel = {};
            
            allHasilUjian.forEach(h => {
                if (allowedMapel.includes(h.mataPelajaran)) {
                    let key = `${h.mataPelajaran} - Kelas ${h.kelas}`;
                    if(!summaryMapel[key]) summaryMapel[key] = { mapel: h.mataPelajaran, kelas: h.kelas, count: 0, avg: 0, totalNilai: 0 };
                    summaryMapel[key].count++; 
                    let nilaiSiswa = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : (h.nilai || 0));
                    summaryMapel[key].totalNilai += nilaiSiswa;
                }
            });

            gridMapel.innerHTML = '';
            for (let key in summaryMapel) {
                let s = summaryMapel[key]; let rataRata = (s.totalNilai / s.count).toFixed(2);
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
            if(gridMapel.innerHTML === '') gridMapel.innerHTML = '<p style="grid-column: 1 / -1; text-align:center; color:var(--text-muted);">Belum ada data hasil ujian.</p>';
        } catch(e) {}
    }

    window.bukaDetailHasil = (mapel, kelas) => { currentMapelDetail = mapel; currentKelasDetail = kelas; document.getElementById('label-mapel-detail').innerText = `HASIL: ${mapel} - KELAS ${kelas}`; window.location.hash = 'section-hasil-detail'; renderDetailHasil(); };

    window.lihatDetailStatus = (status, pelanggaran) => {
        let title = "Detail Status Ujian"; let msg = ""; let type = "info";
        if (status === 'NORMAL') { type = "success"; title = "Status: NORMAL"; msg = `Ujian diselesaikan dengan baik oleh siswa.\n\nTotal pelanggaran terdeteksi: ${pelanggaran} kali.`; } 
        else if (status === 'DISKUALIFIKASI' || status === 'DIHENTIKAN PAKSA') { type = "error"; title = `Status: ${status}`; msg = `Ujian dihentikan paksa oleh sistem keamanan CBT.\n\nSiswa telah melakukan pelanggaran sebanyak ${pelanggaran} kali.`; } 
        else if (status === 'WAKTU HABIS') { type = "warning"; title = "Status: WAKTU HABIS"; msg = `Durasi ujian telah habis.\nSistem otomatis mengumpulkan jawaban terakhir.`; } 
        else { type = "info"; title = `Status Ujian: ${status}`; msg = `Ujian disubmit dengan status: ${status}.\n\nTotal pelanggaran terdeteksi: ${pelanggaran} kali.`; }
        window.customAlert(msg, type, title);
    };

    function renderDetailHasil() {
        const tbody = document.querySelector('#table-hasil tbody'); if (!tbody) return;
        const dataFiltered = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && h.kelas === currentKelasDetail);
        dataFiltered.sort((a, b) => new Date(b.waktuSubmit) - new Date(a.waktuSubmit));

        if (dataFiltered.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Belum ada data hasil ujian.</td></tr>'; } 
        else {
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
    }

    window.downloadExcelHasil = async (mapel = currentMapelDetail, kelas = currentKelasDetail) => {
        const dataFiltered = allHasilUjian.filter(h => h.mataPelajaran === mapel && h.kelas === kelas);
        if (dataFiltered.length === 0) { window.customAlert("Tidak ada data hasil ujian.", "warning"); return; }
        const btn = document.querySelector(`button[onclick="window.downloadExcelHasil()"]`) || document.querySelector(`button[onclick*="downloadExcelHasil('${mapel}'"]`);
        let origText = ""; if (btn) { origText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan Bank Soal...'; btn.disabled = true; }

        try {
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel)); 
            const soalSnap = await getDocs(q); 
            
            let soalArr = [];
            soalSnap.forEach(doc => {
                let data = doc.data();
                let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
                if (arrKelas.includes(kelas)) {
                    soalArr.push({ id: doc.id, ...data });
                }
            }); 
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

    window.hapusHasil = async (id) => { if(await customConfirm("Hapus hasil ujian siswa ini?", "danger")) { await deleteDoc(doc(db, "hasil_ujian", id)); loadDataHasil(); renderDetailHasil(); } };

    document.getElementById('btn-hapus-semua-hasil')?.addEventListener('click', async () => {
        if (!currentMapelDetail || !currentKelasDetail) return;
        if (await window.customConfirm(`Hapus SEMUA data hasil ujian untuk mapel ${currentMapelDetail} di Kelas ${currentKelasDetail}?`, "danger", "Kosongkan Data")) {
            const btnHapusAll = document.getElementById('btn-hapus-semua-hasil'); const origText = btnHapusAll.innerHTML;
            btnHapusAll.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghapus Massal...'; btnHapusAll.disabled = true;
            try {
                const dataAkanDihapus = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && h.kelas === currentKelasDetail);
                await Promise.all(dataAkanDihapus.map(h => deleteDoc(doc(db, "hasil_ujian", h.id))));
                await window.customAlert(`${dataAkanDihapus.length} data berhasil dikosongkan!`, "success"); loadDataHasil(); window.location.hash = 'section-hasil';
            } catch (e) { await window.customAlert("Terjadi kesalahan saat menghapus data massal.", "error"); }
            btnHapusAll.innerHTML = origText; btnHapusAll.disabled = false;
        }
    });

});
