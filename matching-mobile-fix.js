// CBT SMAICH - Responsive matching question layout
// Mobile: statement full-width, downward arrow, answer selector below.
(function () {
    const STYLE_ID = 'cbt-matching-mobile-fix-v1';

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

                /* Header */
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

                /* Kolom tengah desktop tidak diperlukan di HP. */
                #exam-workspace #soal-content .matching-grid > div:nth-child(2) {
                    display: none !important;
                }

                /* Setiap pernyataan menjadi blok penuh. */
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

                /* Panah desktop diubah menjadi panah ke bawah. */
                #exam-workspace #soal-content .matching-grid > .matching-arrow {
                    grid-column: 1 / -1 !important;
                    display: flex !important;
                    width: 100% !important;
                    min-height: 30px !important;
                    box-sizing: border-box !important;
                    align-items: center !important;
                    justify-content: center !important;
                    background: #1f2937 !important;
                    color: #93c5fd !important;
                    border-top: 0 !important;
                    border-bottom: 0 !important;
                }

                #exam-workspace #soal-content .matching-grid > .matching-arrow i {
                    display: none !important;
                }

                #exam-workspace #soal-content .matching-grid > .matching-arrow::after {
                    content: '↓' !important;
                    font-size: 26px !important;
                    line-height: 1 !important;
                    font-weight: 900 !important;
                }

                /* Dropdown selalu di bawah pernyataan. */
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

                /* Daftar pilihan tetap rapi di layar kecil. */
                #exam-workspace #soal-content > div:last-child {
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    overflow-wrap: anywhere !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function apply() {
        installStyles();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply, { once: true });
    } else {
        apply();
    }

    // attempt.js menggambar ulang #soal-content setiap berpindah soal.
    // CSS di atas tetap berlaku, tetapi observer memastikan style terpasang setelah render ulang.
    const observer = new MutationObserver(() => installStyles());
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
