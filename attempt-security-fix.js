import { auth, db } from './firebase-config.js';
import { collection, addDoc, doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

(function () {
    const state = { pendingId: null, unsubscribe: null, paused: false, violationCount: 0 };
    const isExamVisible = () => { const workspace = document.getElementById('exam-workspace'); return !!workspace && getComputedStyle(workspace).display !== 'none'; };
    function ensureStyles() {
        if (document.getElementById('cbt-security-fix-style')) return;
        const style = document.createElement('style'); style.id = 'cbt-security-fix-style';
        style.textContent = `#cbt-violation-lock{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.97);color:#fff;font-family:Inter,system-ui,sans-serif}#cbt-violation-lock .lock-card{width:min(560px,94vw);background:#20283a;border:1px solid #475569;border-radius:20px;padding:32px;box-shadow:0 25px 80px rgba(0,0,0,.45);text-align:center}#cbt-violation-lock .lock-icon{font-size:3.2rem;margin-bottom:14px}#cbt-violation-lock h2{margin:0 0 10px;font-size:1.65rem}#cbt-violation-lock p{color:#cbd5e1;line-height:1.55;margin:8px 0}#cbt-violation-lock .reason{margin:18px 0;padding:12px 14px;border-radius:10px;background:#111827;color:#fca5a5;text-align:left}#cbt-violation-lock .token-wrap{margin-top:18px;text-align:left}#cbt-violation-lock label{display:block;font-weight:800;margin-bottom:7px}#cbt-violation-token{width:100%;box-sizing:border-box;padding:14px;border-radius:10px;border:2px solid #64748b;background:#0f172a;color:#fff;text-align:center;font-size:1.35rem;font-weight:900;letter-spacing:5px;text-transform:uppercase}#cbt-violation-resume{width:100%;margin-top:12px;padding:13px;border:0;border-radius:10px;background:#10b981;color:#fff;font-weight:800;font-size:1rem;cursor:pointer}#cbt-violation-resume:disabled{opacity:.45;cursor:not-allowed}#cbt-violation-status{margin-top:10px;font-size:.82rem;color:#93c5fd}`;
        document.head.appendChild(style);
    }
    function ensureOverlay() {
        ensureStyles(); let el = document.getElementById('cbt-violation-lock'); if (el) return el;
        el = document.createElement('div'); el.id = 'cbt-violation-lock';
        el.innerHTML = `<div class="lock-card"><div class="lock-icon">🔐</div><h2>Ujian Dikunci Sementara</h2><p id="cbt-violation-name">Siswa</p><div class="reason"><b>Pelanggaran terdeteksi</b><br><span id="cbt-violation-reason">-</span></div><p>Untuk melanjutkan ujian, minta pengawas/admin memasukkan token pemulihan yang muncul pada dashboard.</p><div class="token-wrap"><label for="cbt-violation-token">Token Pemulihan</label><input id="cbt-violation-token" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="MENUNGGU TOKEN" disabled><button id="cbt-violation-resume" type="button" disabled>Lanjutkan Ujian</button><div id="cbt-violation-status">Menunggu token dari pengawas...</div></div></div>`;
        document.body.appendChild(el);
        const input = el.querySelector('#cbt-violation-token'); const btn = el.querySelector('#cbt-violation-resume');
        btn.addEventListener('click', async () => {
            if (!state.pendingId || !input.value.trim()) return;
            try {
                const snap = await getDoc(doc(db, 'security_violations', state.pendingId)); if (!snap.exists()) return;
                const data = snap.data(); const supplied = input.value.trim().toUpperCase(); const expected = String(data.resumeToken || '').toUpperCase();
                if (!expected || supplied !== expected) { el.querySelector('#cbt-violation-status').textContent = 'Token salah. Minta token terbaru dari pengawas.'; input.select(); return; }
                await updateDoc(doc(db, 'security_violations', state.pendingId), { status: 'resumed', resumedAt: serverTimestamp() });
                if (state.unsubscribe) state.unsubscribe(); state.unsubscribe = null; state.pendingId = null; state.paused = false;
                document.body.style.filter = 'none'; el.style.display = 'none';
                const root = document.documentElement; if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen().catch(() => {});
                window.customAlert?.('Token diterima. Ujian dapat dilanjutkan.', 'UJIAN DILANJUTKAN');
            } catch (error) { console.error('[CBT Security] Gagal memverifikasi token:', error); el.querySelector('#cbt-violation-status').textContent = 'Gagal memverifikasi token. Periksa koneksi internet.'; }
        });
        return el;
    }
    async function createViolation(reason) {
        const user = auth.currentUser; if (!user || !isExamVisible() || state.pendingId) return;
        state.paused = true; const overlay = ensureOverlay(); const nameEl = overlay.querySelector('#cbt-violation-name'); const reasonEl = overlay.querySelector('#cbt-violation-reason'); const statusEl = overlay.querySelector('#cbt-violation-status'); const input = overlay.querySelector('#cbt-violation-token'); const btn = overlay.querySelector('#cbt-violation-resume');
        const profileSnap = await getDoc(doc(db, 'users', user.uid)).catch(() => null); const profile = profileSnap?.exists() ? profileSnap.data() : {};
        const nama = profile.nama || user.displayName || user.email || 'Siswa'; const username = profile.username || user.email || user.uid; const mapelTitle = document.getElementById('exam-mapel-title')?.innerText || ''; const mataPelajaran = mapelTitle.replace(/^UJIAN:\s*/i, '').trim();
        nameEl.textContent = `${nama} (${username})`; reasonEl.textContent = reason; statusEl.textContent = 'Mengirim laporan pelanggaran ke dashboard pengawas...'; input.value = ''; input.disabled = true; btn.disabled = true; overlay.style.display = 'flex'; document.body.style.filter = 'none';
        const violationRef = await addDoc(collection(db, 'security_violations'), { uid: user.uid, nama, username, mataPelajaran, reason, count: state.violationCount, status: 'pending', resumeToken: null, createdAt: serverTimestamp() });
        state.pendingId = violationRef.id;
        state.unsubscribe = onSnapshot(violationRef, snap => {
            if (!snap.exists()) return; const data = snap.data();
            if (data.status === 'disqualified') { statusEl.textContent = 'Ujian dihentikan oleh pengawas.'; return; }
            if (data.resumeToken && data.status === 'ready') { input.disabled = false; btn.disabled = false; statusEl.textContent = 'Token sudah diterbitkan pengawas. Masukkan token untuk melanjutkan.'; input.focus(); }
            else if (data.status === 'resumed') { state.pendingId = null; state.paused = false; overlay.style.display = 'none'; }
        }, error => { console.error('[CBT Security] Listener pelanggaran:', error); statusEl.textContent = 'Tidak dapat memantau token. Periksa koneksi internet.'; });
    }
    function install() {
        if (window.__cbtSecurityFixInstalled) return; window.__cbtSecurityFixInstalled = true; ensureOverlay();
        document.addEventListener('visibilitychange', () => { if (!isExamVisible()) return; if (document.hidden) { state.violationCount += 1; createViolation('Membuka tab/aplikasi lain atau meninggalkan fokus halaman ujian.').catch(err => console.error(err)); } }, true);
        const grid = document.getElementById('grid-nav-soal');
        if (grid) {
            grid.addEventListener('click', event => { const btn = event.target.closest('.q-box'); if (!btn) return; setTimeout(() => { grid.querySelectorAll('.q-box').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }, 0); }, true);
            new MutationObserver(() => { const buttons = [...grid.querySelectorAll('.q-box')]; const current = Number(document.getElementById('current-q-num')?.textContent || 1) - 1; buttons.forEach((b, i) => b.classList.toggle('active', i === current)); }).observe(grid, { childList: true, subtree: true });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
