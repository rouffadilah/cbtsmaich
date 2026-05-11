import { auth, db, storage } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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

let listMapel = []; let listKelas = []; let allUsersData = []; let allSoalData = []; let filteredSoalData = [];
let previewCurrentIdx = 0; let allHasilUjian = []; let currentMapelDetail = ""; 

// Helper Render Media
function renderMediaHTML(mediaObj) {
    if(!mediaObj) return '';
    if(mediaObj.type === 'image') return `<img src="${mediaObj.url}" style="max-width:100%; max-height:300px; border-radius:8px; margin-bottom:15px; display:block;">`;
    if(mediaObj.type === 'audio') return `<audio controls src="${mediaObj.url}" style="width:100%; max-width:400px; margin-bottom:15px; display:block; outline:none;"></audio>`;
    if(mediaObj.type === 'video') return `<video controls src="${mediaObj.url}" style="max-width:100%; max-height:300px; border-radius:8px; margin-bottom:15px; display:block;"></video>`;
    return '';
}

document.addEventListener('DOMContentLoaded', () => {

        const userRoles = JSON.parse(localStorage.getItem("userRole") || "[]");
        let userMapel = JSON.parse(localStorage.getItem("userMapel") || "[]");
        let userKelas = JSON.parse(localStorage.getItem("userKelas") || "[]"); 
        
        const isAdmin = userRoles.includes("admin");
        const isGuru = userRoles.includes("guru");

        // FUNGSI ROUTING KLIK MENU KARTU
        function handleRouting() {
            let isModalOpen = false;
            document.querySelectorAll('.modal').forEach(m => {
                if (m.style.display === 'flex') { m.style.display = 'none'; isModalOpen = true; }
            });
            if (isModalOpen) return; 

            let hash = window.location.hash.substring(1);
            if (!hash) hash = 'section-beranda'; 

            // Sembunyikan semua section
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

            if (hash === 'section-hasil-detail') {
                if (!currentMapelDetail) { window.location.hash = 'section-hasil'; return; }
                const secHasil = document.getElementById('section-hasil');
                if (secHasil) secHasil.classList.add('active');
                
                const summaryView = document.getElementById('hasil-summary-view');
                const detailView = document.getElementById('hasil-detail-view');
                if(summaryView) summaryView.style.display = 'none'; 
                if(detailView) detailView.style.display = 'block';
                return;
            }

            // Tampilkan section yang dituju
            const targetSection = document.getElementById(hash);
            if (targetSection) targetSection.classList.add('active');

            if (hash === 'section-hasil') {
                const summaryView = document.getElementById('hasil-summary-view');
                const detailView = document.getElementById('hasil-detail-view');
                if(summaryView) summaryView.style.display = 'block';
                if(detailView) detailView.style.display = 'none';
                currentMapelDetail = "";
            }
        }

        window.addEventListener('hashchange', handleRouting);
        
        // FUNGSI AKTIVASI KARTU MENU
        document.querySelectorAll('.stat-clickable').forEach(box => { 
            box.addEventListener('click', (e) => { 
                window.location.hash = e.currentTarget.dataset.target; 
            }); 
        });

        // AUTENTIKASI DAN MEMUAT NAMA PENGGUNA
        onAuthStateChanged(auth, async (user) => {
            if (!user || (!isAdmin && !isGuru)) { window.location.href = "index.html"; return; }

            let finalDisplayName = user.displayName;
            if (!finalDisplayName) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) finalDisplayName = userDoc.data().nama;
                } catch(e) {}
            }
            finalDisplayName = finalDisplayName || "Pengguna";

            // 1. Ganti Tulisan Pojok Kanan Atas dengan Nama
            const adminNameEl = document.getElementById('admin-name');
            if (adminNameEl) adminNameEl.innerText = finalDisplayName;
            
            // 2. Tambahkan Nama ke Ucapan Assalamu'alaikum
            const greetingText = document.getElementById('greeting-text');
            if (greetingText) greetingText.innerHTML = `Assalamu'alaikum, ${finalDisplayName}! 🙏`;

            // Hak Akses (Menyembunyikan menu Pengguna untuk Guru)
            if (isAdmin) {
                fetchStatusReg(); 
            } else if (isGuru && !isAdmin) {
                const mPengguna = document.getElementById('menu-pengguna');
                if (mPengguna) mPengguna.style.display = 'none'; 
                
                const mRegStatus = document.getElementById('admin-reg-status');
                if (mRegStatus) mRegStatus.style.display = 'none'; 
                
                const mDataMaster = document.getElementById('admin-data-master');
                if (mDataMaster) mDataMaster.style.display = 'none';
                
                const mMenuPeng = document.getElementById('menu-pengaturan');
                if (mMenuPeng) {
                    const pTag = mMenuPeng.querySelector('p');
                    if (pTag) pTag.innerText = 'Token Ujian';
                }
            }

            handleRouting(); 
            await loadDataMaster(); 
            loadDataHasil(); 
            loadActiveTokens(); 
            if (isAdmin) loadDataPengguna();
        });

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => { 
                if(confirm('Yakin ingin keluar?')) { await signOut(auth); localStorage.clear(); window.location.href = 'index.html'; } 
            });
        }
    
    setInterval(() => { 
        const liveTimeEl = document.getElementById('live-time');
        if (liveTimeEl) liveTimeEl.innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + " WIB"; 
    }, 1000);
