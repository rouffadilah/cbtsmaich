import { auth, db, storage } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ==========================================
// 0. INJEKSI CSS CUSTOM
// ==========================================
if (!document.getElementById('cbt-custom-css')) {
    const style = document.createElement('style');
    style.id = 'cbt-custom-css';
    style.innerHTML = `
        .dropdown-check { position: relative; display: inline-block; width: 100%; min-width: 140px; }
        .dropdown-check-btn { width: 100%; padding: 8px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 600; color: var(--secondary); transition: 0.2s; }
        .dropdown-check-btn:hover { border-color: var(--primary); }
        .dropdown-check-content { display: none; position: absolute; background-color: white; width: 100%; min-width: 180px; box-shadow: 0px 10px 25px rgba(0,0,0,0.15); z-index: 1000; border-radius: 8px; border: 1px solid #e2e8f0; max-height: 220px; overflow-y: auto; padding: 8px 0; top: 100%; margin-top: 5px; left: 0; }
        .dropdown-check-content label { display: flex; align-items: center; padding: 8px 15px; cursor: pointer; gap: 10px; font-size: 0.85rem; font-weight: 600; color: var(--text-main); transition: 0.2s; margin: 0; }
        .dropdown-check-content label:hover { background-color: #f1f5f9; color: var(--primary); }
        .dropdown-check-content input[type="checkbox"] { transform: scale(1.3); cursor: pointer; }
        .dropdown-check.show .dropdown-check-content { display: block; }
        .card { overflow: visible !important; }
        #view-summary-bank-soal .table-container { min-height: 350px; padding-bottom: 120px; }
    `;
    document.head.appendChild(style);
}

// ==========================================
// 1. VARIABEL GLOBAL
// ==========================================
let listMapel = []; 
let listKelas = []; 
let allUsersData = []; 
let allHasilUjian = []; 
let isAdmin = false; 
let isGuru = false; 
let userMapel = []; 
let userKelas = []; 
let editMasterMode = false;
let currentMapelDetail = ""; 
let currentKelasDetail = ""; 

// ==========================================
// 2. MODUL SOAL MANAGER
// ==========================================
const SoalManager = {
    allSummary: {},
    tempDataKelola: [],

    getTingkatan: function(kelas) {
        if (!kelas) return "Lainnya"; 
        let k = String(kelas).toUpperCase().trim();
        if (k.startsWith("XII")) return "XII"; 
        if (k.startsWith("XI")) return "XI"; 
        if (k.startsWith("X")) return "X";
        return "Lainnya";
    },

    handleKelasToggle: function() {
        const cbs = document.querySelectorAll('.cb-soal-kelas');
        const checked = Array.from(cbs).filter(cb => cb.checked);
        const label = document.getElementById('soal-kelas-label');
        
        if (checked.length === 0) { 
            cbs.forEach(cb => { cb.disabled = false; cb.parentElement.style.opacity = '1'; cb.parentElement.style.cursor = 'pointer'; }); 
            label.innerText = "-- Pilih Kelas --"; 
            return; 
        }
        
        const targetTingkatan = this.getTingkatan(checked[0].value);
        cbs.forEach(cb => {
            if (!cb.checked) {
                const isSameTingkat = this.getTingkatan(cb.value) === targetTingkatan;
                cb.disabled = !isSameTingkat; 
                cb.parentElement.style.opacity = isSameTingkat ? '1' : '0.4'; 
                cb.parentElement.style.cursor = isSameTingkat ? 'pointer' : 'not-allowed';
            }
        });
        label.innerText = `${checked.length} Kelas Dipilih`;
    },

    loadSummary: async function() {
        const tbody = document.querySelector('#table-bank-soal-summary tbody'); 
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Memuat data...</td></tr>';
        
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            this.allSummary = {}; 
            
            snap.forEach(d => {
                let data = d.data();
                let mapel = data.mataPelajaran || "Tanpa Mapel"; 
                let kelasArray = Array.isArray(data.kelas) ? data.kelas : [data.kelas || "Umum"];
                let kelasKey = [...kelasArray].sort().join(', ');
                let groupKey = mapel + "||" + kelasKey;
                
                if(!this.allSummary[groupKey]) { 
                    this.allSummary[groupKey] = { mapel: mapel, classes: kelasArray, kelasKey: kelasKey, count: 0 }; 
                }
                this.allSummary[groupKey].count++;
            });
            
            const statSoalEl = document.getElementById('stat-soal'); 
            if (statSoalEl) statSoalEl.innerText = Object.keys(this.allSummary).length;
            
            const waktuSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian")); 
            const waktuData = waktuSnap.exists() ? waktuSnap.data() : {};
            const jadwalSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian")); 
            const jadwalData = jadwalSnap.exists() ? jadwalSnap.data() : {};
            const tokenSnap = await getDoc(doc(db, "pengaturan", "token_ujian")); 
            const tokenData = tokenSnap.exists() ? tokenSnap.data() : {};
            const acakSnap = await getDoc(doc(db, "pengaturan", "acak_soal"));
            const acakData = acakSnap.exists() ? acakSnap.data() : {};
            
            let html = ''; 
            let rowIdx = 0;
            let sortedKeys = Object.keys(this.allSummary).sort((a, b) => a.localeCompare(b));

            sortedKeys.forEach(groupKey => {
                rowIdx++; 
                let d = this.allSummary[groupKey]; 
                let mainClass = d.classes.length > 0 ? d.classes[0] : '';
                let jadwalKey = mainClass ? `${d.mapel}_${mainClass}` : '';
                
                let jadwal = jadwalKey && jadwalData[jadwalKey] ? jadwalData[jadwalKey] : '';
                let durasi = jadwalKey && waktuData[jadwalKey] ? waktuData[jadwalKey] : '';
                let token = '';
                if(jadwalKey && tokenData[`token_${jadwalKey}`]) { 
                    let tData = tokenData[`token_${jadwalKey}`]; 
                    token = typeof tData === 'object' ? tData.code : tData; 
                }
                
                let isAcakAktif = jadwalKey && acakData[jadwalKey] ? 'checked' : '';
                let acakInputId = `acak-${rowIdx}`;
                
                let canEdit = isAdmin || (isGuru && userMapel.includes(d.mapel));
                let labelKelas = d.classes.length > 0 ? d.classes.join(', ') : '<i style="color:#94a3b8;">Belum ada kelas</i>';
                let kelasHtml = `<span style="font-weight:600; color:var(--secondary); font-size:0.85rem;">${labelKelas}</span>`;

                let jadwalInputId = `jadwal-${rowIdx}`; 
                let durasiInputId = `durasi-${rowIdx}`; 
                let tokenInputId = `token-${rowIdx}`;
                
                let jadwalInput = canEdit ? `<input type="datetime-local" id="${jadwalInputId}" class="ghost-input" value="${jadwal}" style="min-width: 140px;">` : (jadwal || '-');
                let durasiInput = canEdit ? `<input type="number" id="${durasiInputId}" class="ghost-input" value="${durasi}" placeholder="Menit" style="min-width: 80px; text-align: center;">` : (durasi || '-');
                
                let tokenInput = canEdit ? `
                    <div style="display:flex; flex-direction:column; gap:8px; align-items:center; justify-content:center;">
                        <div style="display:flex; align-items:center; gap:5px;">
                            <input type="text" id="${tokenInputId}" class="ghost-input" value="${token}" placeholder="KODE" style="text-transform:uppercase; font-weight:bold; color:var(--danger); width: 80px; text-align: center; border: 1px solid #e2e8f0; padding: 4px;">
                            <button onclick="document.getElementById('${tokenInputId}').value=''; SoalManager.simpanPengaturanBaris('${d.mapel}', '${d.kelasKey}', '${jadwalInputId}', '${durasiInputId}', '${tokenInputId}', '${acakInputId}', this)" class="btn-icon" style="color:white; background:var(--danger); border-radius:4px; padding:4px 8px; font-size:0.8rem; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);" title="Nonaktifkan Token"><i class="fas fa-power-off"></i></button>
                        </div>
                        <label style="font-size: 0.75rem; font-weight: bold; color: var(--info); display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="checkbox" id="${acakInputId}" ${isAcakAktif} style="transform: scale(1.2);"> Acak Soal
                        </label>
                    </div>` : `<span style="display:inline-block; min-width:120px; text-align:center;">${token || '<span style="color:var(--success); font-size:0.8rem; font-weight:bold;">Tanpa Token</span>'}<br><small style="color:var(--info); font-weight:bold;">${isAcakAktif ? '🔀 Diacak' : '➡️ Berurut'}</small></span>`;

                let actionBtn = canEdit ? `
                    <div style="display:flex; gap:5px; justify-content:center;">
                        <button onclick="SoalManager.simpanPengaturanBaris('${d.mapel}', '${d.kelasKey}', '${jadwalInputId}', '${durasiInputId}', '${tokenInputId}', '${acakInputId}', this)" class="btn-icon" style="color: var(--success);" title="Simpan Pengaturan"><i class="fas fa-save"></i></button>
                        <button onclick="SoalManager.bukaDetailSoal('${d.mapel}', '${d.kelasKey}')" class="btn-icon" title="Kelola Soal"><i class="fas fa-cog"></i></button>
                        <button onclick="SoalManager.hapusKeseluruhan('${d.mapel}', '${d.kelasKey}')" class="btn-icon text-danger" title="Hapus Paket Mapel Ini"><i class="fas fa-trash-alt"></i></button>
                    </div>` : `<span style="color:var(--text-muted);"><i class="fas fa-lock"></i></span>`;
                
                html += `<tr>
                    <td style="vertical-align: middle;"><b style="color: var(--secondary); font-size: 1.05rem;">${d.mapel}</b></td>
                    <td>${kelasHtml}</td>
                    <td>${jadwalInput}</td>
                    <td>${durasiInput}</td>
                    <td>${tokenInput}</td>
                    <td style="text-align: center; color: var(--text-muted); font-weight: 600; font-size: 0.9rem;">${d.count} Soal</td>
                    <td style="text-align: center;">${actionBtn}</td>
                </tr>`;
            });
            
            tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;">Tidak ada data soal.</td></tr>';
        } catch (e) { 
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger);">Gagal memuat data ringkasan.</td></tr>'; 
        }
    },

    simpanPengaturanBaris: async function(mapel, kelasKey, jadwalId, durasiId, tokenId, acakId, btnEl) {
        const jadwalVal = document.getElementById(jadwalId).value;
        const durasiVal = document.getElementById(durasiId).value;
        const tokenVal = document.getElementById(tokenId).value.toUpperCase().trim();
        const acakVal = document.getElementById(acakId) ? document.getElementById(acakId).checked : false;
        const origHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btnEl.disabled = true;

        try {
            let classesToUpdate = kelasKey.split(', ');
            if (classesToUpdate.length > 0 && classesToUpdate[0] !== "") {
                let wUpdates = {}; let jUpdates = {}; let tUpdates = {}; let aUpdates = {};
                const expiredAt = new Date().getTime() + (15 * 60 * 1000); 

                classesToUpdate.forEach(cls => { 
                    const dbKey = `${mapel}_${cls}`;
                    if(durasiVal) wUpdates[dbKey] = durasiVal; 
                    else wUpdates[dbKey] = deleteField();

                    if(jadwalVal) jUpdates[dbKey] = jadwalVal;
                    else jUpdates[dbKey] = deleteField();
                    
                    if(tokenVal) {
                        tUpdates[`token_${dbKey}`] = { code: tokenVal, active: true, expiredAt }; 
                    } else {
                        tUpdates[`token_${dbKey}`] = deleteField(); 
                    }

                    aUpdates[dbKey] = acakVal;
                });

                if(Object.keys(wUpdates).length > 0) await setDoc(doc(db, "pengaturan", "waktu_ujian"), wUpdates, { merge: true });
                if(Object.keys(jUpdates).length > 0) await setDoc(doc(db, "pengaturan", "jadwal_ujian"), jUpdates, { merge: true });
                if(Object.keys(tUpdates).length > 0) await setDoc(doc(db, "pengaturan", "token_ujian"), tUpdates, { merge: true });
                if(Object.keys(aUpdates).length > 0) await setDoc(doc(db, "pengaturan", "acak_soal"), aUpdates, { merge: true });
            }
            
            const icon = btnEl.querySelector('i');
            if(icon) { icon.className = 'fas fa-check'; setTimeout(() => { icon.className = 'fas fa-save'; }, 2000); }
            
            if(origHtml.includes('fa-power-off')) {
                await window.customAlert("Token dinonaktifkan! Siswa bisa langsung masuk ujian.", "success", "Token Dihapus");
            } else {
                await window.customAlert("Pengaturan Jadwal, Durasi, Token, dan Acak Soal berhasil disimpan!", "success", "Tersimpan");
            }
            this.loadSummary();
        } catch (e) { 
            window.customAlert("Gagal menyimpan pengaturan: " + e.message, "error"); 
        } finally { 
            btnEl.innerHTML = origHtml; btnEl.disabled = false; 
        }
    },

    bukaDetailSoal: async function(mapel, kelasKey) {
        document.getElementById('view-summary-bank-soal').style.display = 'none'; 
        document.getElementById('view-soal-list').style.display = 'block';
        
        let headerDiv = document.getElementById('label-mapel-edit').parentElement.parentElement;
        let actionContainer = document.getElementById('action-container-kelola');
        
        if(!actionContainer) {
            actionContainer = document.createElement('div');
            actionContainer.id = 'action-container-kelola';
            actionContainer.style.display = 'flex';
            actionContainer.style.gap = '10px';
            actionContainer.style.alignItems = 'center';

            // 1. Tombol Atur Bobot Massal
            let btnBobot = document.createElement('button');
            btnBobot.className = 'btn-3d';
            btnBobot.style.backgroundColor = 'var(--warning)';
            btnBobot.style.padding = '8px 18px';
            btnBobot.style.margin = '0';
            btnBobot.style.fontSize = '0.9rem';
            btnBobot.innerHTML = '<i class="fas fa-balance-scale"></i> Atur Bobot';
            btnBobot.onclick = () => {
                document.getElementById('modal-atur-bobot-massal').style.display = 'flex';
            };

            // 2. Tombol Selesai Mengelola
            let existingBtn = document.createElement('button');
            existingBtn.id = 'btn-selesai-kelola';
            existingBtn.className = 'btn-3d';
            existingBtn.style.backgroundColor = 'var(--success)';
            existingBtn.style.padding = '8px 18px';
            existingBtn.style.margin = '0';
            existingBtn.style.fontSize = '0.9rem';
            existingBtn.innerHTML = '<i class="fas fa-check-circle"></i> Selesai Mengelola';
            existingBtn.onclick = () => {
                window.customAlert("Perubahan bank soal telah tersimpan otomatis.", "success", "Tersimpan");
                document.getElementById('btn-back-mapel-list').click();
            };

            actionContainer.appendChild(btnBobot);
            actionContainer.appendChild(existingBtn);
            headerDiv.appendChild(actionContainer);
        }

        document.getElementById('label-mapel-edit').innerText = `Kelola Paket: ${mapel} (${kelasKey})`;
        document.getElementById('filter-soal-mapel').value = mapel; 
        document.getElementById('filter-soal-mapel').dataset.kelasKey = kelasKey; 
        this.loadDaftarSoal(mapel, kelasKey);
    },

    terapkanBobotMassal: async function() {
        const mapel = document.getElementById('filter-soal-mapel').value;
        const kelasKey = document.getElementById('filter-soal-mapel').dataset.kelasKey;

        const bPG = parseFloat(document.getElementById('mass-bobot-pg').value) || 1;
        const bPGK = parseFloat(document.getElementById('mass-bobot-pgk').value) || 1;
        const bJodoh = parseFloat(document.getElementById('mass-bobot-jodoh').value) || 1;
        const bEssay = parseFloat(document.getElementById('mass-bobot-essay').value) || 1;

        const btn = document.getElementById('btn-simpan-bobot-massal');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;

        try {
            let updates = [];
            this.tempDataKelola.forEach(s => {
                let tipe = (s.tipe || 'PG').toUpperCase();
                let targetBobot = 1;

                if (tipe === 'PG') targetBobot = bPG;
                else if (tipe === 'PGK') targetBobot = bPGK;
                else if (tipe === 'MENJODOHKAN') targetBobot = bJodoh;
                else if (tipe === 'ESSAY') targetBobot = bEssay;

                if (parseFloat(s.bobot) !== targetBobot) {
                    updates.push(updateDoc(doc(db, "bank_soal", s.id), { bobot: targetBobot }));
                }
            });

            if (updates.length > 0) {
                await Promise.all(updates);
                await window.customAlert(`${updates.length} soal berhasil diperbarui bobotnya!`, "success");
                this.loadDaftarSoal(mapel, kelasKey);
            } else {
                await window.customAlert("Semua soal sudah memiliki bobot yang sesuai. Tidak ada perubahan dilakukan.", "info");
            }
            document.getElementById('modal-atur-bobot-massal').style.display = 'none';
        } catch(e) {
            window.customAlert("Gagal memperbarui bobot: " + e.message, "error");
        } finally {
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    },

    loadDaftarSoal: async function(mapel, kelasKey) {
        const container = document.getElementById('list-soal'); 
        container.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Memuat soal...</div>';
        
        try {
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
            const snap = await getDocs(q); 
            this.tempDataKelola = []; 
            
            snap.forEach(doc => { 
                let data = doc.data();
                let kArr = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
                let kKey = [...kArr].sort().join(', ');
                if (kKey === kelasKey) {
                    this.tempDataKelola.push({id: doc.id, ...data}); 
                }
            });
            this.tempDataKelola.sort((a,b) => (a.nomor_soal || 0) - (b.nomor_soal || 0));
            window.tempDataSoalKelola = this.tempDataKelola;

            if(this.tempDataKelola.length === 0) { 
                container.innerHTML = `<div style="text-align:center; padding: 30px; background: white; border: 1px dashed var(--border-color); border-radius: 8px;">Belum ada soal untuk mata pelajaran ini.<br><br><button onclick="SoalManager.bukaModalTambah('${mapel}', 1, '${kelasKey}')" class="btn-3d" style="background:var(--success); padding:8px 20px; border-radius:20px; font-size:0.9rem; margin:0 auto;"><i class="fas fa-plus"></i> Buat Soal Pertama</button></div>`; 
                return; 
            }

            let html = `<div style="display:flex; justify-content:center; position:relative; margin-bottom: 15px; margin-top: 5px;"><hr style="position:absolute; width:100%; top:50%; border:none; border-top:1px dashed #cbd5e1; z-index:1;"><button onclick="SoalManager.bukaModalTambah('${mapel}', 1, '${kelasKey}')" class="btn-3d" style="background:white; color:var(--success); border:1px solid var(--success); padding:4px 15px; border-radius:20px; font-size:0.8rem; z-index:2; box-shadow:0 2px 5px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='var(--success)'; this.style.color='white'" onmouseout="this.style.background='white'; this.style.color='var(--success)'"><i class="fas fa-plus"></i> Sisipkan Soal di Sini</button></div>`;
            
            this.tempDataKelola.forEach((s, idx) => {
                html += `
                <div id="soal-item-${s.id}" style="background: white; border: 1px solid var(--border-color); border-left: 4px solid transparent; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); cursor: pointer; transition: all 0.2s ease; position: relative;" onmouseover="this.style.borderLeftColor='var(--info)'; this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderLeftColor='transparent'; this.style.boxShadow='var(--shadow-sm)'; this.style.transform='translateY(0)'" onclick="SoalManager.bukaModalEdit('${s.id}')">
                    <div style="position:absolute; right:15px; top:15px; z-index:10; display:flex; gap:6px;">
                        <button onclick="event.stopPropagation(); SoalManager.geserUrutan('${s.id}', 'up', '${mapel}', '${kelasKey}')" style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; width:32px; height:32px; border-radius:8px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'" title="Geser ke Atas"><i class="fas fa-arrow-up"></i></button>
                        <button onclick="event.stopPropagation(); SoalManager.geserUrutan('${s.id}', 'down', '${mapel}', '${kelasKey}')" style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; width:32px; height:32px; border-radius:8px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'" title="Geser ke Bawah"><i class="fas fa-arrow-down"></i></button>
                        <button onclick="event.stopPropagation(); SoalManager.hapusSingle('${s.id}', '${mapel}', '${kelasKey}')" style="background:#fee2e2; color:var(--danger); border:none; width:32px; height:32px; border-radius:8px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='var(--danger)'; this.style.color='white'" onmouseout="this.style.background='#fee2e2'; this.style.color='var(--danger)'" title="Hapus Soal"><i class="fas fa-trash-alt"></i></button>
                    </div>
                    <div style="padding: 20px 25px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                            <span style="font-weight:800; color:var(--primary); display:block; margin-bottom:8px;">Soal ${s.nomor_soal || (idx+1)} <span style="background:var(--info); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:5px;">${s.tipe || 'PG'}</span><span style="background:var(--warning); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:5px;">Bobot: ${s.bobot || 1}</span></span>
                        </div>
                        <div style="color:var(--text-main); line-height:1.6; font-size: 1rem; margin-bottom:15px;">${s.teks_soal}</div>`;
                
                if(s.media_soal){
                    const mUrl = typeof s.media_soal === 'object' ? s.media_soal.url : s.media_soal; 
                    const mType = typeof s.media_soal === 'object' && s.media_soal.type ? s.media_soal.type : 'image';
                    if(mType === 'video'){ html += `<div style="margin-bottom:15px;"><video src="${mUrl}" controls style="max-height:200px; border-radius:8px; background:#000;"></video></div>`; } 
                    else if(mType === 'audio'){ html += `<div style="margin-bottom:15px;"><audio src="${mUrl}" controls></audio></div>`; } 
                    else { html += `<div style="margin-bottom:15px; text-align:left;"><img src="${mUrl}" style="max-height:250px; max-width:100%; width:auto; object-fit:contain; border-radius:8px; border:1px solid #e2e8f0;"></div>`; }
                }
                
                if (s.tipe === 'PG' || s.tipe === 'PGK' || !s.tipe) {
                    html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
                    ['A','B','C','D','E'].forEach(o => {
                        let teksOpsi = (s.opsi && s.opsi[o]) ? s.opsi[o] : '';
                        if(teksOpsi || (s.opsi_media && s.opsi_media[o])) {
                            let isBenar = (s.tipe === 'PG' || !s.tipe) ? s.kunci_jawaban === o : Array.isArray(s.kunci_jawaban) && s.kunci_jawaban.includes(o);
                            let mHtml = '';
                            if(s.opsi_media && s.opsi_media[o]){
                                const moData = s.opsi_media[o]; const moUrl = typeof moData === 'object' ? moData.url : moData; const moType = typeof moData === 'object' && moData.type ? moData.type : 'image';
                                if(moType === 'video') mHtml = `<video src="${moUrl}" controls style="max-height:100px; margin-top:5px; border-radius:6px; background:#000;"></video><br>`;
                                else if(moType === 'audio') mHtml = `<audio src="${moUrl}" controls style="max-width:200px; margin-top:5px;"></audio><br>`;
                                else mHtml = `<img src="${moUrl}" style="max-height:120px; max-width:100%; width:auto; object-fit:contain; margin-top:5px; border-radius:6px; border:1px solid #e2e8f0;"><br>`;
                            }
                            if (isBenar) { html += `<div style="display:flex; align-items:flex-start; gap:10px; padding:8px 12px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; color:var(--success); font-weight:600; font-size:0.9rem;"><i class="fas fa-check-circle" style="margin-top:3px;"></i> <div><span>${o}. ${teksOpsi}</span><br>${mHtml}</div></div>`; } 
                            else { html += `<div style="display:flex; align-items:flex-start; gap:10px; padding:8px 12px; border:1px solid #f1f5f9; border-radius:6px; color:var(--text-muted); font-size:0.9rem;"><span style="font-weight:600; width:20px; margin-top:1px;">${o}.</span> <div><span>${teksOpsi}</span><br>${mHtml}</div></div>`; }
                        }
                    });
                    html += `</div>`;
                } else if (s.tipe === 'Menjodohkan') {
                    html += `<div style="font-size:0.9rem; background:#eff6ff; border: 1px solid #bfdbfe; color:#1e40af; padding:15px; border-radius:8px; display:inline-block; width:100%;"><b>Pasangan Jawaban Benar:</b><div style="margin-top: 10px; display:flex; flex-direction:column; gap:8px;">`;
                    if(s.pasangan) { s.pasangan.forEach(p => { html += `<div style="display:flex; align-items:center; gap:10px;"><span style="flex:1; background:white; padding:10px 15px; border-radius:6px; border:1px solid #bfdbfe; color:var(--secondary);">${p.kiri}</span> <i class="fas fa-arrow-right" style="color:#60a5fa;"></i> <span style="flex:1; background:#dcfce7; padding:10px 15px; border-radius:6px; border:1px solid #bbf7d0; color:var(--success); font-weight:bold;">${p.kanan}</span></div>`; }); }
                    html += `</div></div>`;
                } else if (s.tipe === 'Essay' && s.kunci_jawaban) {
                    html += `<div style="font-size:0.9rem; background:#f0fdf4; border: 1px solid #bbf7d0; color:#166534; padding:15px; border-radius:8px; display:inline-block; width:100%; margin-top: 10px;"><b>Referensi Jawaban:</b><div style="margin-top: 8px; color: #15803d; line-height: 1.5;">${s.kunci_jawaban}</div></div>`;
                }
                
                let targetNext = (s.nomor_soal || (idx+1)) + 1;
                html += `</div></div>
                <div style="display:flex; justify-content:center; position:relative; margin: 15px 0;"><hr style="position:absolute; width:100%; top:50%; border:none; border-top:1px dashed #cbd5e1; z-index:1;"><button onclick="SoalManager.bukaModalTambah('${mapel}', ${targetNext}, '${kelasKey}')" class="btn-3d" style="background:white; color:var(--success); border:1px solid var(--success); padding:4px 15px; border-radius:20px; font-size:0.8rem; z-index:2; box-shadow:0 2px 5px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='var(--success)'; this.style.color='white'" onmouseout="this.style.background='white'; this.style.color='var(--success)'"><i class="fas fa-plus"></i> Sisipkan Soal di Sini</button></div>`;
            });
            container.innerHTML = html;
        } catch(e) {
            container.innerHTML = '<div style="text-align:center; color:var(--danger); padding:20px;">Gagal memuat daftar soal.</div>';
        }
    },

    geserUrutan: async function(id, direction, mapel, kelasKey) {
        let index = this.tempDataKelola.findIndex(s => s.id === id);
        if (index === -1) return;
        let targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= this.tempDataKelola.length) return; 

        let currentSoal = this.tempDataKelola[index];
        let targetSoal = this.tempDataKelola[targetIndex];
        let tempNomor = currentSoal.nomor_soal || (index + 1);
        let targetNomor = targetSoal.nomor_soal || (targetIndex + 1);

        if (tempNomor === targetNomor) {
            tempNomor = targetIndex + 1;
            targetNomor = index + 1;
        }

        try {
            document.getElementById('list-soal').style.opacity = '0.5';
            await Promise.all([
                updateDoc(doc(db, "bank_soal", currentSoal.id), { nomor_soal: targetNomor }),
                updateDoc(doc(db, "bank_soal", targetSoal.id), { nomor_soal: tempNomor })
            ]);
            this.loadDaftarSoal(mapel, kelasKey); 
        } catch (e) {
            window.customAlert("Gagal menggeser soal.", "error");
            this.loadDaftarSoal(mapel, kelasKey); 
        }
    },

    normalizeUrutan: async function(mapel, kelasKey) {
        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
        const snap = await getDocs(q); 
        let soalArr = []; 
        snap.forEach(doc => { 
            let data = doc.data();
            let kArr = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
            let kKey = [...kArr].sort().join(', ');
            if (kKey === kelasKey) { soalArr.push({id: doc.id, ...data}); }
        });
        
        soalArr.sort((a, b) => {
            if (a.nomor_soal === b.nomor_soal) {
                let timeA = a.updatedAt || a.createdAt; timeA = timeA ? (timeA.toMillis ? timeA.toMillis() : new Date(timeA).getTime()) : 0;
                let timeB = b.updatedAt || b.createdAt; timeB = timeB ? (timeB.toMillis ? timeB.toMillis() : new Date(timeB).getTime()) : 0;
                return timeA - timeB; 
            }
            return (a.nomor_soal || 0) - (b.nomor_soal || 0);
        });
        
        let updates = [];
        soalArr.forEach((s, idx) => { 
            let nomorBenar = idx + 1; 
            if (s.nomor_soal !== nomorBenar) { updates.push(updateDoc(doc(db, "bank_soal", s.id), { nomor_soal: nomorBenar })); } 
        });
        if (updates.length > 0) await Promise.all(updates);
    },

    bukaModalTambah: function(mapelParams = "", targetNomor = "", kelasKeyParams = "") {
        document.getElementById('edit-soal-id').value = ''; 
        document.getElementById('form-tambah-soal').reset();
        document.getElementById('soal-media').style.display = 'block'; 
        document.getElementById('soal-media-url').style.display = 'none';
        
        const secMassal = document.getElementById('section-import-massal'); 
        const divManual = document.getElementById('divider-import-manual');
        if (secMassal) secMassal.style.display = 'flex'; 
        if (divManual) divManual.style.display = 'flex';
        
        const mapelSelect = document.getElementById('soal-mapel'); 
        const groupKelas = document.getElementById('group-soal-kelas'); 
        const containerKelas = document.getElementById('soal-kelas-container'); 
        const labelKelas = document.getElementById('soal-kelas-label');
        
        let allowedMapel = listMapel; 
        if (!isAdmin && isGuru) allowedMapel = listMapel.filter(m => userMapel.includes(m));
        
        mapelSelect.innerHTML = '<option value="" disabled selected>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        containerKelas.innerHTML = listKelas.map(k => `<label><input type="checkbox" class="cb-soal-kelas" value="${k}" onchange="SoalManager.handleKelasToggle()"> ${k}</label>`).join('');
        labelKelas.innerText = "-- Pilih Kelas --";

        if (mapelParams) {
            document.getElementById('title-modal-soal').innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Soal (Paket Ini)';
            mapelSelect.value = mapelParams;
            mapelSelect.style.pointerEvents = 'none'; mapelSelect.style.backgroundColor = '#e2e8f0'; 
            
            if (kelasKeyParams) {
                let targetClasses = kelasKeyParams.split(', ');
                containerKelas.innerHTML = listKelas.map(k => {
                    let isChecked = targetClasses.includes(k) ? 'checked' : '';
                    let isLocked = targetClasses.includes(k) ? 'onclick="return false;" style="pointer-events:none; opacity:0.8;"' : 'disabled style="opacity:0.4;"';
                    return `<label><input type="checkbox" class="cb-soal-kelas" value="${k}" ${isChecked} ${isLocked}> ${k}</label>`;
                }).join('');
                labelKelas.innerText = `${targetClasses.length} Kelas Dipilih (Terkunci)`;
            } else {
                groupKelas.style.display = 'none';
            }
        } else {
            document.getElementById('title-modal-soal').innerHTML = '<i class="fas fa-file-import"></i> Input Soal';
            mapelSelect.value = "";
            mapelSelect.style.pointerEvents = 'auto'; mapelSelect.style.backgroundColor = '#fafafa'; 
            groupKelas.style.display = 'block';
        }
        
        document.getElementById('soal-nomor').value = targetNomor; 
        document.getElementById('modal-tambah-soal').style.display = 'flex'; 
        document.getElementById('soal-tipe').dispatchEvent(new Event('change'));
    },

    bukaModalEdit: function(id) {
        const soal = this.tempDataKelola.find(s => s.id === id); 
        if (!soal) return;

        const secMassal = document.getElementById('section-import-massal'); 
        const divManual = document.getElementById('divider-import-manual');
        if (secMassal) secMassal.style.display = 'none'; 
        if (divManual) divManual.style.display = 'none';
        
        const mapelSelect = document.getElementById('soal-mapel'); 
        const groupKelas = document.getElementById('group-soal-kelas');
        
        let allowedMapel = listMapel; 
        if (!isAdmin && isGuru) allowedMapel = listMapel.filter(m => userMapel.includes(m));
        
        mapelSelect.innerHTML = '<option value="" disabled>-- Pilih Mapel --</option>' + allowedMapel.map(m => `<option value="${m}">${m}</option>`).join('');
        document.getElementById('edit-soal-id').value = id; 
        mapelSelect.value = soal.mataPelajaran;
        mapelSelect.style.pointerEvents = 'none'; mapelSelect.style.backgroundColor = '#e2e8f0'; 
        groupKelas.style.display = 'none'; 
        
        document.getElementById('soal-nomor').value = soal.nomor_soal || ''; 
        document.getElementById('soal-bobot').value = soal.bobot || 1; 
        document.getElementById('soal-tipe').value = soal.tipe || 'PG'; 
        document.getElementById('soal-teks').value = soal.teks_soal || '';
        
        if (soal.media_soal) {
            const urlStr = typeof soal.media_soal === 'object' ? soal.media_soal.url : soal.media_soal;
            if (!urlStr.includes('firebasestorage.googleapis.com')) { 
                document.querySelector('input[name="tipe_media_utama"][value="url"]').checked = true; 
                document.getElementById('soal-media').style.display = 'none'; 
                document.getElementById('soal-media-url').style.display = 'block'; 
                document.getElementById('soal-media-url').value = urlStr; 
            } else { 
                document.querySelector('input[name="tipe_media_utama"][value="file"]').checked = true; 
                document.getElementById('soal-media').style.display = 'block'; 
                document.getElementById('soal-media-url').style.display = 'none'; 
                document.getElementById('soal-media-url').value = ''; 
            }
        } else { 
            document.querySelector('input[name="tipe_media_utama"][value="file"]').checked = true; 
            document.getElementById('soal-media').style.display = 'block'; 
            document.getElementById('soal-media-url').style.display = 'none'; 
            document.getElementById('soal-media-url').value = ''; 
        }

        document.getElementById('soal-tipe').dispatchEvent(new Event('change'));

        if (soal.tipe === 'PG' || soal.tipe === 'PGK') {
            ['A', 'B', 'C', 'D', 'E'].forEach(k => { 
                document.getElementById(`soal-opsi-${k}`).value = (soal.opsi && soal.opsi[k]) ? soal.opsi[k] : ''; 
                if (soal.opsi_media && soal.opsi_media[k]) {
                    const mData = soal.opsi_media[k]; const urlStr = typeof mData === 'object' ? mData.url : mData;
                    if (urlStr.includes('firebasestorage.googleapis.com')) { 
                        document.getElementById(`tipe-media-opsi-${k}`).value = 'file'; 
                        document.getElementById(`media-opsi-${k}`).style.display = 'block'; 
                        document.getElementById(`media-url-opsi-${k}`).style.display = 'none'; 
                    } else { 
                        document.getElementById(`tipe-media-opsi-${k}`).value = 'url'; 
                        document.getElementById(`media-opsi-${k}`).style.display = 'none'; 
                        document.getElementById(`media-url-opsi-${k}`).style.display = 'block'; 
                        document.getElementById(`media-url-opsi-${k}`).value = urlStr; 
                    }
                } else { 
                    document.getElementById(`tipe-media-opsi-${k}`).value = 'file'; 
                    document.getElementById(`media-opsi-${k}`).style.display = 'block'; 
                    document.getElementById(`media-url-opsi-${k}`).style.display = 'none'; 
                    document.getElementById(`media-url-opsi-${k}`).value = ''; 
                }
            });
            if (soal.tipe === 'PG') { 
                const radio = document.querySelector(`input[name="kunci-pg"][value="${soal.kunci_jawaban}"]`); 
                if (radio) radio.checked = true; 
            } else { 
                document.querySelectorAll('.kunci-pgk').forEach(cb => { 
                    cb.checked = Array.isArray(soal.kunci_jawaban) && soal.kunci_jawaban.includes(cb.value); 
                }); 
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
            const fieldEssay = document.getElementById('soal-kunci-essay'); 
            if (fieldEssay) fieldEssay.value = soal.kunci_jawaban || ''; 
        }
        
        document.getElementById('title-modal-soal').innerHTML = '<i class="fas fa-edit"></i> Update Soal'; 
        document.getElementById('modal-tambah-soal').style.display = 'flex';
    },

    hapusSingle: async function(id, mapel, kelasKey) {
        if (!(await window.customConfirm("Hapus soal ini dari paket ujian?", "danger"))) return;
        try {
            await deleteDoc(doc(db, "bank_soal", id));
            await this.normalizeUrutan(mapel, kelasKey);
            await window.customAlert("Soal berhasil dihapus.", "success");
            this.loadDaftarSoal(mapel, kelasKey);
            this.loadSummary();
        } catch(e) { window.customAlert("Gagal menghapus soal.", "error"); }
    },

    hapusKeseluruhan: async function(mapel, kelasKey) {
        let confirmMsg = `PENGHAPUSAN PAKET!\n\nApakah Anda YAKIN ingin menghapus SELURUH soal untuk mapel "${mapel}" khusus di kelas sasaran (${kelasKey})?`;
        if (!(await window.customConfirm(confirmMsg, "danger", "Konfirmasi Hapus Paket"))) return;

        try {
            const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
            const snap = await getDocs(q); 
            const updatePromises = [];
            snap.forEach(d => { 
                let data = d.data();
                let kArr = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
                let kKey = [...kArr].sort().join(', ');
                if (kKey === kelasKey) { updatePromises.push(deleteDoc(doc(db, "bank_soal", d.id))); }
            });
            await Promise.all(updatePromises);

            let classesToClean = kelasKey.split(', ');
            const wSnap = await getDoc(doc(db, "pengaturan", "waktu_ujian"));
            if(wSnap.exists()) { let fields = {}; classesToClean.forEach(c => { let k = mapel+"_"+c; if(wSnap.data()[k]) fields[k] = deleteField(); }); if(Object.keys(fields).length > 0) await updateDoc(doc(db, "pengaturan", "waktu_ujian"), fields).catch(()=>{}); }
            
            const jSnap = await getDoc(doc(db, "pengaturan", "jadwal_ujian"));
            if(jSnap.exists()) { let fields = {}; classesToClean.forEach(c => { let k = mapel+"_"+c; if(jSnap.data()[k]) fields[k] = deleteField(); }); if(Object.keys(fields).length > 0) await updateDoc(doc(db, "pengaturan", "jadwal_ujian"), fields).catch(()=>{}); }
            
            const tSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
            if(tSnap.exists()) { let fields = {}; classesToClean.forEach(c => { let k = "token_"+mapel+"_"+c; if(tSnap.data()[k]) fields[k] = deleteField(); }); if(Object.keys(fields).length > 0) await updateDoc(doc(db, "pengaturan", "token_ujian"), fields).catch(()=>{}); }

            await window.customAlert(`Berhasil menghapus seluruh data soal mapel ${mapel} untuk kelas ${kelasKey}.`, "success"); 
            this.loadSummary();
        } catch (e) { window.customAlert("Terjadi kesalahan saat menghapus data.", "error"); }
    }
};
window.SoalManager = SoalManager;

// ==========================================
// 3. FUNGSI UTILITAS GLOBAL & MODAL UI
// ==========================================
window.customAlert = (msg, type = 'info', title = '') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-alert');
        if (!modal) { alert(msg); return resolve(); }
        const icon = document.getElementById('alert-icon'); const titleEl = document.getElementById('alert-title'); const messageEl = document.getElementById('alert-message'); const btnOk = document.getElementById('btn-alert-ok');
        let color = 'var(--info)'; let iconClass = 'fas fa-info-circle'; let defaultTitle = 'Informasi';
        if (type === 'success') { color = 'var(--success)'; iconClass = 'fas fa-check-circle'; defaultTitle = 'Berhasil'; }
        else if (type === 'error') { color = 'var(--danger)'; iconClass = 'fas fa-times-circle'; defaultTitle = 'Gagal / Error'; }
        else if (type === 'warning') { color = 'var(--warning)'; iconClass = 'fas fa-exclamation-triangle'; defaultTitle = 'Peringatan'; }
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        if(icon) { icon.className = `${iconClass} fa-4x`; icon.style.color = color; }
        if(btnOk) btnOk.style.backgroundColor = color;
        if(titleEl) titleEl.innerText = title || defaultTitle;
        if(messageEl) messageEl.innerText = msg;
        modal.style.display = 'flex';
        if(btnOk) btnOk.onclick = () => { modal.style.display = 'none'; resolve(); };
    });
};

window.customConfirm = (msg, type = 'warning', title = 'Konfirmasi', okText = 'Ya, Lanjutkan') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-confirm');
        if (!modal) { return resolve(confirm(msg)); }
        const icon = document.getElementById('confirm-icon'); const titleEl = document.getElementById('confirm-title'); const messageEl = document.getElementById('confirm-message'); const btnOk = document.getElementById('btn-confirm-ok'); const btnCancel = document.getElementById('btn-confirm-cancel');
        let color = 'var(--warning)'; let iconClass = 'fas fa-question-circle';
        if (type === 'danger') { color = 'var(--danger)'; iconClass = 'fas fa-exclamation-triangle'; }
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        if(icon) { icon.className = `${iconClass} fa-4x`; icon.style.color = color; }
        if(btnOk) { btnOk.style.backgroundColor = color; btnOk.innerText = okText; }
        if(titleEl) titleEl.innerText = title;
        if(messageEl) messageEl.innerText = msg;
        modal.style.display = 'flex';
        if(btnOk) btnOk.onclick = () => { modal.style.display = 'none'; resolve(true); };
        if(btnCancel) btnCancel.onclick = () => { modal.style.display = 'none'; resolve(false); };
    });
};

window.uploadMediaToStorage = async (file, folderPath) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop(); const fileName = `${Date.now()}_${Math.random().toString(36).substring(2,8)}.${fileExt}`;
    const storageRef = ref(storage, `${folderPath}/${fileName}`); const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    let type = 'image'; if(file.type.startsWith('audio')) type = 'audio'; else if(file.type.startsWith('video')) type = 'video';
    return { url, type };
};

// ==========================================
// 4. ROUTING MENU UTAMA (SPA)
// ==========================================
function handleRouting() {
    let hash = window.location.hash.substring(1) || 'section-beranda';
    if (hash === 'section-pengaturan' && !isAdmin) hash = 'section-beranda';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

    if (hash === 'section-hasil-detail') {
        if (!currentMapelDetail || !currentKelasDetail) { window.location.hash = 'section-hasil'; return; }
        const secHasil = document.getElementById('section-hasil'); if(secHasil) secHasil.classList.add('active');
        const sView = document.getElementById('hasil-summary-view'); const dView = document.getElementById('hasil-detail-view');
        if(sView) sView.style.display = 'none'; if(dView) dView.style.display = 'block';
        return;
    }

    const target = document.getElementById(hash); if (target) target.classList.add('active');
    
    if (hash === 'section-hasil') { 
        if(typeof window.loadDataHasil === "function") window.loadDataHasil();
        const sView = document.getElementById('hasil-summary-view'); const dView = document.getElementById('hasil-detail-view');
        if(sView) sView.style.display = 'block'; if(dView) dView.style.display = 'none'; 
        currentMapelDetail = ""; currentKelasDetail = "";
    }
}
window.addEventListener('hashchange', handleRouting);
if (!window.location.hash) { window.location.hash = 'section-beranda'; }
window.addEventListener('popstate', function() { if (!window.location.hash || window.location.hash === '') { window.location.hash = 'section-beranda'; }});

// ==========================================
// 5. INISIALISASI HALAMAN (DOM)
// ==========================================
window.handleRoleChange = () => {
    const selectedRoles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(el => el.value);
    document.getElementById('group-edit-guru').style.display = (selectedRoles.includes('guru') || selectedRoles.some(r => r !== 'siswa' && r !== 'admin')) ? 'flex' : 'none';
    document.getElementById('group-edit-kelas-siswa').style.display = selectedRoles.includes('siswa') ? 'block' : 'none';
};

window.toggleDropdownCheck = (id) => {
    const el = document.getElementById(id);
    const isShowing = el.classList.contains('show');
    document.querySelectorAll('.dropdown-check.show').forEach(d => d.classList.remove('show'));
    if (!isShowing) el.classList.add('show');
};

document.addEventListener('DOMContentLoaded', () => {
    const darkModeBtn = document.getElementById('btn-global-dark-mode');
    const iconDarkMode = darkModeBtn?.querySelector('i');
    
    if (document.body.classList.contains('dark-mode') && iconDarkMode) {
        iconDarkMode.classList.replace('fa-moon', 'fa-sun');
    }

    darkModeBtn?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        if (isDark) { iconDarkMode?.classList.replace('fa-moon', 'fa-sun'); } 
        else { iconDarkMode?.classList.replace('fa-sun', 'fa-moon'); }
        
        // Render ulang grafik agar warna teks dan garisnya menyesuaikan tema
        if (typeof window.loadDataHasil === 'function') { window.loadDataHasil(); }
    });

    const filterKelas = document.getElementById('filter-kelas-pengguna');
    if (filterKelas) filterKelas.addEventListener('change', window.renderTablePengguna);

    const filterGuruInputs = ['search-guru-id', 'search-guru-nama', 'search-guru-role', 'search-guru-detail'];
    filterGuruInputs.forEach(id => { document.getElementById(id)?.addEventListener('input', window.renderTablePengguna); });

    const filterSiswaInputs = ['search-siswa-nis', 'search-siswa-nama', 'search-siswa-role', 'search-siswa-kelas'];
    filterSiswaInputs.forEach(id => { document.getElementById(id)?.addEventListener('input', window.renderTablePengguna); });

    document.getElementById('close-modal-edit-akun')?.addEventListener('click', () => { document.getElementById('modal-edit-akun').style.display = 'none'; });
    // --- FITUR SIMPAN STATUS OPEN REGISTRASI ---
    document.getElementById('status-reg-all')?.addEventListener('change', async (e) => {
        const isActive = e.target.checked;
        try {
            // Menyimpan status buka/tutup ke dalam database Firestore
            await setDoc(doc(db, "pengaturan", "status_registrasi"), {
                siswa_aktif: isActive,
                guru_aktif: isActive
            }, { merge: true });
            
            window.customAlert(`Pendaftaran berhasil ${isActive ? 'DIBUKA' : 'DITUTUP'}.`, "success");
        } catch (error) {
            e.target.checked = !isActive; // Kembalikan posisi sakelar jika gagal
            window.customAlert("Gagal mengubah status pendaftaran: " + error.message, "error");
        }
    });

    document.getElementById('btn-add-custom-role')?.addEventListener('click', () => {
        const roleVal = document.getElementById('input-custom-role').value.trim().toLowerCase();
        if (!roleVal) return;
        const container = document.getElementById('edit-role-container');
        if (!container.querySelector(`input[value="${roleVal}"]`)) {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" class="edit-role-cb" value="${roleVal}" checked> <span style="text-transform:capitalize;">${roleVal}</span>`;
            container.appendChild(label);
            label.querySelector('input').addEventListener('change', window.handleRoleChange);
        }
        document.getElementById('input-custom-role').value = ''; window.handleRoleChange();
    });

    document.addEventListener('click', (e) => {
        const header = e.target.closest('.toggle-accordion');
        if (header) {
            const targetId = header.getAttribute('data-target'); const target = document.getElementById(targetId); const icon = header.querySelector('.toggle-icon');
            if (!target) return;
            if (target.style.display === 'none' || target.style.display === '') { target.style.display = 'block'; if (icon) icon.style.transform = 'rotate(180deg)'; header.style.background = '#f8fafc'; } 
            else { target.style.display = 'none'; if (icon) icon.style.transform = 'rotate(0deg)'; header.style.background = '#ffffff'; }
        }
        if (!e.target.closest('.dropdown-check')) { document.querySelectorAll('.dropdown-check.show').forEach(d => d.classList.remove('show')); }
    });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = async () => { 
            if (await window.customConfirm("Yakin ingin keluar dari aplikasi?", "warning", "Konfirmasi Keluar", "Ya, Keluar")) { 
                await signOut(auth); localStorage.clear(); window.location.replace("index.html"); 
            } 
        };
    }

    document.getElementById('btn-open-data-master');
    document.getElementById('btn-open-data-master')?.addEventListener('click', () => { document.getElementById('modal-data-master').style.display = 'flex'; editMasterMode = false; window.renderTableMaster(); });
    document.getElementById('btn-tambah-langsung')?.addEventListener('click', () => { SoalManager.bukaModalTambah(); });
    document.getElementById('close-modal-data-master')?.addEventListener('click', () => { document.getElementById('modal-data-master').style.display = 'none'; });
    
    document.getElementById('btn-edit-master-mode')?.addEventListener('click', () => { 
        editMasterMode = !editMasterMode;
        const btn = document.getElementById('btn-edit-master-mode');
        if (editMasterMode) { btn.innerHTML = '<i class="fas fa-check"></i> Selesai Edit'; btn.classList.remove('btn-secondary'); btn.style.backgroundColor = 'var(--success)'; } 
        else { btn.innerHTML = '<i class="fas fa-edit"></i> Mode Hapus Data'; btn.classList.add('btn-secondary'); btn.style.backgroundColor = ''; }
        window.renderTableMaster();
    });

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
        document.getElementById('input-master-name').value = ''; window.loadDataMaster(); await window.customAlert("Data berhasil ditambahkan!", "success");
    });
    
    document.getElementById('soal-tipe')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const pgOpts = document.getElementById('pg-options'); const menjodohkanOpts = document.getElementById('menjodohkan-options'); const essayOpts = document.getElementById('essay-options'); 
        const kunciPg = document.querySelectorAll('.kunci-pg-container'); const kunciPgk = document.querySelectorAll('.kunci-pgk-container');
        
        if (val !== 'Menjodohkan') { document.getElementById('pasangan-container').innerHTML = ''; }
        
        if (val === 'PG' || val === 'PGK') {
            if(pgOpts) pgOpts.style.display = 'block'; if(menjodohkanOpts) menjodohkanOpts.style.display = 'none'; if(essayOpts) essayOpts.style.display = 'none';
            kunciPg.forEach(c => c.style.display = (val === 'PG') ? 'inline-block' : 'none'); kunciPgk.forEach(c => c.style.display = (val === 'PGK') ? 'inline-block' : 'none');
        } else if (val === 'Menjodohkan') {
            if(pgOpts) pgOpts.style.display = 'none'; if(menjodohkanOpts) menjodohkanOpts.style.display = 'block'; if(essayOpts) essayOpts.style.display = 'none';
        } else { 
            if(pgOpts) pgOpts.style.display = 'none'; if(menjodohkanOpts) menjodohkanOpts.style.display = 'none'; if(essayOpts) essayOpts.style.display = 'block';
        }
    });

    document.getElementById('btn-tambah-pasangan')?.addEventListener('click', () => {
        const container = document.getElementById('pasangan-container'); const row = document.createElement('div');
        row.className = 'pasangan-item'; row.style.cssText = 'display:flex; gap:10px; margin-bottom:10px;';
        row.innerHTML = `<input type="text" class="input-text m-kiri" placeholder="Pernyataan Kiri" required><input type="text" class="input-text m-kanan" placeholder="Pasangan Kanan" required><button type="button" class="btn-hapus-pasangan" style="background:var(--danger); color:white; border:none; padding:0 15px; border-radius:8px; cursor:pointer;"><i class="fas fa-trash"></i></button>`;
        container.appendChild(row);
    });
    document.getElementById('pasangan-container')?.addEventListener('click', (e) => { if(e.target.closest('.btn-hapus-pasangan')) { e.target.closest('.pasangan-item').remove(); } });

    document.getElementById('btn-back-mapel-list')?.addEventListener('click', () => {
        document.getElementById('view-summary-bank-soal').style.display = 'block'; document.getElementById('view-soal-list').style.display = 'none'; SoalManager.loadSummary();
    });

    document.getElementById('btn-simpan-bobot-massal')?.addEventListener('click', () => {
        SoalManager.terapkanBobotMassal();
    });

    handleRouting();
});

// ==========================================
// 6. FIREBASE AUTHENTICATION LISTENER
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.replace("index.html"); return; }
    try {
        const roles = JSON.parse(localStorage.getItem("userRole") || "[]");
        isAdmin = roles.includes("admin");
        isGuru = roles.includes("guru");
        userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]");
        userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]");
        if (!isAdmin && !isGuru) { window.location.replace("attempt.html"); return; }
    } catch(e) { window.location.replace("index.html"); return; }

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
        const wrapRegAll = document.getElementById('wrap-reg-all'); if (wrapRegAll) wrapRegAll.style.display = 'none';
        const btnHapusAll = document.getElementById('btn-hapus-semua-hasil'); if (btnHapusAll) btnHapusAll.style.display = 'none';
    } else {
        window.fetchStatusReg();
    }

    handleRouting(); 
    await window.loadDataMaster(); 
    window.loadDataHasil(); 
    window.loadDataPengguna(); 
    SoalManager.loadSummary(); 
});

// ==========================================
// 7. FUNGSI DATA MASTER
// ==========================================
window.fetchStatusReg = async () => {
    try {
        const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
        if (regSnap.exists()) {
            const sAll = document.getElementById('status-reg-all'); 
            if (sAll) sAll.checked = regSnap.data().siswa_aktif !== false;
        }
    } catch (e) {}
};

window.loadDataMaster = async () => {
    try {
        const docRef = doc(db, "pengaturan", "data_akademik");
        const docSnap = await getDoc(docRef);
        let currentMapel = []; let currentKelas = [];
        
        // Tarik data master yang sudah tersimpan sebelumnya
        if (docSnap.exists()) {
            currentMapel = docSnap.data().list_mapel || [];
            currentKelas = docSnap.data().list_kelas || [];
        }

        let masterBerubah = false;

        // 1. Ekstrak dari koleksi "users" (Akun Guru & Siswa)
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.forEach((uDoc) => {
            const uData = uDoc.data();
            if (uData.mapel) {
                const mapelArr = Array.isArray(uData.mapel) ? uData.mapel : [uData.mapel];
                mapelArr.forEach(m => {
                    const mTrim = String(m).trim();
                    if (mTrim && !currentMapel.includes(mTrim)) { currentMapel.push(mTrim); masterBerubah = true; }
                });
            }
            if (uData.kelas) {
                const kelasArr = Array.isArray(uData.kelas) ? uData.kelas : [uData.kelas];
                kelasArr.forEach(k => {
                    const kTrim = String(k).trim();
                    if (kTrim && !currentKelas.includes(kTrim)) { currentKelas.push(kTrim); masterBerubah = true; }
                });
            }
        });

        // 2. Ekstrak dari koleksi "bank_soal"
        const soalSnap = await getDocs(collection(db, "bank_soal"));
        soalSnap.forEach((sDoc) => {
            const sData = sDoc.data();
            if (sData.mataPelajaran) {
                const mTrim = String(sData.mataPelajaran).trim();
                if (mTrim && !currentMapel.includes(mTrim)) { currentMapel.push(mTrim); masterBerubah = true; }
            }
            if (sData.kelas) {
                const kelasArr = Array.isArray(sData.kelas) ? sData.kelas : [sData.kelas];
                kelasArr.forEach(k => {
                    const kTrim = String(k).trim();
                    if (kTrim && !currentKelas.includes(kTrim)) { currentKelas.push(kTrim); masterBerubah = true; }
                });
            }
        });

        // 3. Ekstrak dari koleksi "hasil_ujian"
        const hasilSnap = await getDocs(collection(db, "hasil_ujian"));
        hasilSnap.forEach((hDoc) => {
            const hData = hDoc.data();
            if (hData.mataPelajaran) {
                const mTrim = String(hData.mataPelajaran).trim();
                if (mTrim && !currentMapel.includes(mTrim)) { currentMapel.push(mTrim); masterBerubah = true; }
            }
            if (hData.kelas) {
                const kelasArr = Array.isArray(hData.kelas) ? hData.kelas : [hData.kelas];
                kelasArr.forEach(k => {
                    const kTrim = String(k).trim();
                    if (kTrim && !currentKelas.includes(kTrim)) { currentKelas.push(kTrim); masterBerubah = true; }
                });
            }
        });

        // Urutkan sesuai Abjad / Alfanumerik (Natural Sort untuk kelas seperti X-1, X-2, XI-1)
        currentMapel.sort();
        currentKelas.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        // Jika ada data baru yang ditemukan dari proses ekstrak di atas, simpan pembaruannya ke database
        if (masterBerubah) {
            await setDoc(docRef, { list_mapel: currentMapel, list_kelas: currentKelas }, { merge: true });
        }
        
        listMapel = currentMapel; 
        listKelas = currentKelas;
        window.renderTableMaster(); 
        window.populateSemuaDropdown();
    } catch (e) {
        console.error("Gagal memuat Data Master:", e);
    }
};

window.renderTableMaster = () => {
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
};

window.hapusMasterItem = async (type, val) => {
    if (!(await window.customConfirm(`Hapus ${type === 'mapel' ? 'Mapel' : 'Kelas'} "${val}"?`, "danger"))) return;
    try {
        if (type === 'mapel') { listMapel = listMapel.filter(item => item !== val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_mapel: listMapel }, { merge: true }); } 
        else { listKelas = listKelas.filter(item => item !== val); await setDoc(doc(db, "pengaturan", "data_akademik"), { list_kelas: listKelas }, { merge: true }); }
        window.loadDataMaster();
    } catch (e) { window.customAlert("Gagal menghapus data.", "error"); }
};

window.populateSemuaDropdown = () => {
    const cmbKelasSiswa = document.getElementById('edit-kelas-siswa');
    if (cmbKelasSiswa) cmbKelasSiswa.innerHTML = listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
    const containerMapel = document.getElementById('edit-mapel-container');
    if (containerMapel) containerMapel.innerHTML = listMapel.map(m => `<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="edit-mapel-cb" value="${m}"> ${m}</label>`).join('');
    const containerKelasGuru = document.getElementById('edit-kelas-guru-container');
    if (containerKelasGuru) containerKelasGuru.innerHTML = listKelas.map(k => `<label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" class="edit-kelas-guru-cb" value="${k}"> ${k}</label>`).join('');
    const filterKelasPengguna = document.getElementById('filter-kelas-pengguna');
    if (filterKelasPengguna) filterKelasPengguna.innerHTML = '<option value="all">Semua Kelas</option>' + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
};

// ==========================================
// 8. FUNGSI PENGGUNA (GURU & SISWA)
// ==========================================
window.loadDataPengguna = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsersData = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data(); data.uid = doc.id; allUsersData.push(data);
        });
        allUsersData.sort((a, b) => {
            const roleA = Array.isArray(a.role) ? a.role : [a.role];
            const roleB = Array.isArray(b.role) ? b.role : [b.role];
            
            // Deteksi role khusus
            const isGuruA = roleA.includes("guru") || roleA.some(r => r !== 'siswa' && r !== 'admin');
            const isGuruB = roleB.includes("guru") || roleB.some(r => r !== 'siswa' && r !== 'admin');
            const isSiswaA = roleA.includes("siswa");
            const isSiswaB = roleB.includes("siswa");

            // 1. PISAHKAN KELOMPOK UTAMA: Guru berada di atas, diikuti Siswa, lalu Admin
            if (isGuruA && !isGuruB) return -1;
            if (!isGuruA && isGuruB) return 1;
            if (isSiswaA && !isSiswaB && !isGuruB) return -1;
            if (!isSiswaA && isSiswaB && !isGuruA) return 1;

            // 2. LOGIKA KHUSUS AKUN GURU (Urut ID, T/H)
            if (isGuruA && isGuruB) {
                const idA = (a.username || "").toUpperCase();
                const idB = (b.username || "").toUpperCase();

                // Mutlak ID tertentu paling atas
                if (idA === "E98T6-069" && idB !== "E98T6-069") return -1;
                if (idB === "E98T6-069" && idA !== "E98T6-069") return 1;

                // Karakter ke-4 (T 'Tetap' sebelum H 'Honorer')
                const charA = idA.length >= 4 ? idA.charAt(3) : "";
                const charB = idB.length >= 4 ? idB.charAt(3) : "";
                
                if (charA === 'T' && charB === 'H') return -1;
                if (charA === 'H' && charB === 'T') return 1;

                // Urutan Alfanumerik ID Guru
                return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
            } 
            
            // 3. LOGIKA KHUSUS AKUN SISWA (Urut Kelas -> Urut Nama)
            if (isSiswaA && isSiswaB) {
                const kelasA = Array.isArray(a.kelas) ? a.kelas.join(", ") : (a.kelas || "");
                const kelasB = Array.isArray(b.kelas) ? b.kelas.join(", ") : (b.kelas || "");

                // Urutkan berdasarkan nama Kelas secara alami (X-1, X-2, XI-1, XII-1)
                const urutanKelas = kelasA.localeCompare(kelasB, undefined, { numeric: true, sensitivity: 'base' });
                if (urutanKelas !== 0) return urutanKelas;

                // Jika Kelasnya sama, urutkan berdasarkan Nama Lengkap (A-Z)
                const namaA = (a.nama || "").toLowerCase();
                const namaB = (b.nama || "").toLowerCase();
                if (namaA < namaB) return -1;
                if (namaA > namaB) return 1;
                return (a.username || "").toLowerCase().localeCompare((b.username || "").toLowerCase());
            }

            // 4. Pengurutan default untuk selain Guru & Siswa (misal Admin murni)
            const namaA = (a.nama || "").toLowerCase();
            const namaB = (b.nama || "").toLowerCase();
            if (namaA < namaB) return -1;
            if (namaA > namaB) return 1;
            return (a.username || "").toLowerCase().localeCompare((b.username || "").toLowerCase());
        });
        const elStatSiswa = document.getElementById("stat-siswa"); if (elStatSiswa) elStatSiswa.innerText = allUsersData.length;
        window.renderTablePengguna();
    } catch (error) { 
        const elStatSiswa = document.getElementById("stat-siswa"); if (elStatSiswa) elStatSiswa.innerText = "0";
    }
};

window.renderTablePengguna = () => {
    const tbodyGuru = document.querySelector("#table-guru tbody"); 
    const tbodySiswa = document.querySelector("#table-siswa tbody");
    const tbodyGmail = document.querySelector("#table-gmail tbody");
    if (!tbodyGuru || !tbodySiswa || !tbodyGmail) return;

    const filterGId = (document.getElementById('search-guru-id')?.value || '').toLowerCase();
    const filterGNama = (document.getElementById('search-guru-nama')?.value || '').toLowerCase();
    const filterGRole = (document.getElementById('search-guru-role')?.value || '').toLowerCase();
    const filterGDetail = (document.getElementById('search-guru-detail')?.value || '').toLowerCase();

    const filterGEmail = (document.getElementById('search-gmail-email')?.value || '').toLowerCase();
    const filterGNamaGmail = (document.getElementById('search-gmail-nama')?.value || '').toLowerCase();
    const filterGRoleGmail = (document.getElementById('search-gmail-role')?.value || '').toLowerCase();

    const filterKelasEl = document.getElementById("filter-kelas-pengguna");
    const filterKelas = filterKelasEl ? filterKelasEl.value : "all";
    const filterSNis = (document.getElementById('search-siswa-nis')?.value || '').toLowerCase();
    const filterSNama = (document.getElementById('search-siswa-nama')?.value || '').toLowerCase();
    const filterSRole = (document.getElementById('search-siswa-role')?.value || '').toLowerCase();
    const filterSKelas = (document.getElementById('search-siswa-kelas')?.value || '').toLowerCase();
    
    let htmlGuru = ''; let htmlSiswa = ''; let htmlGmail = ''; 
    let countGuru = 0; let countSiswa = 0; let countGmail = 0;

    allUsersData.forEach((user) => {
        const roles = Array.isArray(user.role) ? user.role : [user.role];
        const roleDisplay = roles.join(", ");
        const kelas = Array.isArray(user.kelas) ? user.kelas.join(", ") : (user.kelas || "-");
        const mapel = Array.isArray(user.mapel) ? user.mapel.join(", ") : (user.mapel || "-");

        const actionButtons = isAdmin ? `
            <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                <button onclick="window.bukaModalEditAkun('${user.uid}')" class="btn-3d" style="background-color: var(--info); padding: 6px 12px; font-size: 0.85rem; margin: 0; min-width: auto;" title="Edit Pengguna"><i class="fas fa-edit"></i></button>
                <button onclick="window.hapusPengguna('${user.uid}')" class="btn-exit-modern" style="padding: 6px 12px; font-size: 0.85rem; margin: 0; min-width: auto;" title="Hapus Pengguna"><i class="fas fa-trash"></i></button>
            </div>
        ` : '-';

        const isGmail = user.username && String(user.username).toLowerCase().includes('@');

        if (isGmail) {
            if ((user.username || "").toLowerCase().includes(filterGEmail) && (user.nama || "").toLowerCase().includes(filterGNamaGmail) && roleDisplay.toLowerCase().includes(filterGRoleGmail)) {
                countGmail++;
                htmlGmail += `<tr><td><strong>${user.username || "-"}</strong></td><td>${user.nama || "-"}</td><td><span style="text-transform: capitalize; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${roleDisplay}</span></td><td><small><b>Mapel:</b> ${mapel}<br><b>Kelas:</b> ${kelas}</small></td>${isAdmin ? `<td style="text-align:center;">${actionButtons}</td>` : ''}</tr>`;
            }
        } else if (roles.some(r => r !== 'siswa')) { 
            if ((user.username || "").toLowerCase().includes(filterGId) && (user.nama || "").toLowerCase().includes(filterGNama) && roleDisplay.toLowerCase().includes(filterGRole) && `${mapel} ${kelas}`.toLowerCase().includes(filterGDetail)) {
                countGuru++;
                htmlGuru += `<tr><td><strong>${user.username || "-"}</strong></td><td>${user.nama || "-"}</td><td><span style="text-transform: capitalize; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${roleDisplay}</span></td><td><small><b>Mapel:</b> ${mapel}<br><b>Kelas:</b> ${kelas}</small></td>${isAdmin ? `<td style="text-align:center;">${actionButtons}</td>` : ''}</tr>`;
            }
        } else if (roles.includes("siswa")) {
            const kelasArr = Array.isArray(user.kelas) ? user.kelas : [user.kelas];
            if ((filterKelas === "all" || filterKelas === "" || kelasArr.includes(filterKelas)) && (user.username || "").toLowerCase().includes(filterSNis) && (user.nama || "").toLowerCase().includes(filterSNama) && roleDisplay.toLowerCase().includes(filterSRole) && kelas.toLowerCase().includes(filterSKelas)) {
                countSiswa++;
                htmlSiswa += `<tr><td><strong>${user.username || "-"}</strong></td><td>${user.nama || "-"}</td><td><span style="text-transform: capitalize; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${roleDisplay}</span></td><td>${kelas}</td>${isAdmin ? `<td style="text-align:center;">${actionButtons}</td>` : ''}</tr>`;
            }
        }
    });

    if (countGuru === 0) htmlGuru = `<tr><td colspan="${isAdmin ? 5 : 4}" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada data staf yang cocok.</td></tr>`;
    if (countSiswa === 0) htmlSiswa = `<tr><td colspan="${isAdmin ? 5 : 4}" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada data siswa yang cocok.</td></tr>`;
    if (countGmail === 0) htmlGmail = `<tr><td colspan="${isAdmin ? 5 : 4}" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada data akun Google yang cocok.</td></tr>`;

    tbodyGuru.innerHTML = htmlGuru; tbodySiswa.innerHTML = htmlSiswa; tbodyGmail.innerHTML = htmlGmail;
};

window.hapusPengguna = async (uid) => {
    if(await window.customConfirm("Apakah Anda yakin ingin menghapus akun pengguna ini secara permanen?", "danger", "Hapus Pengguna", "Ya, Hapus!")) {
        try { await deleteDoc(doc(db, "users", uid)); window.loadDataPengguna(); window.customAlert("Data akun berhasil dihapus dari database!", "success"); } 
        catch (error) { window.customAlert(`Gagal menghapus pengguna. Error: ${error.message}`, "error", "Gagal"); }
    }
};

window.bukaModalEditAkun = async (uid) => {
    try {
        const userDoc = await getDoc(doc(db, "users", uid)); if(!userDoc.exists()) return;
        const data = userDoc.data();
        
        document.getElementById('edit-uid').value = uid; document.getElementById('edit-nama').value = data.nama || '';
        document.getElementById('edit-username').value = data.username || ''; document.getElementById('edit-pass').value = ''; 
        
        const roles = Array.isArray(data.role) ? data.role : [data.role];
        document.getElementById('admin-custom-role-group').style.display = isAdmin ? 'flex' : 'none';
        
        const container = document.getElementById('edit-role-container');
        container.innerHTML = `
            <label><input type="checkbox" class="edit-role-cb" value="siswa"> Siswa</label>
            <label><input type="checkbox" class="edit-role-cb" value="guru"> Guru</label>
            <label><input type="checkbox" class="edit-role-cb" value="admin"> Admin</label>
        `;
        const standardRoles = ['siswa', 'guru', 'admin'];
        roles.forEach(r => {
            if (!standardRoles.includes(r)) {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" class="edit-role-cb" value="${r}" checked> <span style="text-transform:capitalize;">${r}</span>`;
                container.appendChild(label);
            }
        });

        document.querySelectorAll('.edit-role-cb').forEach(cb => { 
            cb.checked = roles.includes(cb.value); 
            cb.addEventListener('change', window.handleRoleChange);
        });

        if (roles.includes('siswa')) {
            document.getElementById('edit-kelas-siswa').value = Array.isArray(data.kelas) ? data.kelas[0] : (data.kelas || '');
        }

        if (roles.some(r => r !== 'siswa')) {
            const mapelArr = Array.isArray(data.mapel) ? data.mapel : [];
            document.querySelectorAll('.edit-mapel-cb').forEach(cb => { cb.checked = mapelArr.includes(cb.value); });
            const kelasArr = Array.isArray(data.kelas) ? data.kelas : [];
            document.querySelectorAll('.edit-kelas-guru-cb').forEach(cb => { cb.checked = kelasArr.includes(cb.value); });
        }
        
        window.handleRoleChange(); document.getElementById('modal-edit-akun').style.display = 'flex';
    } catch(e) {}
};

document.getElementById('btn-save-edit-akun')?.addEventListener('click', async () => {
    const uid = document.getElementById('edit-uid').value;
    if(!uid) return;

    const btn = document.getElementById('btn-save-edit-akun');
    const origText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const newNama = document.getElementById('edit-nama').value.trim();
        const newUsername = document.getElementById('edit-username').value.trim().toUpperCase();
        const newPass = document.getElementById('edit-pass').value;
        const roles = Array.from(document.querySelectorAll('.edit-role-cb:checked')).map(el => el.value);

        if(!newNama || !newUsername || roles.length === 0) { throw new Error("Nama, Username, and minimal 1 Role harus diisi!"); }

        let payload = { nama: newNama, username: newUsername, role: roles };

        if (roles.includes('siswa')) {
            payload.kelas = [document.getElementById('edit-kelas-siswa').value];
        } else {
            payload.mapel = Array.from(document.querySelectorAll('.edit-mapel-cb:checked')).map(el => el.value);
            payload.kelas = Array.from(document.querySelectorAll('.edit-kelas-guru-cb:checked')).map(el => el.value);
        }

        await updateDoc(doc(db, "users", uid), payload);

        if(newPass) {
            window.customAlert("Data profil diperbarui!\n\nCatatan: Update password tidak dapat diterapkan otomatis dari halaman ini. Gunakan konsol Admin Firebase untuk reset password.", "warning", "Info Pembaruan");
        } else {
            window.customAlert("Data akun berhasil diperbarui!", "success");
        }

        document.getElementById('modal-edit-akun').style.display = 'none';
        window.loadDataPengguna();
    } catch (error) {
        window.customAlert("Gagal menyimpan: " + error.message, "error");
    } finally {
        btn.innerHTML = origText; btn.disabled = false;
    }
});

window.downloadDaftarPengguna = () => {
    const data = allUsersData.map(u => ({ "Nama": u.nama, "Username": u.username, "Role": Array.isArray(u.role) ? u.role.join(', ') : u.role, "Kelas": Array.isArray(u.kelas) ? u.kelas.join(', ') : (u.kelas || "-") }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Daftar Pengguna"); XLSX.writeFile(wb, "Daftar_Pengguna_SMAICH.xlsx");
};

// ==========================================
// 9. EVENT SUBMIT FORM SOAL MANUAL
// ==========================================
document.getElementById('form-tambah-soal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mapel = document.getElementById('soal-mapel').value; 
    const selectedKelasCbs = Array.from(document.querySelectorAll('.cb-soal-kelas:checked')).map(cb => cb.value);
    const tipe = document.getElementById('soal-tipe').value; 
    const teks = document.getElementById('soal-teks').value;
    const nomorSoalTarget = parseInt(document.getElementById('soal-nomor').value) || 1;
    const bobotSoal = parseFloat(document.getElementById('soal-bobot').value) || 1;
    const editId = document.getElementById('edit-soal-id').value;

    if(!mapel) return window.customAlert("Silakan pilih Mata Pelajaran terlebih dahulu!", "warning");
    if(!editId && document.getElementById('group-soal-kelas').style.display !== 'none' && selectedKelasCbs.length === 0) {
        return window.customAlert("Silakan pilih minimal satu kelas pada form Kelas Sasaran!", "warning");
    }

    const btnSubmitSoal = e.target.querySelector('button[type="submit"]'); 
    const originalText = btnSubmitSoal.innerHTML;
    btnSubmitSoal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan ke Server...'; btnSubmitSoal.disabled = true;

    try {
        let mediaSoal = null;
        const tipeMediaUtama = document.querySelector('input[name="tipe_media_utama"]:checked')?.value || 'file';
        
        if (tipeMediaUtama === 'file') {
            const fileSoal = document.getElementById('soal-media').files[0];
            if (fileSoal) { mediaSoal = await window.uploadMediaToStorage(fileSoal, `bank_soal/${mapel}`); }
        } else if (tipeMediaUtama === 'url') {
            const urlVal = document.getElementById('soal-media-url').value.trim();
            if (urlVal) {
                let mType = 'image'; const lowerUrl = urlVal.toLowerCase();
                if (lowerUrl.match(/\.(mp4|webm|ogg|mov)$/) || lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) mType = 'video';
                else if (lowerUrl.match(/\.(mp3|wav|ogg)$/)) mType = 'audio';
                mediaSoal = { url: urlVal, type: mType };
            }
        }
        
        let kelasArrayToSave = selectedKelasCbs;
        if (editId) {
            const docSnap = await getDoc(doc(db, "bank_soal", editId));
            if(docSnap.exists()) {
                let data = docSnap.data();
                kelasArrayToSave = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
            }
        }

        let kelasKeyToSave = [...kelasArrayToSave].sort().join(', ');
        let payload = { mataPelajaran: mapel, kelas: kelasArrayToSave, nomor_soal: nomorSoalTarget, bobot: bobotSoal, tipe: tipe, teks_soal: teks, updatedAt: new Date() };
        if (mediaSoal) payload.media_soal = mediaSoal;

        if (tipe === 'PG' || tipe === 'PGK') {
            let opsiKeys = ['A', 'B', 'C', 'D', 'E']; let opsi = {}; let opsi_media = {};
            for (let k of opsiKeys) {
                opsi[k] = document.getElementById(`soal-opsi-${k}`).value;
                let tipeMediaOpsi = document.getElementById(`tipe-media-opsi-${k}`).value;
                if (tipeMediaOpsi === 'file') {
                    let fileOpsi = document.getElementById(`media-opsi-${k}`).files[0];
                    if (fileOpsi) { opsi_media[k] = await window.uploadMediaToStorage(fileOpsi, `bank_soal/${mapel}/opsi`); }
                } else {
                    let urlOpsi = document.getElementById(`media-url-opsi-${k}`).value.trim();
                    if (urlOpsi) {
                        let mTypeOpsi = 'image'; const lowerUrlOpsi = urlOpsi.toLowerCase();
                        if (lowerUrlOpsi.match(/\.(mp4|webm|ogg|mov)$/) || lowerUrlOpsi.includes('youtube') || lowerUrlOpsi.includes('youtu.be')) mTypeOpsi = 'video';
                        else if (lowerUrlOpsi.match(/\.(mp3|wav|ogg)$/)) mTypeOpsi = 'audio';
                        opsi_media[k] = { url: urlOpsi, type: mTypeOpsi };
                    }
                }
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
            if (pasangan.length === 0) throw new Error("Masukkan minimal satu pasangan untuk soal tipe Menjodohkan!");
            payload.pasangan = pasangan;
        } else if (tipe === 'Essay') {
            const kunciEssay = document.getElementById('soal-kunci-essay').value.trim();
            if (kunciEssay) { payload.kunci_jawaban = kunciEssay; }
        }

        if (editId) { 
            await updateDoc(doc(db, "bank_soal", editId), payload); 
        } else { 
            payload.createdAt = new Date(); 
            await addDoc(collection(db, "bank_soal"), payload); 
        }

        await SoalManager.normalizeUrutan(mapel, kelasKeyToSave);
        document.getElementById('form-tambah-soal').reset();
        document.getElementById('edit-soal-id').value = '';
        document.getElementById('modal-tambah-soal').style.display = 'none';

        if(document.getElementById('view-soal-list').style.display === 'block') { 
            await SoalManager.loadDaftarSoal(mapel, kelasKeyToSave); 
            if (editId) {
                setTimeout(() => {
                    const el = document.getElementById(`soal-item-${editId}`);
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                }, 400);
            }
        }
        SoalManager.loadSummary();
        window.customAlert("Soal berhasil disimpan!", "success");
    } catch(err) { window.customAlert(err.message || "Gagal menyimpan soal.", "error"); } 
    finally { btnSubmitSoal.innerHTML = originalText; btnSubmitSoal.disabled = false; }
});

// ==========================================
// 10. UPLOAD MASSAL & IMPORT
// ==========================================
window.downloadTemplate = (type) => {
    if(type === 'excel') {
        const data = [
            {"Tipe Soal (PG / PGK / Menjodohkan / Essay)": "PG", "Nomor Soal": 1, "Bobot Soal": 1, "Teks Pertanyaan": "Siapa presiden pertama Republik Indonesia?", "Link Media Pertanyaan (URL Gambar/Audio/Video)": "", "Opsi A": "Soeharto", "Link Media Opsi A (URL Gambar)": "", "Opsi B": "B.J. Habibie", "Opsi C": "Soekarno", "Opsi D": "Joko Widodo", "Opsi E": "Susilo Bambang Yudhoyono", "Kunci Jawaban / Pasangan Menjodohkan": "C"},
            {"Tipe Soal (PG / PGK / Menjodohkan / Essay)": "PGK", "Nomor Soal": 2, "Bobot Soal": 2, "Teks Pertanyaan": "Manakah dari perangkat berikut yang merupakan perangkat keras (hardware) komputer? (Pilih lebih dari satu)", "Opsi A": "Monitor", "Opsi B": "Sistem Operasi Windows", "Opsi C": "Keyboard", "Opsi D": "Microsoft Word", "Opsi E": "Mouse", "Kunci Jawaban / Pasangan Menjodohkan": "A,C,E"},
            {"Tipe Soal (PG / PGK / Menjodohkan / Essay)": "Menjodohkan", "Nomor Soal": 3, "Bobot Soal": 3, "Teks Pertanyaan": "Pasangkan ibu kota berikut dengan negaranya yang tepat!", "Opsi A": "", "Opsi B": "", "Opsi C": "", "Opsi D": "", "Opsi E": "", "Kunci Jawaban / Pasangan Menjodohkan": "Jakarta=Indonesia; Tokyo=Jepang; Paris=Prancis; London=Inggris"},
            {"Tipe Soal (PG / PGK / Menjodohkan / Essay)": "Essay", "Nomor Soal": 4, "Bobot Soal": 5, "Teks Pertanyaan": "Jelaskan secara singkat proses terjadinya fotosintesis pada tumbuhan!", "Opsi A": "", "Opsi B": "", "Opsi C": "", "Opsi D": "", "Opsi E": "", "Kunci Jawaban / Pasangan Menjodohkan": "Tumbuhan mengubah sinar matahari, air, dan karbon dioksida menjadi glukosa dan oksigen."}
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        
        // Memperlebar kolom agar template mudah dibaca
        const cols = [{wch: 38}, {wch: 12}, {wch: 12}, {wch: 45}, {wch: 40}, {wch: 25}, {wch: 30}, {wch: 25}, {wch: 25}, {wch: 25}, {wch: 25}, {wch: 45}];
        ws['!cols'] = cols;

        XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
        XLSX.writeFile(wb, "Template_Soal_CBT.xlsx");
    } else if (type === 'word') {
        const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Template Soal CBT</title></head><body>
        <h2>FORMAT PENULISAN SOAL CBT (DIBACA OLEH SISTEM)</h2>
        <p><b>PENTING:</b> Jangan mengubah teks judul bagian seperti "A. Pilihan Ganda", "B. Pilihan Ganda Kompleks", dll. Sistem membaca judul tersebut untuk menentukan tipe soal. Gunakan format "Kunci Jawaban: " untuk mendefinisikan kunci.</p>
        <br>
        <h2>A. Pilihan Ganda</h2>
        <p>1. Siapa presiden pertama Republik Indonesia?</p>
        <p>A. Soeharto</p><p>B. B.J. Habibie</p><p>C. Soekarno</p><p>D. Joko Widodo</p><p>E. Susilo Bambang Yudhoyono</p>
        <p>Kunci Jawaban: C</p>
        <br>
        <h2>B. Pilihan Ganda Kompleks</h2>
        <p>1. Manakah dari perangkat berikut yang merupakan perangkat keras komputer?</p>
        <p>A. Monitor</p><p>B. Sistem Operasi Windows</p><p>C. Keyboard</p><p>D. Microsoft Word</p><p>E. Mouse</p>
        <p>Kunci Jawaban: A, C, E</p>
        <br>
        <h2>C. Menjodohkan</h2>
        <p>1. Pasangkan ibu kota berikut dengan negaranya yang tepat!</p>
        <p>Kunci Jawaban: Jakarta=Indonesia; Tokyo=Jepang; Paris=Prancis</p>
        <br>
        <h2>D. Essay</h2>
        <p>1. Jelaskan secara singkat proses terjadinya fotosintesis pada tumbuhan!</p>
        <p>Kunci Jawaban: Tumbuhan mengubah sinar matahari, air, dan karbon dioksida menjadi glukosa dan oksigen.</p>
        </body></html>`;
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'Template_Soal_CBT.doc';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
};

window.parseDocTextToJSON = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0); const jsonData = [];
    let currentTipe = 'PG'; let currentSoal = null; let nomorCounter = { 'PG': 1, 'PGK': 1, 'Menjodohkan': 1, 'Essay': 1 };
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Pengecekan Kategori / Tipe Soal
        if (line.match(/^[A-Z]\.\s*(Pilihan Ganda Kompleks|PGK)/i)) { currentTipe = 'PGK'; continue; }
        if (line.match(/^[A-Z]\.\s*(Pilihan Ganda|PG)/i)) { currentTipe = 'PG'; continue; }
        if (line.match(/^[A-Z]\.\s*(Esai|Essay|Uraian)/i)) { currentTipe = 'Essay'; continue; }
        if (line.match(/^[A-Z]\.\s*(Menjodohkan|Jodohkan)/i)) { currentTipe = 'Menjodohkan'; continue; }
        
        // Mendeteksi Nomor Soal
        const questionMatch = line.match(/^(\d+)\.\s*(.*)/);
        if (questionMatch) {
            if (currentSoal) jsonData.push(currentSoal);
            currentSoal = { 
                "Tipe Soal (PG / PGK / Menjodohkan / Essay)": currentTipe, 
                "Nomor Soal": nomorCounter[currentTipe]++, 
                "Bobot Soal": (currentTipe === 'Essay') ? 5 : ((currentTipe === 'Menjodohkan') ? 4 : ((currentTipe === 'PGK') ? 2 : 1)), 
                "Teks Pertanyaan": questionMatch[2], 
                "Kunci Jawaban / Pasangan Menjodohkan": "" 
            };
            continue;
        }
        
        // Mendeteksi Opsi Jawaban (A-E)
        const optionMatch = line.match(/^-?\s*([A-Ea-e])\.\s*(.*)/);
        if (optionMatch && currentSoal && (currentSoal["Tipe Soal (PG / PGK / Menjodohkan / Essay)"] === 'PG' || currentSoal["Tipe Soal (PG / PGK / Menjodohkan / Essay)"] === 'PGK')) {
            currentSoal[`Opsi ${optionMatch[1].toUpperCase()}`] = optionMatch[2]; continue;
        }
        
        // Mendeteksi Kunci Jawaban
        const kunciMatch = line.match(/^(?:Kunci|Jawaban|Kunci Jawaban)\s*:\s*(.*)/i);
        if (kunciMatch && currentSoal) { 
            let jwbStr = kunciMatch[1].trim();
            // Kapitalisasi otomatis khusus untuk PG dan PGK
            if (currentTipe === 'PG' || currentTipe === 'PGK') {
                jwbStr = jwbStr.toUpperCase();
            }
            currentSoal["Kunci Jawaban / Pasangan Menjodohkan"] = jwbStr; 
            continue; 
        }
        
        // Memasukkan Teks Tambahan ke Soal atau Opsi
        if (currentSoal) {
            let hasOptions = currentSoal['Opsi A'] || currentSoal['Opsi B'];
            if (!hasOptions) { 
                currentSoal["Teks Pertanyaan"] += '\n' + line; 
            } else { 
                let lastOpt = ['E', 'D', 'C', 'B', 'A'].find(o => currentSoal[`Opsi ${o}`]); 
                if (lastOpt) currentSoal[`Opsi ${lastOpt}`] += '\n' + line; 
            }
        }
    }
    
    if (currentSoal) jsonData.push(currentSoal); 
    return jsonData;
};

window.prosesUploadMassal = async (jsonData, mapel, kelasArray) => {
    if (jsonData.length === 0) throw new Error("File kosong atau tidak sesuai format Template!");
    let kelasKeyToSave = [...kelasArray].sort().join(', ');

    const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel));
    const snap = await getDocs(q);
    let maxNomor = 0;
    snap.forEach(doc => {
        let data = doc.data();
        let kArr = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
        if ([...kArr].sort().join(', ') === kelasKeyToSave) {
            let nom = parseInt(data.nomor_soal) || 0;
            if (nom > maxNomor) maxNomor = nom;
        }
    });

    let updates = []; 
    let timestampAwal = new Date().getTime();
    let currentNomor = maxNomor + 1;
    
    for (let row of jsonData) {
        let tipeRaw = String(row["Tipe Soal (PG / PGK / Menjodohkan / Essay)"] || "PG").toUpperCase().trim();
        let tipeFormat = "PG"; if (tipeRaw.includes('ESSAY')) tipeFormat = 'Essay'; else if (tipeRaw.includes('PGK')) tipeFormat = 'PGK'; else if (tipeRaw.includes('JODOH') || tipeRaw.includes('MENJODOHKAN')) tipeFormat = 'Menjodohkan';
        
        timestampAwal += 1000;
        let payload = { mataPelajaran: mapel, kelas: kelasArray, nomor_soal: currentNomor++, bobot: parseFloat(row["Bobot Soal"]) || 1, tipe: tipeFormat, teks_soal: String(row["Teks Pertanyaan"] || ""), createdAt: new Date(timestampAwal), updatedAt: new Date(timestampAwal) };
        
        let linkMediaPertanyaan = row["Link Media Pertanyaan (URL Gambar/Audio/Video)"] ? String(row["Link Media Pertanyaan (URL Gambar/Audio/Video)"]).trim() : "";
        if (linkMediaPertanyaan) {
            let mType = "image"; if (linkMediaPertanyaan.toLowerCase().includes('.mp3') || linkMediaPertanyaan.toLowerCase().includes('.wav')) mType = "audio"; else if (linkMediaPertanyaan.toLowerCase().includes('.mp4') || linkMediaPertanyaan.toLowerCase().includes('.mkv')) mType = "video";
            payload.media_soal = { url: linkMediaPertanyaan, type: mType };
        }
        
        if (tipeFormat === 'PG' || tipeFormat === 'PGK') {
            payload.opsi = { A: row["Opsi A"] ? String(row["Opsi A"]) : "", B: row["Opsi B"] ? String(row["Opsi B"]) : "", C: row["Opsi C"] ? String(row["Opsi C"]) : "", D: row["Opsi D"] ? String(row["Opsi D"]) : "", E: row["Opsi E"] ? String(row["Opsi E"]) : "" };
            let opsiMediaObj = {}; ['A', 'B', 'C', 'D', 'E'].forEach(k => { let linkMediaOpsi = row[`Link Media Opsi ${k} (URL Gambar)`] ? String(row[`Link Media Opsi ${k} (URL Gambar)`]).trim() : ""; if (linkMediaOpsi) { opsiMediaObj[k] = { url: linkMediaOpsi, type: "image" }; } });
            if (Object.keys(opsiMediaObj).length > 0) { payload.opsi_media = opsiMediaObj; }
            let kunci = String(row["Kunci Jawaban / Pasangan Menjodohkan"] || "").trim().toUpperCase();
            if (tipeFormat === 'PGK') { payload.kunci_jawaban = kunci.split(',').map(k => k.trim()); } else { payload.kunci_jawaban = kunci; }
        } else if (tipeFormat === 'Menjodohkan') {
            let kunciRaw = row["Kunci Jawaban / Pasangan Menjodohkan"] ? String(row["Kunci Jawaban / Pasangan Menjodohkan"]).trim() : ""; let pasanganArr = [];
            if (kunciRaw) { kunciRaw.split(';').forEach(p => { let splitPair = p.split('='); if (splitPair.length === 2) { pasanganArr.push({ kiri: splitPair[0].trim(), kanan: splitPair[1].trim() }); } }); }
            payload.pasangan = pasanganArr;
        } else if (tipeFormat === 'Essay') { payload.kunci_jawaban = String(row["Kunci Jawaban / Pasangan Menjodohkan"] || ""); }
        updates.push(addDoc(collection(db, "bank_soal"), payload));
    }
    await Promise.all(updates); 
    await SoalManager.normalizeUrutan(mapel, kelasKeyToSave);
    window.customAlert(`Sukses! ${jsonData.length} Soal berhasil diunggah dengan aman.`, "success"); 
    SoalManager.bukaDetailSoal(mapel, kelasKeyToSave); 
    SoalManager.loadSummary();
};

document.getElementById('btn-import-gdrive')?.addEventListener('click', () => {
    const mapel = document.getElementById('soal-mapel').value;
    if(!mapel) return window.customAlert("Silakan Pilih Mata Pelajaran terlebih dahulu!", "warning");
    const selectedKelasCbs = Array.from(document.querySelectorAll('.cb-soal-kelas:checked')).map(cb => cb.value);
    if(document.getElementById('group-soal-kelas').style.display !== 'none' && selectedKelasCbs.length === 0) { return window.customAlert("Silakan pilih minimal satu kelas!", "warning"); }
    document.getElementById('input-gdrive-url').value = ''; document.getElementById('modal-import-gdrive').style.display = 'flex';
});

document.getElementById('btn-proses-gdrive')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('input-gdrive-url').value.trim(); 
    if (!urlInput) return window.customAlert("Masukkan link Google Sheets/Docs terlebih dahulu!", "warning");
    const match = urlInput.match(/\/d\/([a-zA-Z0-9-_]+)/); if (!match || !match[1]) return window.customAlert("Link tidak valid!", "error");
    const fileId = match[1]; const isDocs = urlInput.includes('/document/d/');
    document.getElementById('modal-import-gdrive').style.display = 'none';
    
    const mapel = document.getElementById('soal-mapel').value; 
    const selectedKelasCbs = Array.from(document.querySelectorAll('.cb-soal-kelas:checked')).map(cb => cb.value);
    let kelasKey = [...selectedKelasCbs].sort().join(', ');
    
    document.getElementById('modal-tambah-soal').style.display = 'none'; document.getElementById('view-summary-bank-soal').style.display = 'none'; document.getElementById('view-soal-list').style.display = 'block'; document.getElementById('label-mapel-edit').innerText = `Kelola Paket: ${mapel} (${kelasKey})`;
    const container = document.getElementById('list-soal'); container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--info); font-weight:bold;"><i class="fas fa-spinner fa-spin fa-3x" style="margin-bottom:15px;"></i><br>Sedang menyedot data dari Google Drive...</div>';
    try {
        if (isDocs) {
            const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`; const response = await fetch(exportUrl);
            if (!response.ok) throw new Error("Akses ditolak. Pastikan dibagikan publik (Anyone with the link).");
            const textData = await response.text(); if (textData.includes('<!DOCTYPE html>')) throw new Error("Terdeteksi HTML. Set publik tanpa login.");
            const jsonData = window.parseDocTextToJSON(textData); await window.prosesUploadMassal(jsonData, mapel, selectedKelasCbs);
        } else {
            const exportUrl = `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv`; const response = await fetch(exportUrl);
            if (!response.ok) throw new Error("Akses ditolak. Pastikan dibagikan publik (Anyone with the link).");
            const csvText = await response.text(); if (csvText.includes('<!DOCTYPE html>')) throw new Error("Terdeteksi HTML. Set publik tanpa login.");
            const workbook = XLSX.read(csvText, { type: 'string' }); const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet); await window.prosesUploadMassal(jsonData, mapel, selectedKelasCbs);
        }
    } catch (err) { window.customAlert("Gagal Import G-Drive: " + err.message, "error"); SoalManager.bukaDetailSoal(mapel, kelasKey); }
});

document.getElementById('upload-excel-soal')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const mapel = document.getElementById('soal-mapel').value; 
    const selectedKelasCbs = Array.from(document.querySelectorAll('.cb-soal-kelas:checked')).map(cb => cb.value);
    
    if(!mapel) { e.target.value = ''; return window.customAlert("Silakan Pilih Mata Pelajaran terlebih dahulu!", "error"); }
    if(document.getElementById('group-soal-kelas').style.display !== 'none' && selectedKelasCbs.length === 0) { e.target.value = ''; return window.customAlert("Silakan pilih minimal satu kelas!", "error"); }
    
    let kelasKey = [...selectedKelasCbs].sort().join(', ');
    document.getElementById('modal-tambah-soal').style.display = 'none'; document.getElementById('view-summary-bank-soal').style.display = 'none'; document.getElementById('view-soal-list').style.display = 'block'; document.getElementById('label-mapel-edit').innerText = `Kelola Paket: ${mapel} (${kelasKey})`;
    const container = document.getElementById('list-soal'); container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--info); font-weight:bold;"><i class="fas fa-spinner fa-spin fa-3x" style="margin-bottom:15px;"></i><br>Membaca file lokal & Menyimpan...</div>';
    const reader = new FileReader();
    if (file.name.endsWith('.docx')) {
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                mammoth.extractRawText({arrayBuffer: arrayBuffer}).then(async function(result) {
                        const text = result.value; const jsonData = window.parseDocTextToJSON(text); await window.prosesUploadMassal(jsonData, mapel, selectedKelasCbs);
                }).catch(function(err) { window.customAlert("Gagal membaca Word: " + err.message, "error"); SoalManager.bukaDetailSoal(mapel, kelasKey); });
            } catch (err) { window.customAlert("Error: " + err.message, "error"); SoalManager.bukaDetailSoal(mapel, kelasKey); }
        };
        reader.readAsArrayBuffer(file);
    } else {
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData = XLSX.utils.sheet_to_json(worksheet);
                await window.prosesUploadMassal(jsonData, mapel, selectedKelasCbs);
            } catch (err) { window.customAlert("Gagal memproses file: " + err.message, "error"); SoalManager.bukaDetailSoal(mapel, kelasKey); }
        };
        reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
});

// ==========================================
// 11. HASIL UJIAN (CAPAIAN SISWA)
// ==========================================
window.chartPartisipasi = null;

window.loadDataHasil = async () => {
    try {
        const snap = await getDocs(collection(db, "hasil_ujian")); 
        allHasilUjian = []; 
        snap.forEach(d => allHasilUjian.push({ id: d.id, ...d.data() }));

        const statUjian = document.getElementById('stat-ujian');
        if (statUjian) statUjian.innerText = allHasilUjian.length;

        const gridMapel = document.getElementById('grid-mapel-hasil'); 
        if(!gridMapel) return;

        let summaryMapel = {};
        let chartDataMapel = {}; // Data khusus untuk grafik

        allHasilUjian.forEach(h => {
            const isAuthorized = isAdmin || (isGuru && userMapel.includes(h.mataPelajaran));
            if (isAuthorized) {
                // 1. Data untuk Kartu Rincian Kelas
                const kelasStr = Array.isArray(h.kelas) ? h.kelas.join(', ') : (h.kelas || "-");
                let key = `${h.mataPelajaran} - Kelas ${kelasStr}`;
                if(!summaryMapel[key]) summaryMapel[key] = { mapel: h.mataPelajaran, kelas: kelasStr, count: 0, totalNilai: 0 };
                summaryMapel[key].count++; 
                let nilaiSiswa = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : (h.nilai || 0));
                summaryMapel[key].totalNilai += parseFloat(nilaiSiswa);

                // 2. Data Agregat Murni per Mapel untuk Grafik
                let mapelName = h.mataPelajaran || "Tanpa Mapel";
                if(!chartDataMapel[mapelName]) chartDataMapel[mapelName] = 0;
                chartDataMapel[mapelName]++;
            }
        });

        // Render Kartu Detail
        gridMapel.innerHTML = '';
        for (let key in summaryMapel) {
            let s = summaryMapel[key]; 
            let rataRata = s.count > 0 ? (s.totalNilai / s.count).toFixed(2) : "0.00";
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
        if(gridMapel.innerHTML === '') { gridMapel.innerHTML = '<p style="grid-column: 1 / -1; text-align:center; color:var(--text-muted);">Belum ada data hasil ujian untuk mapel yang Anda ampu.</p>'; }

        // Panggil fungsi render grafik
        if (document.getElementById('chartPartisipasiMapel')) {
            window.renderChartPartisipasi(chartDataMapel);
        }
        
    } catch(e) { console.error("Gagal memuat hasil ujian:", e); }
};

window.renderChartPartisipasi = async (dataObj) => {
    const ctx = document.getElementById('chartPartisipasiMapel');
    if (!ctx) return;

    // OTOMATIS: Memuat Chart.js dari internet jika terdeteksi belum ada di HTML
    if (typeof Chart === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    const labels = Object.keys(dataObj);
    const dataVals = Object.values(dataObj);

    if (window.chartPartisipasi) {
        window.chartPartisipasi.destroy();
    }

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    window.chartPartisipasi = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Siswa Selesai',
                data: dataVals,
                backgroundColor: 'rgba(16, 185, 129, 0.85)',
                borderColor: '#059669',
                borderWidth: 1,
                borderRadius: 8,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(context) { return context.parsed.y + ' Siswa'; } } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: textColor }, grid: { color: gridColor, drawBorder: false } },
                x: { ticks: { color: textColor, font: { weight: 'bold' } }, grid: { display: false, drawBorder: false } }
            }
        }
    });
};

window.bukaDetailHasil = (mapel, kelas) => { 
    currentMapelDetail = mapel; 
    currentKelasDetail = kelas; 
    document.getElementById('label-mapel-detail').innerText = `HASIL: ${mapel} - KELAS ${kelas}`; 
    window.location.hash = 'section-hasil-detail'; 
    window.renderDetailHasil(); 
};

window.lihatDetailJawaban = async (id) => {
    const h = allHasilUjian.find(x => x.id === id); if(!h) return;
    document.getElementById('edit-id-hasil').value = id;
    document.getElementById('detail-nama-siswa').innerText = `${h.nama} (${h.username || h.uid})`;
    let nilaiSiswa = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : (h.nilai || 0));
    document.getElementById('edit-nilai-siswa').value = nilaiSiswa;

    const container = document.getElementById('container-jawaban-siswa');
    container.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Menarik lembar jawaban...</div>';
    document.getElementById('modal-detail-jawaban').style.display = 'flex';

    try {
        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", h.mataPelajaran));
        const snap = await getDocs(q); 
        let soalArr = []; 
        
        snap.forEach(d => {
            let sData = d.data();
            let kelasSoal = Array.isArray(sData.kelas) ? sData.kelas : [sData.kelas];
            if (kelasSoal.includes(h.kelas) || kelasSoal.includes("Umum") || kelasSoal.length === 0) {
                soalArr.push({id: d.id, ...sData});
            }
        });
        soalArr.sort((a,b) => (a.nomor_soal || 0) - (b.nomor_soal || 0));

        let html = '';
        soalArr.forEach((s, idx) => {
            let jwbSiswa = (h.jawaban && h.jawaban[s.id]) ? h.jawaban[s.id] : '-';
            let kunci = s.kunci_jawaban || s.jawaban_benar || '-';
            let tipe = s.tipe || 'PG';
            
            let statusBenar = false;
            if(tipe === 'PG' || tipe === 'PGK'){
                statusBenar = Array.isArray(kunci) ? (Array.isArray(jwbSiswa) && jwbSiswa.sort().join(',') === kunci.sort().join(',')) : (jwbSiswa === kunci);
            }
            
            html += `<div style="padding:15px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:10px; background:${statusBenar ? '#f0fdf4' : '#ffffff'};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <b style="color:var(--secondary);">Soal ${idx+1} <span style="background:var(--info); color:white; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:4px;">${tipe}</span></b>
                    ${(tipe === 'PG' || tipe === 'PGK') ? `<i class="${statusBenar ? 'fas fa-check-circle' : 'fas fa-times-circle'}" style="color:${statusBenar ? 'var(--success)' : 'var(--danger)'};"></i>` : ''}
                </div>
                <div style="font-size:0.9rem; margin-top:8px; color:#475569; padding-bottom:8px; border-bottom:1px dashed #cbd5e1;">${s.teks_soal || ''}</div>
                <div style="margin-top:10px; font-size:0.9rem;">
                    <span style="color:var(--primary);">Jawaban Siswa: <b style="color:#0f172a;">${typeof jwbSiswa === 'object' ? JSON.stringify(jwbSiswa) : jwbSiswa}</b></span><br>
                    <span style="color:var(--success);">Kunci Jawaban: <b>${typeof kunci === 'object' ? JSON.stringify(kunci) : kunci}</b></span>
                </div>
            </div>`;
        });
        container.innerHTML = html || '<div style="text-align:center;">Lembar kosong / data soal tidak ditemukan.</div>';
    } catch(e) { 
        console.error(e);
        container.innerHTML = '<div style="text-align:center; color:red;">Gagal memuat soal.</div>'; 
    }
};

document.getElementById('btn-simpan-nilai-baru')?.addEventListener('click', async () => {
    const id = document.getElementById('edit-id-hasil').value;
    const newSkor = parseFloat(document.getElementById('edit-nilai-siswa').value) || 0;
    const btn = document.getElementById('btn-simpan-nilai-baru');
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        await updateDoc(doc(db, "hasil_ujian", id), { skorPG: newSkor, skor: newSkor });
        let idx = allHasilUjian.findIndex(x => x.id === id);
        if(idx !== -1) { allHasilUjian[idx].skorPG = newSkor; allHasilUjian[idx].skor = newSkor; }
        window.renderDetailHasil();
        window.customAlert("Nilai siswa berhasil diubah secara manual!", "success");
        document.getElementById('modal-detail-jawaban').style.display = 'none';
    } catch(e) { window.customAlert("Gagal update nilai", "error"); }
    btn.innerHTML = 'Simpan Nilai'; btn.disabled = false;
});

window.lihatDetailStatus = (status, pelanggaran) => {
    let title = "Detail Status Ujian"; let msg = ""; let type = "info";
    if (status === 'NORMAL') { type = "success"; title = "Status: NORMAL"; msg = `Ujian diselesaikan dengan baik oleh siswa.\n\nTotal pelanggaran terdeteksi: ${pelanggaran} kali.`; } 
    else if (status === 'DISKUALIFIKASI' || status === 'DIHENTIKAN PAKSA') { type = "error"; title = `Status: ${status}`; msg = `Ujian dihentikan paksa oleh sistem keamanan CBT.\n\nSiswa telah melakukan pelanggaran sebanyak ${pelanggaran} kali.`; } 
    else if (status === 'WAKTU HABIS') { type = "warning"; title = "Status: WAKTU HABIS"; msg = `Durasi ujian telah habis.\nSistem otomatis mengumpulkan jawaban terakhir.`; } 
    else { type = "info"; title = `Status Ujian: ${status}`; msg = `Ujian disubmit dengan status: ${status}.\n\nTotal pelanggaran terdeteksi: ${pelanggaran} kali.`; }
    window.customAlert(msg, type, title);
};

window.renderDetailHasil = () => {
    const tbody = document.querySelector('#table-hasil tbody'); if (!tbody) return;
    const dataFiltered = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && (Array.isArray(h.kelas) ? h.kelas.join(', ') : (h.kelas || "-")) === currentKelasDetail);
    dataFiltered.sort((a, b) => new Date(b.waktuSubmit) - new Date(a.waktuSubmit));

    if (dataFiltered.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Belum ada data hasil ujian.</td></tr>'; 
    } else {
        let html = '';
        dataFiltered.forEach((h, index) => {
            const namaSiswa = h.nama || "Nama Tidak Terdata"; const nisSiswa = h.username || h.uid || "-";
            const nilai = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : 0);
            const jmlPelanggaran = h.pelanggaran || 0; const status = h.statusPelanggaran || 'NORMAL';
            
            let warnaStatus = '#10b981'; if (status === 'DISKUALIFIKASI' || status === 'DIHENTIKAN PAKSA') warnaStatus = '#ef4444'; else if (status === 'WAKTU HABIS') warnaStatus = '#f59e0b';
            let waktu = '-'; if (h.waktuSubmit) { const dateObj = new Date(h.waktuSubmit); waktu = !isNaN(dateObj) ? dateObj.toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : h.waktuSubmit; }
            
            html += `<tr>
                    <td>${index + 1}</td>
                    <td style="font-weight: 600;">${namaSiswa}</td>
                    <td><span style="color: var(--info); font-size: 0.85rem; font-weight: bold;">${nisSiswa}</span></td>
                    <td style="text-align:center; font-weight:bold; font-size:1.1rem;">${nilai}</td>
                    <td style="text-align:center;"><span class="badge ${jmlPelanggaran > 0 ? 'badge-danger' : 'badge-success'}">${jmlPelanggaran}</span></td>
                    <td style="text-align:center;"><span onclick="window.lihatDetailStatus('${status}', ${jmlPelanggaran})" style="background: ${warnaStatus}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; display: inline-block; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${status}</span></td>
                    <td style="text-align:center; font-size:0.85rem;">${waktu}</td>
                    <td style="text-align:center;"><div style="display: flex; gap: 5px; justify-content: center;"><button onclick="window.lihatDetailJawaban('${h.id}')" class="btn-3d" style="background:var(--info); padding:6px 10px; font-size:0.85rem;" title="Lihat Detail Jawaban"><i class="fas fa-eye"></i></button><button onclick="window.hapusHasil('${h.id}')" class="btn-3d" style="background:var(--danger); padding:6px 10px; font-size:0.85rem;" title="Hapus Data"><i class="fas fa-trash-alt"></i></button></div></td>
                </tr>`;
        });
        tbody.innerHTML = html;
    }
};

window.downloadExcelHasil = async (mapel = currentMapelDetail, kelas = currentKelasDetail) => {
    const dataFiltered = allHasilUjian.filter(h => h.mataPelajaran === mapel && (Array.isArray(h.kelas) ? h.kelas.join(', ') : (h.kelas || "-")) === kelas);
    if (dataFiltered.length === 0) { window.customAlert("Tidak ada data hasil ujian.", "warning"); return; }
    const btn = document.querySelector(`button[onclick="window.downloadExcelHasil()"]`) || document.querySelector(`button[onclick*="downloadExcelHasil('${mapel}'"]`);
    let origText = ""; if (btn) { origText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghubungkan Bank Soal...'; btn.disabled = true; }

    try {
        const q = query(collection(db, "bank_soal"), where("mataPelajaran", "==", mapel)); const soalSnap = await getDocs(q); let soalArr = [];
        soalSnap.forEach(doc => { let data = doc.data(); let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas]; if (arrKelas.includes(kelas) || kelas.includes(arrKelas[0])) { soalArr.push({ id: doc.id, ...data }); } }); 
        soalArr.sort((a, b) => (a.nomor_soal || 0) - (b.nomor_soal || 0));

        const rowsForExcel = dataFiltered.map((h, index) => {
            let nilaiSiswa = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : 0);
            let waktu = '-'; if (h.waktuSubmit) { const dObj = new Date(h.waktuSubmit); waktu = !isNaN(dObj) ? dObj.toLocaleString('id-ID') : h.waktuSubmit; }
            let rowData = { "No": index + 1, "Nama Siswa": h.nama || "Nama Tidak Terdata", "NIS / Email": h.username || h.uid || "-", "Mata Pelajaran": h.mataPelajaran, "Kelas": h.kelas, "Nilai Akhir": nilaiSiswa, "Jumlah Pelanggaran": h.pelanggaran || 0, "Status Ujian": h.statusPelanggaran || 'NORMAL', "Waktu Submit": waktu };
            
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
        XLSX.writeFile(workbook, `Hasil_Lengkap_CBT_${mapel}_${kelas}.xlsx`);
    } catch (e) { window.customAlert("Terjadi kesalahan sistem rekap.", "error"); } finally { if (btn) { btn.innerHTML = origText; btn.disabled = false; } }
};

window.hapusHasil = async (id) => { if(await customConfirm("Hapus hasil ujian siswa ini?", "danger")) { await deleteDoc(doc(db, "hasil_ujian", id)); window.loadDataHasil(); window.renderDetailHasil(); } };

document.getElementById('btn-hapus-semua-hasil')?.addEventListener('click', async () => {
    if (!currentMapelDetail || !currentKelasDetail) return;
    if (await window.customConfirm(`Hapus SEMUA data hasil ujian untuk mapel ${currentMapelDetail} di Kelas ${currentKelasDetail}?`, "danger", "Kosongkan Data")) {
        const btnHapusAll = document.getElementById('btn-hapus-semua-hasil'); const origText = btnHapusAll.innerHTML;
        btnHapusAll.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghapus Massal...'; btnHapusAll.disabled = true;
        try {
            const dataAkanDihapus = allHasilUjian.filter(h => h.mataPelajaran === currentMapelDetail && (Array.isArray(h.kelas) ? h.kelas.includes(currentKelasDetail) : h.kelas === currentKelasDetail));
            await Promise.all(dataAkanDihapus.map(h => deleteDoc(doc(db, "hasil_ujian", h.id))));
            await window.customAlert(`${dataAkanDihapus.length} data berhasil dikosongkan!`, "success"); window.loadDataHasil(); window.location.hash = 'section-hasil';
        } catch (e) { await window.customAlert("Terjadi kesalahan saat menghapus data massal.", "error"); }
        btnHapusAll.innerHTML = origText; btnHapusAll.disabled = false;
    }
});

// ==========================================
// 12. PREVIEW SOAL MODERN
// ==========================================
window.previewSoal = (id) => {
    const s = SoalManager.tempDataKelola.find(x => x.id === id); if(!s) return;
    const content = document.getElementById('preview-content'); content.dataset.dark = '0'; content.style.background = 'white'; content.style.borderColor = '#e2e8f0'; content.style.color = '';
    const btn = document.getElementById('btn-dark-toggle'); if(btn){ btn.innerHTML = '<i class="fas fa-moon" style="font-size:0.9rem;"></i>'; btn.style.background = '#f1f5f9'; btn.style.color = '#475569'; }

    document.getElementById('preview-title').innerText = `Soal ${s.nomor_soal || ''} - ${s.tipe || 'PG'}`; document.getElementById('preview-subtitle').innerText = `${s.mataPelajaran} • ${s.bobot || 1} poin`;
    let html = `<div style="margin-bottom:22px;"><div style="display:inline-flex; align-items:center; gap:8px; background:#f0f9ff; color:#0369a1; padding:6px 12px; border-radius:8px; font-size:0.8rem; font-weight:600; margin-bottom:14px; border:1px solid #bae6fd;"><i class="fas fa-user-graduate"></i> Tampilan Siswa</div><div style="font-size:1.08rem; line-height:1.75; color:#0f172a; font-weight:500;">${s.teks_soal || ''}</div></div>`;
    
    if(s.media_soal){
        const mUrl = typeof s.media_soal === 'object' ? s.media_soal.url : s.media_soal;
        const mType = typeof s.media_soal === 'object' && s.media_soal.type ? s.media_soal.type : 'image';
        if(mType === 'video'){ html += `<div style="margin:20px 0; text-align:center;"><video src="${mUrl}" controls style="max-width:100%; max-height:320px; border-radius:12px; background:#000;"></video></div>`; } 
        else if(mType === 'audio'){ html += `<div style="margin:20px 0; text-align:center;"><audio src="${mUrl}" controls></audio></div>`; }
        else { html += `<div style="margin:20px 0; text-align:center;"><img src="${mUrl}" style="max-width:100%; max-height:350px; width:auto; object-fit:contain; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 12px rgba(0,0,0,0.08);"></div>`; }
    }
    
    if(s.tipe === 'PG' || s.tipe === 'PGK'){
        html += '<div style="display:flex; flex-direction:column; gap:12px; margin-top:24px;">';
        ['A','B','C','D','E'].forEach(k => {
            if(s.opsi && (s.opsi[k] || (s.opsi_media && s.opsi_media[k]))){
                const isCorrect = s.tipe === 'PG' ? s.kunci_jawaban === k : (Array.isArray(s.kunci_jawaban) && s.kunci_jawaban.includes(k));
                let mHtml = '';
                if(s.opsi_media && s.opsi_media[k]){
                    const moData = s.opsi_media[k]; const moUrl = typeof moData === 'object' ? moData.url : moData; const moType = typeof moData === 'object' && moData.type ? moData.type : 'image';
                    if(moType === 'video') mHtml = `<video src="${moUrl}" controls style="max-width:180px; margin-top:8px; border-radius:8px; background:#000;"></video>`;
                    else if(moType === 'audio') mHtml = `<audio src="${moUrl}" controls style="margin-top:8px;"></audio>`;
                    else mHtml = `<img src="${moUrl}" style="max-width:100%; max-height:150px; width:auto; object-fit:contain; margin-top:8px; border-radius:8px; border:1px solid #e2e8f0;">`;
                }
                html += `<div style="display:flex; align-items:flex-start; gap:14px; padding:14px 16px; border:1.5px solid ${isCorrect ? '#86efac' : '#e2e8f0'}; border-radius:12px; background:${isCorrect ? '#f0fdf4' : 'white'}; transition:all 0.2s;"><div style="width:32px; height:32px; background:${isCorrect ? '#10b981' : '#f1f5f9'}; color:${isCorrect ? 'white' : '#475569'}; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; flex-shrink:0;">${k}</div><div style="flex:1; padding-top:2px;"><div style="color:#1e293b; line-height:1.6;">${s.opsi[k]}</div>${mHtml}</div>${isCorrect ? '<div style="color:#10b981; font-size:1.1rem;"><i class="fas fa-check-circle"></i></div>' : ''}</div>`;
            }
        });
        html += '</div>';
    } else if(s.tipe === 'Menjodohkan'){ html += '<div style="margin-top:20px; padding:16px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; color:#92400e; font-size:0.9rem;"><i class="fas fa-link"></i> Soal Menjodohkan - siswa akan memasangkan jawaban di application</div>'; } 
    else if(s.tipe === 'Essay'){ html += `<div style="margin-top:24px;"><label style="display:block; font-weight:600; margin-bottom:8px; color:#475569; font-size:0.9rem;">Jawaban siswa:</label><div style="min-height:120px; border:1.5px dashed #cbd5e1; border-radius:10px; background:#f8fafc;"></div>${s.kunci_jawaban ? `<div style="margin-top:16px; padding:12px; background:#f0f9ff; border-left:3px solid #0ea5e9; border-radius:6px;"><strong style="font-size:0.85rem; color:#0369a1;">Kunci/Rubrik:</strong><div style="margin-top:4px; color:#0c4a6e; font-size:0.9rem;">${s.kunci_jawaban}</div></div>` : ''}</div>`; }
    
    document.getElementById('preview-content').innerHTML = html; document.getElementById('modal-preview-soal').style.display = 'flex';
};

window.togglePreviewDark = () => {
    const content = document.getElementById('preview-content'); const modal = document.getElementById('modal-preview-soal'); const btn = document.getElementById('btn-dark-toggle'); const isDark = content.dataset.dark === '1';
    if(!isDark){
        content.dataset.dark = '1'; content.style.background = '#0f172a'; content.style.borderColor = '#334155'; content.style.color = '#e2e8f0'; modal.querySelector('[style*="background:#f8fafc"]').style.background = '#020617'; btn.innerHTML = '<i class="fas fa-sun" style="font-size:0.9rem;"></i>'; btn.style.background = '#1e293b'; btn.style.color = '#fbbf24'; btn.style.borderColor = '#334155';
        content.querySelectorAll('div').forEach(el => {
            const style = el.getAttribute('style') || '';
            if(style.includes('color:#0f172a') || style.includes('color:#1e293b')){ el.style.color = '#e2e8f0'; }
            if(style.includes('background:white') && !style.includes('border')){ el.style.background = '#1e293b'; el.style.borderColor = '#334155'; }
            if(style.includes('background:#f8fafc')){ el.style.background = '#0f172a'; }
            if(style.includes('border:1.5px solid #e2e8f0')){ el.style.borderColor = '#334155'; el.style.background = '#1e293b'; }
            if(style.includes('background:#f0f9ff')){ el.style.background = '#1e293b'; el.style.borderColor = '#334155'; }
        });
    } else {
        content.dataset.dark = '0'; content.style.background = 'white'; content.style.borderColor = '#e2e8f0'; content.style.color = ''; modal.querySelector('[style*="background:#020617"]').style.background = '#f8fafc'; btn.innerHTML = '<i class="fas fa-moon" style="font-size:0.9rem;"></i>'; btn.style.background = '#f1f5f9'; btn.style.color = '#475569'; btn.style.borderColor = '#e2e8f0';
        const currentId = SoalManager.tempDataKelola.find(s => document.getElementById('preview-title').innerText.includes(s.nomor_soal))?.id; if(currentId) { window.previewSoal(currentId); content.dataset.dark = '0'; }
    }
};

// ==========================================
// 14. FIX UI & NAVIGASI BAWAAN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.close-btn, .close-modal, [data-dismiss="modal"]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const modal = this.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) { e.target.style.display = 'none'; }
    });

    const btnFabNav = document.getElementById('btn-fab-nav');
    const sidebar = document.querySelector('aside') || document.querySelector('.sidebar');
    const overlaySidebar = document.getElementById('overlay-sidebar');

    if(btnFabNav && sidebar && overlaySidebar) {
        btnFabNav.addEventListener('click', () => {
            sidebar.style.display = 'block';
            if(sidebar.style.transform) sidebar.style.transform = 'translateX(0)';
            overlaySidebar.style.display = 'block';
        });
        overlaySidebar.addEventListener('click', () => {
            if(sidebar.style.transform) sidebar.style.transform = 'translateX(-100%)';
            else sidebar.style.display = 'none';
            overlaySidebar.style.display = 'none';
        });
    }

    document.getElementById('btn-mode-siswa')?.addEventListener('click', () => { window.location.href = 'attempt.html'; });
    const filterGmailInputs = ['search-gmail-email', 'search-gmail-nama', 'search-gmail-role'];
    filterGmailInputs.forEach(id => { document.getElementById(id)?.addEventListener('input', window.renderTablePengguna); });
});

window.switchTab = function(sectionId) { window.location.hash = sectionId; document.getElementById('overlay-sidebar')?.click(); };
window.showSection = function(sectionId) { window.location.hash = sectionId; };
window.closeModal = function(modalId) { const m = document.getElementById(modalId); if(m) m.style.display = 'none'; };
