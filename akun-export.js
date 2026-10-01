import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]));

  function isAdminDashboard() {
    const add = document.getElementById('btn-open-manajemen');
    return !!add && getComputedStyle(add).display !== 'none';
  }

  function addButton() {
    if (!isAdminDashboard() || document.getElementById('btn-download-semua-akun')) return;
    const header = document.querySelector('#section-pengguna .card > div:first-child');
    if (!header) return;
    const button = document.createElement('button');
    button.id = 'btn-download-semua-akun';
    button.type = 'button';
    button.className = 'btn-3d';
    button.style.cssText = 'margin:0;background:#2563eb;padding:7px 14px;font-size:.85rem;';
    button.title = 'Download data akun tanpa password';
    button.innerHTML = '<i class="fas fa-file-excel"></i> Download Semua Akun';
    button.addEventListener('click', downloadUsers);
    header.appendChild(button);
  }

  async function downloadUsers() {
    const button = document.getElementById('btn-download-semua-akun');
    if (!button) return;
    const old = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyiapkan...';
    try {
      if (!isAdminDashboard()) throw new Error('Menu ini hanya tersedia untuk admin.');
      if (typeof XLSX === 'undefined') throw new Error('Library Excel belum siap. Muat ulang halaman.');
      const snap = await getDocs(collection(db, 'users'));
      const rows = [];
      snap.forEach((item) => {
        const d = item.data() || {};
        const list = (v) => Array.isArray(v) ? v.join(', ') : String(v ?? '');
        rows.push({
          'Nama Lengkap': d.nama || d.name || '',
          'Username / NIS / ID Guru': d.username || '',
          'Email': d.email || '',
          'Role': list(d.role),
          'Kelas': list(d.kelas),
          'Mata Pelajaran': list(d.mapel),
          'UID': item.id,
          'Status': d.aktif === false ? 'Nonaktif' : 'Aktif'
        });
      });
      rows.sort((a,b) => `${a.Role}-${a['Nama Lengkap']}`.localeCompare(`${b.Role}-${b['Nama Lengkap']}`, 'id'));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{wch:28},{wch:24},{wch:34},{wch:18},{wch:22},{wch:38},{wch:34},{wch:12}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Semua Akun');
      const info = XLSX.utils.aoa_to_sheet([
        ['CBT-SMAICH - DATA AKUN'],
        ['Jumlah Akun', rows.length],
        ['Waktu Download', new Date().toLocaleString('id-ID')],
        ['Keamanan', 'Password tidak disertakan. Password Firebase tidak dapat dibaca kembali oleh dashboard.']
      ]);
      info['!cols'] = [{wch:22},{wch:90}];
      XLSX.utils.book_append_sheet(wb, info, 'Informasi');
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      XLSX.writeFile(wb, `CBT-SMAICH-Semua-Akun-${stamp}.xlsx`);
      if (window.customAlert) window.customAlert(`Berhasil menyiapkan ${rows.length} akun. Password tidak disertakan.`, 'success');
    } catch (error) {
      console.error('[CBT] Export akun gagal:', error);
      if (window.customAlert) window.customAlert(`Gagal mengunduh akun: ${error.message}`, 'error');
      else alert(error.message);
    } finally {
      button.disabled = false;
      button.innerHTML = old;
    }
  }

  function init() {
    addButton();
    [500,1500,3000].forEach(ms => setTimeout(addButton, ms));
    const observer = new MutationObserver(addButton);
    observer.observe(document.body, {childList:true, subtree:true});
    setTimeout(() => observer.disconnect(), 10000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
