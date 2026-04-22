// registrasi.js
import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", function() {
    const registerForm = document.getElementById("register-form");

    if(registerForm) {
        registerForm.addEventListener("submit", async function(e) {
            e.preventDefault(); 

            // Ubah tombol jadi loading
            const btnSubmit = document.querySelector(".btn-login");
            btnSubmit.innerHTML = "MEMPROSES...";
            btnSubmit.disabled = true;

            const name = document.getElementById("reg-name").value;
            const username = document.getElementById("reg-username").value;
            const password = document.getElementById("reg-password").value;
            const confirmPassword = document.getElementById("reg-confirm-password").value;

            if(password !== confirmPassword) {
                alert("Pendaftaran Gagal: Password dan Konfirmasi Password tidak cocok!");
                btnSubmit.innerHTML = "DAFTAR SEKARANG";
                btnSubmit.disabled = false;
                return;
            }

            // Trik: Ubah username jadi format email agar diterima Firebase
            const dummyEmail = username + "@cbt.smaich.id";

            try {
                // 1. Buat User di Firebase
                const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, password);
                
                // 2. Simpan Nama Lengkap ke Profil Firebase
                await updateProfile(userCredential.user, {
                    displayName: name
                });

                alert("Registrasi Berhasil! Silakan login.");
                window.location.href = "index.html";

            } catch (error) {
                // Tangani error dari Firebase (misal: username sudah dipakai)
                if (error.code === 'auth/email-already-in-use') {
                    alert("Gagal: Nomor Peserta ini sudah terdaftar!");
                } else if (error.code === 'auth/weak-password') {
                    alert("Gagal: Password minimal harus 6 karakter!");
                } else {
                    alert("Error: " + error.message);
                }
                btnSubmit.innerHTML = "DAFTAR SEKARANG";
                btnSubmit.disabled = false;
            }
        });
    }
});
