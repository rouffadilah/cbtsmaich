// CBT SMAICH - Responsive matching question layout
// Mobile: statement full-width, downward arrow, answer selector below.
// Matching helper list and A=... option map are hidden from students.
(function () {
    const STYLE_ID = 'cbt-matching-mobile-fix-v2';

    // Bersihkan autosave lama yang berisi null pada jawaban.
    // Pada soal menjodohkan, null membuat Object.entries(null) melempar error
    // sehingga seluruh area pasangan tidak sempat dirender.
    function sanitizeSavedAnswers() {
        try {
            Object.keys(localStorage).forEach(key => {
                if (!key.startsWith('cbt_ans_')) return;
                const raw = localStorage.getItem(key);
                if (!raw) return;
                const data = JSON.parse(raw);
                if (!data || typeof data !== 'object' || !data.jawabanSiswa || typeof data.jawabanSiswa !== 'object') return;

                let changed = false;
                Object.keys(data.jawabanSiswa).forEach(qid => {
                    if (data.jawabanSiswa[qid] === null) {
                        // null berarti belum dijawab; string kosong aman untuk semua tipe.
                        data.jawabanSiswa[qid] = '';
                        changed = true;
                    }
                });

                if (changed) localStorage.setItem(key, JSON.stringify(data));
            });
        } catch (e) {
            console.warn('[CBT] Gagal membersihkan autosave jawaban:', e);
        }
    }

    sanitizeSavedAnswers();

    function installStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            @media screen and (max-width: 700px) {
                #exam-workspace #soal-content .matching-grid {
                    display: grid !important;
                    grid-template-columns: minmax(0, 1fr) !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    overflow: hidden !important;
                    border-radius: 14px !important;
                    background: transparent !important;
                    box-shadow: none !important;
                }

                #exam-workspace #soal-content .matching-grid > div:nth-child(1),
                #exam-workspace #soal-content .matching-grid > div:nth-child(3) {
                    grid-column: 1 / -1 !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    min-width: 0 !important;
                    padding: 10px 12px !important;
                    background: #eef2ff !important;
                    color: #1e3a8a !important;
                    border-bottom: 1px solid #cbd5e1 !important;
                }

                #exam-workspace #soal-content .matching-grid > div:nth-child(3) {
                    border-top: 0 !important;
                    text-align: left !important;
                }

                #exam-workspace #soal-content .matching-grid > div:nth-child(2) {
                    display: flex !important;
                    grid-column: 1 / -1 !important;
                    width: 100% !important;
                    min-height: 30px !important;
                    align-items: center !important;
                    justify-content: center !important;
                    background: #1f2937 !important;
                    color: #93c5fd !important;
                    border: 0 !important;
                }

                #exam-workspace #soal-content .matching-grid > div:nth-child(2) i {
                    display: none !important;
                }

                #exam-workspace #soal-content .matching-grid > div:nth-child(2)::after {
                    content: '↓' !important;
                    font-size: 26px !important;
                    line-height: 1 !important;
                    font-weight: 900 !important;
                }

                #exam-workspace #soal-content .matching-grid > .matching-left {
                    grid-column: 1 / -1 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    box-sizing: border-box !important;
                    display: flex !important;
                    align-items: flex-start !important;
                    gap: 10px !important;
                    padding: 12px !important;
                    background: #1f2937 !important;
                    color: #f8fafc !important;
                    border-top: 1px solid #475569 !important;
                    overflow: visible !important;
                }

                #exam-workspace #soal-content .matching-grid > .matching-left > span:last-child {
                    flex: 1 1 auto !important;
                    width: auto !important;
                    max-width: none !important;
                    min-width: 0 !important;
                    white-space: normal !important;
                    overflow: visible !important;
                    text-overflow: clip !important;
                    overflow-wrap: anywhere !important;
                    word-break: normal !important;
                    line-height: 1.45 !important;
                    color: #f8fafc !important;
                }

                #exam-workspace #soal-content .matching-grid > .matching-left > span:first-child {
                    flex: 0 0 auto !important;
                }

                #exam-workspace #soal-content .matching-grid > .matching-right {
                    grid-column: 1 / -1 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    box-sizing: border-box !important;
                    padding: 10px 12px 14px !important;
                    background: #1f2937 !important;
                    border-top: 0 !important;
                }

                #exam-workspace #soal-content .matching-grid .select-jodoh {
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    min-height: 52px !important;
                    box-sizing: border-box !important;
                    padding: 10px 38px 10px 12px !important;
                    font-size: 16px !important;
                    line-height: 1.3 !important;
                    white-space: normal !important;
                    overflow-wrap: anywhere !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function removeMatchingHelpers() {
        const content = document.querySelector('#exam-workspace #soal-content');
        if (!content || !content.querySelector('.matching-grid')) return;

        // Hapus "Daftar pilihan: 1. ..., 2. ..." dari tampilan siswa.
        Array.from(content.children).forEach(child => {
            const text = (child.textContent || '').trim();
            if (/^Daftar pilihan\s*:/i.test(text)) child.remove();
        });

        // Mapping A=... tidak ditampilkan lagi pada teks soal.
        const grid = content.querySelector('.matching-grid');
        let previous = grid ? grid.previousElementSibling : null;
        while (previous) {
            const text = previous.textContent || '';
            if (/\b[A-E]\s*=\s*/i.test(text)) {
                const walker = document.createTreeWalker(previous, NodeFilter.SHOW_TEXT);
                let node;
                while ((node = walker.nextNode())) {
                    const match = node.nodeValue.search(/\bA\s*=\s*/i);
                    if (match >= 0) {
                        node.nodeValue = node.nodeValue.slice(0, match).replace(/[\s:;,.-]+$/, '').trimEnd();
                        let sibling = node.parentNode?.nextSibling;
                        while (sibling) {
                            const next = sibling.nextSibling;
                            sibling.remove();
                            sibling = next;
                        }
                        break;
                    }
                }
                break;
            }
            previous = previous.previousElementSibling;
        }
    }

    function apply() {
        sanitizeSavedAnswers();
        installStyles();
        removeMatchingHelpers();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply, { once: true });
    } else {
        apply();
    }

    // attempt.js menggambar ulang #soal-content setiap berpindah soal.
    const observer = new MutationObserver(() => {
        installStyles();
        removeMatchingHelpers();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
