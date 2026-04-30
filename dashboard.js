import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Tambahkan 'doc' dan 'setDoc' untuk sinkronisasi token dengan database
import { collection, addDoc, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. INISIALISASI DATA 
    // ==========================================
    let dataSiswa = JSON.parse(localStorage.getItem('cbt_siswa')) || [];
    let dataSoal = JSON.parse(localStorage.getItem('cbt_soal')) || [];
    let dataHasil = JSON.parse(localStorage.getItem('cbt_hasil')) || [
        { nama: 'Ahmad Fauzi', nilai: 88, waktu: '24 Apr 2026, 10:15' },
        { nama: 'Siti Nurhaliza', nilai: 95, waktu: '24 Apr 2026, 10:30' }
    ];
    let tokenUjian = localStorage.getItem('cbt_token') || 'SMAICH-26XQ';
    
    document.getElementById('input-token').value = tokenUjian;

    // Fungsi Render Statistik
    function updateStats() {
        document.getElementById('stat-siswa').innerText = dataSiswa.length;
        document.getElementById('stat-soal').innerText = dataSoal.length;
        document.getElementById('stat-ujian').innerText = dataHasil.length;
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

    // Jam Waktu Nyata
    setInterval(() => {
        const liveTimeEl = document.getElementById('live-time');
        if (liveTimeEl) {
            const now = new Date();
            liveTimeEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false }) + " WIB";
        }
    }, 1000);

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if(confirm('Keluar dari panel?')) window.location.href = 'index.html'; 
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

    // Modal Tambah Siswa
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

    // Hapus Siswa
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

    // Fitur Pencarian
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

    // Modal Tambah Soal
    const modalSoal = document.getElementById('modal-tambah-soal');
    const selectJenisSoal = document.getElementById('input-jenis-soal');
    
    // Area DOM
    const areaPG = document.getElementById('area-pg');
    const areaPGKompleks = document.getElementById('area-pg-kompleks');
    const areaBenarSalah = document.getElementById('area-benar-salah');
    const areaUraian = document.getElementById('area-uraian');
    const areaStimulus = document.getElementById('area-stimulus');

    // Tampilkan nama file yang dipilih
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
        selectJenisSoal.dispatchEvent(new Event('change')); // Reset tampilan
    });

    // Logika ganti UI form berdasarkan jenis soal
    selectJenisSoal?.addEventListener('change', function() {
        const jenis = this.value;
        
        // Sembunyikan semua area terlebih dahulu
        areaPG.style.display = 'none';
        areaPGKompleks.style.display = 'none';
        areaBenarSalah.style.display = 'none';
        areaUraian.style.display = 'none';
        areaStimulus.style.display = 'none';

        // Reset atribut required
        document.querySelectorAll('.opsi-pg-teks, .opsi-pgk-teks').forEach(el => el.required = false);
        document.querySelectorAll('input[name="kunci_pg"], input[name="kunci_bs"]').forEach(el => el.required = false);

        // Tampilkan area sesuai jenis yang dipilih
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
            areaPG.style.display = 'block'; // Asumsi default soal turunan stimulus adalah PG
            document.querySelectorAll('.opsi-pg-teks').forEach(el => el.required = true);
            document.querySelectorAll('input[name="kunci_pg"]').forEach(el => el.required = true);
        }
        else if (jenis === 'uraian-singkat' || jenis === 'uraian-panjang') {
            areaUraian.style.display = 'block';
        }
    });

    // Hapus duplikasi event listener submit soal. Kita cukup gunakan satu ini saja.
    document.getElementById('form-tambah-soal')?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const jenis = selectJenisSoal.value;
        let pertanyaan = document.getElementById('input-pertanyaan').value;
        const mediaFile = document.getElementById('media-soal').files[0];
        
        let kunci = "";
        
        // Jika soal stimulus, gabungkan wacana ke dalam teks soal
        if (jenis === 'stimulus') {
            const wacana = document.getElementById('input-wacana').value;
            pertanyaan = `<div style="background:#f1f5f9; padding:15px; margin-bottom:15px; border-radius:8px;"><strong>Wacana:</strong><br>${wacana}</div>${pertanyaan}`;
        }

        let detailSoal = `[${jenis.toUpperCase()}] ` + pertanyaan;

        if(mediaFile) detailSoal += ` <br><small style='color:blue;'>(Berisi Lampiran: ${mediaFile.name})</small>`;

        // Ambil kunci jawaban berdasarkan jenis
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

   
    // ==========================================
    // FUNGSI DOWNLOAD TEMPLATE (EXCEL & WORD)
    // ==========================================
    document.getElementById('btn-template-excel')?.addEventListener('click', () => {
        const csvData = [
            ["No", "Jenis Soal", "Wacana/Stimulus", "Pertanyaan", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E", "Kunci Jawaban"],
            [1, "pg", "", "Manakah dari berikut ini yang merupakan protokol layer Transport pada model OSI?", "HTTP", "TCP", "IP", "MAC", "FTP", "B"],
            [2, "pg-kompleks", "", "Pilihlah tag HTML yang sering digunakan dalam pembuatan struktur dasar form CBT web!", "<form>", "<table>", "<input>", "<button>", "<img>", "A, C, D"],
            [3, "benar-salah", "", "Python adalah bahasa pemrograman yang membutuhkan kompilasi penuh sebelum dijalankan (compiled language).", "Benar", "Salah", "", "", "", "Salah"],
            [4, "stimulus", "Di laboratorium komputer sekolah, terdapat 30 PC siswa dan 1 PC guru yang dihubungkan ke sebuah switch terpusat. Guru ingin memantau layar siswa secara realtime.", "Berdasarkan wacana di atas, topologi jaringan apa yang sedang digunakan secara fisik di laboratorium tersebut?", "Star", "Ring", "Bus", "Mesh", "Tree", "A"],
            [5, "uraian-singkat", "", "Tuliskan fungsi dari perintah 'ping' dalam troubleshooting jaringan OS MikroTik!", "", "", "", "", "", "Untuk menguji konektivitas jaringan antar perangkat"],
            [6, "uraian-panjang", "", "Jelaskan perbedaan mendasar antara IPv4 dan IPv6 dari segi kapasitas dan format penulisan!", "", "", "", "", "", "Siswa menjelaskan format 32-bit vs 128-bit dan desimal vs heksadesimal"]
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

    document.getElementById('btn-template-word')?.addEventListener('click', () => {
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Template Soal CBT</title></head><body style='font-family: Arial, sans-serif;'>";
        const content = `
            <h2 style="text-align: center;">TEMPLATE IMPORT SOAL CBT - SMA ISLAM CIKAL HARAPAN 1</h2>
            <p><b>Petunjuk Pengisian:</b><br>
            - Gunakan format di bawah ini untuk menulis soal ujian.<br>
            - Hapus teks contoh dan ganti dengan soal Anda.<br>
            - Jangan ubah label seperti <b>[NO]</b>, <b>[JENIS_SOAL]</b>, <b>[WACANA]</b>, <b>[SOAL]</b>, dan <b>[KUNCI]</b> agar sistem bisa membacanya.</p>
            <hr>
            <p><b>[NO]</b> 1</p>
            <p><b>[JENIS_SOAL]</b> pg</p>
            <p><b>[SOAL]</b> Dalam pemrograman Python, struktur data apa yang tidak dapat diubah (immutable) setelah dideklarasikan?</p>
            <p><b>[A]</b> List</p>
            <p><b>[B]</b> Dictionary</p>
            <p><b>[C]</b> Tuple</p>
            <p><b>[D]</b> Set</p>
            <p><b>[E]</b> Array</p>
            <p><b>[KUNCI]</b> C</p>
        `;
        const footer = "</body></html>";
        
        const sourceHTML = header + content + footer;
        const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "Template_Soal_CBT_SMAICH.doc");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Hapus Soal
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

    // Tombol Terbitkan
    document.getElementById('btn-terbitkan')?.addEventListener('click', () => {
        if(dataSoal.length === 0) return alert('Tidak ada soal untuk diterbitkan!');
        alert('Soal berhasil diterbitkan! Siswa sekarang dapat mengaksesnya.');
    });


    // ==========================================
    // 5. FITUR: HASIL UJIAN & CETAK PDF
    // ==========================================
    const tbodyHasil = document.querySelector('#table-hasil tbody');

    function renderHasil() {
        tbodyHasil.innerHTML = '';
        if(dataHasil.length === 0) {
            tbodyHasil.innerHTML = `<tr><td colspan="3" style="text-align: center;">Belum ada siswa yang menyelesaikan ujian.</td></tr>`;
        } else {
            dataHasil.forEach((hasil) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${hasil.nama}</td>
                    <td><strong>${hasil.nilai}</strong></td>
                    <td>${hasil.waktu}</td>
                `;
                tbodyHasil.appendChild(tr);
            });
        }
        updateStats();
    }

    document.getElementById('btn-print-pdf')?.addEventListener('click', () => {
        window.print();
    });


    // ==========================================
    // 6. PENGATURAN: RESET TOKEN (DIINTEGRASIKAN DENGAN FIRESTORE)
    // ==========================================
    
    // Fungsi baru untuk sinkronisasi token ke database Firestore
    async function simpanTokenKeDatabase(tokenBaru) {
        try {
            const pengaturanRef = doc(db, "pengaturan", "token_ujian");
            await setDoc(pengaturanRef, {
                token_aktif: tokenBaru,
                diupdate_pada: serverTimestamp() // Menggunakan timestamp server Firestore
            }, { merge: true });
            console.log("Token berhasil disinkronisasi ke Firestore.");
        } catch (error) {
            console.error("Gagal menyimpan token ke Firestore:", error);
            alert("Gagal menyinkronkan token ke database. Pastikan koneksi internet stabil.");
        }
    }

    document.getElementById('btn-reset-token')?.addEventListener('click', async () => {
        if(confirm('Generate token baru? Token lama tidak akan berlaku lagi.')) {
            // Generate token acak
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let newToken = 'SMAICH-';
            for(let i = 0; i < 4; i++) {
                newToken += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            // Ubah UI
            const btnToken = document.getElementById('btn-reset-token');
            const originalText = btnToken.innerHTML;
            btnToken.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Memproses...`;
            btnToken.disabled = true;

            // Simpan ke LocalStorage (sebagai backup)
            document.getElementById('input-token').value = newToken;
            localStorage.setItem('cbt_token', newToken);
            
            // Simpan ke Firestore
            await simpanTokenKeDatabase(newToken);
            
            // Kembalikan UI
            btnToken.innerHTML = originalText;
            btnToken.disabled = false;
            
            alert('Token Baru berhasil digenerate dan diaktifkan: ' + newToken);
        }
    });

    // Panggil render awal saat halaman dimuat
    renderSiswa();
    renderSoal();
    renderHasil();
});
