import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAMXmQzjdFN3-XjHB2SpjbpQXCAFYsyNhI",
  authDomain: "gentrophyos.firebaseapp.com",
  projectId: "gentrophyos",
  storageBucket: "gentrophyos.firebasestorage.app",
  messagingSenderId: "408025076426",
  appId: "1:408025076426:web:6b20b8de5c30e0281c9a33",
  measurementId: "G-SW7Y0V2PR3"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
