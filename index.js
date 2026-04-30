import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================
// 1. ELEMEN DOM & KONSTANTA
// ==========================================
const ELEMENTS = {
    loginForm: document.getElementById("login-form"),
    roleSelect: document.getElementById("login-role"),
    btnSubmit: document.getElementById("btn-submit"),
    portalTitle: document.getElementById("portal-title"),
    usernameInput: document.getElementById("username"),
    passwordInput: document.getElementById("password")
};

const ROLES = {
    GURU: "guru",
    SISWA: "siswa"
};

// ==========================================
// 2. FUNGSI PENGENDALI UI (TAMPILAN)
// ==========================================

/**
 * Mengubah teks judul portal dan tombol berdasarkan role yang dipilih
 */
function handleRoleChange(event) {
    const isGuru = event.target.value === ROLES.GURU;
    
    // Animasi sederhana dengan transisi opacity
    ELEMENTS.portalTitle.style.opacity = 0;
    
    setTimeout(() => {
        ELEMENTS.portalTitle.innerText = isGuru ? "PORTAL GURU SMAICH" : "CBT SMAICH";
        ELEMENTS.btnSubmit.innerText = isGuru ? "MASUK PANEL KONTROL" : "MASUK KE UJIAN";
        ELEMENTS.portalTitle.style.opacity = 1;
    }, 150);
}

/**
 * Mengatur status tombol submit (loading / normal)
 */
function setSubmitState(isLoading, originalText = "") {
    if (isLoading) {
        ELEMENTS.btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMPROSES...';
        ELEMENTS.btnSubmit.disabled = true;
        ELEMENTS.btnSubmit.style.opacity = "0.8";
    } else {
        ELEMENTS.btnSubmit.innerHTML = originalText;
        ELEMENTS.btnSubmit.disabled = false;
        ELEMENTS.btnSubmit.style.opacity = "1";
    }
}

/**
 * Mengonversi kode error Firebase menjadi pesan yang ramah pengguna
 */
function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-credential':
            return "Username atau Password salah!";
        case 'auth/network-request-failed':
            return "Koneksi internet terputus. Silakan periksa jaringan Anda.";
        case 'auth/user-not-found':
            return "Akun tidak ditemukan.";
        default:
            return "Terjadi kesalahan saat masuk. Silakan coba lagi.";
    }
}

// ==========================================
// 3. FUNGSI AUTENTIKASI (LOGIN LOGIC)
// ==========================================

/**
 * Memproses pengiriman form login
 */
async function handleLogin(event) {
    event.preventDefault(); 
    
    const originalBtnText = ELEMENTS.btnSubmit.innerHTML;
    setSubmitState(true); // Aktifkan mode loading

    const username = ELEMENTS.usernameInput.value.trim();
    const password = ELEMENTS.passwordInput.value;
    const loginRole = ELEMENTS.roleSelect.value;
    
    // Format email dummy sesuai sistem
    const dummyEmail = `${username}@cbt.smaich.id`;

    try {
        // Proses Autentikasi Firebase
        await signInWithEmailAndPassword(auth, dummyEmail, password);

        // Simpan role ke local storage untuk otorisasi di halaman selanjutnya
        localStorage.setItem("userRole", loginRole);
        
        // Redirect sesuai role
        if (loginRole === ROLES.GURU) {
            window.location.href = "dashboard.html"; 
        } else {
            window.location.href = "attempt.html";
        }

    } catch (error) {
        console.error("Login Error:", error.code);
        
        // Tampilkan pesan error
        alert(getErrorMessage(error.code));
        
        // Kembalikan tombol ke status awal
        setSubmitState(false, originalBtnText);
    }
}

// ==========================================
// 4. INISIALISASI EVENT LISTENER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Pastikan elemen ada sebelum menambahkan event listener untuk mencegah error
    if (ELEMENTS.roleSelect) {
        ELEMENTS.roleSelect.addEventListener("change", handleRoleChange);
    }

    if (ELEMENTS.loginForm) {
        ELEMENTS.loginForm.addEventListener("submit", handleLogin);
    }
});