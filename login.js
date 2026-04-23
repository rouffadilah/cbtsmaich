import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const roleSelect = document.getElementById("login-role");
    const btnSubmit = document.getElementById("btn-submit");
    const portalTitle = document.getElementById("portal-title");

    roleSelect?.addEventListener("change", function() {
        const isGuru = this.value === "guru";
        portalTitle.innerText = isGuru ? "PORTAL GURU SMAICH" : "CBT SMAICH";
        btnSubmit.innerText = isGuru ? "MASUK PANEL KONTROL" : "MASUK KE UJIAN";
    });

    loginForm?.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = "MEMPROSES...";
        btnSubmit.disabled = true;

        const inputUsername = document.getElementById("username").value;
        const loginRole = roleSelect.value;
        const dummyEmail = `${inputUsername}@cbt.smaich.id`;

        try {
            await signInWithEmailAndPassword(auth, dummyEmail, document.getElementById("password").value);
            localStorage.setItem("userRole", loginRole);
            
            window.location.href = loginRole === "guru" ? "guru-dashboard.html" : "attempt.html";
        } catch (error) {
            alert(error.code === 'auth/invalid-credential' ? "Kredensial salah!" : `Error: ${error.message}`);
            btnSubmit.innerHTML = originalBtnText;
            btnSubmit.disabled = false;
        }
    });
});