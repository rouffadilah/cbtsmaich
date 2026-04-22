// guru.js
import { auth, db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. NAVIGASI MENU SIDEBAR ---
    const menuItems = document.querySelectorAll(".option-item");
    const sections = document.querySelectorAll(".content-section");

    menuItems.forEach(item => {
        item.addEventListener("click", function() {
            // Hilangkan class selected dari semua menu
            menuItems.forEach(i => i.classList.remove("selected"));
            
            // Tambahkan class selected ke menu yang diklik
            this.classList.add("selected");

            // Sembunyikan semua section
            sections.forEach(s => s.classList.remove("active"));
        
            // Tampilkan section yang sesuai dengan data-section
            const targetId = this.getAttribute("data-section");
            if (targetId) {
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.classList.add("active");
                }
            }
        });
    });

    // --- 4. FITUR TAMPIL NAMA FILE SAAT DI UPLOAD ---
    const fileInput = document.getElementById("file-upload");
    const fileNameDisplay = document.getElementById("file-name-display");
    if(fileInput && fileNameDisplay) {
        fileInput.addEventListener("change", function() {
            if(this.files.length > 0) {
                fileNameDisplay.innerHTML = `<i class="fas fa-file-excel"></i> File terpilih: ${this.files[0].name}`;
            }
        });
    }

    // --- 5. FITUR PENCARIAN (SEARCH) DATA SISWA SECARA REALTIME ---
    const searchInput = document.getElementById("search-siswa");
    if(searchInput) {
        searchInput.addEventListener("keyup", function() {
            let filter = this.value.toLowerCase();
            let rows = document.querySelectorAll("#table-siswa tbody tr");

            rows.forEach(row => {
                let text = row.innerText.toLowerCase();
                if(text.includes(filter)) {
                    row.style.display = ""; // Tampilkan
                } else {
                    row.style.display = "none"; // Sembunyikan
                }
            });
        });
    }

    // --- 2. LOGIKA UPLOAD SOAL ---
    const uploadForm = document.getElementById("upload-soal-form");
    if(uploadForm) {
        uploadForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            alert("Data sedang diproses untuk disimpan ke database...");
        });
    }

    // --- 3. LOGOUT ---
    const btnLogout = document.getElementById("btn-logout");
    if(btnLogout) {
        btnLogout.addEventListener("click", async () => {
            if(confirm("Yakin ingin keluar dari panel kontrol?")) {
                try {
                    await signOut(auth);
                    window.location.href = "index.html";
                } catch (error) {
                    console.error("Error saat logout:", error);
                }
            }
        });
    }
});
