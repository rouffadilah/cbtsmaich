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
    let dataHasil = JSON.parse(localStorage.getItem('cbt_hasil')) || [
        { nama: 'Ahmad Fauzi', kelas: 'XII TKJ 1', mapel: 'Informatika', benar: 44, salah: 6, totalSoal: 50, nilai: 88, waktu: '24 Apr 2026, 10:15' },
        { nama: 'Siti Nurhaliza', kelas: 'XII AKL 2', mapel: 'Informatika', benar: 47, salah: 3, totalSoal: 50, nilai: 94, waktu: '24 Apr 2026, 10:30' },
        { nama: 'Budi Santoso', kelas: 'XI RPL 1', mapel: 'Coding & AI', benar: 39, salah: 11, totalSoal: 50, nilai: 78, waktu: '24 Apr 2026, 11:05' }
    ];

    // Mengambil hasil yang sudah difilter sesuai mapel yang diampu guru
    function getFilteredHasil() {
        const mapelGuru = localStorage.getItem('cbt_guru_mapel') || 'semua';
        if (mapelGuru === 'semua') return dataHasil;
        return dataHasil.filter(hasil => hasil.mapel === mapelGuru);
    }

    function updateStats() {
        document.getElementById('stat-siswa').innerText = dataSiswa.length;
        document.getElementById('stat-soal').innerText = dataSoal.length;
        
        // Ubah stat ujian agar mencerminkan jumlah siswa pada mapel si Guru tersebut
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

    const modalSiswa = document.getElementById('modal-tambah-siswa');
    document.getElementById('btn-tambah-siswa')?.addEventListener('click', () => modalSiswa.style.display = 'flex');
    document.getElementById('close-modal-siswa')?.addEventListener('click', () => modalSiswa.style.display = 'none');

    document.getElementById('form-tambah-siswa')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const nis = document.getElementById('input-nis').value;
        const nama = document.getElementById('input-nama').value;
        const kelas = document.getElementById('input-kelas').value;

        dataSiswa.push({ nis, nama, kelas });
        localStorage.setItem('cbt_siswa', JSON.stringify(dataSiswa));
        
        e.target.reset();
        modalSiswa.style.display = 'none';
        renderSiswa();
        alert('Siswa berhasil ditambahkan!');
    });

    tbodySiswa.addEventListener('click', (e) => {
        if(e.target.closest('.btn-delete-siswa')) {
            if(confirm('Hapus siswa ini?')) {
                const index = e.target.closest('.btn-delete-siswa').dataset.index;
                dataSiswa.splice(index, 1);
                localStorage.setItem('cbt_siswa', JSON.stringify(dataSiswa));
                renderSiswa();
            }
        }
    });

    document.getElementById('search-siswa')?.addEventListener('keyup', function() {
        const filter = this.value.toLowerCase();
        document.querySelectorAll('#table-siswa tbody tr').forEach(row => {
            if(row.querySelector('td[colspan]')) return;
            row.style.display = row.textContent.toLowerCase().includes(filter) ? '' : 'none';
        });
    });

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

    const modalSoal = document.getElementById('modal-tambah-soal');
    const selectJenisSoal = document.getElementById('input-jenis-soal');
    
    const areaPG = document.getElementById('area-pg');
    const areaPGKompleks = document.getElementById('area-pg-kompleks');
    const areaBenarSalah = document.getElementById('area-benar-salah');
    const areaUraian = document.getElementById('area-uraian');
    const areaStimulus = document.getElementById('area-stimulus');

    document.getElementById('media-soal')?.addEventListener('change', function() {
        if(this.files[0]) {
            document.getElementById('nama-file-soal').innerText = "File terlampir: " + this.files[0].name;
        }
    });

    document.getElementById('btn-tambah-manual')?.addEventListener('click', () => modalSoal.style.display = 'flex');
    document.getElementById('close-modal-soal')?.addEventListener('click', () => {
        modalSoal.style.display = 'none';
        document.getElementById('form-tambah-soal').reset();
        document.getElementById('nama-file-soal').innerText = "";
        selectJenisSoal.dispatchEvent(new Event('change')); 
    });

    selectJenisSoal?.addEventListener('change', function() {
        const jenis = this.value;
        
        areaPG.style.display = 'none';
        areaPGKompleks.style.display = 'none';
        areaBenarSalah.style.display = 'none';
        areaUraian.style.display = 'none';
        areaStimulus.style.display = 'none';

        document.querySelectorAll('.opsi-pg-teks, .opsi-pgk-teks').forEach(el => el.required = false);
        document.querySelectorAll('input[name="kunci_pg"], input[name="kunci_bs"]').forEach(el => el.required = false);

        if(jenis === 'pg') {
            areaPG.style.display = 'block';
            document.querySelectorAll('.opsi-pg-teks').forEach(el => el.required = true);
            document.querySelectorAll('input[name="kunci_pg"]').forEach(el => el.required = true);
        } 
        else if (jenis === 'pg-kompleks') {
            areaPGKompleks.style.display = 'block';
            document.querySelectorAll('.opsi-pgk-teks').forEach(el => el.required = true);
        }
        else if (jenis === 'benar-salah') {
            areaBenarSalah.style.display = 'block';
            document.querySelectorAll('input[name="kunci_bs"]').forEach(el => el.required = true);
        }
        else if (jenis === 'stimulus') {
            areaStimulus.style.display = 'block';
            areaPG.style.display = 'block'; 
            document.querySelectorAll('.opsi-pg-teks').forEach(el => el.required = true);
            document.querySelectorAll('input[name="kunci_pg"]').forEach(el => el.required = true);
        }
        else if (jenis === 'uraian-singkat' || jenis === 'uraian-panjang') {
            areaUraian.style.display = 'block';
        }
    });

    document.getElementById('form-tambah-soal')?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const jenis = selectJenisSoal.value;
        let pertanyaan = document.getElementById('input-pertanyaan').value;
        const mediaFile = document.getElementById('media-soal').files[0];
        
        let kunci = "";
        
        if (jenis === 'stimulus') {
            const wacana = document.getElementById('input-wacana').value;
            pertanyaan = `<div style="background:#f1f5f9; padding:15px; margin-bottom:15px; border-radius:8px;"><strong>Wacana:</strong><br>${wacana}</div>${pertanyaan}`;
        }

        let detailSoal = `[${jenis.toUpperCase()}] ` + pertanyaan;

        if(mediaFile) detailSoal += ` <br><small style='color:blue;'>(Berisi Lampiran: ${mediaFile.name})</small>`;

        if(jenis === 'pg' || jenis === 'stimulus') {
            const kunciTerpilih = document.querySelector('input[name="kunci_pg"]:checked');
            kunci = kunciTerpilih ? kunciTerpilih.value : "-";
        } 
        else if (jenis === 'pg-kompleks') {
            const kunciTerpilih = Array.from(document.querySelectorAll('input[name="kunci_pgk"]:checked')).map(cb => cb.value);
            if(kunciTerpilih.length === 0) return alert("Pilih minimal 1 kunci jawaban untuk PG Kompleks!");
            kunci = kunciTerpilih.join(", "); 
        }
        else if (jenis === 'benar-salah') {
            const kunciTerpilih = document.querySelector('input[name="kunci_bs"]:checked');
            kunci = kunciTerpilih ? kunciTerpilih.value : "-";
        }
        else {
            const kunciUraian = document.getElementById('input-kunci-uraian').value;
            kunci = kunciUraian ? "Rubrik Tersimpan" : "Menunggu Review Manual";
        }

        dataSoal.push({ pertanyaan: detailSoal, kunci });
        localStorage.setItem('cbt_soal', JSON.stringify(dataSoal));
        
        e.target.reset();
        document.getElementById('nama-file-soal').innerText = "";
        modalSoal.style.display = 'none';
        renderSoal();
    });

    document.getElementById('btn-template-excel')?.addEventListener('click', () => {
        const csvData = [
            ["No", "Jenis Soal", "Wacana/Stimulus", "Pertanyaan", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E", "Kunci Jawaban"],
            [1, "pg", "", "Manakah dari berikut ini yang merupakan protokol layer Transport pada model OSI?", "HTTP", "TCP", "IP", "MAC", "FTP", "B"],
            [2, "pg-kompleks", "", "Pilihlah tag HTML yang sering digunakan dalam pembuatan struktur dasar form CBT web!", "<form>", "<table>", "<input>", "<button>", "<img>", "A, C, D"]
        ];

        let csvContent = csvData.map(e => e.map(item => `"${item}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "Template_Soal_CBT_SMAICH.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    tbodySoal.addEventListener('click', (e) => {
        if(e.target.closest('.btn-delete-soal')) {
            if(confirm('Hapus soal ini?')) {
                const index = e.target.closest('.btn-delete-soal').dataset.index;
                dataSoal.splice(index, 1);
                localStorage.setItem('cbt_soal', JSON.stringify(dataSoal));
                renderSoal();
            }
        }
    });

    document.getElementById('btn-terbitkan')?.addEventListener('click', () => {
        if(dataSoal.length === 0) return alert('Tidak ada soal untuk diterbitkan!');
        alert('Soal berhasil diterbitkan! Siswa sekarang dapat mengaksesnya.');
    });

    // ==========================================
    // 5. FITUR: HASIL UJIAN & CETAK PDF / EXCEL
    // ==========================================
    const tbodyHasil = document.querySelector('#table-hasil tbody');

    function renderHasil() {
        const mapelGuru = localStorage.getItem('cbt_guru_mapel') || 'semua';
        
        // Update label badge UI di atas tabel
        const labelFilter = document.getElementById('label-filter-hasil');
        if (labelFilter) {
            labelFilter.innerHTML = mapelGuru === 'semua' 
                ? '<i class="fas fa-filter"></i> Mapel: Semua (Admin)' 
                : `<i class="fas fa-filter"></i> Mapel: ${mapelGuru}`;
        }

        // Ambil data yang sudah difilter
        const filteredHasil = getFilteredHasil();

        tbodyHasil.innerHTML = '';
        if(filteredHasil.length === 0) {
            tbodyHasil.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Tidak ada data hasil ujian untuk mata pelajaran ini.</td></tr>`;
        } else {
            filteredHasil.forEach((hasil) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${hasil.nama || '-'}</td>
                    <td>${hasil.kelas || '-'}</td>
                    <td><span style="background: var(--primary-light); color: var(--primary-hover); padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">${hasil.mapel || '-'}</span></td>
                    <td><strong style="color: var(--primary); font-size: 1.1rem;">${hasil.nilai || 0}</strong></td>
                    <td>${hasil.waktu || '-'}</td>
                `;
                tbodyHasil.appendChild(tr);
            });
        }
        updateStats();
    }

    // Aksi Cetak PDF
    document.getElementById('btn-print-pdf')?.addEventListener('click', () => {
        window.print();
    });

    // Aksi Export Excel (HANYA MENG-EXPORT HASIL YANG SUDAH DIFILTER)
    document.getElementById('btn-print-excel')?.addEventListener('click', () => {
        const filteredHasil = getFilteredHasil();

        if (filteredHasil.length === 0) {
            alert('Tidak ada data hasil ujian untuk di-export pada mata pelajaran Anda!');
            return;
        }

        let csvContent = "Nama Siswa,Kelas,Mata Pelajaran,Jumlah Benar,Jumlah Salah,Total Soal,Nilai Akhir,Waktu Submit\n";

        filteredHasil.forEach(row => {
            let rowData = [
                `"${row.nama || '-'}"`,
                `"${row.kelas || '-'}"`,
                `"${row.mapel || '-'}"`,
                `"${row.benar || 0}"`,        
                `"${row.salah || 0}"`,        
                `"${row.totalSoal || 0}"`,    
                `"${row.nilai || 0}"`,
                `"${row.waktu || '-'}"`
            ];
            csvContent += rowData.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,"");
        const mapelClean = (localStorage.getItem('cbt_guru_mapel') || 'Semua').replace(/\s+/g, '_');
        
        link.setAttribute("href", url);
        link.setAttribute("download", `Rekap_Nilai_${mapelClean}_${dateStr}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ==========================================
    // 6. PENGATURAN HAK AKSES DAN TOKEN MAPEL
    // ==========================================

    // Logika simpan Hak Akses Guru
    const selectGuruMapel = document.getElementById('select-guru-mapel');
    const savedGuruMapel = localStorage.getItem('cbt_guru_mapel') || 'semua';
    if(selectGuruMapel) selectGuruMapel.value = savedGuruMapel;

    document.getElementById('btn-save-guru-mapel')?.addEventListener('click', () => {
        const selectedMapel = selectGuruMapel.value;
        localStorage.setItem('cbt_guru_mapel', selectedMapel);
        alert('Hak akses mata pelajaran berhasil disimpan! Tabel hasil ujian telah diperbarui.');
        renderHasil(); // Render ulang tabel agar data langsung tersaring
    });

    // Logika manajemen Token Ujian (tetap seperti sebelumnya)
    const selectMapelToken = document.getElementById('select-mapel-token');
    const inputToken = document.getElementById('input-token');
    const labelMapelAktif = document.getElementById('label-mapel-aktif');
    const btnResetToken = document.getElementById('btn-reset-token');

    async function loadTokenByMapel(mapel) {
        inputToken.value = "Memuat data...";
        try {
            const pengaturanRef = doc(db, "pengaturan", "token_ujian");
            const docSnap = await getDoc(pengaturanRef);
            
            if (docSnap.exists() && docSnap.data()[`token_${mapel}`]) {
                inputToken.value = docSnap.data()[`token_${mapel}`];
            } else {
                inputToken.value = "BELUM ADA TOKEN";
            }
        } catch (error) {
            console.error("Gagal memuat token:", error);
            inputToken.value = "Gagal memuat";
        }
    }

    if (selectMapelToken) {
        selectMapelToken.addEventListener('change', (e) => {
            const mapel = e.target.value;
            const textMapel = e.target.options[e.target.selectedIndex].text;
            
            labelMapelAktif.innerText = textMapel;
            loadTokenByMapel(mapel);
        });

        loadTokenByMapel(selectMapelToken.value);
    }

    async function simpanTokenKeDatabase(tokenBaru, mapel) {
        try {
            const pengaturanRef = doc(db, "pengaturan", "token_ujian");
            await setDoc(pengaturanRef, {
                [`token_${mapel}`]: tokenBaru,
                diupdate_pada: serverTimestamp() 
            }, { merge: true });
        } catch (error) {
            console.error("Gagal menyimpan token ke Firestore:", error);
            alert("Gagal menyinkronkan token ke database. Pastikan koneksi internet stabil.");
            throw error; 
        }
    }

    btnResetToken?.addEventListener('click', async () => {
        const mapel = selectMapelToken.value;
        const textMapel = selectMapelToken.options[selectMapelToken.selectedIndex].text;

        if(confirm(`Generate token baru untuk mata pelajaran ${textMapel}? Token lama tidak akan berlaku lagi.`)) {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let newToken = 'SMAICH-';
            for(let i = 0; i < 4; i++) {
                newToken += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            const originalText = btnResetToken.innerHTML;
            btnResetToken.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Memproses...`;
            btnResetToken.disabled = true;

            try {
                await simpanTokenKeDatabase(newToken, mapel);
                inputToken.value = newToken;
                alert(`Token Baru untuk ${textMapel} berhasil dibuat: ` + newToken);
            } catch (error) {
                // Error ditangani di catch simpanTokenKeDatabase
            } finally {
                btnResetToken.innerHTML = originalText;
                btnResetToken.disabled = false;
            }
        }
    });

    // Render Awal
    renderSiswa();
    renderSoal();
    renderHasil();
});
