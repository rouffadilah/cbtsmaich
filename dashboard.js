import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 0. AUTENTIKASI & KEAMANAN DASHBOARD
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        const fullName = user.displayName || user.email.split('@')[0] || "Guru";
        const firstName = fullName.split(' ')[0];

        const adminNameEl = document.getElementById('admin-name');
        if (adminNameEl) adminNameEl.innerText = fullName;

        const greetingEl = document.querySelector('.welcome-banner h2');
        if (greetingEl) greetingEl.innerHTML = `Assalamu'alaikum, ${firstName}! 👋`;
    } else {
        window.location.href = "index.html";
    }
});

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. INISIALISASI DATA 
    // ==========================================
    let dataSiswa = JSON.parse(localStorage.getItem('cbt_siswa')) || [];
    let dataSoal = JSON.parse(localStorage.getItem('cbt_soal')) || [];
    
    // Data simulasi hasil ujian beserta Rincian Nomor Soal yang Benar
    let dataHasil = JSON.parse(localStorage.getItem('cbt_hasil')) || [
        { nama: 'Ahmad Fauzi', kelas: 'XII TKJ 1', mapel: 'Informatika', benar: 44, salah: 6, totalSoal: 50, nilai: 88, waktu: '24 Apr 2026', rincianBenar: [1, 2, 3, 5, 8, 10, 11, 15, 20, 22, 25, 30, 31, 33, 35, 40, 42, 45, 48, 50] },
        { nama: 'Siti Nurhaliza', kelas: 'XII AKL 2', mapel: 'Informatika', benar: 47, salah: 3, totalSoal: 50, nilai: 94, waktu: '24 Apr 2026', rincianBenar: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
        { nama: 'Budi Santoso', kelas: 'XI RPL 1', mapel: 'Coding & AI', benar: 39, salah: 11, totalSoal: 50, nilai: 78, waktu: '24 Apr 2026', rincianBenar: [1, 4, 5, 6, 10, 15, 18, 20, 21, 25, 28, 30] }
    ];

    function getFilteredHasil() {
        const mapelGuru = localStorage.getItem('cbt_guru_mapel') || 'semua';
        if (mapelGuru === 'semua') return dataHasil;
        return dataHasil.filter(hasil => hasil.mapel === mapelGuru);
    }

    function updateStats() {
        document.getElementById('stat-siswa').innerText = dataSiswa.length;
        document.getElementById('stat-soal').innerText = dataSoal.length;
        const filteredHasil = getFilteredHasil();
        document.getElementById('stat-ujian').innerText = filteredHasil.length;
    }

    // ==========================================
    // 2. NAVIGASI DASHBOARD
    // ==========================================
    const menuOptions = document.querySelectorAll('.option-item');
    const contentSections = document.querySelectorAll('.content-section');

    menuOptions.forEach(option => {
        option.addEventListener('click', () => {
            menuOptions.forEach(opt => opt.classList.remove('selected'));
            contentSections.forEach(sec => sec.classList.remove('active'));
            option.classList.add('selected');
            const target = option.dataset.section;
            document.getElementById(target)?.classList.add('active');
        });
    });

    setInterval(() => {
        const liveTimeEl = document.getElementById('live-time');
        if (liveTimeEl) {
            const now = new Date();
            liveTimeEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false }) + " WIB";
        }
    }, 1000);

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if(confirm('Apakah Anda yakin ingin keluar dari panel?')) {
            const btnLogout = document.getElementById('btn-logout');
            btnLogout.innerHTML = '<i class="fas fa-spinner fa-spin"></i> KELUAR...';
            btnLogout.disabled = true;

            signOut(auth).then(() => {
                localStorage.removeItem("userRole"); 
                window.location.href = 'index.html'; 
            }).catch((error) => {
                alert('Gagal keluar dari sesi: ' + error.message);
                btnLogout.innerHTML = '<i class="fas fa-sign-out-alt"></i> KELUAR';
                btnLogout.disabled = false;
            });
        }
    });

    // ==========================================
    // 3. FITUR: DATA SISWA
    // ==========================================
    const tbodySiswa = document.querySelector('#table-siswa tbody');
    
    function renderSiswa() {
        tbodySiswa.innerHTML = '';
        if(dataSiswa.length === 0) {
            tbodySiswa.innerHTML = `<tr><td colspan="5" style="text-align: center;">Belum ada data siswa.</td></tr>`;
        } else {
            dataSiswa.forEach((siswa, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${siswa.nis}</td>
                    <td>${siswa.nama}</td>
                    <td>${siswa.kelas}</td>
                    <td><span style="background: var(--success); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">Aktif</span></td>
                    <td><button class="btn-delete-siswa" data-index="${index}" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>
                `;
                tbodySiswa.appendChild(tr);
            });
        }
        updateStats();
    }

    // ==========================================
    // 4. FITUR: BANK SOAL
    // ==========================================
    const tbodySoal = document.querySelector('#table-soal tbody');

    function renderSoal() {
        tbodySoal.innerHTML = '';
        if(dataSoal.length === 0) {
            tbodySoal.innerHTML = `<tr><td colspan="5" style="text-align: center;">Belum ada soal. Silakan tambah manual.</td></tr>`;
        } else {
            dataSoal.forEach((soal, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${soal.pertanyaan}</td>
                    <td><strong>${soal.kunci}</strong></td>
                    <td><span style="color: var(--warning); font-weight: bold;">Draf</span></td>
                    <td><button class="btn-delete-soal" data-index="${index}" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>
                `;
                tbodySoal.appendChild(tr);
            });
        }
        updateStats();
    }

    // ==========================================
    // 5. FITUR: HASIL UJIAN & CETAK PDF / EXCEL
    // ==========================================
    const tbodyHasil = document.querySelector('#table-hasil tbody');
    const filterTabelHasil = document.getElementById('filter-tabel-hasil');

    // Memicu render ulang saat dropdown filter diubah
    filterTabelHasil?.addEventListener('change', () => {
        renderHasil();
    });

    function renderHasil() {
        // Filter level 1: Dari hak akses guru
        let filteredHasil = getFilteredHasil(); 

        // Filter level 2: Dari dropdown tabel
        const filterPilihan = filterTabelHasil?.value || 'semua';
        if (filterPilihan !== 'semua') {
            filteredHasil = filteredHasil.filter(hasil => hasil.mapel === filterPilihan);
        }

        tbodyHasil.innerHTML = '';
        if(filteredHasil.length === 0) {
            tbodyHasil.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">Tidak ada data hasil ujian.</td></tr>`;
        } else {
            filteredHasil.forEach((hasil, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${hasil.nama || '-'}</strong></td>
                    <td>${hasil.kelas || '-'}</td>
                    <td><span style="background: var(--primary-light); color: var(--primary-hover); padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">${hasil.mapel || '-'}</span></td>
                    <td><span style="color: var(--success); font-weight: bold;">${hasil.benar || 0}</span> / ${hasil.totalSoal || 0}</td>
                    <td><strong style="color: var(--primary); font-size: 1.1rem;">${hasil.nilai || 0}</strong></td>
                    <td>
                        <button class="btn-3d btn-secondary btn-detail-hasil" data-index="${index}" style="padding: 6px 12px; font-size: 0.8rem; width: auto;"><i class="fas fa-list-ol"></i> Rincian</button>
                    </td>
                `;
                tbodyHasil.appendChild(tr);
            });
        }
        updateStats();
    }

    // LOGIKA MODAL RINCIAN SOAL BENAR
    tbodyHasil.addEventListener('click', (e) => {
        const btnDetail = e.target.closest('.btn-detail-hasil');
        if (btnDetail) {
            const index = btnDetail.dataset.index;
            
            let currentData = getFilteredHasil();
            const filterPilihan = filterTabelHasil?.value || 'semua';
            if (filterPilihan !== 'semua') currentData = currentData.filter(h => h.mapel === filterPilihan);
            
            const data = currentData[index];

            document.getElementById('detail-nama').innerText = `: ${data.nama}`;
            document.getElementById('detail-kelas').innerText = `: ${data.kelas}`;
            document.getElementById('detail-mapel').innerText = `: ${data.mapel}`;
            document.getElementById('detail-jml-benar').innerText = data.benar;
            document.getElementById('detail-total-soal').innerText = data.totalSoal;
            document.getElementById('detail-nilai').innerText = data.nilai;

            const containerRincian = document.getElementById('detail-rincian-benar');
            containerRincian.innerHTML = '';
            
            if(data.rincianBenar && data.rincianBenar.length > 0) {
                const sortedRincian = data.rincianBenar.sort((a, b) => a - b);
                sortedRincian.forEach(num => {
                    const box = document.createElement('div');
                    box.innerText = num;
                    box.style.background = 'var(--success)';
                    box.style.color = 'white';
                    box.style.fontWeight = 'bold';
                    box.style.width = '35px';
                    box.style.height = '35px';
                    box.style.display = 'flex';
                    box.style.alignItems = 'center';
                    box.style.justifyContent = 'center';
                    box.style.borderRadius = '6px';
                    box.style.boxShadow = 'var(--shadow-sm)';
                    containerRincian.appendChild(box);
                });
            } else {
                containerRincian.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem; font-style: italic;">Rincian nomor tidak ditemukan.</span>';
            }

            document.getElementById('modal-detail-hasil').style.display = 'flex';
        }
    });

    document.getElementById('close-modal-detail')?.addEventListener('click', () => {
        document.getElementById('modal-detail-hasil').style.display = 'none';
    });

    // Aksi Cetak PDF & Excel
    document.getElementById('btn-print-pdf')?.addEventListener('click', () => window.print());
    
    document.getElementById('btn-print-excel')?.addEventListener('click', () => {
        let filteredHasil = getFilteredHasil();
        const filterPilihan = filterTabelHasil?.value || 'semua';
        if (filterPilihan !== 'semua') filteredHasil = filteredHasil.filter(h => h.mapel === filterPilihan);

        if (filteredHasil.length === 0) return alert('Tidak ada data untuk di-export!');

        let csvContent = "Nama Siswa,Kelas,Mata Pelajaran,Jawaban Benar,Total Soal,Nilai Akhir\n";
        filteredHasil.forEach(row => {
            csvContent += `"${row.nama}","${row.kelas}","${row.mapel}","${row.benar}","${row.totalSoal}","${row.nilai}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Rekap_Nilai_${filterPilihan}_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ==========================================
    // 6. PENGATURAN HAK AKSES MAPEL GURU
    // ==========================================
    const selectGuruMapel = document.getElementById('select-guru-mapel');
    const savedGuruMapel = localStorage.getItem('cbt_guru_mapel') || 'semua';
    if(selectGuruMapel) selectGuruMapel.value = savedGuruMapel;

    document.getElementById('btn-save-guru-mapel')?.addEventListener('click', () => {
        localStorage.setItem('cbt_guru_mapel', selectGuruMapel.value);
        alert('Hak akses mapel berhasil disimpan!');
        renderHasil();
    });

    // Render Awal
    renderSiswa();
    renderSoal();
    renderHasil();
});
