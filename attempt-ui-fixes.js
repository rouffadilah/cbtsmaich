// UI fixes for the CBT attempt page.
// Loaded after attempt.js so it can improve the rendered matching question
// and keep question navigation state visually synchronized.

document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.id = 'attempt-ui-fixes-style';
    style.textContent = `
        /* Matching question: clearer desktop/tablet layout */
        #soal-content .matching-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 54px minmax(0, 1.12fr) !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 14px !important;
            overflow: hidden !important;
            background: #fff !important;
            box-shadow: 0 4px 14px rgba(15,23,42,.06) !important;
        }
        #soal-content .matching-grid > div {
            min-width: 0;
        }
        #soal-content .matching-grid .matching-cell-left,
        #soal-content .matching-grid .matching-cell-right,
        #soal-content .matching-grid .matching-cell-arrow {
            border-top: 1px solid #e2e8f0;
        }
        #soal-content .matching-grid .matching-cell-left {
            display: flex !important;
            align-items: flex-start !important;
            gap: 10px !important;
            padding: 14px 16px !important;
            line-height: 1.55 !important;
        }
        #soal-content .matching-grid .matching-cell-right {
            padding: 10px 14px !important;
        }
        #soal-content .matching-grid .matching-cell-arrow {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: #f8fafc !important;
            color: #64748b !important;
            font-size: 1rem !important;
        }
        #soal-content .matching-grid .matching-badge {
            flex: 0 0 34px !important;
            width: 34px !important;
            min-width: 34px !important;
            height: 34px !important;
            border-radius: 9px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: #0ea5e9 !important;
            color: #fff !important;
            font-weight: 800 !important;
        }
        #soal-content .matching-grid .matching-text {
            color: #0f172a !important;
            font-weight: 650 !important;
            line-height: 1.55 !important;
            word-break: break-word !important;
        }
        #soal-content .matching-grid .select-jodoh {
            min-height: 50px !important;
            border: 2px solid #60a5fa !important;
            border-radius: 10px !important;
            padding: 10px 12px !important;
            font-weight: 650 !important;
            color: #0f172a !important;
            background: #fff !important;
            cursor: pointer !important;
        }
        #soal-content .matching-grid .select-jodoh:focus {
            outline: none !important;
            border-color: #2563eb !important;
            box-shadow: 0 0 0 3px rgba(37,99,235,.15) !important;
        }
        #soal-content .matching-bank {
            margin-top: 14px !important;
            padding: 14px !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 12px !important;
            background: #f8fafc !important;
        }
        #soal-content .matching-bank-title {
            display: flex !important;
            align-items: center !important;
            gap: 7px !important;
            margin-bottom: 8px !important;
            color: #1e3a8a !important;
            font-weight: 800 !important;
        }
        #soal-content .matching-bank-item {
            display: inline-flex !important;
            align-items: flex-start !important;
            gap: 6px !important;
            margin: 4px 5px 0 0 !important;
            padding: 7px 10px !important;
            border-radius: 9px !important;
            background: #fff !important;
            border: 1px solid #dbeafe !important;
            color: #334155 !important;
            line-height: 1.4 !important;
        }
        
        /* Question navigation: make the active number unmistakable */
        #grid-nav-soal .q-box.active {
            background: #2563eb !important;
            border-color: #1d4ed8 !important;
            color: #fff !important;
            transform: translateY(-1px);
            box-shadow: 0 0 0 3px rgba(37,99,235,.20) !important;
        }
        #grid-nav-soal .q-box.filled.active {
            background: #2563eb !important;
            border-color: #1d4ed8 !important;
        }
        #grid-nav-soal .q-box.ragu.active {
            background: #2563eb !important;
            border-color: #1d4ed8 !important;
        }
        #current-q-num {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-width: 34px !important;
            height: 34px !important;
            padding: 0 8px !important;
            border-radius: 9px !important;
            background: #eff6ff !important;
            border: 1px solid #bfdbfe !important;
        }
        
        @media (max-width: 768px) {
            #soal-content .matching-grid {
                grid-template-columns: 1fr !important;
            }
            #soal-content .matching-grid > div:first-child,
            #soal-content .matching-grid > div:nth-child(2),
            #soal-content .matching-grid > div:nth-child(3) {
                grid-column: 1 !important;
            }
            #soal-content .matching-grid > div:nth-child(2) {
                display: none !important;
            }
            #soal-content .matching-grid > div:nth-child(3) {
                padding-top: 0 !important;
                border-top: 0 !important;
                padding-bottom: 14px !important;
            }
            #soal-content .matching-grid > div:nth-child(3)::before {
                content: 'Pilih pasangan jawaban';
                display: block;
                margin-bottom: 7px;
                color: #64748b;
                font-size: .78rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: .03em;
            }
        }
    `;
    document.head.appendChild(style);

    function syncQuestionNavigation() {
        const current = Number(document.getElementById('current-q-num')?.textContent || 0);
        if (!current) return;
        document.querySelectorAll('#grid-nav-soal .q-box').forEach((box, index) => {
            box.classList.toggle('active', index + 1 === current);
        });
    }

    function improveMatchingUI() {
        const content = document.getElementById('soal-content');
        if (!content) return;
        const selects = content.querySelectorAll('.select-jodoh');
        if (!selects.length) return;

        // The current renderer uses a 3-column grid. Add stable classes without
        // replacing nodes, so its existing onchange handlers remain intact.
        const grid = selects[0].closest('div[style*="grid-template-columns"]');
        if (!grid) return;
        grid.classList.add('matching-grid');

        const cells = Array.from(grid.children);
        cells.forEach((cell, index) => {
            const col = index % 3;
            if (col === 0) cell.classList.add('matching-cell-left');
            if (col === 1) cell.classList.add('matching-cell-arrow');
            if (col === 2) cell.classList.add('matching-cell-right');
        });

        grid.querySelectorAll('.matching-cell-left').forEach(cell => {
            if (cell.dataset.uiFixed === '1') return;
            const badge = cell.querySelector('span:first-child');
            const text = cell.querySelector('span:nth-child(2)');
            if (badge) badge.classList.add('matching-badge');
            if (text) {
                text.classList.add('matching-text');
                // Prevent duplicate labels such as badge "A" + text "A. Background Removal".
                const badgeValue = badge?.textContent?.trim();
                const pattern = badgeValue && /^[A-E]$/i.test(badgeValue)
                    ? new RegExp('^' + badgeValue.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\s*[.)-]?\\s*', 'i')
                    : null;
                if (pattern) text.textContent = text.textContent.trim().replace(pattern, '');
            }
            cell.dataset.uiFixed = '1';
        });

        const bank = Array.from(content.children).find(el => /Daftar pilihan:/i.test(el.textContent || ''));
        if (bank && bank.dataset.uiFixed !== '1') {
            bank.classList.add('matching-bank');
            const bold = bank.querySelector('b');
            if (bold) bold.innerHTML = '<i class="fas fa-layer-group"></i> Bank pasangan jawaban';
            bank.querySelectorAll('span').forEach(span => span.classList.add('matching-bank-item'));
            bank.dataset.uiFixed = '1';
        }
    }

    const contentObserver = new MutationObserver(() => {
        improveMatchingUI();
        syncQuestionNavigation();
    });
    const content = document.getElementById('soal-content');
    if (content) contentObserver.observe(content, { childList: true, subtree: true });

    const nav = document.getElementById('grid-nav-soal');
    if (nav) {
        nav.addEventListener('click', () => setTimeout(syncQuestionNavigation, 30));
        const navObserver = new MutationObserver(syncQuestionNavigation);
        navObserver.observe(nav, { childList: true, subtree: true });
    }

    const currentNumber = document.getElementById('current-q-num');
    if (currentNumber) {
        const numberObserver = new MutationObserver(syncQuestionNavigation);
        numberObserver.observe(currentNumber, { childList: true, characterData: true, subtree: true });
    }

    ['btn-prev', 'btn-next'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => setTimeout(syncQuestionNavigation, 40));
    });

    // Initial pass and a short delayed pass for dynamically-rendered questions.
    improveMatchingUI();
    syncQuestionNavigation();
    setTimeout(() => { improveMatchingUI(); syncQuestionNavigation(); }, 100);
});
