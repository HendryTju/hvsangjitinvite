// firebase-config.js - ES Module loading Firebase SDK from CDN
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDiXDcd5Q6g5xhhqlAZixkG37Mn7lEMHuY",
  authDomain: "hvsangjitinvite.firebaseapp.com",
  projectId: "hvsangjitinvite",
  storageBucket: "hvsangjitinvite.firebasestorage.app",
  messagingSenderId: "854593856142",
  appId: "1:854593856142:web:717b5d6a77cd7907115fdf"
};

let app;
let auth;
let db;
let storage;
let isEmulated = false;

// Check if credentials have been filled in
const hasRealCredentials = 
  firebaseConfig.apiKey && 
  !firebaseConfig.apiKey.includes("YOUR_") && 
  firebaseConfig.projectId && 
  !firebaseConfig.projectId.includes("YOUR_");

if (hasRealCredentials) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Firebase initialized successfully in real production mode.");
  } catch (error) {
    console.warn("Failed to initialize Firebase with provided credentials. Falling back to local emulator mode.", error);
    isEmulated = true;
  }
} else {
  console.log("Firebase credentials not set. Operating in local-only Emulated Mode.");
  isEmulated = true;
}

export { auth, db, storage, isEmulated, firebaseConfig };
export { getApps };
export { getAuth, getFirestore, getStorage };
export { initializeApp };
