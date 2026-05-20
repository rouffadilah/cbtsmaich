import { auth, db, storage, functions } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-functions.js";

// Variabel Globals
let listMapel = []; let listKelas = []; let allUsersData = []; let allHasilUjian = []; 
let currentMapelDetail = ""; let currentKelasDetail = "";
let isAdmin = false; let isGuru = false; let userMapel = []; let userKelas = [];

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
// 2. LOGIKA UTAMA DASHBOARD & AUTHENTIKASI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    if (!window.location.hash) { window.location.hash = 'section-beranda'; }
    window.addEventListener('popstate', function() {
        if (!window.location.hash || window.location.hash === '') { window.location.hash = 'section-beranda'; }
    });

    try { 
        let userRoles = JSON.parse(localStorage.getItem("userRole") || "[]"); 
        userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]"); 
        userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
        isAdmin = userRoles.includes("admin"); 
        isGuru = userRoles.includes("guru");
    } catch (e) {}

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
            const btnMaster = document.getElementById('btn-open-data-master'); if (btnMaster) btnMaster.style.display = 'none';
            const btnAddUser = document.getElementById('btn-open-manajemen'); if (btnAddUser) btnAddUser.style.display = 'none';
            const wrapRegGuru = document.getElementById('wrap-reg-guru'); if (wrapRegGuru) wrapRegGuru.style.display = 'none';
            const wrapRegSiswa = document.getElementById('wrap-reg-siswa'); if (wrapRegSiswa) wrapRegSiswa.style.display = 'none';
            const btnHapusAll = document.getElementById('btn-hapus-semua-hasil'); if (btnHapusAll) btnHapusAll.style.display = 'none';
        } else {
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
            target.style.display = 'block'; if (icon) icon.style.transform = 'rotate(180deg)'; header.style.background = '#f8fafc';
        } else {
            target.style.display = 'none'; if (icon) icon.style.transform = 'rotate(0deg)'; header.style.background = '#ffffff';
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
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", h.mataPelajaran), where("kelas", "==", h.kelas));
            const snap = await getDocs(q);
            
            if(snap.empty) { 
                container.innerHTML = '<div style="text-align:center; color:var(--danger); padding: 20px; background: white; border-radius: 8px;">Soal ujian tidak ditemukan di database. (Mungkin sudah dihapus)</div>'; 
                return; 
            }

            let soalArr = []; 
            snap.forEach(doc => soalArr.push({id: doc.id, ...doc.data()}));
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
            const docSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
            if (docSnap.exists()) { listMapel = docSnap.data().list_mapel || []; listKelas = docSnap.data().list_kelas || []; }
            renderTableMaster(); populateSemuaDropdown(); loadBankSoalSummary();
        } catch (e) {}
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
    }

    // ==========================================
    // 5. MANAJEMEN PENGGUNA (EDIT & HAPUS AKUN)
    // ==========================================
    async function loadDataPengguna() {
        const tbodyGuru = document.querySelector('#table-guru tbody'); const tbodySiswa = document.querySelector('#table-siswa tbody');
        if (tbodyGuru) tbodyGuru.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>`;
        if (tbodySiswa) tbodySiswa.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>`;
        try {
            const snap = await getDocs(collection(db, "users"));
            let countSiswa = 0; let countGuru = 0; let htmlGuru = ''; let htmlSiswa = '';
            allUsersData = []; 
            snap.forEach(d => {
                const data = d.data(); const id = d.id; allUsersData.push({ id, ...data });
                let roleArray = typeof data.role === 'string' ? [data.role] : (Array.isArray(data.role) ? data.role : []);
                if (roleArray.includes('guru') || roleArray.includes('admin')) {
                    countGuru++; let mapelStr = data.mapel ? (Array.isArray(data.mapel) ? data.mapel.join(', ') : data.mapel) : '-'; let kelasStr = data.kelas ? (Array.isArray(data.kelas) ? data.kelas.join(', ') : data.kelas) : '-';
                    htmlGuru += `<tr><td>${data.username || '-'}</td><td><b>${data.nama || '-'}</b></td><td>${roleArray.join(', ').toUpperCase()}</td><td><div style="font-size:0.8rem;">M: ${mapelStr}<br>K: ${kelasStr}</div></td></tr>`;
                } 
                if (roleArray.includes('siswa')) {
                    countSiswa++; htmlSiswa += `<tr><td>${data.username || '-'}</td><td><b>${data.nama || '-'}</b></td><td>SISWA</td><td>${data.kelas || '-'}</td></tr>`;
                }
            });
            if (tbodyGuru) tbodyGuru.innerHTML = countGuru > 0 ? htmlGuru : `<tr><td colspan="4" style="text-align:center;">Belum ada data guru.</td></tr>`;
            if (tbodySiswa) tbodySiswa.innerHTML = countSiswa > 0 ? htmlSiswa : `<tr><td colspan="4" style="text-align:center;">Belum ada data siswa.</td></tr>`;
            let statSiswaEl = document.getElementById('stat-siswa'); if (statSiswaEl) statSiswaEl.innerText = countSiswa + countGuru;
        } catch (e) { console.error(e); }
    }

    // =================================================================
    // 6. BANK SOAL & FITUR BARU: AUTO-RENUMBERING & GOOGLE FORM UI
    // =================================================================
    async function loadBankSoalSummary() {
        const tbody = document.querySelector('#table-bank-soal-summary tbody'); if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Memuat data...</td></tr>';
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            let summary = {}; let uniqueMapel = new Set(); 
            snap.forEach(d => {
                let mapel = d.data().mataPelajaran; let kelas = d.data().kelas; uniqueMapel.add(mapel); let key = `${mapel}_${kelas}`;
                if(!summary[key]) summary[key] = { mapel, kelas, count: 0 }; summary[key].count++;
            });
            let statSoalEl = document.getElementById('stat-soal'); if (statSoalEl) statSoalEl.innerText = uniqueMapel.size;
            const waktuSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian")); const waktuData = waktuSnap.exists() ? waktuSnap.data() : {};
            const jadwalSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian")); const jadwalData = jadwalSnap.exists() ? jadwalSnap.data() : {};
            const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian")); const tokenData = tokenSnap.exists() ? tokenSnap.data() : {};
            let html = '';
            for (let key in summary) {
                let d = summary[key]; let jadwal = jadwalData[key] ? jadwalData[key].replace('T', ' ') : '-'; let durasi = waktuData[key] ? waktuData[key] + ' Mnt' : '-';
                let token = '-'; if(tokenData[`token_${key}`]) { token = typeof tokenData[`token_${key}`] === 'object' ? tokenData[`token_${key}`].code : tokenData[`token_${key}`]; }
                let isMapelGuru = isGuru && userMapel.includes(d.mapel);
                let actionBtn = (isAdmin || isMapelGuru) ? `<button onclick="window.bukaDetailSoal('${d.mapel}', '${d.kelas}')" class="btn-3d" style="background:var(--info); padding:5px 15px; font-size:0.85rem;"><i class="fas fa-cog"></i> Kelola</button>` : `<span style="color:var(--text-muted); font-size:0.85rem;"><i class="fas fa-lock"></i> Terkunci</span>`;
                html += `<tr><td>${d.mapel}</td><td>${d.kelas}</td><td>${jadwal}</td><td>${durasi}</td><td style="font-weight:bold; color:var(--danger);">${token}</td><td>${d.count}</td><td style="text-align:center;">${actionBtn}</td></tr>`;
            }
            if(html === '') html = '<tr><td colspan="7" style="text-align:center;">Tidak ada data soal.</td></tr>';
            tbody.innerHTML = html;
        } catch (e) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Gagal memuat data</td></tr>'; }
    }

    document.getElementById('soal-tipe')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const pgOpts = document.getElementById('pg-options'); const menjodohkanOpts = document.getElementById('menjodohkan-options'); const essayOpts = document.getElementById('essay-options'); 
        const kunciPg = document.querySelectorAll('.kunci-pg-container'); const kunciPgk = document.querySelectorAll('.kunci-pgk-container');
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

    // FUNGSI INTI: Normalisasi Nomor Urut Soal Otomatis
    async function normalizeUrutanSoal(mapel, kelas) {
        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel), where("kelas", "==", kelas));
        const snap = await getDocs(q);
        let soalArr = [];
        snap.forEach(doc => soalArr.push({id: doc.id, ...doc.data()}));
        
        // Urutkan berdasarkan nomor_soal. Jika kembar, data yang paling baru diubah/dibuat diutamakan (naik)
        soalArr.sort((a, b) => {
            if (a.nomor_soal === b.nomor_soal) {
                let timeA = a.updatedAt || a.createdAt; timeA = timeA ? (timeA.toMillis ? timeA.toMillis() : new Date(timeA).getTime()) : 0;
                let timeB = b.updatedAt || b.createdAt; timeB = timeB ? (timeB.toMillis ? timeB.toMillis() : new Date(timeB).getTime()) : 0;
                return timeB - timeA; 
            }
            return (a.nomor_soal || 0) - (b.nomor_soal || 0);
        });

        // Tulis ulang urutan ke database
        let updates = [];
        soalArr.forEach((s, idx) => {
            let correctNum = idx + 1;
            if (s.nomor_soal !== correctNum) {
                updates.push(updateDoc(doc(db, "bank_soal", s.id), { nomor_soal: correctNum }));
            }
        });
        
        if (updates.length > 0) { await Promise.all(updates); }
    }

    // SUBMIT PENYIMPANAN SOAL
    document.getElementById('form-tambah-soal')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mapel = document.getElementById('soal-mapel').value;
        const kelas = document.getElementById('soal-kelas').value;
        const tipe = document.getElementById('soal-tipe').value;
        const teks = document.getElementById('soal-teks').value;
        const nomorSoalTarget = parseInt(document.getElementById('soal-nomor').value) || 1;

        const btnSubmitSoal = e.target.querySelector('button[type="submit"]');
        const originalText = btnSubmitSoal.innerHTML;
        btnSubmitSoal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENGUNGGAH & MENYIMPAN...'; btnSubmitSoal.disabled = true;

        try {
            const fileSoal = document.getElementById('soal-media').files[0];
            let mediaSoal = await uploadMediaToStorage(fileSoal, `bank_soal/${mapel}_${kelas}`);

            // updatedAt penting untuk tie-breaker (penyisipan nomor yang sama)
            let payload = { mataPelajaran: mapel, kelas: kelas, nomor_soal: nomorSoalTarget, tipe: tipe, teks_soal: teks, updatedAt: new Date() };
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
                if (pasangan.length === 0) throw new Error("Masukkan minimal satu pasangan!");
                payload.pasangan = pasangan;
            } else if (tipe === 'Essay') {
                const kunciEssay = document.getElementById('soal-kunci-essay').value.trim();
                if (kunciEssay) { payload.kunci_jawaban = kunciEssay; }
            }

            const editId = document.getElementById('edit-soal-id').value;
            
            if (editId) {
                await updateDoc(doc(db, "bank_soal", editId), payload);
            } else {
                payload.createdAt = new Date();
                await addDoc(collection(db, "bank_soal"), payload);
            }

            // Jalankan penomoran otomatis
            await normalizeUrutanSoal(mapel, kelas);

            document.getElementById('form-tambah-soal').reset();
            document.getElementById('edit-soal-id').value = '';
            document.getElementById('modal-tambah-soal').style.display = 'none';

            // Refresh UI
            const curMapel = document.getElementById('filter-soal-mapel').value;
            const curKelas = document.getElementById('filter-soal-kelas').value;
            
            if(document.getElementById('view-soal-list').style.display === 'block') {
                window.loadDaftarSoal(curMapel, curKelas);
            }
            loadBankSoalSummary();
            // Optional alert success
            window.customAlert("Soal berhasil disimpan & diurutkan!", "success");

        } catch(err) { window.customAlert(err.message || "Gagal menyimpan soal.", "error"); } 
        finally { btnSubmitSoal.innerHTML = originalText; btnSubmitSoal.disabled = false; }
    });

    window.bukaModalTambahSoal = (mapelParams = "", kelasParams = "", targetNomor = "") => {
        document.getElementById('edit-soal-id').value = '';
        document.getElementById('form-tambah-soal').reset();
        
        const mapelSelect = document.getElementById('soal-mapel');
        const kelasSelect = document.getElementById('soal-kelas');
        const inputNomor = document.getElementById('soal-nomor');
        const modalTitle = document.getElementById('title-modal-soal');

        let allowedMapel = listMapel;
        if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); }

        mapelSelect.innerHTML = '<option value="" disabled selected>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        kelasSelect.innerHTML = '<option value="" disabled selected>-- Pilih Kelas --</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');

        if (mapelParams && kelasParams) {
            modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Soal (Mapel Ini)';
            mapelSelect.value = mapelParams; kelasSelect.value = kelasParams;
            mapelSelect.style.pointerEvents = 'none'; mapelSelect.style.backgroundColor = '#e2e8f0';
            kelasSelect.style.pointerEvents = 'none'; kelasSelect.style.backgroundColor = '#e2e8f0';
        } else {
            modalTitle.innerHTML = '<i class="fas fa-file-import"></i> Input Soal (Buat Mapel Baru)';
            mapelSelect.value = ""; kelasSelect.value = "";
            mapelSelect.style.pointerEvents = 'auto'; mapelSelect.style.backgroundColor = '#fafafa';
            kelasSelect.style.pointerEvents = 'auto'; kelasSelect.style.backgroundColor = '#fafafa';
        }
        
        // Auto-fill nomor yang disisipkan
        inputNomor.value = targetNomor;

        document.getElementById('modal-tambah-soal').style.display = 'flex';
        document.getElementById('soal-tipe').dispatchEvent(new Event('change'));
    };

    document.getElementById('btn-tambah-langsung')?.addEventListener('click', () => { window.bukaModalTambahSoal(); });

    // SET KETIKA KARTU SOAL DIKLIK -> BUKA FORM EDIT
    window.editDataSoal = (id) => {
        const soal = window.tempDataSoalKelola.find(s => s.id === id);
        if (!soal) return;
        
        document.getElementById('edit-soal-id').value = id;
        document.getElementById('soal-mapel').value = soal.mataPelajaran;
        document.getElementById('soal-kelas').value = soal.kelas;
        document.getElementById('soal-nomor').value = soal.nomor_soal || ''; 
        document.getElementById('soal-tipe').value = soal.tipe || 'PG';
        document.getElementById('soal-teks').value = soal.teks_soal || '';
        
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

    // RENDER UI "GOOGLE FORMS" DI DAFTAR SOAL
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
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel), where("kelas", "==", kelas));
            const snap = await getDocs(q);
            
            let soalArr = []; 
            snap.forEach(doc => soalArr.push({id: doc.id, ...doc.data()}));
            soalArr.sort((a,b) => (a.nomor_soal || 0) - (b.nomor_soal || 0)); 
            
            window.tempDataSoalKelola = soalArr; 

            if(soalArr.length === 0) { 
                container.innerHTML = `
                <div style="text-align:center; padding: 30px; background: white; border: 1px dashed var(--border-color); border-radius: 8px;">
                    Belum ada soal untuk mata pelajaran ini.<br><br>
                    <button onclick="window.bukaModalTambahSoal('${mapel}', '${kelas}', 1)" class="btn-3d" style="background:var(--success); padding:8px 20px; border-radius:20px; font-size:0.9rem; margin:0 auto;"><i class="fas fa-plus"></i> Buat Soal Pertama</button>
                </div>`; 
                return; 
            }

            let html = '';
            
            // TOMBOL SISIPKAN PERTAMA KALI (ATAS SENDIRI)
            html += `
            <div style="display:flex; justify-content:center; position:relative; margin-bottom: 15px; margin-top: 5px;">
                <hr style="position:absolute; width:100%; top:50%; border:none; border-top:1px dashed #cbd5e1; z-index:1;">
                <button onclick="window.bukaModalTambahSoal('${mapel}', '${kelas}', 1)" class="btn-3d" style="background:white; color:var(--success); border:1px solid var(--success); padding:4px 15px; border-radius:20px; font-size:0.8rem; z-index:2; box-shadow:0 2px 5px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='var(--success)'; this.style.color='white'" onmouseout="this.style.background='white'; this.style.color='var(--success)'"><i class="fas fa-plus"></i> Sisipkan Soal di Sini</button>
            </div>`;
            
            soalArr.forEach((s, idx) => {
                // KARTU SOAL (BISA DIKLIK KESELURUHAN)
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
                            <span style="font-weight:800; font-size:1.1rem; color:var(--secondary);">Soal ${s.nomor_soal || (idx+1)}</span>
                            <span style="background:#f1f5f9; color:var(--text-muted); padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold; border:1px solid #e2e8f0;">${s.tipe || 'PG'}</span>
                        </div>
                        
                        <div style="color:var(--text-main); line-height:1.6; font-size: 1rem; margin-bottom:15px;">${s.teks_soal}</div>
                        ${s.media_soal ? `<div style="margin-bottom:15px; font-size:0.85rem; color:var(--info); background:#eff6ff; padding:8px 12px; border-radius:6px; display:inline-block;"><i class="fas fa-paperclip"></i> Terlampir File Media (${s.media_soal.type.toUpperCase()})</div><br>` : ''}
                `;
                
                // RENDER OPSI JAWABAN (PREVIEW)
                if (s.tipe === 'PG' || s.tipe === 'PGK' || !s.tipe) {
                    html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
                    ['A','B','C','D','E'].forEach(o => {
                        let teksOpsi = (s.opsi && s.opsi[o]) ? s.opsi[o] : '';
                        if(teksOpsi) {
                            let isBenar = false;
                            if ((s.tipe === 'PG' || !s.tipe) && s.kunci_jawaban === o) isBenar = true;
                            if (s.tipe === 'PGK' && Array.isArray(s.kunci_jawaban) && s.kunci_jawaban.includes(o)) isBenar = true;
                            
                            if (isBenar) {
                                html += `<div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; color:var(--success); font-weight:600; font-size:0.9rem;"><i class="fas fa-check-circle"></i> <span>${o}. ${teksOpsi}</span></div>`;
                            } else {
                                html += `<div style="display:flex; align-items:center; gap:10px; padding:8px 12px; border:1px solid #f1f5f9; border-radius:6px; color:var(--text-muted); font-size:0.9rem;"><span style="font-weight:600; width:20px;">${o}.</span> <span>${teksOpsi}</span></div>`;
                            }
                        }
                    });
                    html += `</div>`;
                } else if (s.tipe === 'Menjodohkan') {
                    html += `<div style="font-size:0.9rem; background:#eff6ff; border: 1px solid #bfdbfe; color:#1e40af; padding:15px; border-radius:8px; display:inline-block; width:100%;"><b>Pasangan Jawaban Benar:</b><div style="margin-top: 10px; display:flex; flex-direction:column; gap:8px;">`;
                    if(s.pasangan) { s.pasangan.forEach(p => { html += `<div style="display:flex; align-items:center; gap:10px;"><span style="flex:1; background:white; padding:10px 15px; border-radius:6px; border:1px solid #bfdbfe; color:var(--secondary);">${p.kiri}</span> <i class="fas fa-arrow-right" style="color:#60a5fa;"></i> <span style="flex:1; background:#dcfce7; padding:10px 15px; border-radius:6px; border:1px solid #bbf7d0; color:var(--success); font-weight:bold;">${p.kanan}</span></div>`; }); }
                    html += `</div></div>`;
                } else if (s.tipe === 'Essay') {
                    if (s.kunci_jawaban) { html += `<div style="font-size:0.9rem; background:#f0fdf4; border: 1px solid #bbf7d0; color:#166534; padding:15px; border-radius:8px; display:inline-block; width:100%; margin-top: 10px;"><b>Referensi Jawaban:</b><div style="margin-top: 8px; color: #15803d; line-height: 1.5;">${s.kunci_jawaban}</div></div>`; } 
                }
                
                html += `</div></div>`; // Tutup padding dan card
                
                // TOMBOL SISIPKAN SETELAH SOAL INI
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
                await deleteDoc(doc(db, "bank_soal", id)); 
                const curMapel = document.getElementById('filter-soal-mapel').value;
                const curKelas = document.getElementById('filter-soal-kelas').value;
                
                // Normalisasi agar nomor kembali urut menutup yang kosong (contoh 1,3 -> 1,2)
                await normalizeUrutanSoal(curMapel, curKelas);
                
                window.loadDaftarSoal(curMapel, curKelas); 
                loadBankSoalSummary(); 
            } 
            catch(e) { window.customAlert("Gagal menghapus soal", "error"); }
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
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

        try {
            if(waktu) await setDoc(doc(db, "pengaturan", "waktu_ujian"), { [key]: waktu }, { merge: true });
            if(jadwal) await setDoc(doc(db, "pengaturan", "jadwal_ujian"), { [key]: jadwal }, { merge: true });
            if(token) { await setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${key}`]: { code: token, active: true } }, { merge: true }); }
            window.customAlert("Pengaturan ujian berhasil disimpan!", "success"); loadBankSoalSummary();
        } catch(e) { window.customAlert("Gagal menyimpan pengaturan.", "error"); }
        btn.innerHTML = origHtml; btn.disabled = false;
    });

    // ==========================================
    // 7. HASIL UJIAN (Tetap seperti sebelumnya)
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
        else if (status === 'DISKUALIFIKASI' || status === 'DIHENTIKAN PAKSA') { type = "error"; title = `Status: ${status}`; msg = `Ujian dihentikan paksa oleh sistem keamanan CBT SMAICH.\n\nSiswa telah melakukan pelanggaran sebanyak ${pelanggaran} kali.`; } 
        else if (status === 'WAKTU HABIS') { type = "warning"; title = "Status: WAKTU HABIS"; msg = `Durasi ujian telah habis.\nSistem otomatis mengumpulkan jawaban terakhir.\n\nTotal pelanggaran terdeteksi: ${pelanggaran} kali.`; } 
        else { type = "info"; title = `Status Ujian: ${status}`; msg = `Ujian disubmit dengan status: ${status}.\n\nTotal pelanggaran terdeteksi: ${pelanggaran} kali.`; }
        window.customAlert(msg, type, title);
    };

    function renderDetailHasil() {
        const tbody = document.querySelector('#table-hasil tbody'); if (!tbody) return;
        const dataFiltered = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && h.kelas === currentKelasDetail);
        
        if (dataFiltered.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Belum ada data hasil ujian.</td></tr>'; } 
        else {
            let html = '';
            dataFiltered.forEach((h, index) => {
                const namaSiswa = h.nama || "Nama Tidak Terdata"; const nisSiswa = h.username || h.uid || "-";
                const nilai = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : 0);
                const jmlPelanggaran = h.pelanggaran || 0; const status = h.statusPelanggaran || 'NORMAL';
                
                let warnaStatus = '#10b981'; 
                if (status === 'DISKUALIFIKASI' || status === 'DIHENTIKAN PAKSA') warnaStatus = '#ef4444'; else if (status === 'WAKTU HABIS') warnaStatus = '#f59e0b';
                
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
        if (dataFiltered.length === 0) { window.customAlert("Tidak ada data hasil ujian yang bisa diunduh untuk kelas ini.", "warning"); return; }

        const btn = document.querySelector(`button[onclick="window.downloadExcelHasil()"]`) || document.querySelector(`button[onclick*="downloadExcelHasil('${mapel}'"]`);
        let origText = ""; if (btn) { origText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan Bank Soal...'; btn.disabled = true; }

        try {
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel), where("kelas", "==", kelas)); const soalSnap = await getDocs(q); let soalArr = [];
            soalSnap.forEach(doc => soalArr.push({ id: doc.id, ...doc.data() })); soalArr.sort((a, b) => (a.nomor_soal || 0) - (b.nomor_soal || 0));

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

            const namaFileClean = `Hasil_Lengkap_CBT_${mapel}_${kelas}`.replace(/[^a-zA-Z0-9]/g, "_"); XLSX.writeFile(workbook, `${namaFileClean}.xlsx`);
        } catch (e) { console.error("Gagal generate excel lengkap:", e); window.customAlert("Terjadi kesalahan sistem saat mencoba merekap data jawaban ke excel.", "error"); } finally { if (btn) { btn.innerHTML = origText; btn.disabled = false; } }
    };

    window.hapusHasil = async (id) => { if(await customConfirm("Hapus hasil ujian siswa ini?", "danger")) { await deleteDoc(doc(db, "hasil_ujian", id)); loadDataHasil(); renderDetailHasil(); } };

    document.getElementById('btn-hapus-semua-hasil')?.addEventListener('click', async () => {
        if (!currentMapelDetail || !currentKelasDetail) return;
        if (await window.customConfirm(`Hapus SEMUA data hasil ujian untuk mapel ${currentMapelDetail} di Kelas ${currentKelasDetail}? Tindakan ini tidak bisa dibatalkan.`, "danger", "Kosongkan Data")) {
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
