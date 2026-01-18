import { db, rtdb, auth, storage } from "./firebase-client";
import { getAdminFirestore, getAdminDatabase, getAdminAuth } from "./firebase-admin";

// Client-side Firebase exports
export { db, rtdb, auth, storage };

// Server-side (Admin) Firebase exports
export const adminDb = getAdminFirestore;
export const adminRtdb = getAdminDatabase;
export const adminAuth = getAdminAuth;

// Helper function to execute operations with error handling
export async function executeDbOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        console.error('Database operation error:', error);
        throw error;
    }
}