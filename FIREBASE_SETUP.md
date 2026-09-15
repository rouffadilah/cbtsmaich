# Firebase / CBT SMAICH Setup

Project: `cbt-sekolah-7fed0`
App ID: `1:289218396137:web:366383efd1348edad3d578`

## 1. Authentication
Firebase Console → Authentication → Sign-in method → enable **Email/Password**.

Create each user in Firebase Authentication, then create a matching document:
`users/{uid}`

Example:
```json
{
  "nama": "Nama Siswa",
  "username": "username@cbt.smaich.id",
  "role": ["siswa"],
  "kelas": ["X IPA 1"]
}
```

Guru/admin profiles use `role: ["guru"]` or `role: ["admin"]`.

## 2. Firestore Rules
Deploy `firestore.rules` after reviewing the permissions:
```bash
firebase use cbt-sekolah-7fed0
firebase deploy --only firestore:rules
```

## 3. Important fix for the stuck exam page
`attempt.js` previously had the final closing brace for `selesaiUjian()` missing before the `DOMContentLoaded` override. This caused the browser error:
`Uncaught SyntaxError: Unexpected end of input`.

The current `attempt.js` closes the function correctly. `attempt.html` also uses a versioned script URL and the service worker cache version is bumped so GitHub Pages is less likely to serve an old JavaScript file.

After deploying, hard-refresh the site once (Ctrl+Shift+R) and, on phones, close the old PWA/browser tab and reopen the site.
