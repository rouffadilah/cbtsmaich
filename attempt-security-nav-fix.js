// CBT SMAICH - student exam navigation + security hardening
// Loaded from firebase-config.js so it runs after the page DOM is ready, while
// the actual attempt.js module keeps ownership of exam state and scoring.

(function () {
    const isAttemptPage = /\/attempt(?:\.html)?\/?$/.test(window.location.pathname);
    if (!isAttemptPage) return;

    const waitFor = (selector, callback, tries = 120) => {
        const run = () => {
            const el = document.querySelector(selector);
            if (el) {
                callback(el);
                return;
            }
            if (tries-- > 0) setTimeout(run, 250);
        };
        run();
    };

    function installQuestionNavigation() {
        waitFor('#grid-nav-soal', (grid) => {
            if (grid.dataset.navFixInstalled === '1') return;
            grid.dataset.navFixInstalled = '1';

            // Delegated capture handler: it also works after renderNavigasi()
            // rebuilds all numbered buttons.
            grid.addEventListener('click', (event) => {
                const button = event.target.closest('button.q-box');
                if (!button || !grid.contains(button)) return;

                event.preventDefault();
                event.stopImmediatePropagation();

                button.type = 'button';
                button.style.pointerEvents = 'auto';
                button.style.position = 'relative';
                button.style.zIndex = '20';

                // renderNavigasi() stores the real navigation logic in onclick.
                // Calling it directly avoids interference from page-level
                // fullscreen/capture listeners.
                if (typeof button.onclick === 'function') {
                    button.onclick.call(button, event);
                }

                document.querySelectorAll('#grid-nav-soal .q-box').forEach((b) => {
                    b.type = 'button';
                    b.style.pointerEvents = 'auto';
                    b.style.position = 'relative';
                    b.style.zIndex = '20';
                });
            }, true);

            const patchButtons = () => {
                grid.querySelectorAll('.q-box').forEach((button) => {
                    button.type = 'button';
                    button.style.pointerEvents = 'auto';
                    button.style.position = 'relative';
                    button.style.zIndex = '20';
                    button.setAttribute('aria-label', `Buka soal ${button.textContent.trim()}`);
                });
            };

            new MutationObserver(patchButtons).observe(grid, { childList: true, subtree: true });
            patchButtons();
        });
    }

    function installSecurityVisualLayer() {
        if (document.documentElement.dataset.cbtSecurityFix === '1') return;
        document.documentElement.dataset.cbtSecurityFix = '1';

        const style = document.createElement('style');
        style.textContent = `
            #cbt-security-lock {
                position: fixed;
                inset: 0;
                z-index: 99998;
                display: none;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 24px;
                background: rgba(15, 23, 42, .96);
                color: #fff;
                backdrop-filter: blur(12px);
            }
            #cbt-security-lock .security-box {
                max-width: 520px;
                padding: 28px;
                border: 1px solid rgba(255,255,255,.16);
                border-radius: 18px;
                background: rgba(30,41,59,.96);
                box-shadow: 0 20px 60px rgba(0,0,0,.35);
            }
            #cbt-security-lock .security-icon { font-size: 46px; margin-bottom: 14px; }
            #cbt-security-lock h2 { margin: 0 0 10px; }
            #cbt-security-lock p { margin: 0; line-height: 1.6; color: #cbd5e1; }
            body.cbt-security-blurred > *:not(#cbt-security-lock) {
                filter: blur(18px) !important;
                pointer-events: none !important;
            }
            #sidebar-nav { position: relative; z-index: 2001 !important; }
            #grid-nav-soal, #grid-nav-soal .q-box { pointer-events: auto !important; }
            #overlay-sidebar { z-index: 1500 !important; }
        `;
        document.head.appendChild(style);

        const lock = document.createElement('div');
        lock.id = 'cbt-security-lock';
        lock.innerHTML = `
            <div class="security-box">
                <div class="security-icon">🔒</div>
                <h2>Mode Ujian Aman Aktif</h2>
                <p id="cbt-security-lock-message">Halaman ujian sedang dikunci karena jendela/tab tidak aktif.</p>
            </div>`;
        document.body.appendChild(lock);

        const isExamRunning = () => {
            const workspace = document.getElementById('exam-workspace');
            return !!workspace && getComputedStyle(workspace).display !== 'none';
        };

        const showLock = (message) => {
            if (!isExamRunning()) return;
            const msg = document.getElementById('cbt-security-lock-message');
            if (msg) msg.textContent = message;
            lock.style.display = 'flex';
            document.body.classList.add('cbt-security-blurred');
        };

        const hideLock = () => {
            lock.style.display = 'none';
            document.body.classList.remove('cbt-security-blurred');
        };

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && isExamRunning()) {
                showLock('Tab atau aplikasi lain terdeteksi. Kembali ke halaman ujian. Sistem keamanan ujian tetap aktif.');
            } else if (!document.hidden) {
                hideLock();
            }
        }, true);

        window.addEventListener('blur', () => {
            if (isExamRunning()) showLock('Jendela ujian kehilangan fokus. Kembali ke halaman ini untuk melanjutkan.');
        }, true);

        window.addEventListener('focus', () => {
            if (!document.hidden) hideLock();
        }, true);

        document.addEventListener('fullscreenchange', () => {
            if (isExamRunning() && !document.fullscreenElement) {
                showLock('Mode layar penuh dimatikan. Aktifkan kembali layar penuh untuk melanjutkan ujian.');
            }
        }, true);

        // Fallback shortcut protection. The primary violation counter remains
        // in attempt.js, so this layer does not double-count violations.
        document.addEventListener('keydown', (event) => {
            if (!isExamRunning()) return;
            const key = String(event.key || '').toLowerCase();
            const blocked =
                key === 'f12' ||
                (event.ctrlKey && ['u', 'p', 's'].includes(key)) ||
                (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
                (event.metaKey && event.shiftKey && key === 's');
            if (blocked) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);

        document.addEventListener('contextmenu', (event) => {
            if (isExamRunning()) event.preventDefault();
        }, true);

        // If the mobile sidebar overlay is open, keep the sidebar above it so
        // question numbers remain clickable.
        const repairSidebarLayer = () => {
            const sidebar = document.getElementById('sidebar-nav');
            const overlay = document.getElementById('overlay-sidebar');
            if (sidebar) sidebar.style.zIndex = '2001';
            if (overlay) overlay.style.zIndex = '1500';
        };
        repairSidebarLayer();
        new MutationObserver(repairSidebarLayer).observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('DOMContentLoaded', () => {
        installQuestionNavigation();
        installSecurityVisualLayer();
    });

    // Modules can load after DOMContentLoaded in some cached/WebView cases.
    setTimeout(installQuestionNavigation, 500);
    setTimeout(installSecurityVisualLayer, 500);
})();
