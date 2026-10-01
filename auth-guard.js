import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * Centralized authentication/authorization guard.
 * Firebase Auth is the source of identity; Firestore users/{uid} is the
 * source of application role/profile. localStorage is never trusted for auth.
 */
export function normalizeRoles(value) {
    if (Array.isArray(value)) return value.map(v => String(v).trim().toLowerCase()).filter(Boolean);
    if (value == null) return [];
    return [String(value).trim().toLowerCase()].filter(Boolean);
}

export async function getAuthenticatedProfile() {
    const user = auth.currentUser;
    if (!user) return null;

    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return { user, profile: null, roles: [] };

    const profile = snap.data() || {};
    return { user, profile, roles: normalizeRoles(profile.role) };
}

export function waitForAuthenticatedProfile() {
    return new Promise(resolve => {
        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            unsubscribe();
            resolve(value);
        };

        const unsubscribe = onAuthStateChanged(auth, async user => {
            if (!user) return finish(null);
            try {
                finish(await getAuthenticatedProfile());
            } catch (error) {
                console.error('Gagal membaca profil pengguna:', error);
                finish({ user, profile: null, roles: [] });
            }
        });
    });
}

export async function requireAuth({ redirect = '/', allowedRoles = [] } = {}) {
    const session = await waitForAuthenticatedProfile();
    if (!session?.user) {
        window.location.replace(redirect);
        return null;
    }

    const allowed = normalizeRoles(allowedRoles);
    if (allowed.length > 0 && !session.roles.some(role => allowed.includes(role))) {
        window.location.replace('/attempt');
        return null;
    }

    if (!session.profile) {
        await signOut(auth).catch(() => {});
        window.location.replace(redirect);
        return null;
    }

    return session;
}

export async function signOutAndRedirect(path = '/') {
    await signOut(auth);
    try {
        localStorage.removeItem('userRole');
        localStorage.removeItem('userMapel');
        localStorage.removeItem('userKelas');
    } catch (_) {}
    window.location.replace(path);
}
