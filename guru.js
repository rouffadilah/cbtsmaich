import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    let drafSoalGlobal = [];
    const tabelDraft = document.getElementById('tabel-draft-soal')?.querySelector('tbody');
    let manualCounter = 1;

    // 1. Keamanan: Tendang user jika belum login
    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = "index.html"; 
    });

    // 2. Sistem Navigasi Tab
    const menuOptions = document.querySelectorAll('.option-item');
    const contentSections = document.querySelectorAll('.content-section');

    menuOptions.forEach(option => {
        option.addEventListener('click', () => {
            menuOptions.forEach(opt => opt.classList.remove('selected'));
            contentSections.forEach(sec => sec.classList.remove('active'));

            option.classList.add('selected');
            document.getElementById(option.dataset.section)?.classList.add('active');
        });
    });

    // 3. Jam Waktu Nyata (Fitur ping palsu dibuang)
    setInterval(() => {
        const liveTimeEl = document.getElementById('live-time');
        if (liveTimeEl) liveTimeEl.textContent = `Waktu Server: ${new Date().toLocaleTimeString('id-ID')} WIB`;
    }, 1000);

    // 4. Unduh Template Excel
    document.getElementById('btn-download-template')?.addEventListener('click', () => {
        if (typeof XLSX === 'undefined') return alert('Library SheetJS belum termuat.');
        const data = [
            ["No", "Pertanyaan", "Opsi_A", "Opsi_B", "Opsi_C", "Opsi_D", "Opsi_E", "Kunci_Jawaban"],
            [1, "Berapa hasil 5 + 5?", "8", "9", "10", "11", "12", "C"]
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Template");
        XLSX.writeFile(wb, "Template_Soal_SMAICH.xlsx");
    });

    // 5. Upload Excel & Tambah ke Draf
    const uploadForm = document.getElementById('upload-soal-form');
    const fileUpload = document.getElementById('file-upload');
    
    fileUpload?.addEventListener('change', function() {
        const display = document.getElementById('file-name-display');
        if (display) display.textContent = this.files.length ? `Terpilih: ${this.files[0].name}` : '';
    });

    uploadForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const mapel = document.getElementById('mapel-excel').value;
        const file = fileUpload.files[0];

        if(!mapel || !file) return alert('Pilih mapel dan file Excel!');
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target.result), {type: 'array'});
                const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                if (!excelData.length) return alert("File Excel kosong!");

                excelData.forEach((row, index) => {
                    const soal = {
                        id_draf: Date.now() + index,
                        mapel, tipe: "PG", pertanyaan: row.Pertanyaan,
                        opsi_a: row.Opsi_A || "", opsi_b: row.Opsi_B || "",
                        opsi_c: row.Opsi_C || "", opsi_d: row.Opsi_D || "",
                        opsi_e: row.Opsi_E || "", kunci: row.Kunci_Jawaban || "",
                        sumber: "Excel"
                    };
                    tambahKeDraf(soal, "Excel", "PG");
                });
                uploadForm.reset();
            } catch (error) {
                alert("Gagal membaca file Excel.");
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // 6. Upload Manual & Tambah ke Draf
    document.getElementById('manual-soal-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const mapel = document.getElementById('input-mapel-manual').value;
        const tipe = document.getElementById('tipe-soal').value;
        const pertanyaan = document.getElementById('input-pertanyaan').value;

        if(!mapel) return alert('Pilih Mapel!');

        tambahKeDraf({
            id_draf: Date.now(), mapel, tipe, pertanyaan, sumber: "Manual"
        }, `M-${manualCounter++}`, tipe);
        
        this.reset();
    });

    // Fungsi Pembantu: Render Draf ke Tabel
    function tambahKeDraf(soalObj, labelSumber, tipe) {
        drafSoalGlobal.push(soalObj);
        tabelDraft.querySelector('.empty-row')?.remove();

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${labelSumber}</td>
            <td><span class="badge badge-warning">${tipe}</span></td>
            <td>${soalObj.pertanyaan.substring(0, 50)}...</td>
            <td>-</td>
            <td><button type="button" class="action-btn btn-delete-draf" style="background: var(--danger);"><i class="fas fa-trash"></i></button></td>
        `;
        
        tr.querySelector('.btn-delete-draf').addEventListener('click', () => {
            tr.remove();
            drafSoalGlobal = drafSoalGlobal.filter(s => s.id_draf !== soalObj.id_draf);
            if(!tabelDraft.children.length) tabelDraft.innerHTML = `<tr class="empty-row"><td colspan="5">Belum ada soal...</td></tr>`;
        });
        tabelDraft.appendChild(tr);
    }

    // 7. Terbitkan ke Firestore
    const btnTerbitkan = document.getElementById('btn-terbitkan-ujian');
    btnTerbitkan?.addEventListener('click', async () => {
        if(!drafSoalGlobal.length) return alert('Draf kosong!');
        if (!confirm('Yakin ingin menyimpan soal ke Server?')) return;

        const originalText = btnTerbitkan.innerHTML;
        btnTerbitkan.innerHTML = "Menyimpan...";
        btnTerbitkan.disabled = true;

        try {
            for (const soal of drafSoalGlobal) {
                delete soal.id_draf; 
                await addDoc(collection(db, "bank_soal"), { ...soal, createdAt: serverTimestamp() });
            }
            alert('BERHASIL! Soal tersimpan.');
            drafSoalGlobal = []; 
            tabelDraft.innerHTML = `<tr class="empty-row"><td colspan="5">Belum ada soal...</td></tr>`;
        } catch (error) {
            alert("Gagal menyimpan ke database.");
        } finally {
            btnTerbitkan.innerHTML = originalText;
            btnTerbitkan.disabled = false;
        }
    });

    // 8. Logout & Pencarian Siswa
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        if(confirm('Keluar dari panel?')) {
            await signOut(auth);
            window.location.href = 'index.html'; 
        }
    });

    document.getElementById('search-siswa')?.addEventListener('keyup', function() {
        const filter = this.value.toLowerCase();
        document.querySelectorAll('#table-siswa tbody tr').forEach(row => {
            const teks = row.textContent.toLowerCase();
            row.style.display = teks.includes(filter) ? '' : 'none';
        });
    });
});