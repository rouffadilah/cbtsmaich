import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // 1. CEK STATUS LOGIN GURU
    onAuthStateChanged(auth, (user) => {
        if (!user || localStorage.getItem("userRole") !== "guru") {
            window.location.href = "index.html";
            return;
        }
        document.getElementById('admin-name').innerText = user.displayName || "Guru Admin";
        document.getElementById('greeting-text').innerHTML = `Assalamu'alaikum, ${user.displayName || 'Guru'}! 👋`;
        
        // Memuat data awal dari Firebase
        loadDataSiswa();
        loadDataSoal();
        loadDataHasil();
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
        if(confirm('Apakah Anda yakin ingin keluar dari panel?')) {
            await signOut(auth);
            localStorage.clear();
            window.location.href = 'index.html'; 
        }
    });

    // 2. NAVIGASI MENU DASHBOARD
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

    // Jam Berjalan
    setInterval(() => {
        document.getElementById('live-time').innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + " WIB";
    }, 1000);

    // 3. LOAD DATA SISWA (FIREBASE)
    async function loadDataSiswa() {
        const tbodySiswa = document.querySelector('#table-siswa tbody');
        tbodySiswa.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>`;
        try {
            const qSiswa = query(collection(db, "users"), where("role", "==", "siswa"));
            const snap = await getDocs(qSiswa);
            document.getElementById('stat-siswa').innerText = snap.size;
            tbodySiswa.innerHTML = '';
            
            if(snap.empty) { tbodySiswa.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada siswa terdaftar.</td></tr>`; return; }

            snap.forEach(docSnap => {
                const data = docSnap.data();
                tbodySiswa.innerHTML += `
                    <tr>
                        <td>${data.username}</td>
                        <td><strong>${data.nama}</strong></td>
                        <td><span style="background: var(--success); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">Aktif</span></td>
                        <td><button onclick="hapusDokumen('users', '${docSnap.id}', window.refreshSiswa)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `;
            });
        } catch (error) { console.error(error); }
    }
    window.refreshSiswa = loadDataSiswa;

    // 4. LOAD BANK SOAL (FIREBASE)
    async function loadDataSoal() {
        const tbodySoal = document.querySelector('#table-soal tbody');
        tbodySoal.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat bank soal...</td></tr>`;
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            document.getElementById('stat-soal').innerText = snap.size;
            tbodySoal.innerHTML = '';
            
            if(snap.empty) { tbodySoal.innerHTML = `<tr><td colspan="5" style="text-align:center;">Bank soal kosong.</td></tr>`; return; }

            snap.forEach(docSnap => {
                const data = docSnap.data();
                tbodySoal.innerHTML += `
                    <tr>
                        <td><span style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${data.mataPelajaran.toUpperCase()}</span></td>
                        <td><span style="color: var(--primary); font-weight: bold;">${data.tipe}</span></td>
                        <td>${data.teks_soal.substring(0, 60)}...</td>
                        <td><strong>Terdata</strong></td>
                        <td><button onclick="hapusDokumen('bank_soal', '${docSnap.id}', window.refreshSoal)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `;
            });
        } catch(error) { console.error(error); }
    }
    window.refreshSoal = loadDataSoal;

    // 5. LOGIKA MODAL TAMBAH SOAL & TAB
    const modalSoal = document.getElementById('modal-tambah-soal');
    const areaManual = document.getElementById('area-manual');
    const areaImport = document.getElementById('area-import');
    const tabManual = document.getElementById('tab-manual');
    const tabImport = document.getElementById('tab-import');

    document.getElementById('btn-tambah-manual').addEventListener('click', () => {
        modalSoal.style.display = 'flex';
        renderFormDinamis('PG'); 
    });
    document.getElementById('close-modal-soal').addEventListener('click', () => modalSoal.style.display = 'none');

    tabManual.addEventListener('click', () => {
        areaManual.style.display = 'block'; areaImport.style.display = 'none';
        tabManual.classList.replace('btn-secondary', 'btn-primary'); tabImport.classList.replace('btn-primary', 'btn-secondary');
    });
    tabImport.addEventListener('click', () => {
        areaManual.style.display = 'none'; areaImport.style.display = 'block';
        tabImport.classList.replace('btn-secondary', 'btn-primary'); tabManual.classList.replace('btn-primary', 'btn-secondary');
    });

    const tipeSelect = document.getElementById('soal-tipe');
    const areaOpsi = document.getElementById('area-opsi-dinamis');

    tipeSelect.addEventListener('change', (e) => renderFormDinamis(e.target.value));

    function renderFormDinamis(tipe) {
        areaOpsi.innerHTML = ''; 
        if (tipe === 'PG') {
            areaOpsi.innerHTML = `
                ${['A','B','C','D','E'].map(opt => `
                <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                    <input type="radio" name="kunci_pg" value="${opt}" ${opt==='A'?'checked':''}>
                    <label style="font-weight: bold; width: 20px;">${opt}</label>
                    <input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="padding: 8px;">
                </div>`).join('')}
            `;
        } else if (tipe === 'PGK') {
            areaOpsi.innerHTML = `
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">Centang semua jawaban yang benar.</p>
                ${['A','B','C','D','E'].map(opt => `
                <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                    <input type="checkbox" class="kunci_pgk" value="${opt}">
                    <label style="font-weight: bold; width: 20px;">${opt}</label>
                    <input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="padding: 8px;">
                </div>`).join('')}
            `;
        } else if (tipe === 'Menjodohkan') {
            areaOpsi.innerHTML = `
                <div id="container-jodoh">
                    ${[1,2,3].map(num => `
                    <div style="display: flex; gap: 10px; margin-bottom: 8px;">
                        <input type="text" class="jodoh-kiri input-text" placeholder="Pernyataan ${num}" style="padding: 8px;">
                        <input type="text" class="jodoh-kanan input-text" placeholder="Jawaban ${num}" style="padding: 8px;">
                    </div>`).join('')}
                </div>
            `;
        } else if (tipe === 'Isian') {
            areaOpsi.innerHTML = `<label>Kunci Jawaban</label><input type="text" id="kunci_isian" class="input-text" placeholder="Masukkan jawaban singkat">`;
        } else if (tipe === 'Uraian') {
            areaOpsi.innerHTML = `<label>Panduan Jawaban</label><textarea id="rubrik_uraian" class="input-text" rows="2" placeholder="Poin utama penilaian..."></textarea>`;
        }
    }

    // 6. SIMPAN SOAL MANUAL KE FIREBASE
    document.getElementById('btn-simpan-soal').addEventListener('click', async () => {
        const mapel = document.getElementById('soal-mapel').value;
        const tipe = tipeSelect.value;
        const teks = document.getElementById('soal-teks').value.trim();
        if(!teks) return alert("Mohon isi teks pertanyaan!");

        let payload = { mataPelajaran: mapel, tipe: tipe, teks_soal: teks, createdAt: new Date() };

        if (tipe === 'PG') {
            payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value };
            payload.kunci_jawaban = document.querySelector('input[name="kunci_pg"]:checked').value;
        } else if (tipe === 'PGK') {
            payload.opsi = { A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value, C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value, E: document.getElementById('opsi-E').value };
            let kunci = []; document.querySelectorAll('.kunci_pgk:checked').forEach(cb => kunci.push(cb.value));
            payload.kunci_jawaban = kunci;
        } else if (tipe === 'Menjodohkan') {
            let pasangan = []; document.querySelectorAll('.jodoh-kiri').forEach((el, idx) => {
                let kanan = document.querySelectorAll('.jodoh-kanan')[idx];
                if(el.value) pasangan.push({ premis: el.value, target: kanan.value });
            });
            payload.pasangan = pasangan;
        } else if (tipe === 'Isian') {
            payload.kunci_jawaban = document.getElementById('kunci_isian').value.toLowerCase();
        } else if (tipe === 'Uraian') {
            payload.rubrik = document.getElementById('rubrik_uraian').value;
        }

        try {
            await addDoc(collection(db, "bank_soal"), payload);
            alert("Soal berhasil disimpan!");
            modalSoal.style.display = 'none';
            loadDataSoal(); 
        } catch (error) { console.error(error); alert("Gagal menyimpan soal."); }
    });

    // 7. IMPORT EXCEL
    document.getElementById('file-excel').addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const mapel = document.getElementById('import-mapel').value;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                const jsonSoal = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if(!confirm(`Import ${jsonSoal.length} soal?`)) return;

                for (let row of jsonSoal) {
                    const tipe = (row.Tipe || 'PG').toString().toUpperCase();
                    let payload = { mataPelajaran: mapel, tipe: tipe, teks_soal: row.Soal, createdAt: new Date() };
                    if(tipe === 'PG') {
                        payload.opsi = { A: row.OpsiA, B: row.OpsiB, C: row.OpsiC, D: row.OpsiD, E: row.OpsiE };
                        payload.kunci_jawaban = row.Kunci;
                    } else if (tipe === 'PGK') {
                        payload.opsi = { A: row.OpsiA, B: row.OpsiB, C: row.OpsiC, D: row.OpsiD, E: row.OpsiE };
                        payload.kunci_jawaban = row.Kunci ? row.Kunci.toString().split(',') : [];
                    } else if (tipe === 'ISIAN') {
                        payload.kunci_jawaban = (row.Kunci || "").toLowerCase();
                    }
                    await addDoc(collection(db, "bank_soal"), payload);
                }
                alert("Import Excel selesai.");
                modalSoal.style.display = 'none';
                loadDataSoal();
            } catch (err) { console.error(err); alert("Gagal membaca file Excel."); }
        };
        reader.readAsArrayBuffer(file);
    });

    // 8. LOAD DATA HASIL UJIAN (FIREBASE)
    async function loadDataHasil() {
        const tbodyHasil = document.querySelector('#table-hasil tbody');
        tbodyHasil.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat hasil...</td></tr>`;
        try {
            const snap = await getDocs(collection(db, "hasil_ujian"));
            document.getElementById('stat-ujian').innerText = snap.size;
            tbodyHasil.innerHTML = '';
            if(snap.empty) { tbodyHasil.innerHTML = `<tr><td colspan="5" style="text-align:center;">Belum ada hasil.</td></tr>`; return; }

            snap.forEach(docSnap => {
                const h = docSnap.data();
                tbodyHasil.innerHTML += `
                    <tr>
                        <td><strong>${h.namaSiswa}</strong></td>
                        <td>${h.mataPelajaran.toUpperCase()}</td>
                        <td>${h.benar || 0} / ${h.totalSoal || 0}</td>
                        <td><strong style="color: var(--primary);">${h.nilai || 0}</strong></td>
                        <td><button onclick="hapusDokumen('hasil_ujian', '${docSnap.id}', window.refreshHasil)" style="background: var(--danger); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `;
            });
        } catch(error) { console.error(error); }
    }
    window.refreshHasil = loadDataHasil;

    // FUNGSI HAPUS GLOBAL
    window.hapusDokumen = async function(koleksi, id, callback) {
        if(!confirm("Hapus data ini permanen?")) return;
        try { await deleteDoc(doc(db, koleksi, id)); callback(); } 
        catch(err) { console.error(err); alert("Gagal menghapus."); }
    };
});
