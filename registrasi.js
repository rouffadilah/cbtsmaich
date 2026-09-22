import { auth, db, firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { onAuthStateChanged, getAuth, signOut as signOutAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
    let isAdminRegistrar = false;
    let selectedAdminRoles = ['siswa'];
    const ADMIN_CREATOR_APP_NAME = 'cbt-admin-registration-creator';

    const REG_ACADEMIC_CACHE_KEY = 'cbt_academic_master_cache_v2';
    const REG_ACADEMIC_CACHE_TTL = 10 * 60 * 1000;

    function readRegistrationAcademicCache() {
        try {
            const raw = localStorage.getItem(REG_ACADEMIC_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.listMapel) || !Array.isArray(parsed.listKelas)) return null;
            if (parsed.savedAt && (Date.now() - parsed.savedAt) > REG_ACADEMIC_CACHE_TTL) return null;
            return parsed;
        } catch (e) { return null; }
    }

    function writeRegistrationAcademicCache(listMapel, listKelas) {
        try {
            localStorage.setItem(REG_ACADEMIC_CACHE_KEY, JSON.stringify({ listMapel, listKelas, savedAt: Date.now() }));
        } catch (e) {}
    }

    function getAdminCreatorAuth() {
        const existing = getApps().find(app => app.name === ADMIN_CREATOR_APP_NAME);
        const app = existing || initializeApp(firebaseConfig, ADMIN_CREATOR_APP_NAME);
        return getAuth(app);
    }

    const escapeHtml = (value) => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const escapeAttr = (value) => escapeHtml(value).replace(/"/g,'&quot;').replace(/'/g,'&#39;');

    function syncAdminSelectAll(allId, selector) {
        const all = document.getElementById(allId);
        const boxes = Array.from(document.querySelectorAll(selector));
        if (!all) return;
        const checkedCount = boxes.filter(cb => cb.checked).length;
        all.checked = boxes.length > 0 && checkedCount === boxes.length;
        all.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
    }

    function buildAdminCheckboxGroup(containerId, allId, checkboxClass, items, selectedValues = []) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const selected = new Set(selectedValues);
        container.innerHTML = `
            <label style="display:flex;align-items:center;gap:8px;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid #bfdbfe;font-weight:800;color:#1d4ed8;">
                <input type="checkbox" id="${allId}" class="select-all-checkbox"> <span>All</span>
            </label>` +
            items.map(item => `<label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" class="${checkboxClass}" value="${escapeAttr(item)}" ${selected.has(item) ? 'checked' : ''}> ${escapeHtml(item)}</label>`).join('');
        document.querySelectorAll(`.${checkboxClass}`).forEach(cb => cb.addEventListener('change', () => syncAdminSelectAll(allId, `.${checkboxClass}`)));
        document.getElementById(allId)?.addEventListener('change', () => {
            document.querySelectorAll(`.${checkboxClass}`).forEach(cb => cb.checked = document.getElementById(allId).checked);
            syncAdminSelectAll(allId, `.${checkboxClass}`);
            if (checkboxClass === 'reg-admin-role-cb') {
                selectedAdminRoles = Array.from(document.querySelectorAll('.reg-admin-role-cb:checked')).map(cb => cb.value);
                syncRegistrationRoleUI();
            }
        });
        syncAdminSelectAll(allId, `.${checkboxClass}`);
    }

    function getRegistrationRoles() {
        return isAdminRegistrar
            ? Array.from(document.querySelectorAll('.reg-admin-role-cb:checked')).map(cb => cb.value)
            : [roleInput.value];
    }

    function syncRegistrationRoleUI() {
        const roles = getRegistrationRoles();
        const hasStudent = roles.includes('siswa');
        const hasTeacher = roles.includes('guru');
        const groupKelasSiswa = document.getElementById('group-kelas-siswa');
        const groupKelasAdmin = document.getElementById('group-kelas-admin');
        const groupMapelGuru = document.getElementById('group-mapel-guru');
        const groupKelasGuru = document.getElementById('group-kelas-guru');
        const inputKelasSiswa = document.getElementById('reg-kelas-siswa');
        const lblRoleMassal = document.getElementById('lbl-role-massal');

        const primaryRole = roles.length === 1 ? roles[0] : (hasTeacher ? 'guru' : 'siswa');
        roleInput.value = primaryRole;
        if (lblRoleMassal) lblRoleMassal.innerText = primaryRole === 'guru' ? 'Guru' : 'Siswa';

        if (roles.length === 0) {
            regTitle.innerText = 'REGISTRASI AKUN';
            usernameLabel.innerText = 'Username / NIS / ID Guru';
        } else if (roles.length === 1 && roles[0] === 'siswa') {
            regTitle.innerText = 'REGISTRASI SISWA';
            usernameLabel.innerText = 'Nomor Peserta / NIS';
        } else if (roles.length === 1 && roles[0] === 'guru') {
            regTitle.innerText = 'REGISTRASI GURU';
            usernameLabel.innerText = 'ID Guru';
        } else {
            regTitle.innerText = 'REGISTRASI MULTI-ROLE';
            usernameLabel.innerText = 'Username / NIS / ID Guru';
        }

        boxSiswa.classList.toggle('active', roles.length === 1 && roles[0] === 'siswa');
        boxGuru.classList.toggle('active', roles.length === 1 && roles[0] === 'guru');

        if (isAdminRegistrar) {
            if (groupKelasSiswa) groupKelasSiswa.style.display = 'none';
            if (groupKelasGuru) groupKelasGuru.style.display = 'none';
            if (groupKelasAdmin) groupKelasAdmin.style.display = (hasStudent || hasTeacher) ? 'block' : 'none';
            if (groupMapelGuru) groupMapelGuru.style.display = hasTeacher ? 'block' : 'none';
            if (inputKelasSiswa) inputKelasSiswa.removeAttribute('required');
        } else {
            if (groupKelasAdmin) groupKelasAdmin.style.display = 'none';
            if (groupKelasSiswa) groupKelasSiswa.style.display = hasStudent && !hasTeacher ? 'block' : 'none';
            if (groupMapelGuru) groupMapelGuru.style.display = hasTeacher ? 'block' : 'none';
            if (groupKelasGuru) groupKelasGuru.style.display = hasTeacher ? 'block' : 'none';
            if (inputKelasSiswa) hasStudent && !hasTeacher ? inputKelasSiswa.setAttribute('required','true') : inputKelasSiswa.removeAttribute('required');
        }

        if (roles.includes('siswa') && roles.includes('guru')) {
            if (groupMapelGuru) groupMapelGuru.style.display = 'block';
        }

        updateRegUI();
    }

    async function detectAdminRegistrationMode() {
        let user = auth.currentUser;
        if (!user) {
            user = await new Promise(resolve => {
                let done = false;
                const unsub = onAuthStateChanged(auth, authUser => {
                    if (done) return;
                    done = true;
                    unsub();
                    resolve(authUser || null);
                });
                setTimeout(() => {
                    if (!done) { done = true; unsub(); resolve(auth.currentUser || null); }
                }, 2500);
            });
        }

        try {
            if (user) {
                const profileSnap = await getDoc(doc(db, 'users', user.uid));
                const roles = profileSnap.exists()
                    ? (Array.isArray(profileSnap.data().role) ? profileSnap.data().role : [profileSnap.data().role])
                    : [];
                isAdminRegistrar = roles.includes('admin');
            } else {
                isAdminRegistrar = false;
            }
        } catch (e) {
            isAdminRegistrar = false;
        }

        if (isAdminRegistrar) {
            document.getElementById('admin-registration-options').style.display = 'block';
            buildAdminCheckboxGroup('reg-role-admin-container', 'reg-role-all', 'reg-admin-role-cb', ['siswa','guru','admin'], ['siswa']);
            selectedAdminRoles = ['siswa'];
        } else {
            document.getElementById('admin-registration-options').style.display = 'none';
        }
        syncRegistrationRoleUI();
        return isAdminRegistrar;
    }

    function renderRegistrationAcademic(listKelas, listMapel) {
        const kelas = Array.from(new Set((listKelas || []).map(v => String(v).trim()).filter(Boolean)));
        const mapel = Array.from(new Set((listMapel || []).map(v => String(v).trim()).filter(Boolean)));
        const selectKelasSiswa = document.getElementById('reg-kelas-siswa');
        if (selectKelasSiswa) {
            selectKelasSiswa.innerHTML = '<option value="" disabled selected>Pilih Kelas...</option>' +
                kelas.map(k => `<option value="${escapeAttr(k)}">${escapeHtml(k)}</option>`).join('');
        }

        const containerMapel = document.getElementById('reg-mapel-container');
        if (containerMapel) {
            containerMapel.innerHTML = (isAdminRegistrar ? `<label style="display:flex;align-items:center;gap:8px;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--border-color);font-weight:800;color:var(--primary);"><input type="checkbox" id="reg-mapel-all" class="select-all-checkbox"> <span>All</span></label>` : '') +
                mapel.map(m => `<label><input type="checkbox" class="reg-mapel-cb" value="${escapeAttr(m)}"> ${escapeHtml(m)}</label>`).join('');
            if (isAdminRegistrar) {
                document.querySelectorAll('.reg-mapel-cb').forEach(cb => cb.addEventListener('change', () => syncAdminSelectAll('reg-mapel-all', '.reg-mapel-cb')));
                document.getElementById('reg-mapel-all')?.addEventListener('change', e => {
                    document.querySelectorAll('.reg-mapel-cb').forEach(cb => cb.checked = e.target.checked);
                    syncAdminSelectAll('reg-mapel-all', '.reg-mapel-cb');
                });
            }
        }

        const containerKelasGuru = document.getElementById('reg-kelas-guru-container');
        if (containerKelasGuru) {
            containerKelasGuru.innerHTML = (isAdminRegistrar ? `<label style="display:flex;align-items:center;gap:8px;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid var(--border-color);font-weight:800;color:var(--primary);"><input type="checkbox" id="reg-kelas-guru-all" class="select-all-checkbox"> <span>All</span></label>` : '') +
                kelas.map(k => `<label><input type="checkbox" class="reg-kelas-cb" value="${escapeAttr(k)}"> ${escapeHtml(k)}</label>`).join('');
            if (isAdminRegistrar) {
                document.querySelectorAll('.reg-kelas-cb').forEach(cb => cb.addEventListener('change', () => syncAdminSelectAll('reg-kelas-guru-all', '.reg-kelas-cb')));
                document.getElementById('reg-kelas-guru-all')?.addEventListener('change', e => {
                    document.querySelectorAll('.reg-kelas-cb').forEach(cb => cb.checked = e.target.checked);
                    syncAdminSelectAll('reg-kelas-guru-all', '.reg-kelas-cb');
                });
            }
        }

        const containerKelasAdmin = document.getElementById('reg-kelas-admin-container');
        if (containerKelasAdmin && isAdminRegistrar) {
            buildAdminCheckboxGroup('reg-kelas-admin-container', 'reg-kelas-admin-all', 'reg-kelas-admin-cb', kelas, []);
        }
        syncRegistrationRoleUI();
    }

    async function fetchRegStatus() {
        setRegMessage('info', 'Memuat data akademik...');
        try {
            // Tampilkan cache lebih dulu supaya daftar mapel/kelas langsung terlihat.
            const cached = readRegistrationAcademicCache();
            if (cached) renderRegistrationAcademic(cached.listKelas, cached.listMapel);

            const adminPromise = detectAdminRegistrationMode();
            const [regSnap, akademikSnap] = await Promise.all([
                getDoc(doc(db, 'pengaturan', 'status_registrasi')),
                getDoc(doc(db, 'pengaturan', 'data_akademik'))
            ]);
            await adminPromise;

            if (regSnap.exists()) {
                statusRegSiswa = regSnap.data().siswa_aktif !== false;
                statusRegGuru = regSnap.data().guru_aktif !== false;
            }

            let listKelas = cached?.listKelas || [];
            let listMapel = cached?.listMapel || [];
            if (akademikSnap.exists()) {
                const data = akademikSnap.data() || {};
                listKelas = Array.isArray(data.list_kelas) ? data.list_kelas : [];
                listMapel = Array.isArray(data.list_mapel) ? data.list_mapel : [];
                writeRegistrationAcademicCache(listMapel, listKelas);
            }
            renderRegistrationAcademic(listKelas, listMapel);
        } catch(e) {
            console.error('Gagal menarik data awal', e);
            setRegMessage('error', 'Data akademik belum dapat dimuat. Silakan coba lagi.');
        }
    }

    function updateRegUI() {
        const roles = getRegistrationRoles();
        const warningBox = document.getElementById('reg-warning');
        const hasStudent = roles.includes('siswa');
        const hasTeacher = roles.includes('guru');
        let isAllowed = true;
        if (!isAdminRegistrar) {
            if (hasStudent && !statusRegSiswa) isAllowed = false;
            if (hasTeacher && !statusRegGuru) isAllowed = false;
        }

        if (!isAllowed) {
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = '0.5';
            btnSubmit.innerHTML = '<i class="fas fa-lock"></i> PENDAFTARAN DITUTUP';
            warningBox.style.display = 'block';
            warningBox.innerHTML = `<i class="fas fa-lock"></i> Pendaftaran ${hasTeacher ? 'GURU' : 'SISWA'} saat ini ditutup oleh Admin.`;
            setRegMessage('error', 'Pendaftaran sedang ditutup. Silakan kembali nanti.');
        } else {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
            btnSubmit.innerHTML = btnSubmit.dataset.defaultText || 'DAFTAR MANUAL';
            warningBox.style.display = 'none';
            setRegMessage('info', isAdminRegistrar ? 'Mode Admin aktif. Anda dapat memilih multi-role dan All untuk mapel/kelas.' : `Pilih jenis akun ${hasTeacher ? 'guru' : 'siswa'} dan lengkapi formulir di bawah ini.`);
        }
    }

    function setRole(role) {
        roleInput.value = role;
        if (isAdminRegistrar) {
            selectedAdminRoles = [role];
            document.querySelectorAll('.reg-admin-role-cb').forEach(cb => cb.checked = selectedAdminRoles.includes(cb.value));
            syncAdminSelectAll('reg-role-all', '.reg-admin-role-cb');
        }
        syncRegistrationRoleUI();
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
        if (!isAdminRegistrar) {
            if (role === 'siswa' && !statusRegSiswa) return alert("Pendaftaran Massal Siswa sedang ditutup!");
            if (role === 'guru' && !statusRegGuru) return alert("Pendaftaran Massal Guru sedang ditutup!");
        }

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

                    const dummyEmail = `${username.toLowerCase()}@cbt.smaich.id`;

                    try {
                        const creatorAuth = isAdminRegistrar ? getAdminCreatorAuth() : auth;
                        const userCred = await createUserWithEmailAndPassword(creatorAuth, dummyEmail, password);
                        try {
                            await updateProfile(userCred.user, { displayName: nama });
                            await setDoc(doc(db, "users", userCred.user.uid), payload);
                            successCount++;
                        } catch (saveError) {
                            try { await userCred.user.delete(); } catch (_) {}
                            throw saveError;
                        }
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

                if (isAdminRegistrar) {
                    try { await signOutAuth(getAdminCreatorAuth()); } catch (_) {}
                    setRegMessage('success', `Registrasi massal selesai. Berhasil: ${successCount} akun, gagal: ${errorCount}. Sesi Admin tetap aktif.`);
                } else {
                    await auth.signOut();
                    setRegMessage('success', `Registrasi massal selesai. Berhasil: ${successCount} akun, gagal: ${errorCount}. Silakan kembali ke halaman login.`);
                    setTimeout(() => { window.location.href = "index.html"; }, 700);
                }

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
        const roles = getRegistrationRoles();
        const hasStudent = roles.includes('siswa');
        const hasTeacher = roles.includes('guru');

        if (!isAdminRegistrar) {
            if (hasStudent && !statusRegSiswa) {
                setRegMessage('error', 'Pendaftaran siswa sedang ditutup.');
                return;
            }
            if (hasTeacher && !statusRegGuru) {
                setRegMessage('error', 'Pendaftaran guru sedang ditutup.');
                return;
            }
        }

        if (roles.length === 0) {
            setRegMessage('error', 'Pilih minimal 1 role akun.');
            return;
        }

        const name = document.getElementById("reg-name").value.trim();
        const username = document.getElementById("reg-username").value.replace(/\s+/g, '').toUpperCase();
        const password = document.getElementById("reg-password").value;

        if (!name) {
            setRegMessage('error', 'Nama lengkap wajib diisi.');
            return;
        }
        if (!username) {
            setRegMessage('error', 'Username / NIS / ID Guru wajib diisi.');
            return;
        }
        if (password !== document.getElementById("reg-confirm-password").value) {
            setRegMessage('error', 'Password tidak cocok. Periksa kembali pengisian.');
            return;
        }
        if (password.length < 6) {
            setRegMessage('error', 'Password minimal 6 karakter untuk keamanan akun.');
            return;
        }

        const regexGuru = /^[A-Z]\d{2}[A-Z]\d-\d{3}$/;
        const isNis = /^\d{10}$/.test(username);
        const isIdGuru = regexGuru.test(username);

        if (hasStudent && !hasTeacher && !roles.includes('admin') && !isNis) {
            setRegMessage('error', 'NIS siswa harus berupa 10 digit angka.');
            return;
        }
        if (hasTeacher && !hasStudent && !roles.includes('admin') && !isIdGuru) {
            setRegMessage('error', 'Format ID Guru tidak sesuai. Contoh: E24H6-223.');
            return;
        }
        if (hasStudent && hasTeacher && !roles.includes('admin') && !(isNis || isIdGuru)) {
            setRegMessage('error', 'Untuk akun multi-role, gunakan NIS 10 digit atau ID Guru seperti E24H6-223.');
            return;
        }
        if (!hasStudent && !hasTeacher && roles.includes('admin') && !/^[A-Z0-9._-]{3,64}$/.test(username)) {
            setRegMessage('error', 'Username Admin hanya boleh berisi huruf, angka, titik, underscore, atau tanda hubung.');
            return;
        }

        try {
            const payload = {
                nama: name,
                username: username,
                role: roles,
                createdAt: serverTimestamp()
            };

            if (hasTeacher) {
                const mapelTerpilih = Array.from(document.querySelectorAll('.reg-mapel-cb:checked')).map(cb => cb.value);
                if (mapelTerpilih.length === 0) {
                    setRegMessage('error', 'Pilih minimal 1 mata pelajaran. Gunakan All untuk memilih semua mapel.');
                    return;
                }
                payload.mapel = mapelTerpilih;
            }

            if (hasStudent || hasTeacher) {
                if (isAdminRegistrar) {
                    const kelasTerpilih = Array.from(document.querySelectorAll('.reg-kelas-admin-cb:checked')).map(cb => cb.value);
                    if (kelasTerpilih.length === 0) {
                        setRegMessage('error', 'Pilih minimal 1 kelas. Gunakan All untuk memilih semua kelas.');
                        return;
                    }
                    payload.kelas = kelasTerpilih;
                } else if (hasTeacher) {
                    const kelasTerpilih = Array.from(document.querySelectorAll('.reg-kelas-cb:checked')).map(cb => cb.value);
                    if (kelasTerpilih.length === 0) {
                        setRegMessage('error', 'Pilih minimal 1 kelas ajar.');
                        return;
                    }
                    payload.kelas = kelasTerpilih;
                } else {
                    const kelasSiswa = document.getElementById("reg-kelas-siswa").value;
                    if (!kelasSiswa) {
                        setRegMessage('error', 'Pilih kelas siswa terlebih dahulu.');
                        return;
                    }
                    payload.kelas = kelasSiswa;
                }
            }

            const dummyEmail = `${username.toLowerCase()}@cbt.smaich.id`;
            setSubmittingState(true);
            setRegMessage('info', isAdminRegistrar ? 'Admin sedang membuat akun baru...' : 'Mendaftarkan akun baru...');

            const creatorAuth = isAdminRegistrar ? getAdminCreatorAuth() : auth;
            const userCred = await createUserWithEmailAndPassword(creatorAuth, dummyEmail, password);
            const newUser = userCred.user;
            try {
                await updateProfile(newUser, { displayName: name });
                await setDoc(doc(db, "users", newUser.uid), payload);
            } catch (saveError) {
                try { await newUser.delete(); } catch (_) {}
                throw saveError;
            } finally {
                if (isAdminRegistrar) {
                    try { await signOutAuth(creatorAuth); } catch (_) {}
                }
            }

            if (isAdminRegistrar) {
                setRegMessage('success', `Akun berhasil dibuat dengan role: ${roles.join(', ')}. Sesi Admin tetap aktif.`);
                registerForm.reset();
                selectedAdminRoles = ['siswa'];
                document.querySelectorAll('.reg-admin-role-cb').forEach(cb => cb.checked = cb.value === 'siswa');
                syncAdminSelectAll('reg-role-all', '.reg-admin-role-cb');
                document.querySelectorAll('.reg-mapel-cb, .reg-kelas-admin-cb, .reg-kelas-cb').forEach(cb => cb.checked = false);
                document.getElementById('reg-kelas-siswa').value = '';
                syncRegistrationRoleUI();
            } else {
                await auth.signOut();
                setRegMessage('success', `Akun ${roles[0].toUpperCase()} berhasil dibuat. Silakan login dengan username dan password baru.`);
                setTimeout(() => { window.location.href = "index.html"; }, 700);
            }

        } catch (error) {
            let msg = "Terjadi kesalahan saat menyimpan akun.";
            if (error.code === 'auth/email-already-in-use') msg = "ID/Username sudah terdaftar!";
            if (error.code === 'auth/weak-password') msg = "Password minimal 6 karakter!";
            if (error.code === 'permission-denied') msg = "Akses ditolak. Pastikan akun Admin memang memiliki role admin.";
            setRegMessage('error', msg);
        } finally {
            setSubmittingState(false);
        }
    }););
});
