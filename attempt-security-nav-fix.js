// CBT SMAICH - student exam navigation + proctor recovery layer
// Loaded from firebase-config.js so it survives renderNavigasi() rebuilds.
import { auth, db } from './firebase-config.js';
import { collection, addDoc, doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

(function () {
    const isAttemptPage = /\/attempt(?:\.html)?\/?$/.test(window.location.pathname);
    if (!isAttemptPage) return;

    const state = { pendingId: null, unsubscribe: null, lastViolationAt: 0, installed: false };

    const waitFor = (selector, callback, tries = 120) => {
        const run = () => {
            const el = document.querySelector(selector);
            if (el) { callback(el); return; }
            if (tries-- > 0) setTimeout(run, 250);
        };
        run();
    };

    const isExamRunning = () => {
        const workspace = document.getElementById('exam-workspace');
        return !!workspace && getComputedStyle(workspace).display !== 'none';
    };

    function installQuestionNavigation() {
        waitFor('#grid-nav-soal', (grid) => {
            if (grid.dataset.navFixInstalled === '2') return;
            grid.dataset.navFixInstalled = '2';

            const syncActive = () => {
                const buttons = [...grid.querySelectorAll('button.q-box')];
                const current = Number(document.getElementById('current-q-num')?.textContent || 1) - 1;
                buttons.forEach((button, index) => {
                    button.type = 'button';
                    button.style.pointerEvents = 'auto';
                    button.style.position = 'relative';
                    button.style.zIndex = '2002';
                    button.classList.toggle('active', index === current);
                    button.setAttribute('aria-label', `Buka soal ${index + 1}`);
                });
            };

            grid.addEventListener('click', (event) => {
                const button = event.target.closest('button.q-box');
                if (!button || !grid.contains(button)) return;
                event.preventDefault();
                button.type = 'button';
                button.style.pointerEvents = 'auto';
                // renderNavigasi() owns the real click handler.
                if (typeof button.onclick === 'function') button.onclick.call(button, event);
                setTimeout(syncActive, 20);
            }, true);

            new MutationObserver(() => setTimeout(syncActive, 0)).observe(grid, { childList: true, subtree: true });
            syncActive();
        });
    }

    function ensureLockUi() {
        if (document.getElementById('cbt-security-lock')) return document.getElementById('cbt-security-lock');
        const style = document.createElement('style');
        style.id = 'cbt-security-recovery-style';
        style.textContent = `
            /* Mobile exam layout repair */
            @media screen and (max-width:1024px){
                html,body{width:100%;max-width:100%;overflow-x:hidden!important;}
                #exam-workspace{width:100%!important;max-width:100%!important;overflow:hidden!important;}
                #exam-workspace .exam-body{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;height:calc(100dvh - 92px)!important;overflow:hidden!important;}
                #exam-workspace .question-area{display:flex!important;width:100%!important;max-width:none!important;min-width:0!important;height:100%!important;box-sizing:border-box!important;overflow-x:hidden!important;overflow-y:auto!important;padding:18px 14px!important;border-right:0!important;}
                #exam-workspace .question-area>*{max-width:100%!important;min-width:0!important;}
                #exam-workspace #soal-content{width:100%!important;min-width:0!important;overflow-wrap:anywhere!important;word-break:break-word!important;}
                #exam-workspace .nav-bottom-container{width:100%!important;box-sizing:border-box!important;flex-shrink:0!important;}
                #exam-workspace .sidebar-area{position:fixed!important;right:-100%!important;left:auto!important;top:0!important;width:min(88vw,360px)!important;max-width:360px!important;height:100dvh!important;box-sizing:border-box!important;z-index:2001!important;transition:right .25s ease!important;overflow-y:auto!important;}
                #exam-workspace .sidebar-area.open{right:0!important;}
                #exam-workspace #grid-nav-soal{width:100%!important;grid-template-columns:repeat(5,minmax(42px,1fr))!important;overflow-y:auto!important;}
                #exam-workspace #overlay-sidebar{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;z-index:1500!important;background:rgba(15,23,42,.55)!important;}

                /* Matching questions: stack into readable cards on phones. */
                #exam-workspace #soal-content .matching-grid{display:block!important;width:100%!important;max-width:100%!important;border-radius:14px!important;overflow:hidden!important;}
                #exam-workspace #soal-content .matching-grid>.matching-left{width:100%!important;max-width:100%!important;box-sizing:border-box!important;min-width:0!important;padding:14px 14px 10px!important;display:flex!important;align-items:flex-start!important;gap:10px!important;overflow-wrap:anywhere!important;word-break:normal!important;}
                #exam-workspace #soal-content .matching-grid>.matching-arrow{display:none!important;}
                #exam-workspace #soal-content .matching-grid>.matching-right{width:100%!important;max-width:100%!important;box-sizing:border-box!important;min-width:0!important;padding:0 14px 14px!important;border-top:0!important;}
                #exam-workspace #soal-content .matching-grid .matching-left + .matching-arrow + .matching-right{border-top:0!important;}
                #exam-workspace #soal-content .matching-grid .matching-right .select-jodoh{width:100%!important;max-width:100%!important;min-height:50px!important;font-size:16px!important;white-space:normal!important;box-sizing:border-box!important;}
                #exam-workspace #soal-content .matching-grid .matching-left span{max-width:calc(100% - 44px)!important;overflow-wrap:anywhere!important;word-break:normal!important;}
            }
            #cbt-security-lock{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.97);color:#fff;font-family:Inter,system-ui,sans-serif}
            #cbt-security-lock .security-box{width:min(560px,94vw);padding:30px;border:1px solid #475569;border-radius:20px;background:#20283a;box-shadow:0 25px 80px rgba(0,0,0,.45);text-align:center}
            #cbt-security-lock .security-icon{font-size:48px;margin-bottom:12px}
            #cbt-security-lock h2{margin:0 0 10px;font-size:1.6rem}
            #cbt-security-lock p{margin:8px 0;line-height:1.55;color:#cbd5e1}
            #cbt-security-lock .reason{margin:16px 0;padding:12px;text-align:left;background:#111827;border-radius:10px;color:#fecaca}
            #cbt-security-token{width:100%;box-sizing:border-box;margin-top:10px;padding:13px;border:2px solid #64748b;border-radius:10px;background:#0f172a;color:#fff;text-align:center;font-size:1.3rem;font-weight:900;letter-spacing:5px;text-transform:uppercase}
            #cbt-security-resume{width:100%;margin-top:10px;padding:13px;border:0;border-radius:10px;background:#10b981;color:#fff;font-weight:800;font-size:1rem;cursor:pointer}
            #cbt-security-resume:disabled{opacity:.45;cursor:not-allowed}
            #cbt-security-status{margin-top:9px;font-size:.82rem;color:#93c5fd}
            body.cbt-security-blurred > *:not(#cbt-security-lock){filter:blur(18px)!important;pointer-events:none!important}
            #sidebar-nav{position:relative;z-index:2001!important} #grid-nav-soal,#grid-nav-soal .q-box{pointer-events:auto!important} #overlay-sidebar{z-index:1500!important}
        `;
        document.head.appendChild(style);
        const lock = document.createElement('div');
        lock.id = 'cbt-security-lock';
        lock.innerHTML = `<div class="security-box"><div class="security-icon">🔐</div><h2>Ujian Dikunci Sementara</h2><p id="cbt-security-student">Siswa</p><div class="reason"><b>Pelanggaran terdeteksi</b><br><span id="cbt-security-reason">-</span></div><p>Untuk melanjutkan, minta pengawas/admin menggunakan token pemulihan yang muncul pada dashboard.</p><label style="display:block;text-align:left;font-weight:800;margin-top:15px;">Token Pemulihan</label><input id="cbt-security-token" maxlength="8" inputmode="numeric" autocomplete="off" placeholder="MENUNGGU TOKEN" disabled><button id="cbt-security-resume" type="button" disabled>Lanjutkan Ujian</button><div id="cbt-security-status">Menunggu token dari pengawas...</div></div>`;
        document.body.appendChild(lock);
        return lock;
    }

    async function reportViolation(reason) {
        if (!isExamRunning() || state.pendingId) return;
        const now = Date.now();
        if (now - state.lastViolationAt < 1500) return;
        state.lastViolationAt = now;

        const user = auth.currentUser;
        if (!user) return;
        const lock = ensureLockUi();
        const studentEl = lock.querySelector('#cbt-security-student');
        const reasonEl = lock.querySelector('#cbt-security-reason');
        const statusEl = lock.querySelector('#cbt-security-status');
        const input = lock.querySelector('#cbt-security-token');
        const resume = lock.querySelector('#cbt-security-resume');

        const profileSnap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
        const profile = profileSnap?.exists() ? profileSnap.data() : {};
        const nama = profile.nama || user.displayName || user.email || 'Siswa';
        const username = profile.username || user.email || user.uid;
        const title = document.getElementById('exam-mapel-title')?.innerText || '';
        const mataPelajaran = title.replace(/^UJIAN:\s*/i, '').trim();
        const count = Number(document.getElementById('violation-count')?.textContent || 0) + 1;

        studentEl.textContent = `${nama} (${username})`;
        reasonEl.textContent = reason;
        statusEl.textContent = 'Mengirim laporan pelanggaran ke dashboard pengawas...';
        input.value = ''; input.disabled = true; resume.disabled = true;
        lock.style.display = 'flex'; document.body.classList.add('cbt-security-blurred'); document.body.style.filter = 'none';

        try {
            const violationRef = await addDoc(collection(db, 'security_violations'), { uid:user.uid, nama, username, mataPelajaran, reason, count, status:'pending', resumeToken:null, createdAt:serverTimestamp() });
            state.pendingId = violationRef.id;
            state.unsubscribe = onSnapshot(violationRef, snap => {
                if (!snap.exists()) return;
                const data = snap.data();
                if (data.status === 'disqualified') { statusEl.textContent = 'Ujian dihentikan oleh pengawas.'; input.disabled = true; resume.disabled = true; return; }
                if (data.resumeToken && data.status === 'ready') {
                    input.disabled = false; resume.disabled = false;
                    statusEl.textContent = 'Token sudah diterbitkan. Masukkan token untuk melanjutkan.';
                    input.focus();
                }
            }, error => { console.error('[CBT Security]', error); statusEl.textContent = 'Koneksi pemantauan gagal. Periksa internet.'; });
        } catch (error) {
            console.error('[CBT Security] Gagal membuat laporan:', error);
            statusEl.textContent = 'Laporan gagal dikirim. Periksa koneksi internet lalu kembali ke halaman ujian.';
        }
    }

    function bindResumeButton() {
        const lock = ensureLockUi();
        lock.querySelector('#cbt-security-resume').addEventListener('click', async () => {
            if (!state.pendingId) return;
            const input = lock.querySelector('#cbt-security-token');
            const status = lock.querySelector('#cbt-security-status');
            try {
                const snap = await getDoc(doc(db, 'security_violations', state.pendingId));
                const data = snap.exists() ? snap.data() : null;
                const expected = String(data?.resumeToken || '').toUpperCase();
                const supplied = String(input.value || '').trim().toUpperCase();
                if (!expected || supplied !== expected) { status.textContent = 'Token salah. Gunakan token yang tampil pada dashboard pengawas.'; input.select(); return; }
                await updateDoc(doc(db, 'security_violations', state.pendingId), { status:'resumed', resumedAt:serverTimestamp() });
                if (state.unsubscribe) state.unsubscribe();
                state.unsubscribe = null; state.pendingId = null;
                lock.style.display = 'none'; document.body.classList.remove('cbt-security-blurred'); document.body.style.filter = 'none';
                const root = document.documentElement;
                if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen().catch(() => {});
                window.customAlert?.('Token diterima. Ujian dapat dilanjutkan.', 'UJIAN DILANJUTKAN');
            } catch (error) { console.error(error); status.textContent = 'Verifikasi token gagal. Periksa koneksi internet.'; }
        });
    }

    function installSecurityVisualLayer() {
        if (document.documentElement.dataset.cbtSecurityFix === '2') return;
        document.documentElement.dataset.cbtSecurityFix = '2';
        ensureLockUi(); bindResumeButton();

        document.addEventListener('visibilitychange', () => {
            if (!isExamRunning()) return;
            if (document.hidden) {
                document.body.classList.add('cbt-security-blurred');
                reportViolation('Membuka tab/aplikasi lain atau meninggalkan fokus halaman ujian.').catch(console.error);
            }
            // Saat kembali ke tab, JANGAN membuka ujian otomatis. Token pengawas diperlukan.
        }, true);

        document.addEventListener('fullscreenchange', () => {
            if (isExamRunning() && !document.fullscreenElement) reportViolation('Mode layar penuh dimatikan.').catch(console.error);
        }, true);

        document.addEventListener('keydown', event => {
            if (!isExamRunning()) return;
            const key = String(event.key || '').toLowerCase();
            const blocked = key === 'f12' || (event.ctrlKey && ['u','p','s'].includes(key)) || (event.ctrlKey && event.shiftKey && ['i','j','c'].includes(key)) || (event.metaKey && event.shiftKey && key === 's');
            if (blocked) { event.preventDefault(); event.stopPropagation(); }
        }, true);
        document.addEventListener('contextmenu', event => { if (isExamRunning()) event.preventDefault(); }, true);

        const repairSidebarLayer = () => { const sidebar = document.getElementById('sidebar-nav'); const overlay = document.getElementById('overlay-sidebar'); if (sidebar) sidebar.style.zIndex='2001'; if (overlay) overlay.style.zIndex='1500'; };
        repairSidebarLayer(); new MutationObserver(repairSidebarLayer).observe(document.body, { childList:true, subtree:true });
    }

    function install() {
        if (state.installed) return; state.installed = true;
        installQuestionNavigation();
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSecurityVisualLayer); else installSecurityVisualLayer();
    }

    install();
    setTimeout(installQuestionNavigation, 500);
    setTimeout(installSecurityVisualLayer, 500);
})();
