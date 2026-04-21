// guru.js
import { auth, db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    
    const sectionBuat = document.getElementById("section-buat-soal");
    const sectionBank = document.getElementById("section-bank-soal");
    const bankContainer = document.getElementById("bank-soal-container");

    // --- 1. NAVIGASI MENU SIDEBAR ---
    const menuItems = document.querySelectorAll(".option-item");
    const sections = document.querySelectorAll(".content-section");

    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            // 1. Hilangkan class selected dari semua menu
            menuItems.forEach(i => i.classList.remove("selected"));
            // 2. Tambahkan class selected ke menu yang diklik
            item.classList.add("selected");

            // 3. Sembunyikan semua section
            sections.forEach(s => s.classList.remove("active"));
        
            // 4. Tampilkan section yang sesuai dengan data-section menu
            const targetId = item.getAttribute("data-section");
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add("active");
            
            // Jika masuk ke Bank Soal, muat ulang data
            if(targetId === "section-bank-soal") {
                loadBankSoal(); 
            }
        }
    });
});

    // --- 2. FUNGSI MUAT BANK SOAL ---
    async function loadBankSoal() {
        bankContainer.innerHTML = "<p>Memuat data...</p>";
        
        try {
            const querySnapshot = await getDocs(collection(db, "bank_soal"));
            bankContainer.innerHTML = ""; // Kosongkan kontainer

            if (querySnapshot.empty) {
                bankContainer.innerHTML = "<p>Belum ada soal yang dibuat.</p>";
                return;
            }

            querySnapshot.forEach((documentSnapshot) => {
                const data = documentSnapshot.data();
                const id = documentSnapshot.id;

                const card = document.createElement("div");
                card.className = "card";
                card.style = "margin-bottom: 15px; padding: 15px; border-left: 5px solid var(--primary); background: #fafafa;";
                
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <span class="q-type-badge">${data.tipe.toUpperCase()}</span>
                            <p style="margin-top: 10px; font-weight: bold;">${data.pertanyaan}</p>
                            <ul style="margin: 10px 0 0 20px; font-size: 0.9rem; color: #555;">
                                <li>A. ${data.pilihan[0]}</li>
                                <li>B. ${data.pilihan[1]}</li>
                                <li>C. ${data.pilihan[2]}</li>
                                <li>D. ${data.pilihan[3]}</li>
                                <li>E. ${data.pilihan[4]}</li>
                            </ul>
                            <p style="margin-top: 10px; color: var(--primary-dark); font-weight: bold;">Kunci: ${data.kunciJawaban}</p>
                        </div>
                        <button class="btn-hapus" data-id="${id}" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Hapus</button>
                    </div>
                `;
                bankContainer.appendChild(card);
            });

            // Tambahkan event listener untuk tombol hapus
            document.querySelectorAll(".btn-hapus").forEach(btn => {
                btn.onclick = async () => {
                    if (confirm("Apakah Anda yakin ingin menghapus soal ini?")) {
                        const docId = btn.getAttribute("data-id");
                        await deleteDoc(doc(db, "bank_soal", docId));
                        loadBankSoal(); // Refresh daftar
                    }
                };
            });

        } catch (error) {
            console.error("Error loading bank soal:", error);
            bankContainer.innerHTML = "<p>Gagal memuat data.</p>";
        }
    }

    // --- 3. LOGIKA SIMPAN SOAL (Sama seperti sebelumnya) ---
    const formBuatSoal = document.getElementById("form-buat-soal");
    if(formBuatSoal) {
        formBuatSoal.onsubmit = async (e) => {
            e.preventDefault();
            // ... (logika addDoc Anda yang sudah ada) ...
            // Setelah success, tambahkan: 
            // alert("Berhasil!"); formBuatSoal.reset();
        };
    }

    // --- 4. LOGOUT ---
    document.getElementById("btn-logout").onclick = async () => {
        await signOut(auth);
        window.location.href = "index.html";
    };
});