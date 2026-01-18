import * as admin from "firebase-admin";

const firebaseAdminConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

export function getFirebaseAdmin() {
    if (!admin.apps.length) {
        if (!firebaseAdminConfig.projectId || !firebaseAdminConfig.clientEmail || !firebaseAdminConfig.privateKey) {
            console.error("Firebase Admin config is missing environment variables.");
        }

        admin.initializeApp({
            credential: admin.credential.cert(firebaseAdminConfig),
            databaseURL: `https://${firebaseAdminConfig.projectId}-default-rtdb.firebaseio.com`,
        });
    }
    return admin;
}

export const getAdminFirestore = () => getFirebaseAdmin().firestore();
export const getAdminDatabase = () => getFirebaseAdmin().database();
export const getAdminAuth = () => getFirebaseAdmin().auth();
export const getAdminMessaging = () => getFirebaseAdmin().messaging();

export { admin };
