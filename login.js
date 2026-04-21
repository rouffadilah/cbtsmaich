// login.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", function() {
    const loginForm = document.getElementById("login-form");

    if(loginForm) {
        loginForm.addEventListener("submit", async function(e) {
            e.preventDefault(); 

            const btnSubmit = document.querySelector(".btn-login");
            btnSubmit.innerHTML = "MENCOCOKKAN DATA...";
            btnSubmit.disabled = true;

            const inputUsername = document.getElementById("username").value;
            const inputPassword = document.getElementById("password").value;
            const loginRole = document.getElementById("login-role").value; // AMBIL ROLE

            const dummyEmail = inputUsername + "@cbt.smaich.id";

            try {
                const userCredential = await signInWithEmailAndPassword(auth, dummyEmail, inputPassword);
                const userName = userCredential.user.displayName || inputUsername;

                alert("Login Berhasil! Selamat Datang, " + userName);
                
                // --- LOGIKA PENGALIHAN HALAMAN ---
                if (loginRole === "guru") {
                    window.location.href = "guru-dashboard.html"; // Ke Dashboard Guru
                } else {
                    window.location.href = "attempt.html"; // Ke Halaman Ujian Siswa
                }

            } catch (error) {
                console.error("Login Error:", error);
                if (error.code === 'auth/invalid-credential') {
                    alert("Nomor Peserta atau Password salah!");
                } else {
                    alert("Terjadi kesalahan: " + error.message);
                }
                
                btnSubmit.innerHTML = "MASUK KE UJIAN";
                btnSubmit.disabled = false;
            }
        });
    }
});