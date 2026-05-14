import { auth, db, storage } from './firebase-config.js'; 
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, updateProfile, getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

const secondaryApp = initializeApp({ apiKey: "AIzaSyB8R0VNO0noUlkcUcjBkpsGFrYPdtA7KxM", authDomain: "cbt-sekolah-7fed0.firebaseapp.com", projectId: "cbt-sekolah-7fed0", storageBucket: "cbt-sekolah-7fed0.firebasestorage.app", messagingSenderId: "289218396137", appId: "1:289218396137:web:366383efd1348edad3d578" }, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

let listMapel = []; let listKelas = []; let allUsersData = []; let allSoalData = []; let filteredSoalData = [];
let previewCurrentIdx = 0; let allHasilUjian = []; let currentMapelDetail = ""; 

// ==========================================
// 1. MODAL CUSTOM & NOTIFIKASI
// ==========================================
window.customAlert = (msg, type = 'info', title = '') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-alert');
        if (!modal) { alert(msg); return resolve(); }
        
        const icon = document.getElementById('alert-icon');
        const titleEl = document.getElementById('alert-title');
        const messageEl = document.getElementById('alert-message');
        const btnOk = document.getElementById('btn-alert-ok');
        
        let color = 'var(--info)'; let iconClass = 'fas fa-info-circle'; let defaultTitle = 'Informasi';
        if (type === 'success') { color = 'var(--success)'; iconClass = 'fas fa-check-circle'; defaultTitle = 'Berhasil'; }
        else if (type === 'error') { color = 'var(--danger)'; iconClass = 'fas fa-times-circle'; defaultTitle = 'Gagal / Error'; }
        else if (type === 'warning') { color = 'var(--warning)'; iconClass = 'fas fa-exclamation-triangle'; defaultTitle = 'Peringatan'; }
        
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        icon.className = `${iconClass} fa-4x`; icon.style.color = color;
        btnOk.style.backgroundColor = color;
        titleEl.innerText = title || defaultTitle;
        messageEl.innerText = msg;
        
        modal.style.display = 'flex';
        btnOk.onclick = () => { modal.style.display = 'none'; resolve(); };
    });
};

window.customConfirm = (msg, type = 'warning', title = 'Konfirmasi', okText = 'Ya, Lanjutkan') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-custom-confirm');
        if (!modal) { return resolve(confirm(msg)); }
        
        const icon = document.getElementById('confirm-icon');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const btnOk = document.getElementById('btn-confirm-ok');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        
        let color = 'var(--warning)'; let iconClass = 'fas fa-question-circle';
        if (type === 'danger') { color = 'var(--danger)'; iconClass = 'fas fa-exclamation-triangle'; }
        
        modal.querySelector('.modal-content').style.borderTop = `5px solid ${color}`;
        icon.className = `${iconClass} fa-4x`; icon.style.color = color;
        btnOk.style.backgroundColor = color; btnOk.innerText = okText;
        titleEl.innerText = title;
        messageEl.innerText = msg;
        
        modal.style.display = 'flex';
        btnOk.onclick = () => { modal.style.display = 'none'; resolve(true); };
        btnCancel.onclick = () => { modal.style.display = 'none'; resolve(false); };
    });
};

// ==========================================
// 2. HELPER MEDIA
// ==========================================
async function uploadFileKeStorage(file) {
    if (!file) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const storageRef = ref(storage, `bank_soal_media/${Date.now()}_${safeName}`);
    await uploadBytes(storageRef, file);
    return { url: await getDownloadURL(storageRef), type: file.type.split('/')[0] };
}
function base64ToFile(base64Str, filename) {
    try { let arr = base64Str.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n); while (n--) u8arr[n] = bstr.charCodeAt(n); return new File([u8arr], filename, { type: mime }); } catch (e) { return null; }
}
function renderMediaHTML(mediaObj) {
    if (!mediaObj) return '';
    if (mediaObj.type === 'image') return `<img src="${mediaObj.url}" style="max-width:100%; max-height:300px; border-radius:8px; margin-bottom:15px; display:block;">`;
    if (mediaObj.type === 'audio') return `<audio controls src="${mediaObj.url}" style="width:100%; max-width:400px; margin-bottom:15px; display:block; outline:none;"></audio>`;
    if (mediaObj.type === 'video') return `<video controls src="${mediaObj.url}" style="max-width:100%; max-height:300px; border-radius:8px; margin-bottom:15px; display:block;"></video>`;
    return '';
}

// ==========================================
// 3. LOGIKA UTAMA DASHBOARD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    let userRoles = []; 
    let userMapel = []; 
    let userKelas = [];
    
    try { 
        userRoles = JSON.parse(localStorage.getItem("userRole") || "[]"); 
        userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]"); 
        userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
    } catch (e) {}
    
    const isAdmin = userRoles.includes("admin"); 
    const isGuru = userRoles.includes("guru");

    function handleRouting() {
        let hash = window.location.hash.substring(1) || 'section-beranda';
        
        if (hash === 'section-pengaturan') hash = 'section-beranda';
        
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); 
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

        // Menampilkan / Menyembunyikan tombol kembali Global
        const globalBackBtn = document.getElementById('global-back-btn');
        if (hash === 'section-beranda') {
            if (globalBackBtn) globalBackBtn.style.display = 'none';
        } else {
            if (globalBackBtn) globalBackBtn.style.display = 'block';
        }

        if (hash === 'section-hasil-detail') {
            if (!currentMapelDetail) { window.location.hash = 'section-hasil'; return; }
            document.getElementById('section-hasil').classList.add('active');
            if(document.getElementById('hasil-summary-view')) document.getElementById('hasil-summary-view').style.display = 'none'; 
            if(document.getElementById('hasil-detail-view')) document.getElementById('hasil-detail-view').style.display = 'block';
            return;
        }

        const target = document.getElementById(hash); 
        if (target) target.classList.add('active');
        
        if (hash === 'section-hasil') { 
            if(document.getElementById('hasil-summary-view')) document.getElementById('hasil-summary-view').style.display = 'block'; 
            if(document.getElementById('hasil-detail-view')) document.getElementById('hasil-detail-view').style.display = 'none'; 
            currentMapelDetail = ""; 
        }
    }

    window.addEventListener('hashchange', handleRouting);

    onAuthStateChanged(auth, async (user) => {
        if (!user || (!isAdmin && !isGuru)) { window.location.href = "index.html"; return; }
        
        let finalDisplayName = user.displayName;
        if (!finalDisplayName) { 
            try { const userDoc = await getDoc(doc(db, "users", user.uid)); if (userDoc.exists()) finalDisplayName = userDoc.data().nama; } catch(e) {} 
        }
        finalDisplayName = finalDisplayName || "Pengguna";

        const adminNameEl = document.getElementById('admin-name'); 
        if (adminNameEl) adminNameEl.innerText = finalDisplayName;
        
        const greetingText = document.getElementById('greeting-text'); 
        if (greetingText) greetingText.innerHTML = `Assalamu'alaikum, <span style="display: inline-block;">${finalDisplayName}! 🙏</span>`;

        if (isAdmin) { 
            fetchStatusReg(); 
        } else if (isGuru && !isAdmin) {
            if(document.getElementById('menu-pengguna')) document.getElementById('menu-pengguna').style.display = 'none'; 
            if(document.getElementById('admin-reg-status')) document.getElementById('admin-reg-status').style.display = 'none'; 
            if(document.getElementById('admin-data-master')) document.getElementById('admin-data-master').style.display = 'none';
            if(document.getElementById('admin-manajemen-pengguna')) document.getElementById('admin-manajemen-pengguna').style.display = 'none';
        }

        handleRouting(); 
        loadDataMaster(); 
        loadDataHasil(); 
        loadActiveTokens(); 
        if (isAdmin) loadDataPengguna();
    });

    document.getElementById('btn-logout').onclick = async () => { 
        if (await customConfirm("Yakin ingin keluar dari aplikasi?", "warning", "Konfirmasi Keluar", "Ya, Keluar")) { await signOut(auth); localStorage.clear(); window.location.href = "index.html"; } 
    };

    // ==========================================
    // LOGIKA ACCORDION UMUM
    // ==========================================
    document.querySelectorAll('.toggle-accordion').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-target');
            const target = document.getElementById(targetId);
            const icon = header.querySelector('.toggle-icon');
            
            if (target.style.display === 'none') {
                target.style.display = 'block';
                icon.style.transform = 'rotate(180deg)';
                header.style.background = '#f8fafc';
            } else {
                target.style.display = 'none';
                icon.style.transform = 'rotate(0deg)';
                header.style.background = '#ffffff';
            }
        });
    });

    // ==========================================
    // 4. DATA MASTER (MAPEL & KELAS)
    // ==========================================
    async function loadDataMaster() {
        try {
            const docSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
            if (docSnap.exists()) { listMapel = docSnap.data().list_mapel || []; listKelas = docSnap.data().list_kelas || []; }
            renderTableMaster(); populateSemuaDropdown();
        } catch (e) { console.error("Gagal load data master", e); }
    }

    function renderTableMaster() {
        const tbodyMapel = document.querySelector('#table-master-mapel tbody');
        if (tbodyMapel) tbodyMapel.innerHTML = listMapel.length === 0 ? `<tr><td style="text-align:center;">Kosong</td></tr>` : listMapel.map((m, i) => `<tr><td>${m}</td><td style="text-align:right;"><button onclick="window.hapusMapel(${i})" class="btn-3d" style="background:var(--danger); padding:4px 8px;"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        const tbodyKelas = document.querySelector('#table-master-kelas tbody');
        if (tbodyKelas) tbodyKelas.innerHTML = listKelas.length === 0 ? `<tr><td style="text-align:center;">Kosong</td></tr>` : listKelas.map((k, i) => `<tr><td>${k}</td><td style="text-align:right;"><button onclick="window.hapusKelas(${i})" class="btn-3d" style="background:var(--danger); padding:4px 8px;"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    }

    function populateSemuaDropdown() {
        let allowedMapel = listMapel; let allowedKelas = listKelas;
        if (!isAdmin && isGuru) { allowedMapel = listMapel.filter(m => userMapel.includes(m)); allowedKelas = listKelas.filter(k => userKelas.includes(k)); }

        const optionsMapel = '<option value="" disabled selected>Pilih Mapel...</option>' + allowedMapel.map(m => `<option value="${
