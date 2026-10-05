import { auth } from './firebase-config.js';

(function () {
  const PASSWORD_ID = 'edit-login-password';
  const CONFIRM_ID = 'edit-login-password-confirm';
  const STYLE_ID = 'admin-login-edit-style';

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #admin-login-credentials { margin: 12px 0 16px; padding: 14px; border: 1px solid #bfdbfe; background:#eff6ff; border-radius:10px; }
      #admin-login-credentials .cred-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      #admin-login-credentials label { display:block; font-size:.78rem; font-weight:700; color:#334155; margin-bottom:5px; }
      #admin-login-credentials input { width:100%; }
      #admin-login-credentials .hint { font-size:.72rem; color:#64748b; margin-top:5px; }
      @media(max-width:600px){ #admin-login-credentials .cred-grid { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function ensureCredentialFields() {
    const modal = document.getElementById('modal-edit-akun');
    const username = document.getElementById('edit-username');
    const save = document.getElementById('btn-save-edit-akun');
    if (!modal || !username || !save) return false;
    addStyle();

    username.readOnly = false;
    username.removeAttribute('readonly');
    username.style.background = 'white';
    username.setAttribute('autocomplete', 'username');
    username.placeholder = 'Username login baru';

    if (!document.getElementById('admin-login-credentials')) {
      const box = document.createElement('div');
      box.id = 'admin-login-credentials';
      box.innerHTML = `
        <div style="font-weight:800;color:#1e40af;margin-bottom:10px;"><i class="fas fa-key"></i> Kredensial Login</div>
        <div class="cred-grid">
          <div>
            <label for="${PASSWORD_ID}">Password Baru</label>
            <input type="password" id="${PASSWORD_ID}" class="input-text" autocomplete="new-password" placeholder="Kosongkan jika tidak diubah">
            <div class="hint">Minimal 6 karakter.</div>
          </div>
          <div>
            <label for="${CONFIRM_ID}">Konfirmasi Password</label>
            <input type="password" id="${CONFIRM_ID}" class="input-text" autocomplete="new-password" placeholder="Ulangi password baru">
          </div>
        </div>
        <div style="margin-top:9px;font-size:.75rem;color:#475569;"><i class="fas fa-info-circle"></i> Username dan password ini akan menjadi kredensial login Firebase pengguna.</div>
      `;
      save.parentElement.insertBefore(box, save);
    }

    // Replace the original button once so the old profile-only listener cannot run.
    if (!save.dataset.adminCredentialHandler) {
      const replacement = save.cloneNode(true);
      replacement.dataset.adminCredentialHandler = '1';
      save.replaceWith(replacement);
      replacement.addEventListener('click', handleSave);
    }
    return true;
  }

  function checkedValues(selector) {
    return Array.from(document.querySelectorAll(selector + ' input[type="checkbox"]:checked'))
      .map(el => String(el.value || '').trim())
      .filter(Boolean);
  }

  function getRoles() {
    return checkedValues('#edit-role-container');
  }

  async function handleSave() {
    const btn = document.querySelector('#btn-save-edit-akun');
    const uid = document.getElementById('edit-uid')?.value?.trim();
    const nama = document.getElementById('edit-nama')?.value?.trim();
    const username = document.getElementById('edit-username')?.value?.trim().toLowerCase();
    const password = document.getElementById(PASSWORD_ID)?.value || '';
    const confirm = document.getElementById(CONFIRM_ID)?.value || '';

    if (!uid || !nama || !username) {
      window.customAlert?.('Nama, username, dan UID wajib diisi.', 'error', 'Data belum lengkap');
      return;
    }
    if (password && password !== confirm) {
      window.customAlert?.('Konfirmasi password tidak sama.', 'error', 'Password berbeda');
      return;
    }
    if (password && password.length < 6) {
      window.customAlert?.('Password baru minimal 6 karakter.', 'error', 'Password terlalu pendek');
      return;
    }

    const roles = getRoles();
    const mapel = checkedValues('#edit-mapel-container');
    const kelasGuru = checkedValues('#edit-kelas-guru-container');
    const kelasSiswa = checkedValues('#edit-kelas-siswa-container');
    const kelas = kelasGuru.length ? kelasGuru : kelasSiswa;

    const original = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sesi admin sudah berakhir. Silakan login kembali.');
      const token = await user.getIdToken(true);

      const response = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          uid,
          username,
          password,
          profile: { nama, username, role: roles, mapel, kelas }
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Gagal memperbarui akun.');

      const passwordInfo = result.passwordChanged ? ' Username dan password berhasil diubah.' : ' Username berhasil diubah.';
      window.customAlert?.(`Akun berhasil diperbarui.${passwordInfo}`, 'success', 'Berhasil');
      const modal = document.getElementById('modal-edit-akun');
      if (modal) modal.style.display = 'none';
      const p = document.getElementById(PASSWORD_ID);
      const c = document.getElementById(CONFIRM_ID);
      if (p) p.value = '';
      if (c) c.value = '';
      if (typeof window.loadDataPengguna === 'function') await window.loadDataPengguna();
    } catch (error) {
      console.error('Admin update user:', error);
      window.customAlert?.(error.message || 'Gagal memperbarui akun.', 'error', 'Gagal');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = original || '<i class="fas fa-save"></i> Perbarui Akun'; }
    }
  }

  function init() {
    const ready = () => {
      ensureCredentialFields();
      const modal = document.getElementById('modal-edit-akun');
      if (modal) {
        const observer = new MutationObserver(() => {
          if (modal.style.display !== 'none') ensureCredentialFields();
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
      }
      setInterval(() => {
        const modalEl = document.getElementById('modal-edit-akun');
        if (modalEl && modalEl.style.display !== 'none') ensureCredentialFields();
      }, 700);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
    else ready();
  }

  init();
})();
