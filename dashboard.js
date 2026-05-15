import { auth, db, storage } from './firebase-config.js'; 
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Variabel Globals
let listMapel = []; let listKelas = []; let allUsersData = []; let allSoalData = []; let filteredSoalData = [];
let previewCurrentIdx = 0; let allHasilUjian = []; 
let currentMapelDetail = ""; let currentKelasDetail = ""; // Penambahan State Kelas

// ... [FUNGSI HELPER MODAL & ALERT TETAP SAMA] ...

document.addEventListener('DOMContentLoaded', () => {

    // Routing
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

    let userRoles = []; let userMapel = []; let userKelas = [];
    try { 
        userRoles = JSON.parse(localStorage.getItem("userRole") || "[]"); 
        userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]"); 
        userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
    } catch (e) {}
    
    const isAdmin = userRoles.includes("admin"); 
    const isGuru = userRoles.includes("guru");

    onAuthStateChanged(auth, async (user) => {
        if (!user || (!isAdmin && !isGuru)) { window.location.href = "index.html"; return; }
        
        let finalDisplayName = user.displayName || "Pengguna";

        const greetingText = document.getElementById('greeting-text'); 
        if (greetingText) greetingText.innerHTML = `Assalamu'alaikum, <span style="display: inline-block;">${finalDisplayName}! 🙏</span>`;

        // =====================================
        // RESTRIKSI GURU (HIDING ADMIN FEATURES)
        // =====================================
        if (!isAdmin) {
            // Sembunyikan Tombol Data Master & Tambah Akun
            const btnMaster = document.getElementById('btn-open-data-master');
            if (btnMaster) btnMaster.style.display = 'none';
            const btnAddUser = document.getElementById('btn-open-manajemen');
            if (btnAddUser) btnAddUser.style.display = 'none';
            
            // Sembunyikan Toggle Izin Registrasi
            const wrapRegGuru = document.getElementById('wrap-reg-guru');
            if (wrapRegGuru) wrapRegGuru.style.display = 'none';
            const wrapRegSiswa = document.getElementById('wrap-reg-siswa');
            if (wrapRegSiswa) wrapRegSiswa.style.display = 'none';
            
            // Sembunyikan Tombol Hapus Semua Hasil Ujian
            const btnHapusAll = document.getElementById('btn-hapus-semua-hasil');
            if (btnHapusAll) btnHapusAll.style.display = 'none';
        }

        if (isAdmin) { fetchStatusReg(); } 

        handleRouting(); 
        loadDataMaster(); 
        loadDataHasil(); 
        loadDataPengguna(); // Guru tetap bisa meload data pengguna, namun tanpa fungsi edit/delete
    });

    // ... [LOGIKA DATA MASTER, BANK SOAL, TOGGLE STATUS REGISTRASI TETAP SAMA] ...

    // ==========================================
    // MANAJEMEN PENGGUNA (READ ONLY UNTUK GURU)
    // ==========================================
    async function loadDataPengguna() {
        const tbodySiswa = document.querySelector('#table-siswa tbody'); 
        const tbodyGuru = document.querySelector('#table-guru tbody'); 
        if (!tbodySiswa || !tbodyGuru) return;
        
        tbodySiswa.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>';
        tbodyGuru.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>';
            
        try {
            const snap = await getDocs(collection(db, "users")); 
            const statSiswa = document.getElementById('stat-siswa'); if (statSiswa) statSiswa.innerText = snap.size; 
            
            tbodySiswa.innerHTML = ''; tbodyGuru.innerHTML = ''; allUsersData = []; 
            let countSiswa = 0; let countGuru = 0;

            snap.forEach(docSnap => {
                const data = docSnap.data(); data.id = docSnap.id; allUsersData.push(data);
                const rls = Array.isArray(data.role) ? data.role : [data.role]; 
                const roleColor = rls.includes('admin') ? 'var(--danger)' : (rls.includes('guru') ? 'var(--info)' : 'var(--success)');
                
                let detailText = '-';
                if (rls.includes('guru')) { detailText = `Mapel: ${Array.isArray(data.mapel) ? data.mapel.join(', ') : (data.mapel || '-')} <br><span style="font-size:0.75rem; color:var(--text-muted);">Kelas Ajar: ${Array.isArray(data.kelas) ? data.kelas.join(', ') : (data.kelas || '-')}</span>`; } 
                else if (rls.includes('siswa')) { detailText = `Kelas: ${data.kelas || '-'}`; }
                
                // RESTRIKSI TOMBOL AKSI
                let aksiHTML = '<span style="color:var(--text-muted);">-</span>';
                if (isAdmin) {
                    aksiHTML = `
                        <button onclick="window.editPengguna('${docSnap.id}')" style="color:var(--warning); background:none; border:none; cursor:pointer; font-size:1.1rem; margin-right:15px;" title="Edit Pengguna/Role"><i class="fas fa-edit"></i></button>
                        <button onclick="window.hapusDokumen('users', '${docSnap.id}', window.loadDataPengguna)" style="color:var(--danger); background:none; border:none; cursor:pointer; font-size:1.1rem;" title="Hapus Permanen"><i class="fas fa-trash"></i></button>
                    `;
                }

                const rowHTML = `<tr><td>${data.username}</td><td><strong>${data.nama}</strong></td><td><span style="background: ${roleColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${rls.join(', ').toUpperCase()}</span></td><td>${detailText}</td>
                    <td style="text-align: center;">${aksiHTML}</td></tr>`;
                
                if (rls.includes('guru') || rls.includes('admin')) {
                    tbodyGuru.innerHTML += rowHTML; countGuru++;
                } else {
                    tbodySiswa.innerHTML += rowHTML; countSiswa++;
                }
            });

        } catch (error) { 
            console.error(error); 
            tbodySiswa.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Gagal memuat data.</td></tr>'; 
        }
    }
    window.loadDataPengguna = loadDataPengguna;

    // ... [FUNGSI EDIT AKUN (TETAP SAMA KARENA HANYA DIPANGGIL BUTTON MILIK ADMIN)] ...

    // ==========================================
    // CAPAIAN SISWA (DIKELOMPOKKAN PER MAPEL & KELAS)
    // ==========================================
    async function loadDataHasil() {
        const snap = await getDocs(collection(db, "hasil_ujian")); document.getElementById('stat-ujian').innerText = snap.size;
        allHasilUjian = []; snap.forEach(d => allHasilUjian.push({id: d.id, ...d.data()}));
        const grid = document.getElementById('grid-mapel-hasil'); if(!grid) return; grid.innerHTML = '';
        
        // Logika Pengelompokan
        let groupedResults = {};
        allHasilUjian.forEach(h => {
            // Gabungkan Mapel dan Kelas sebagai Key unik
            let key = `${h.mataPelajaran}|${h.kelas}`;
            if (!groupedResults[key]) {
                groupedResults[key] = { mapel: h.mataPelajaran, kelas: h.kelas, count: 0 };
            }
            groupedResults[key].count++;
        });

        // Filter Guru hanya melihat kelas ajarnya
        let displayedResults = Object.values(groupedResults);
        if (!isAdmin && isGuru) {
            displayedResults = displayedResults.filter(g => userMapel.includes(g.mapel) && userKelas.includes(g.kelas));
        }

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

    // Ubah penangkapan klik menjadi dua parameter (Mapel & Kelas)
    window.openDetailHasil = (mapel, kelas) => {
        currentMapelDetail = mapel; 
        currentKelasDetail = kelas; 
        window.location.hash = 'section-hasil-detail'; 
        document.getElementById('label-mapel-detail').innerHTML = `${mapel} <span style="font-weight:normal; font-size:0.95rem; color:var(--text-muted);">(Kelas: ${kelas})</span>`;
        
        const tbody = document.querySelector('#table-hasil tbody'); tbody.innerHTML = '';
        
        // Filter berdasarkan Mapel dan Kelas
        const filtered = allHasilUjian.filter(h => h.mataPelajaran === mapel && h.kelas === kelas);
        
        filtered.forEach(h => { 
            let aksiHTML = '-';
            // Hanya admin yang bisa mendelete nilai spesifik
            if (isAdmin) {
                aksiHTML = `<button onclick="window.hapusLangsung('hasil_ujian', '${h.id}', this.parentElement.parentElement)" style="color: var(--danger); border: none; background: none; cursor: pointer; font-size: 1.2rem; transition: 0.2s;" title="Hapus Data Ini Langsung"><i class="fas fa-trash"></i></button>`;
            }

            tbody.innerHTML += `<tr>
                <td><b>${h.namaSiswa}</b></td>
                <td>${h.benar}/${h.totalSoal}</td>
                <td><b style="color: var(--primary); font-size: 1.1rem;">${h.nilai}</b></td>
                <td style="text-align: center;">${aksiHTML}</td>
            </tr>`; 
        });
    };

    window.refreshHasil = () => { loadDataHasil(); if(currentMapelDetail && currentKelasDetail) window.openDetailHasil(currentMapelDetail, currentKelasDetail); };

    // Penghapusan massal hanya untuk Mapel dan Kelas yang sedang dibuka
    document.getElementById('btn-hapus-semua-hasil')?.addEventListener('click', async () => {
        if (!currentMapelDetail || !currentKelasDetail) return;
        if (await window.customConfirm(`Hapus SEMUA data hasil ujian untuk mapel ${currentMapelDetail} di Kelas ${currentKelasDetail}? Tindakan ini tidak bisa dibatalkan.`, "danger", "Kosongkan Data")) {
            
            const btnHapusAll = document.getElementById('btn-hapus-semua-hasil');
            const origText = btnHapusAll.innerHTML;
            btnHapusAll.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghapus Massal...';
            btnHapusAll.disabled = true;
            
            try {
                // Filter hanya yang sesuai Mapel DAN Kelas
                const dataAkanDihapus = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && h.kelas === currentKelasDetail);
                await Promise.all(dataAkanDihapus.map(h => deleteDoc(doc(db, "hasil_ujian", h.id))));
                
                await window.customAlert(`${dataAkanDihapus.length} data berhasil dikosongkan!`, "success");
                window.refreshHasil(); 
                window.history.back();
            } catch (e) {
                await window.customAlert("Terjadi kesalahan saat menghapus data massal.", "error");
            }
            btnHapusAll.innerHTML = origText; btnHapusAll.disabled = false;
        }
    });

});
