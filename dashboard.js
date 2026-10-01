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
        .select-all-checkbox { accent-color: var(--primary); }
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

// Cache lokal membuat data Mapel/Kelas tersedia hampir seketika saat modal akun dibuka.
const ACADEMIC_CACHE_KEY = 'cbt_academic_master_cache_v2';
const ACADEMIC_CACHE_TTL = 10 * 60 * 1000;

function readAcademicCache() {
    try {
        const raw = localStorage.getItem(ACADEMIC_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.listMapel) || !Array.isArray(parsed.listKelas)) return null;
        if (parsed.savedAt && (Date.now() - parsed.savedAt) > ACADEMIC_CACHE_TTL) return null;
        return parsed;
    } catch (e) { return null; }
}

function writeAcademicCache(mapel, kelas) {
    try {
        localStorage.setItem(ACADEMIC_CACHE_KEY, JSON.stringify({ listMapel: mapel, listKelas: kelas, savedAt: Date.now() }));
    } catch (e) {}
}

function applyAcademicMaster(mapel, kelas) {
    listMapel = Array.from(new Set(Array.isArray(mapel) ? mapel.map(v => String(v).trim()).filter(Boolean) : []));
    listKelas = Array.from(new Set(Array.isArray(kelas) ? kelas.map(v => String(v).trim()).filter(Boolean) : []));
    listMapel.sort((a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    listKelas.sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    window.renderTableMaster();
    window.populateSemuaDropdown();
}

// ==========================================
// 2. MODUL SOAL MANAGER
// ==========================================
const SoalManager = {
    allSummary: {},
    tempDataKelola: [],
    allQuestionsCache: [],

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
            snap.forEach(d => { const data = d.data(); /* existing logic */ });
        } catch(e) { console.error(e); }
    }
};

// ==========================================
// 11. HASIL UJIAN (CAPAIAN SISWA)
// ==========================================
window.chartPartisipasi = null;

window.loadDataHasil = async () => {
    try {
        let docs = [];

        if (isAdmin) {
            const snap = await getDocs(collection(db, "hasil_ujian"));
            snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
        } else if (isGuru) {
            // SECURITY: guru tidak lagi mengambil seluruh hasil ujian lalu memfilter di browser.
            // Query dibatasi langsung ke kombinasi mapel + kelas yang dimiliki guru.
            const mapel = Array.from(new Set(userMapel.map(v => String(v).trim()).filter(Boolean)));
            const kelas = Array.from(new Set(userKelas.map(v => String(v).trim()).filter(Boolean)));
            const requests = [];
            mapel.forEach(m => kelas.forEach(k => {
                requests.push(getDocs(query(
                    collection(db, "hasil_ujian"),
                    where("mataPelajaran", "==", m),
                    where("kelas", "==", k)
                )));
            }));
            const snaps = await Promise.all(requests);
            const seen = new Set();
            snaps.forEach(snap => snap.forEach(d => {
                if (!seen.has(d.id)) {
                    seen.add(d.id);
                    docs.push({ id: d.id, ...d.data() });
                }
            }));
        }

        allHasilUjian = docs;

        const statUjian = document.getElementById('stat-ujian');
        if (statUjian) statUjian.innerText = allHasilUjian.length;

        const gridMapel = document.getElementById('grid-mapel-hasil'); 
        if(!gridMapel) return;

        let summaryMapel = {};
        let chartDataMapel = {};

        allHasilUjian.forEach(h => {
            const kelasStr = Array.isArray(h.kelas) ? h.kelas.join(', ') : (h.kelas || "-");
            let key = `${h.mataPelajaran} - Kelas ${kelasStr}`;
            if(!summaryMapel[key]) summaryMapel[key] = { mapel: h.mataPelajaran, kelas: kelasStr, count: 0, totalNilai: 0 };
            summaryMapel[key].count++; 
            let nilaiSiswa = h.skorPG !== undefined ? h.skorPG : (h.skor !== undefined ? h.skor : (h.nilai || 0));
            summaryMapel[key].totalNilai += parseFloat(nilaiSiswa);

            let mapelName = h.mataPelajaran || "Tanpa Mapel";
            if(!chartDataMapel[mapelName]) chartDataMapel[mapelName] = 0;
            chartDataMapel[mapelName]++;
        });

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

        if (document.getElementById('chartPartisipasiMapel')) {
            window.renderChartPartisipasi(chartDataMapel);
        }
        
    } catch(e) { console.error("Gagal memuat hasil ujian:", e); }
};
