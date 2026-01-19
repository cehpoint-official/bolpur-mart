import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getMessaging, isSupported } from "firebase/messaging";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if API key is present
let app: any;
let auth: any;
let db: any;
let rtdb: any;
let storage: any;

if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    console.warn("Firebase API Key is missing. Firebase features will be disabled.");
}

try {
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        rtdb = getDatabase(app);
        storage = getStorage(app);
    } else {
        // Provide dummy or null values to prevent crashing
        app = null;
        auth = null;
        db = null;
        rtdb = null;
        storage = null;
    }
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

// Messaging is only supported in browser environments
const messaging = async () => {
    if (typeof window === "undefined" || !app) return null;
    const supported = await isSupported();
    return supported ? getMessaging(app) : null;
};

export { app, auth, db, rtdb, storage, messaging };
