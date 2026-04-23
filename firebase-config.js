import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB8R0VNO0noUlkcUcjBkpsGFrYPdtA7KxM",
  authDomain: "cbt-sekolah-7fed0.firebaseapp.com",
  projectId: "cbt-sekolah-7fed0",
  storageBucket: "cbt-sekolah-7fed0.firebasestorage.app",
  messagingSenderId: "289218396137",
  appId: "1:289218396137:web:366383efd1348edad3d578",
  measurementId: "G-GF6PJWK2S5"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);