import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

(function () {
    let started = false;
    const activeIds = new Set();
    const token = () => String(Math.floor(100000 + Math.random() * 900000));

    function ensureUi() {
        if (document.getElementById('cbt-security-alerts')) return document.getElementById('cbt-security-alerts');
        const box = document.createElement('div');
        box.id = 'cbt-security-alerts';
        box.style.cssText = 'position:fixed;right:18px;top:18px;width:min(430px,calc(100vw - 36px));z-index:2147482000;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
        document.body.appendChild(box);
        return box;
    }

    function renderAlert(id, data) {
        const root = ensureUi();
        let card = document.getElementById(`security-alert-${id}`);
        if (!card) { card = document.createElement('div'); card.id = `security-alert-${id}`; root.appendChild(card); }
        const issued = data.resumeToken ? String(data.resumeToken) : 'MEMPROSES...';
        card.style.cssText = 'pointer-events:auto;background:#20283a;color:#fff;border:1px solid #475569;border-left:5px solid #ef4444;border-radius:14px;padding:15px 16px;box-shadow:0 15px 40px rgba(0,0,0,.28);font-family:Inter,system-ui,sans-serif;';
        card.innerHTML = `<div style="font-weight:900;font-size:1rem;margin-bottom:5px;">⚠️ Pelanggaran Ujian</div><div style="font-weight:800;color:#93c5fd;">${escapeHtml(data.nama || 'Siswa')}</div><div style="font-size:.82rem;color:#cbd5e1;margin:3px 0 8px;">${escapeHtml(data.mataPelajaran || '-')}</div><div style="font-size:.82rem;color:#fecaca;margin-bottom:10px;">${escapeHtml(data.reason || '-')}</div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#111827;border-radius:9px;padding:10px 12px;"><span style="font-size:.75rem;color:#94a3b8;">TOKEN PEMULIHAN</span><strong style="font-size:1.35rem;letter-spacing:4px;color:#34d399;">${issued}</strong></div><div style="font-size:.72rem;color:#94a3b8;margin-top:8px;">Siswa harus memasukkan token ini sebelum dapat melanjutkan.</div>`;
    }

    function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }

    async function issueToken(id, data) {
        if (data.resumeToken || data.status !== 'pending') return;
        const newToken = token();
        try {
            await updateDoc(doc(db, 'security_violations', id), { resumeToken: newToken, status: 'ready', tokenIssuedAt: serverTimestamp(), tokenIssuedBy: auth.currentUser?.uid || null });
        } catch (error) { console.error('[CBT Security] Gagal menerbitkan token:', error); }
    }

    function start() {
        if (started) return; started = true;
        const q = query(collection(db, 'security_violations'), where('status', '==', 'pending'));
        onSnapshot(q, snap => {
            snap.docChanges().forEach(change => {
                if (change.type === 'removed') return;
                const data = change.doc.data(); const id = change.doc.id;
                renderAlert(id, data);
                if (!data.resumeToken && data.status === 'pending' && !activeIds.has(id)) {
                    activeIds.add(id);
                    issueToken(id, data);
                }
            });
        }, error => console.error('[CBT Security] Gagal memantau pelanggaran:', error));
    }

    onAuthStateChanged(auth, async user => {
        if (!user) return;
        start();
    });
})();
