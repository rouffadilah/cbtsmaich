import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // 1. CEK AUTENTIKASI GURU
    onAuthStateChanged(auth, (user) => {
        if (!user || localStorage.getItem("userRole") !== "guru") {
            window.location.href = "index.html";
            return;
        }
        document.getElementById('admin-name').innerText = user.displayName || "Guru";
        document.getElementById('greeting-text').innerHTML = `Assalamu'alaikum, ${user.displayName || 'Guru'}! 👋`;
        
        loadDataSiswa();
        loadDataSoal();
        loadDataHasil();
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        if(confirm('Apakah Anda yakin ingin keluar dari panel?')) {
            await signOut(auth);
            localStorage.clear();
            window.location.href = 'index.html'; 
        }
    });

    // 2. NAVIGASI MENU & JAM
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

    setInterval(() => {
        document.getElementById('live-time').innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + " WIB";
    }, 1000);

    // 3. LOAD DATA SISWA
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

    // 4. LOAD BANK SOAL
    async function loadDataSoal() {
        const tbodySoal = document.querySelector('#table-soal tbody');
        tbodySoal.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat bank soal...</td></tr>`;
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            document.getElementById('stat-soal').innerText = snap.size;
            tbodySoal.innerHTML = '';
            
            if(snap.empty) { tbodySoal.innerHTML = `<tr><td colspan="5" style="text-align:center;">Bank soal masih kosong.</td></tr>`; return; }

            snap.forEach(docSnap => {
                const data = docSnap.data();
                let kunciText = Array.isArray(data.kunci_jawaban) ? data.kunci_jawaban.join(', ') : 
                               (typeof data.kunci_jawaban === 'object' ? 'Lihat Rincian' : data.kunci_jawaban || '-');
                if(data.tipe === 'Uraian') kunciText = 'Cek Rubrik';

                tbodySoal.innerHTML += `
                    <tr>
                        <td><span style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${data.mataPelajaran.toUpperCase()}</span></td>
                        <td><span style="color: var(--primary); font-weight: bold;">${data.tipe}</span></td>
                        <td>${data.teks_soal.substring(0, 50)}...</td>
                        <td><strong>${kunciText}</strong></td>
                        <td><button onclick="hapusDokumen('bank_soal', '${docSnap.id}', window.refreshSoal)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `;
            });
        } catch(error) { console.error(error); }
    }
    window.refreshSoal = loadDataSoal;

    // 5. MANAJEMEN MODAL & UI DINAMIS SOAL
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
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">Pilih satu tombol radio sebagai kunci jawaban benar.</p>
                ${['A','B','C','D','E'].map(opt => `
                <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                    <input type="radio" name="kunci_pg" value="${opt}" ${opt==='A'?'checked':''}>
                    <label style="font-weight: bold; width: 20px;">${opt}</label>
                    <input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="padding: 8px;" required>
                </div>`).join('')}
            `;
        } else if (tipe === 'PGK') {
            areaOpsi.innerHTML = `
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">Centang checkbox untuk jawaban-jawaban yang benar (bisa lebih dari 1).</p>
                ${['A','B','C','D','E'].map(opt => `
                <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                    <input type="checkbox" class="kunci_pgk" value="${opt}">
                    <label style="font-weight: bold; width: 20px;">${opt}</label>
                    <input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="padding: 8px;">
                </div>`).join('')}
            `;
        } else if (tipe === 'Menjodohkan') {
            areaOpsi.innerHTML = `
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">Masukkan pasangan Premis (kiri) dan Jawaban (kanan).</p>
                <div id="container-jodoh">
                    ${[1,2,3,4].map(num => `
                    <div style="display: flex; gap: 10px; margin-bottom: 8px;">
                        <input type="text" class="jodoh-kiri input-text" placeholder="Premis ${num}" style="padding: 8px;">
                        <i class="fas fa-arrows-alt-h" style="align-self: center; color: var(--text-muted);"></i>
                        <input type="text" class="jodoh-kanan input-text" placeholder="Pasangan/Jawaban ${num}" style="padding: 8px;">
                    </div>`).join('')}
                </div>
            `;
        } else if (tipe === 'Isian') {
            areaOpsi.innerHTML = `
                <div class="input-group">
                    <label>Kunci Jawaban Singkat</label>
                    <input type="text" id="kunci_isian" class="input-text" placeholder="Contoh: Router" required>
                    <small style="color: var(--text-muted);">*Sistem mengecek kecocokan teks (huruf besar/kecil diabaikan).</small>
                </div>
            `;
        } else if (tipe === 'Uraian') {
            areaOpsi.innerHTML = `
                <div class="input-group">
                    <label>Rubrik Penilaian / Kunci Jawaban (Opsional)</label>
                    <textarea id="rubrik_uraian" class="input-text" rows="2" placeholder="Contoh: Poin penuh jika menjawab 3 fungsi dengan tepat..."></textarea>
                    <small style="color: var(--warning);"><i class="fas fa-info-circle"></i> Soal Uraian harus dikoreksi manual.</small>
                </div>
            `;
        }
    }

    // SIMPAN SOAL MANUAL
    document.getElementById('btn-simpan-soal').addEventListener('click', async () => {
        const mapel = document.getElementById('soal-mapel').value;
        const tipe = tipeSelect.value;
        const teks = document.getElementById('soal-teks').value.trim();
        if(!teks) return alert("Teks soal tidak boleh kosong!");

        let payload = { mataPelajaran: mapel, tipe: tipe, teks_soal: teks, createdAt: new Date() };

        if (tipe === 'PG') {
            payload.opsi = {
                A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value,
                C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value,
                E: document.getElementById('opsi-E').value
            };
            payload.kunci_jawaban = document.querySelector('input[name="kunci_pg"]:checked').value;
        } 
        else if (tipe === 'PGK') {
            payload.opsi = {
                A: document.getElementById('opsi-A').value, B: document.getElementById('opsi-B').value,
                C: document.getElementById('opsi-C').value, D: document.getElementById('opsi-D').value,
                E: document.getElementById('opsi-E').value
            };
            let kunci = [];
            document.querySelectorAll('.kunci_pgk:checked').forEach(cb => kunci.push(cb.value));
            if(kunci.length === 0) return alert("Pilih minimal 1 jawaban benar untuk PGK!");
            payload.kunci_jawaban = kunci; 
        }
        else if (tipe === 'Menjodohkan') {
            let pasangan = [];
            const kiri = document.querySelectorAll('.jodoh-kiri');
            const kanan = document.querySelectorAll('.jodoh-kanan');
            kiri.forEach((el, idx) => {
                if(el.value && kanan[idx].value) pasangan.push({ premis: el.value, target: kanan[idx].value });
            });
            if(pasangan.length === 0) return alert("Masukkan minimal 1 pasangan menjodohkan!");
            payload.pasangan = pasangan;
        }
        else if (tipe === 'Isian') {
            const kunci = document.getElementById('kunci_isian').value.trim();
            if(!kunci) return alert("Kunci isian tidak boleh kosong!");
            payload.kunci_jawaban = kunci.toLowerCase();
        }
        else if (tipe === 'Uraian') {
            payload.rubrik = document.getElementById('rubrik_uraian')?.value || "";
        }

        const btn = document.getElementById('btn-simpan-soal');
        btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Menyimpan...";
        
        try {
            await addDoc(collection(db, "bank_soal"), payload);
            alert("Soal berhasil disimpan!");
            modalSoal.style.display = 'none';
            btn.innerHTML = '<i class="fas fa-save"></i> SIMPAN SOAL KE DATABASE';
            document.getElementById('soal-teks').value = '';
            loadDataSoal(); 
        } catch (error) {
            console.error(error);
            alert("Gagal menyimpan soal.");
            btn.innerHTML = '<i class="fas fa-save"></i> SIMPAN SOAL KE DATABASE';
        }
    });

    // IMPORT EXCEL
    document.getElementById('file-excel').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const mapel = document.getElementById('import-mapel').value;
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonSoal = XLSX.utils.sheet_to_json(worksheet);
                
                if(jsonSoal.length === 0) return alert("Excel kosong!");
                if(!confirm(`Import ${jsonSoal.length} soal ke mapel ${mapel.toUpperCase()}?`)) return;

                let successCount = 0;
                for (let row of jsonSoal) {
                    const tipe = (row.Tipe || 'PG').toString().toUpperCase();
                    let payload = { mataPelajaran: mapel, tipe: tipe, teks_soal: row.Soal, createdAt: new Date() };

                    if(tipe === 'PG') {
                        payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" };
                        payload.kunci_jawaban = (row.Kunci || "A").toString().toUpperCase();
                    } 
                    else if (tipe === 'ISIAN') {
                        payload.kunci_jawaban = (row.Kunci || "").toString().toLowerCase();
                    }

                    await addDoc(collection(db, "bank_soal"), payload);
                    successCount++;
                }
                alert(`Import Berhasil! ${successCount} soal tersimpan.`);
                modalSoal.style.display = 'none';
                loadDataSoal();
            } catch (error) {
                console.error(error);
                alert("Gagal membaca Excel. Pastikan format kolom (Tipe, Soal, OpsiA, Kunci) benar.");
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // IMPORT WORD (MAMMOTH)
    document.getElementById('file-word').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(loadEvent) {
            mammoth.extractRawText({arrayBuffer: loadEvent.target.result})
                .then(function(result) {
                    alert("Teks Word terbaca. Sistem membutuhkan Regex untuk memisah soal otomatis (Fitur akan dikembangkan lebih lanjut). Total Teks: " + result.value.length);
                })
                .catch(function(err) { console.log(err); alert("Gagal membaca dokumen Word."); });
        };
        reader.readAsArrayBuffer(file);
    });

    // 6. LOAD HASIL UJIAN
    let allHasilUjian = [];
    async function loadDataHasil() {
        const tbodyHasil = document.querySelector('#table-hasil tbody');
        tbodyHasil.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat hasil...</td></tr>`;
        try {
            const snap = await getDocs(collection(db, "hasil_ujian"));
            document.getElementById('stat-ujian').innerText = snap.size;
            
            allHasilUjian = [];
            snap.forEach(docSnap => allHasilUjian.push({ id: docSnap.id, ...docSnap.data() }));
            renderHasilTable(); 
        } catch(error) { console.error(error); }
    }
    window.refreshHasil = loadDataHasil;

    document.getElementById('filter-tabel-hasil').addEventListener('change', renderHasilTable);

    function renderHasilTable() {
        const tbodyHasil = document.querySelector('#table-hasil tbody');
        const filterVal = document.getElementById('filter-tabel-hasil').value;
        tbodyHasil.innerHTML = '';

        let filtered = allHasilUjian;
        if(filterVal !== 'semua') filtered = allHasilUjian.filter(h => h.mataPelajaran === filterVal);

        if(filtered.length === 0) {
            tbodyHasil.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Tidak ada data hasil ujian.</td></tr>`;
            return;
        }

        filtered.forEach(hasil => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${hasil.namaSiswa}</strong></td>
                <td><span style="background: var(--primary-light); color: var(--primary-hover); padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">${hasil.mataPelajaran.toUpperCase()}</span></td>
                <td><span style="color: var(--success); font-weight: bold;">${hasil.benar || 0}</span> / ${hasil.totalSoal || 0}</td>
                <td><strong style="color: var(--primary); font-size: 1.1rem;">${hasil.nilai || 0}</strong></td>
                <td>
                    <button class="btn-3d btn-secondary btn-detail-hasil" style="padding: 6px 12px; font-size: 0.8rem; width: auto;"><i class="fas fa-list-ol"></i> Rincian</button>
                    <button onclick="hapusDokumen('hasil_ujian', '${hasil.id}', window.refreshHasil)" style="background: var(--danger); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tr.querySelector('.btn-detail-hasil').addEventListener('click', () => bukaModalRincian(hasil));
            tbodyHasil.appendChild(tr);
        });
    }

    function bukaModalRincian(data) {
        document.getElementById('detail-nama').innerText = `: ${data.namaSiswa}`;
        document.getElementById('detail-mapel').innerText = `: ${data.mataPelajaran.toUpperCase()}`;
        document.getElementById('detail-jml-benar').innerText = data.benar;
        document.getElementById('detail-total-soal').innerText = data.totalSoal;
        document.getElementById('detail-nilai').innerText = data.nilai;

        const containerRincian = document.getElementById('detail-rincian-benar');
        containerRincian.innerHTML = '';
        if(data.rincianBenar && data.rincianBenar.length > 0) {
            data.rincianBenar.forEach(num => {
                containerRincian.innerHTML += `<div style="background:var(--success); color:white; font-weight:bold; width:35px; height:35px; display:flex; align-items:center; justify-content:center; border-radius:6px; box-shadow:var(--shadow-sm);">${num}</div>`;
            });
        } else {
            containerRincian.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem; font-style: italic;">Tidak ada yang benar.</span>';
        }
        document.getElementById('modal-detail-hasil').style.display = 'flex';
    }
    document.getElementById('close-modal-detail').addEventListener('click', () => document.getElementById('modal-detail-hasil').style.display = 'none');

    // 7. PENGATURAN TOKEN
    document.getElementById('btn-save-token').addEventListener('click', async () => {
        const mapel = document.getElementById('set-token-mapel').value;
        const tokenInput = document.getElementById('input-token-baru').value.trim().toUpperCase();
        if(!tokenInput) return alert("Token tidak boleh kosong!");

        try {
            const tokenRef = doc(db, "pengaturan", "token_ujian");
            await setDoc(tokenRef, { [`token_${mapel}`]: tokenInput }, { merge: true });
            alert(`Token mapel ${mapel.toUpperCase()} diset menjadi: ${tokenInput}`);
            document.getElementById('input-token-baru').value = '';
        } catch(error) { console.error(error); alert("Gagal menyimpan token!"); }
    });

    // 8. HAPUS DOKUMEN GLOBAL
    window.hapusDokumen = async function(koleksi, id, callbackFunc) {
        if(!confirm("Yakin ingin menghapus data ini permanen?")) return;
        try {
            await deleteDoc(doc(db, koleksi, id));
            if(typeof callbackFunc === 'function') callbackFunc();
        } catch(err) { console.error(err); alert("Gagal menghapus data."); }
    };
});
