import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    // --- CEK DARK MODE ---
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
    const registerForm = document.getElementById("register-form");
    const btnSubmit = document.getElementById("btn-submit");
    const regStatus = document.getElementById("reg-status");
    const boxSiswa = document.getElementById("select-siswa");
    const boxGuru = document.getElementById("select-guru");
    const roleInput = document.getElementById("reg-role");
    const usernameLabel = document.getElementById("username-label");
    const regTitle = document.getElementById("reg-title");
    
    const setRegMessage = (type, message) => {
        if (!regStatus) return;
        regStatus.className = `auth-status ${type}`;
        regStatus.textContent = message;
    };

    const setSubmittingState = (isSubmitting) => {
        if (!btnSubmit) return;
        btnSubmit.disabled = isSubmitting;
        const defaultText = btnSubmit.dataset.defaultText || btnSubmit.textContent;
        btnSubmit.innerHTML = isSubmitting ? "<i class='fas fa-spinner fa-spin'></i> MEMPROSES..." : defaultText;
    };
    
    let statusRegSiswa = true;
    let statusRegGuru = true;

    async function fetchRegStatus() {
        setRegMessage('info', 'Memuat pengaturan pendaftaran dan data akademik...');
        try {
            const regSnap = await getDoc(doc(db, "pengaturan", "status_registrasi"));
            if(regSnap.exists()) {
                statusRegSiswa = regSnap.data().siswa_aktif !== false; 
                statusRegGuru = regSnap.data().guru_aktif !== false; 
            }

            const akademikSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
            if(akademikSnap.exists()) {
                const data = akademikSnap.data();
                const listKelas = data.list_kelas || [];
                const listMapel = data.list_mapel || [];

                const selectKelasSiswa = document.getElementById("reg-kelas-siswa");
                if(selectKelasSiswa) {
                    selectKelasSiswa.innerHTML = '<option value="" disabled selected>Pilih Kelas...</option>' + 
                        listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
                }

                const containerMapel = document.getElementById("reg-mapel-container");
                if(containerMapel) {
                    containerMapel.innerHTML = listMapel.map(m => `<label><input type="checkbox" class="reg-mapel-cb" value="${m}"> ${m}</label>`).join('');
                }

                const containerKelasGuru = document.getElementById("reg-kelas-guru-container");
                if(containerKelasGuru) {
                    containerKelasGuru.innerHTML = listKelas.map(k => `<label><input type="checkbox" class="reg-kelas-cb" value="${k}"> ${k}</label>`).join('');
                }
            }
            updateRegUI(roleInput.value);
        } catch(e) { 
            console.error("Gagal menarik data awal", e); 
        }
    }

    function updateRegUI(role) {
        const warningBox = document.getElementById("reg-warning");
        let isAllowed = true;
        if (role === 'siswa' && !statusRegSiswa) isAllowed = false;
        if (role === 'guru' && !statusRegGuru) isAllowed = false;

        if (!isAllowed) {
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = '0.5';
            btnSubmit.innerHTML = '<i class="fas fa-lock"></i> PENDAFTARAN DITUTUP';
            warningBox.style.display = 'block';
            warningBox.innerHTML = `<i class="fas fa-lock"></i> Pendaftaran form <b>${role.toUpperCase()}</b> saat ini ditutup oleh Admin.`;
            setRegMessage('error', `Pendaftaran ${role.toUpperCase()} sedang ditutup. Silakan kembali nanti.`);
        } else {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
            btnSubmit.innerHTML = btnSubmit.dataset.defaultText || 'DAFTAR MANUAL'; 
            warningBox.style.display = 'none';
            setRegMessage('info', `Pilih jenis akun ${role === 'guru' ? 'guru' : 'siswa'} dan lengkapi formulir di bawah ini.`);
        }
    }

    function setRole(role) {
        roleInput.value = role;
        const groupKelasSiswa = document.getElementById("group-kelas-siswa");
        const groupMapelGuru = document.getElementById("group-mapel-guru");
        const groupKelasGuru = document.getElementById("group-kelas-guru");
        const inputKelasSiswa = document.getElementById("reg-kelas-siswa");
        const inputUsername = document.getElementById("reg-username");
        const lblRoleMassal = document.getElementById("lbl-role-massal");

        if (role === 'guru') {
            regTitle.innerText = "REGISTRASI GURU";
            usernameLabel.innerText = "ID Guru";
            lblRoleMassal.innerText = "Guru";
            boxGuru.classList.add('active');
            boxSiswa.classList.remove('active');
            
            inputUsername.placeholder = "Contoh: E24H6-223";
            inputUsername.removeAttribute("inputmode");
            inputUsername.setAttribute("maxlength", "9");
            
            if(groupKelasSiswa) groupKelasSiswa.style.display = 'none';
            if(groupMapelGuru) groupMapelGuru.style.display = 'block';
            if(groupKelasGuru) groupKelasGuru.style.display = 'block';
            if(inputKelasSiswa) inputKelasSiswa.removeAttribute("required");
        } else {
            regTitle.innerText = "REGISTRASI SISWA";
            usernameLabel.innerText = "Nomor Peserta / NIS";
            lblRoleMassal.innerText = "Siswa";
            boxSiswa.classList.add('active');
            boxGuru.classList.remove('active');
            
            inputUsername.placeholder = "Masukkan NIS (10 Digit Angka)";
            inputUsername.setAttribute("inputmode", "numeric");
            inputUsername.setAttribute("maxlength", "10");

            if(groupKelasSiswa) groupKelasSiswa.style.display = 'block';
            if(groupMapelGuru) groupMapelGuru.style.display = 'none';
            if(groupKelasGuru) groupKelasGuru.style.display = 'none';
            if(inputKelasSiswa) inputKelasSiswa.setAttribute("required", "true");
        }
        updateRegUI(role); 
    }

    boxSiswa.addEventListener('click', () => setRole('siswa'));
    boxGuru.addEventListener('click', () => setRole('guru'));

    fetchRegStatus();

    // ====================================================
    // FITUR BARU: DOWNLOAD TEMPLATE & IMPORT EXCEL MASSAL
    // ====================================================
    document.getElementById('btn-download-template')?.addEventListener('click', () => {
        const role = roleInput.value;
        let templateData = [];
        let filename = "";

        if (role === 'siswa') {
            templateData = [
                { "Nama Lengkap": "Ahmad Fulan", "NIS": "1029384756", "Password": "password123", "Kelas": "X-1" },
                { "Nama Lengkap": "Budi Santoso", "NIS": "1029384757", "Password": "password123", "Kelas": "X-2" }
            ];
            filename = "Template_Registrasi_Siswa.xlsx";
        } else {
            templateData = [
                { "Nama Lengkap": "Pak Guru Budi", "ID Guru": "E24H6-223", "Password": "password123", "Mata Pelajaran (Pisahkan koma)": "Informatika, Jaringan", "Kelas Ajar (Pisahkan koma)": "X-1, X-2, XI-1" }
            ];
            filename = "Template_Registrasi_Guru.xlsx";
        }

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data Registrasi");
        XLSX.writeFile(workbook, filename);
    });

    document.getElementById('upload-massal')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const role = roleInput.value;
        if (role === 'siswa' && !statusRegSiswa) return alert("Pendaftaran Massal Siswa sedang ditutup!");
        if (role === 'guru' && !statusRegGuru) return alert("Pendaftaran Massal Guru sedang ditutup!");

        if (!confirm(`TINDAKAN OTOMATIS: Anda yakin ingin mengimpor dan mendaftarkan banyak akun ${role.toUpperCase()} sekaligus dari file Excel ini?`)) {
            e.target.value = ''; return;
        }

        const statusLabel = document.getElementById('mass-upload-status');
        statusLabel.style.display = 'block';

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) throw new Error("Data Excel tidak ditemukan / kosong!");

                let successCount = 0; let errorCount = 0;

                // --- 1. AMBIL DATA MASTER YANG SUDAH ADA SAAT INI ---
                const akademikSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
                let masterMapel = [];
                let masterKelas = [];
                if (akademikSnap.exists()) {
                    masterMapel = akademikSnap.data().list_mapel || [];
                    masterKelas = akademikSnap.data().list_kelas || [];
                }
                let dataMasterBerubah = false;

                for (let row of jsonData) {
                    let nama = row['Nama Lengkap'] ? String(row['Nama Lengkap']).trim() : '';
                    let username = '';
                    
                    if (role === 'siswa') username = row['NIS'] ? String(row['NIS']).trim() : '';
                    else username = row['ID Guru'] ? String(row['ID Guru']).trim() : '';
                    
                    username = username.replace(/\s+/g, '').toUpperCase();
                    let password = row['Password'] ? String(row['Password']) : '123456';

                    if (!nama || !username) { errorCount++; continue; }

                    let payload = { nama, username, createdAt: serverTimestamp(), role: [role] };
                    
                    if (role === 'siswa') {
                        payload.kelas = row['Kelas'] ? String(row['Kelas']).trim() : '';
                        
                        // Otomatis deteksi Kelas baru dari Siswa
                        if (payload.kelas && !masterKelas.includes(payload.kelas)) {
                            masterKelas.push(payload.kelas);
                            dataMasterBerubah = true;
                        }
                    } else {
                        payload.mapel = row['Mata Pelajaran (Pisahkan koma)'] ? String(row['Mata Pelajaran (Pisahkan koma)']).split(',').map(s=>s.trim()) : [];
                        payload.kelas = row['Kelas Ajar (Pisahkan koma)'] ? String(row['Kelas Ajar (Pisahkan koma)']).split(',').map(s=>s.trim()) : [];
                    }

                    // --- 2. CEK & UPDATE ARRAY MAPEL BARU (JIKA ADA) ---
                    if (payload.mapel && payload.mapel.length > 0) {
                        payload.mapel.forEach(m => {
                            if (m && !masterMapel.includes(m)) {
                                masterMapel.push(m);
                                dataMasterBerubah = true;
                            }
                        });
                    }

                    // --- 3. CEK & UPDATE ARRAY KELAS AJAR BARU DARI GURU (JIKA ADA) ---
                    if (payload.kelas && Array.isArray(payload.kelas)) {
                        payload.kelas.forEach(k => {
                            if (k && !masterKelas.includes(k)) {
                                masterKelas.push(k);
                                dataMasterBerubah = true;
                            }
                        });
                    }

                    const dummyEmail = `${username}@cbt.smaich.id`;

                    try {
                        const userCred = await createUserWithEmailAndPassword(auth, dummyEmail, password);
                        await updateProfile(userCred.user, { displayName: nama });
                        await setDoc(doc(db, "users", userCred.user.uid), payload);
                        successCount++;
                    } catch(err) {
                        console.error("Gagal mendaftarkan:", username, err);
                        errorCount++;
                    }
                    await new Promise(r => setTimeout(r, 400));
                }

                // --- 4. SIMPAN PERUBAHAN MAPEL/KELAS BARU KE DATABASE ---
                if (dataMasterBerubah) {
                    await setDoc(doc(db, "pengaturan", "data_akademik"), {
                        list_mapel: masterMapel,
                        list_kelas: masterKelas
                    }, { merge: true });
                }

                setRegMessage('success', `Registrasi massal selesai. Berhasil: ${successCount} akun, gagal: ${errorCount}. Sistem memperbarui data master jika diperlukan.`);
                window.location.href = "index.html";

            } catch (error) {
                setRegMessage('error', 'Gagal memproses file Excel: ' + error.message);
                statusLabel.style.display = 'none';
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    });

    // ====================================================
    // PENDAFTARAN MANUAL
    // ====================================================
    registerForm?.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        const role = roleInput.value;
        
        if (role === 'siswa' && !statusRegSiswa) {
            setRegMessage('error', 'Pendaftaran siswa sedang ditutup.');
            return;
        }
        if (role === 'guru' && !statusRegGuru) {
            setRegMessage('error', 'Pendaftaran guru sedang ditutup.');
            return;
        }
        
        const name = document.getElementById("reg-name").value.trim();
        const username = document.getElementById("reg-username").value.replace(/\s+/g, '').toUpperCase();
        const password = document.getElementById("reg-password").value;

        if (!name) {
            setRegMessage('error', 'Nama lengkap wajib diisi.');
            return;
        }

        if(password !== document.getElementById("reg-confirm-password").value) {
            setRegMessage('error', 'Password tidak cocok. Periksa kembali pengisian.');
            return;
        }

        if (password.length < 6) {
            setRegMessage('error', 'Password minimal 6 karakter untuk keamanan akun.');
            return;
        }

        if (role === 'siswa') {
            const isNumeric = /^\d+$/.test(username);
            if (!isNumeric) {
                setRegMessage('error', 'NIS siswa harus berupa angka.');
                return;
            }
            if (username.length !== 10) {
                setRegMessage('error', 'NIS harus berjumlah 10 digit angka.');
                return;
            }
        } else if (role === 'guru') {
            const regexGuru = /^[A-Z]\d{2}[A-Z]\d-\d{3}$/;
            if (!regexGuru.test(username)) {
                setRegMessage('error', 'Format ID Guru tidak sesuai. Contoh: E24H6-223.');
                return;
            }
        }

        setSubmittingState(true);
        setRegMessage('info', 'Mendaftarkan akun baru...');

        const dummyEmail = `${username}@cbt.smaich.id`;

        try {
            let payload = {
                nama: name,
                username: username,
                createdAt: serverTimestamp()
            };

            if (role === 'siswa') {
                payload.role = ['siswa'];
                payload.kelas = document.getElementById("reg-kelas-siswa").value;
            } else if (role === 'guru') {
                payload.role = ['guru'];

                const mapelTerpilih = Array.from(document.querySelectorAll('.reg-mapel-cb:checked')).map(cb => cb.value);
                const kelasTerpilih = Array.from(document.querySelectorAll('.reg-kelas-cb:checked')).map(cb => cb.value);
                
                if (mapelTerpilih.length === 0 || kelasTerpilih.length === 0) {
                    setRegMessage('error', 'Pilih minimal 1 mata pelajaran dan 1 kelas ajar.');
                    return;
                }
                
                payload.mapel = mapelTerpilih;
                payload.kelas = kelasTerpilih;
            }

            const userCred = await createUserWithEmailAndPassword(auth, dummyEmail, password);
            const user = userCred.user;
            await updateProfile(user, { displayName: name });

            await setDoc(doc(db, "users", user.uid), payload);

            setRegMessage('success', `Akun ${role.toUpperCase()} berhasil dibuat. Anda akan diarahkan ke halaman masuk.`);
            window.location.href = "index.html";

        } catch (error) {
            let msg = "Terjadi kesalahan saat menyimpan akun.";
            if (error.code === 'auth/email-already-in-use') msg = "ID/Username sudah terdaftar!";
            if (error.code === 'auth/weak-password') msg = "Password minimal 6 karakter!";
            
            setRegMessage('error', msg);
        } finally {
            setSubmittingState(false);
        }
    });
});
