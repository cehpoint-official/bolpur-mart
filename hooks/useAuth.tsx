"use client";

import { useEffect, createContext, useContext } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { AuthStore } from "@/types/auth";
import { FirebaseAuthService } from "@/lib/firebase-services";

const AuthContext = createContext<AuthStore | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const authStore = useAuthStore();

    useEffect(() => {
        // Use the guarded service method instead of raw Firebase
        const unsubscribe = FirebaseAuthService.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // Sync session cookie with backend
                    const idToken = await firebaseUser.getIdToken();
                    await fetch("/api/auth/login", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ idToken }),
                    });
                } catch (error) {
                    console.error("Failed to sync session:", error);
                }
            } else {
                try {
                    // Clear session cookie
                    await fetch("/api/auth/login", { method: "DELETE" });
                } catch (error) {
                    console.error("Failed to clear session:", error);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={authStore}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
