import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

(function () {
    if (!/\/dashboard(?:\.html)?\/?$/.test(window.location.pathname)) return;
    let started = false;
    let auth = null;
    let db = null;
    const activeIds = new Set();
    const latestByUid = new Map();
    const token = () => String(Math.floor(100000 + Math.random() * 900000));

    function ensureUi() {
        if (document.getElementById('cbt-security-alerts')) return document.getElementById('cbt-security-alerts');
        const box = document.createElement('div');
        box.id = 'cbt-security-alerts';
        box.style.cssText = 'position:fixed;right:18px;top:18px;width:min(430px,calc(100vw - 36px));max-height:calc(100vh - 36px);overflow:auto;z-index:2147482000;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
        document.body.appendChild(box);
        return box;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[ch]));
    }

    function activeRecords() {
        return [...latestByUid.values()].sort((a, b) => {
            const at = a.createdAt?.toMillis?.() || 0;
            const bt = b.createdAt?.toMillis?.() || 0;
            return bt - at;
        });
    }

    function renderAll() {
        const root = ensureUi();
        root.innerHTML = '';
        activeRecords().forEach(data => renderAlert(data.id, data));
        root.style.display = activeRecords().length ? 'flex' : 'none';
    }

    function renderAlert(id, data) {
        const root = ensureUi();
        const card = document.createElement('div');
        card.id = `security-alert-${id}`;
        const issued = data.resumeToken ? String(data.resumeToken) : 'MEMPROSES...';
        const statusLabel = data.status === 'pending' ? 'Menunggu penerbitan token...' : 'Token aktif';
        card.style.cssText = 'pointer-events:auto;background:#20283a;color:#fff;border:1px solid #475569;border-left:5px solid #ef4444;border-radius:14px;padding:15px 16px;box-shadow:0 15px 40px rgba(0,0,0,.28);font-family:Inter,system-ui,sans-serif;';
        card.innerHTML = `<div style="font-weight:900;font-size:1rem;margin-bottom:5px;">⚠️ Pelanggaran Ujian</div><div style="font-weight:800;color:#93c5fd;">${escapeHtml(data.nama||'Siswa')}</div><div style="font-size:.82rem;color:#cbd5e1;margin:3px 0 8px;">${escapeHtml(data.mataPelajaran||'-')}</div><div style="font-size:.82rem;color:#fecaca;margin-bottom:10px;">${escapeHtml(data.reason||'-')}</div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#111827;border-radius:9px;padding:10px 12px;"><span style="font-size:.75rem;color:#94a3b8;">TOKEN PEMULIHAN</span><strong style="font-size:1.35rem;letter-spacing:4px;color:#34d399;">${issued}</strong></div><div style="font-size:.72rem;color:#94a3b8;margin-top:8px;">${statusLabel}. Siswa harus memasukkan token ini sebelum dapat melanjutkan.</div><button type="button" data-close="${escapeHtml(id)}" style="margin-top:10px;width:100%;padding:8px 10px;border:1px solid #475569;border-radius:8px;background:#111827;color:#cbd5e1;font-weight:700;cursor:pointer;">Tutup notifikasi lama</button>`;
        card.querySelector('[data-close]').addEventListener('click', async () => {
            try {
                await updateDoc(doc(db, 'security_violations', id), { status:'dismissed', dismissedAt:serverTimestamp(), dismissedBy:auth?.currentUser?.uid||null });
                latestByUid.delete(String(data.uid));
                renderAll();
            } catch (error) {
                console.error('[CBT Security] Gagal menutup notifikasi:', error);
            }
        });
        root.appendChild(card);
    }

    async function issueToken(id, data) {
        if (data.resumeToken || data.status !== 'pending' || !db) return;
        try {
            await updateDoc(doc(db, 'security_violations', id), {
                resumeToken: token(),
                status:'ready',
                tokenIssuedAt:serverTimestamp(),
                tokenIssuedBy:auth?.currentUser?.uid||null
            });
        } catch (error) {
            console.error('[CBT Security] Gagal menerbitkan token:', error);
        }
    }

    function start() {
        if (started || !db) return;
        started = true;
        const q = query(collection(db,'security_violations'),where('status','in',['pending','ready']));
        onSnapshot(q, snap => {
            snap.docChanges().forEach(change => {
                const id = change.doc.id;
                const data = { id, ...change.doc.data() };
                const uid = String(data.uid || id);
                if (change.type === 'removed') {
                    if (latestByUid.get(uid)?.id === id) latestByUid.delete(uid);
                    return;
                }
                // One active recovery request per student: keep only the newest.
                const previous = latestByUid.get(uid);
                const previousTime = previous?.createdAt?.toMillis?.() || 0;
                const currentTime = data.createdAt?.toMillis?.() || Date.now();
                if (!previous || currentTime >= previousTime) latestByUid.set(uid, data);

                if (!data.resumeToken && data.status === 'pending' && !activeIds.has(id)) {
                    activeIds.add(id);
                    issueToken(id, data);
                }
            });
            renderAll();
        }, error => console.error('[CBT Security] Gagal memantau pelanggaran:',error));
    }

    async function boot() {
        try {
            const firebase = await import('./firebase-config.js');
            auth = firebase.auth;
            db = firebase.db;
            if (auth) onAuthStateChanged(auth,user=>{ if(user) start(); });
        } catch(error) {
            console.error('[CBT Security] Gagal memuat Firebase:',error);
        }
    }

    boot();
})();
