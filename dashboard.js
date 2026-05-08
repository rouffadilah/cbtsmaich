import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CEK AUTENTIKASI GURU
    // ==========================================
    onAuthStateChanged(auth, (user) => {
        if (!user || localStorage.getItem("userRole") !== "guru") {
            window.location.href = "index.html";
            return;
        }
        document.getElementById('admin-name').innerText = user.displayName || "Guru";
        document.getElementById('greeting-text').innerHTML = `Assalamu'alaikum, ${user.displayName || 'Guru'}! 👋`;
        
        // Memuat Data dari Firebase setelah dipastikan Login
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

    // Navigasi Menu
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

    // Jam Real-time
    setInterval(() => {
        document.getElementById('live-time').innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + " WIB";
    }, 1000);

    // ==========================================
    // 2. LOAD DATA SISWA (FIREBASE)
    // ==========================================
    async function loadDataSiswa() {
        const tbodySiswa = document.querySelector('#table-siswa tbody');
        tbodySiswa.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>`;
        
        try {
            const qSiswa = query(collection(db, "users"), where("role", "==", "siswa"));
            const snap = await getDocs(qSiswa);
            
            document.getElementById('stat-siswa').innerText = snap.size;
            tbodySiswa.innerHTML = '';
            
            if(snap.empty) {
                tbodySiswa.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada siswa terdaftar.</td></tr>`;
                return;
            }

            snap.forEach(docSnap => {
                const data = docSnap.data();
                tbodySiswa.innerHTML += `
                    <tr>
                        <td>${data.username}</td>
                        <td><strong>${data.nama}</strong></td>
                        <td><span style="background: var(--success); color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">Aktif</span></td>
                        <td>
                            <button onclick="hapusDokumen('users', '${docSnap.id}', loadDataSiswa)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error(error);
        }
    }

    // ==========================================
    // 3. LOAD & TAMBAH SOAL (FIREBASE)
    // ==========================================
    async function loadDataSoal() {
        const tbodySoal = document.querySelector('#table-soal tbody');
        tbodySoal.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat bank soal...</td></tr>`;
        
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            document.getElementById('stat-soal').innerText = snap.size;
            tbodySoal.innerHTML = '';
            
            if(snap.empty) {
                tbodySoal.innerHTML = `<tr><td colspan="4" style="text-align:center;">Bank soal masih kosong.</td></tr>`;
                return;
            }

            snap.forEach(docSnap => {
                const data = docSnap.data();
                tbodySoal.innerHTML += `
                    <tr>
                        <td><span style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.8rem; font-weight:bold;">${data.mataPelajaran.toUpperCase()}</span></td>
                        <td>${data.teks_soal}</td>
                        <td><strong>${data.kunci_jawaban}</strong></td>
                        <td>
                            <button onclick="hapusDokumen('bank_soal', '${docSnap.id}', loadDataSoal)" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        } catch(error) { console.error(error); }
    }

    // Modal Tambah Soal
    const modalSoal = document.getElementById('modal-tambah-soal');
    document.getElementById('btn-tambah-manual').addEventListener('click', () => modalSoal.style.display = 'flex');
    document.getElementById('close-modal-soal').addEventListener('click', () => modalSoal.style.display = 'none');

    document.getElementById('btn-simpan-soal').addEventListener('click', async () => {
        const mapel = document.getElementById('soal-mapel').value;
        const teks = document.getElementById('soal-teks').value;
        const opsiA = document.getElementById('soal-a').value;
        const opsiB = document.getElementById('soal-b').value;
        const opsiC = document.getElementById('soal-c').value;
        const opsiD = document.getElementById('soal-d').value;
        const opsiE = document.getElementById('soal-e').value;
        const kunci = document.getElementById('soal-kunci').value;

        if(!teks || !opsiA || !opsiB) return alert("Mohon lengkapi minimal Soal, Opsi A, dan Opsi B!");

        document.getElementById('btn-simpan-soal').innerHTML = "Menyimpan...";
        
        try {
            await addDoc(collection(db, "bank_soal"), {
                mataPelajaran: mapel,
                teks_soal: teks,
                opsi_a: opsiA, opsi_b: opsiB, opsi_c: opsiC, opsi_d: opsiD, opsi_e: opsiE,
                kunci_jawaban: kunci
            });
            alert("Soal berhasil ditambahkan!");
            modalSoal.style.display = 'none';
            document.getElementById('btn-simpan-soal').innerHTML = '<i class="fas fa-save"></i> SIMPAN SOAL KE DATABASE';
            
            // Bersihkan form
            document.getElementById('soal-teks').value = '';
            ['a','b','c','d','e'].forEach(opt => document.getElementById(`soal-${opt}`).value = '');
            
            loadDataSoal(); // Refresh tabel
        } catch (error) {
            console.error(error);
            alert("Gagal menyimpan soal: " + error.message);
        }
    });

    // ==========================================
    // 4. LOAD DATA HASIL UJIAN (FIREBASE)
    // ==========================================
    let allHasilUjian = [];

    async function loadDataHasil() {
        const tbodyHasil = document.querySelector('#table-hasil tbody');
        tbodyHasil.innerHTML = `<tr><td colspan="5" style="text-align:center;">Memuat hasil...</td></tr>`;
        
        try {
            const snap = await getDocs(collection(db, "hasil_ujian"));
            document.getElementById('stat-ujian').innerText = snap.size;
            
            allHasilUjian = [];
            snap.forEach(docSnap => {
                allHasilUjian.push({ id: docSnap.id, ...docSnap.data() });
            });
            renderHasilTable(); // Render berdasarkan filter
        } catch(error) { console.error(error); }
    }

    document.getElementById('filter-tabel-hasil').addEventListener('change', renderHasilTable);

    function renderHasilTable() {
        const tbodyHasil = document.querySelector('#table-hasil tbody');
        const filterVal = document.getElementById('filter-tabel-hasil').value;
        tbodyHasil.innerHTML = '';

        let filtered = allHasilUjian;
        if(filterVal !== 'semua') {
            filtered = allHasilUjian.filter(h => h.mataPelajaran === filterVal);
        }

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
                    <button onclick="hapusDokumen('hasil_ujian', '${hasil.id}', loadDataHasil)" style="background: var(--danger); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 5px;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            
            // Event rincian
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
            containerRincian.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem; font-style: italic;">Siswa tidak menjawab benar satu pun.</span>';
        }
        document.getElementById('modal-detail-hasil').style.display = 'flex';
    }
    
    document.getElementById('close-modal-detail').addEventListener('click', () => {
        document.getElementById('modal-detail-hasil').style.display = 'none';
    });

    // ==========================================
    // 5. PENGATURAN TOKEN (FIREBASE)
    // ==========================================
    document.getElementById('btn-save-token').addEventListener('click', async () => {
        const mapel = document.getElementById('set-token-mapel').value;
        const tokenInput = document.getElementById('input-token-baru').value.trim().toUpperCase();

        if(!tokenInput) return alert("Token tidak boleh kosong!");

        try {
            const tokenRef = doc(db, "pengaturan", "token_ujian");
            await setDoc(tokenRef, {
                [`token_${mapel}`]: tokenInput
            }, { merge: true });

            alert(`Token untuk mapel ${mapel.toUpperCase()} berhasil diset menjadi: ${tokenInput}`);
            document.getElementById('input-token-baru').value = '';
        } catch(error) {
            console.error(error);
            alert("Gagal menyimpan token!");
        }
    });

    // Global helper delete
    window.hapusDokumen = async function(koleksi, id, callbackFunc) {
        if(!confirm("Yakin ingin menghapus data ini permanen?")) return;
        try {
            await deleteDoc(doc(db, koleksi, id));
            callbackFunc(); // Refresh data yang dihapus
        } catch(err) {
            console.error(err);
            alert("Gagal menghapus data.");
        }
    };
});
