import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Menggunakan Secondary App untuk Admin membuat User (agar Admin tidak ter-logout)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const secondaryApp = initializeApp({
    apiKey: "AIzaSyB8R0VNO0noUlkcUcjBkpsGFrYPdtA7KxM",
    authDomain: "cbt-sekolah-7fed0.firebaseapp.com",
    projectId: "cbt-sekolah-7fed0",
    storageBucket: "cbt-sekolah-7fed0.firebasestorage.app",
    messagingSenderId: "289218396137",
    appId: "1:289218396137:web:366383efd1348edad3d578"
}, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

document.addEventListener('DOMContentLoaded', () => {

    const userRole = localStorage.getItem("userRole");
    const userMapel = localStorage.getItem("userMapel");

    // 1. CEK AUTENTIKASI DAN ROLE
    onAuthStateChanged(auth, (user) => {
        if (!user || (userRole !== "admin" && userRole !== "guru")) {
            window.location.href = "index.html";
            return;
        }

        document.getElementById('admin-name').innerText = user.displayName || userRole.toUpperCase();
        document.getElementById('greeting-text').innerHTML = `Assalamu'alaikum, ${user.displayName}! 👋`;

        // PENGATURAN UI BERDASARKAN ROLE (RBAC)
        if (userRole === "admin") {
            document.getElementById('panel-title-role').innerText = "PANEL ADMIN";
        } else if (userRole === "guru") {
            document.getElementById('panel-title-role').innerText = "PANEL GURU";
            
            // Sembunyikan Menu Admin
            document.getElementById('menu-pengguna').style.display = 'none';
            document.getElementById('menu-pengaturan').style.display = 'none';

            // Kunci Mapel hanya untuk Mapel Guru tersebut
            const selectMapelSoal = document.getElementById('soal-mapel');
            selectMapelSoal.value = userMapel;
            selectMapelSoal.disabled = true;

            const selectMapelImport = document.getElementById('import-mapel');
            selectMapelImport.value = userMapel;
            selectMapelImport.disabled = true;

            const filterHasil = document.getElementById('filter-tabel-hasil');
            filterHasil.value = userMapel;
            filterHasil.disabled = true;
        }

        loadDataSoal();
        loadDataHasil();
        if(userRole === "admin") loadDataPengguna();
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        if(confirm('Yakin ingin keluar?')) {
            await signOut(auth); localStorage.clear(); window.location.href = 'index.html'; 
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
    setInterval(() => { document.getElementById('live-time').innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + " WIB"; }, 1000);


    // 3. LOAD DATA PENGGUNA (HANYA ADMIN)
    async function loadDataPengguna() {
        const tbody = document.querySelector('#table-siswa tbody');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>`;
        try {
            const snap = await getDocs(collection(db, "users"));
            document.getElementById('stat-siswa').innerText = snap.size;
            tbody.innerHTML = '';
            
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const roleColor = data.role === 'admin' ? 'var(--danger)' : (data.role === 'guru' ? 'var(--info)' : 'var(--success)');
                tbody.innerHTML += `
                    <tr>
                        <td>${data.username}</td>
                        <td><strong>${data.nama}</strong></td>
                        <td><span style="background: ${roleColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${data.role.toUpperCase()}</span></td>
                        <td>${data.role === 'guru' ? (data.mapel || '-') : '-'}</td>
                        <td><button onclick="hapusDokumen('users', '${docSnap.id}', window.refreshPengguna)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `;
            });
        } catch (error) { console.error(error); }
    }
    window.refreshPengguna = loadDataPengguna;

    // Menampilkan dropdown Mapel jika role=guru dipilih saat buat user
    document.getElementById('new-role').addEventListener('change', (e) => {
        document.getElementById('new-mapel').style.display = (e.target.value === 'guru') ? 'block' : 'none';
    });

    // BIKIN AKUN BARU (ADMIN)
    document.getElementById('btn-add-user')?.addEventListener('click', async () => {
        const nama = document.getElementById('new-nama').value.trim();
        const username = document.getElementById('new-username').value.trim();
        const role = document.getElementById('new-role').value;
        const pass = document.getElementById('new-pass').value;
        const mapel = document.getElementById('new-mapel').value;

        if(!nama || !username || !pass) return alert("Lengkapi form pembuatan akun!");
        if(pass.length < 6) return alert("Password minimal 6 karakter!");

        const btn = document.getElementById('btn-add-user');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses'; btn.disabled = true;

        try {
            const dummyEmail = `${username}@cbt.smaich.id`;
            // Bikin auth pakai secondary app agar admin tidak ter-logout
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, pass);
            await updateProfile(userCred.user, { displayName: nama });

            // Simpan ke Firestore
            let payload = { nama: nama, username: username, role: role, createdAt: new Date() };
            if (role === 'guru') payload.mapel = mapel;

            await setDoc(doc(db, "users", userCred.user.uid), payload);
            
            alert(`Berhasil membuat akun ${role.toUpperCase()} untuk ${nama}`);
            document.getElementById('new-nama').value = ''; document.getElementById('new-username').value = ''; document.getElementById('new-pass').value = '';
            loadDataPengguna();

            // Sign out dari secondary app
            await secondaryAuth.signOut();
        } catch (error) {
            console.error(error); alert("Gagal: " + (error.code === 'auth/email-already-in-use' ? 'Username sudah dipakai' : error.message));
        }
        btn.innerHTML = '<i class="fas fa-save"></i> Tambah'; btn.disabled = false;
    });


    // 4. LOAD BANK SOAL (DENGAN FILTER ROLE)
    async function loadDataSoal() {
        const tbodySoal = document.querySelector('#table-soal tbody');
        tbodySoal.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat bank soal...</td></tr>`;
        try {
            let qSoal = collection(db, "bank_soal");
            if (userRole === "guru") { // Filter khusus Guru
                qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", userMapel));
            }

            const snap = await getDocs(qSoal);
            document.getElementById('stat-soal').innerText = snap.size;
            tbodySoal.innerHTML = '';
            if(snap.empty) { tbodySoal.innerHTML = `<tr><td colspan="4" style="text-align:center;">Bank soal kosong.</td></tr>`; return; }

            snap.forEach(docSnap => {
                const data = docSnap.data();
                tbodySoal.innerHTML += `
                    <tr>
                        <td><span style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${data.mataPelajaran.toUpperCase()}</span></td>
                        <td><span style="color: var(--primary); font-weight: bold;">${data.tipe}</span></td>
                        <td>${data.teks_soal.substring(0, 50)}...</td>
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

    document.getElementById('btn-tambah-manual').addEventListener('click', () => { modalSoal.style.display = 'flex'; renderFormDinamis('PG'); });
    document.getElementById('close-modal-soal').addEventListener('click', () => modalSoal.style.display = 'none');

    tabManual.addEventListener('click', () => { areaManual.style.display = 'block'; areaImport.style.display = 'none'; tabManual.classList.replace('btn-secondary', 'btn-primary'); tabImport.classList.replace('btn-primary', 'btn-secondary'); });
    tabImport.addEventListener('click', () => { areaManual.style.display = 'none'; areaImport.style.display = 'block'; tabImport.classList.replace('btn-secondary', 'btn-primary'); tabManual.classList.replace('btn-primary', 'btn-secondary'); });

    const tipeSelect = document.getElementById('soal-tipe');
    tipeSelect.addEventListener('change', (e) => renderFormDinamis(e.target.value));

    function renderFormDinamis(tipe) {
        const areaOpsi = document.getElementById('area-opsi-dinamis');
        areaOpsi.innerHTML = ''; 
        if (tipe === 'PG') {
            areaOpsi.innerHTML = `${['A','B','C','D','E'].map(opt => `<div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;"><input type="radio" name="kunci_pg" value="${opt}" ${opt==='A'?'checked':''}><label style="font-weight: bold; width: 20px;">${opt}</label><input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="padding: 8px;"></div>`).join('')}`;
        } else if (tipe === 'PGK') {
            areaOpsi.innerHTML = `${['A','B','C','D','E'].map(opt => `<div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;"><input type="checkbox" class="kunci_pgk" value="${opt}"><label style="font-weight: bold; width: 20px;">${opt}</label><input type="text" id="opsi-${opt}" class="input-text" placeholder="Teks opsi ${opt}" style="padding: 8px;"></div>`).join('')}`;
        } else if (tipe === 'Menjodohkan') {
            areaOpsi.innerHTML = `<div id="container-jodoh">${[1,2,3].map(num => `<div style="display: flex; gap: 10px; margin-bottom: 8px;"><input type="text" class="jodoh-kiri input-text" placeholder="Pernyataan ${num}" style="padding: 8px;"><input type="text" class="jodoh-kanan input-text" placeholder="Jawaban ${num}" style="padding: 8px;"></div>`).join('')}</div>`;
        } else if (tipe === 'Isian') {
            areaOpsi.innerHTML = `<label>Kunci Jawaban</label><input type="text" id="kunci_isian" class="input-text" placeholder="Masukkan jawaban singkat">`;
        } else if (tipe === 'Uraian') {
            areaOpsi.innerHTML = `<label>Panduan Penilaian</label><textarea id="rubrik_uraian" class="input-text" rows="2" placeholder="Poin utama penilaian..."></textarea>`;
        }
    }

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
            let kunci = []; document.querySelectorAll('.kunci_pgk:checked').forEach(cb => kunci.push(cb.value)); payload.kunci_jawaban = kunci;
        } else if (tipe === 'Menjodohkan') {
            let pasangan = []; document.querySelectorAll('.jodoh-kiri').forEach((el, idx) => {
                let kanan = document.querySelectorAll('.jodoh-kanan')[idx]; if(el.value) pasangan.push({ premis: el.value, target: kanan.value });
            }); payload.pasangan = pasangan;
        } else if (tipe === 'Isian') {
            payload.kunci_jawaban = document.getElementById('kunci_isian').value.toLowerCase();
        } else if (tipe === 'Uraian') {
            payload.rubrik = document.getElementById('rubrik_uraian').value;
        }

        try { await addDoc(collection(db, "bank_soal"), payload); alert("Soal berhasil disimpan!"); modalSoal.style.display = 'none'; loadDataSoal(); } catch (error) { console.error(error); alert("Gagal menyimpan."); }
    });

    document.getElementById('file-excel').addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const mapel = document.getElementById('import-mapel').value;
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                const jsonSoal = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if(!confirm(`Import ${jsonSoal.length} soal?`)) return;

                let successCount = 0;
                for (let row of jsonSoal) {
                    const tipe = (row.Tipe || 'PG').toString().toUpperCase();
                    let payload = { mataPelajaran: mapel, tipe: tipe, teks_soal: row.Soal, createdAt: new Date() };

                    if(tipe === 'PG') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = (row.Kunci||"A").toString().toUpperCase(); } 
                    else if (tipe === 'PGK') { payload.opsi = { A: row.OpsiA||"", B: row.OpsiB||"", C: row.OpsiC||"", D: row.OpsiD||"", E: row.OpsiE||"" }; payload.kunci_jawaban = row.Kunci ? row.Kunci.toString().replace(/\s/g, '').toUpperCase().split(',') : []; }
                    else if (tipe === 'MENJODOHKAN') {
                        let pasangan = []; ['OpsiA', 'OpsiB', 'OpsiC', 'OpsiD', 'OpsiE'].forEach(opt => { if(row[opt] && row[opt].includes('=')) { let parts = row[opt].split('='); pasangan.push({ premis: parts[0].trim(), target: parts[1].trim() }); } }); payload.pasangan = pasangan;
                    }
                    else if (tipe === 'ISIAN') { payload.kunci_jawaban = (row.Kunci || "").toString().toLowerCase(); }
                    else if (tipe === 'URAIAN') { payload.rubrik = row['Keterangan/Rubrik'] || row.Rubrik || ""; }

                    await addDoc(collection(db, "bank_soal"), payload); successCount++;
                }
                alert(`Import Berhasil! ${successCount} soal tersimpan.`); modalSoal.style.display = 'none'; loadDataSoal();
            } catch (err) { console.error(err); alert("Gagal membaca file Excel."); }
        };
        reader.readAsArrayBuffer(file);
    });

    // 6. LOAD HASIL UJIAN (FILTERED)
    let allHasilUjian = [];
    async function loadDataHasil() {
        const tbodyHasil = document.querySelector('#table-hasil tbody');
        tbodyHasil.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat hasil...</td></tr>`;
        try {
            let qHasil = collection(db, "hasil_ujian");
            if (userRole === "guru") { // Khusus Guru, cuma narik mapelnya dia
                qHasil = query(collection(db, "hasil_ujian"), where("mataPelajaran", "==", userMapel));
            }
            const snap = await getDocs(qHasil);
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
        let filtered = filterVal === 'semua' ? allHasilUjian : allHasilUjian.filter(h => h.mataPelajaran === filterVal);

        if(filtered.length === 0) { tbodyHasil.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Tidak ada hasil ujian.</td></tr>`; return; }

        filtered.forEach(h => {
            tbodyHasil.innerHTML += `<tr><td><strong>${h.namaSiswa}</strong></td><td>${h.mataPelajaran.toUpperCase()}</td><td>${h.benar || 0} / ${h.totalSoal || 0}</td><td><strong style="color: var(--primary);">${h.nilai || 0}</strong></td><td><button class="btn-detail-hasil btn-secondary btn-3d" data-id="${h.id}" style="padding: 6px 12px; width:auto; font-size:0.8rem;"><i class="fas fa-list"></i></button> <button onclick="hapusDokumen('hasil_ujian', '${h.id}', window.refreshHasil)" style="background: var(--danger); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td></tr>`;
        });

        document.querySelectorAll('.btn-detail-hasil').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const data = allHasilUjian.find(item => item.id === e.currentTarget.dataset.id);
                document.getElementById('detail-nama').innerText = `: ${data.namaSiswa}`;
                document.getElementById('detail-mapel').innerText = `: ${data.mataPelajaran.toUpperCase()}`;
                document.getElementById('detail-jml-benar').innerText = data.benar;
                document.getElementById('detail-total-soal').innerText = data.totalSoal;
                document.getElementById('detail-nilai').innerText = data.nilai;
                document.getElementById('detail-rincian-benar').innerHTML = data.rincianBenar?.length > 0 ? data.rincianBenar.map(n => `<div style="background:var(--success); color:white; font-weight:bold; width:35px; height:35px; display:flex; align-items:center; justify-content:center; border-radius:6px;">${n}</div>`).join('') : '<small>Kosong</small>';
                document.getElementById('modal-detail-hasil').style.display = 'flex';
            });
        });
    }
    document.getElementById('close-modal-detail').addEventListener('click', () => document.getElementById('modal-detail-hasil').style.display = 'none');

    // 7. PENGATURAN TOKEN (HANYA ADMIN)
    document.getElementById('btn-save-token')?.addEventListener('click', async () => {
        const mapel = document.getElementById('set-token-mapel').value;
        const tokenInput = document.getElementById('input-token-baru').value.trim().toUpperCase();
        if(!tokenInput) return alert("Token kosong!");
        try { await setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${mapel}`]: tokenInput }, { merge: true }); alert(`Token ${mapel.toUpperCase()} = ${tokenInput}`); document.getElementById('input-token-baru').value = ''; } 
        catch(error) { console.error(error); alert("Gagal!"); }
    });

    // 8. FUNGSI HAPUS GLOBAL
    window.hapusDokumen = async function(koleksi, id, callback) {
        if(!confirm("Hapus data ini permanen?")) return;
        try { await deleteDoc(doc(db, koleksi, id)); callback(); } catch(err) { console.error(err); alert("Gagal."); }
    };
});
