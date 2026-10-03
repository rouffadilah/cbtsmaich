// CBT SMAICH - Matching question mobile renderer v3
// Fix: the previous helper removed the rendered matching grid itself.
// This version never removes siblings of the matching grid.
(function () {
    const STYLE_ID = 'cbt-matching-mobile-fix-v3';

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
                        data.jawabanSiswa[qid] = '';
                        changed = true;
                    }
                });
                if (changed) localStorage.setItem(key, JSON.stringify(data));
            });
        } catch (e) {
            console.warn('[CBT] Autosave sanitize:', e);
        }
    }

    function installStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            @media screen and (max-width: 700px) {
                #exam-workspace #soal-content .matching-grid {
                    display:grid !important;
                    grid-template-columns:minmax(0,1fr) !important;
                    width:100% !important;
                    max-width:100% !important;
                    min-width:0 !important;
                    overflow:hidden !important;
                    border-radius:14px !important;
                }
                #exam-workspace #soal-content .matching-grid > div:nth-child(1),
                #exam-workspace #soal-content .matching-grid > div:nth-child(3) {
                    grid-column:1 / -1 !important;
                    width:100% !important;
                    box-sizing:border-box !important;
                    min-width:0 !important;
                    padding:10px 12px !important;
                    background:#eef2ff !important;
                    color:#1e3a8a !important;
                    border-bottom:1px solid #cbd5e1 !important;
                }
                #exam-workspace #soal-content .matching-grid > div:nth-child(2) {
                    display:flex !important;
                    grid-column:1 / -1 !important;
                    width:100% !important;
                    min-height:30px !important;
                    align-items:center !important;
                    justify-content:center !important;
                    background:#1f2937 !important;
                    color:#93c5fd !important;
                    border:0 !important;
                }
                #exam-workspace #soal-content .matching-grid > div:nth-child(2) i { display:none !important; }
                #exam-workspace #soal-content .matching-grid > div:nth-child(2)::after {
                    content:'↓' !important;
                    font-size:26px !important;
                    line-height:1 !important;
                    font-weight:900 !important;
                }
                #exam-workspace #soal-content .matching-grid > .matching-left {
                    grid-column:1 / -1 !important;
                    width:100% !important;
                    max-width:100% !important;
                    min-width:0 !important;
                    box-sizing:border-box !important;
                    display:flex !important;
                    align-items:flex-start !important;
                    gap:10px !important;
                    padding:12px !important;
                    background:#1f2937 !important;
                    color:#f8fafc !important;
                    border-top:1px solid #475569 !important;
                    overflow:visible !important;
                }
                #exam-workspace #soal-content .matching-grid > .matching-left > span:last-child {
                    flex:1 1 auto !important;
                    width:auto !important;
                    max-width:none !important;
                    min-width:0 !important;
                    white-space:normal !important;
                    overflow:visible !important;
                    text-overflow:clip !important;
                    overflow-wrap:anywhere !important;
                    word-break:normal !important;
                    line-height:1.45 !important;
                    color:#f8fafc !important;
                }
                #exam-workspace #soal-content .matching-grid > .matching-left > span:first-child { flex:0 0 auto !important; }
                #exam-workspace #soal-content .matching-grid > .matching-right {
                    grid-column:1 / -1 !important;
                    width:100% !important;
                    max-width:100% !important;
                    min-width:0 !important;
                    box-sizing:border-box !important;
                    padding:10px 12px 14px !important;
                    background:#1f2937 !important;
                    border-top:0 !important;
                }
                #exam-workspace #soal-content .matching-grid .select-jodoh {
                    display:block !important;
                    width:100% !important;
                    max-width:100% !important;
                    min-width:0 !important;
                    min-height:52px !important;
                    box-sizing:border-box !important;
                    padding:10px 38px 10px 12px !important;
                    font-size:16px !important;
                    line-height:1.3 !important;
                    white-space:normal !important;
                    overflow-wrap:anywhere !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Remove only the A=... helper text from the immediate question element.
    // IMPORTANT: never remove sibling elements, because the matching grid is a sibling.
    function removeMappingTextSafely() {
        const content = document.querySelector('#exam-workspace #soal-content');
        const grid = content?.querySelector('.matching-grid');
        if (!content || !grid) return;

        const previous = grid.previousElementSibling;
        if (!previous) return;

        const walker = document.createTreeWalker(previous, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) nodes.push(node);

        let found = false;
        nodes.forEach(textNode => {
            if (found) {
                textNode.nodeValue = '';
                return;
            }
            const value = textNode.nodeValue || '';
            const match = value.search(/\bA\s*=\s*/i);
            if (match >= 0) {
                textNode.nodeValue = value.slice(0, match).replace(/[\s:;,.-]+$/, '').trimEnd();
                found = true;
            }
        });
    }

    function removeChoiceSummarySafely() {
        const content = document.querySelector('#exam-workspace #soal-content');
        if (!content) return;
        content.querySelectorAll('*').forEach(el => {
            if (el.children.length === 0 && /^Daftar pilihan\s*:/i.test((el.textContent || '').trim())) {
                el.style.display = 'none';
            }
        });
    }

    function apply() {
        sanitizeSavedAnswers();
        installStyles();
        removeMappingTextSafely();
        removeChoiceSummarySafely();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply, { once:true });
    } else {
        apply();
    }

    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            apply();
        });
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
})();
