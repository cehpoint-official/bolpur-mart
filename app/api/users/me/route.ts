import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const session = cookies().get("session")?.value;

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const auth = getAdminAuth();
        const decodedToken = await auth.verifySessionCookie(session);
        const uid = decodedToken.uid;

        const db = getAdminFirestore();
        const userDoc = await db.collection("users").doc(uid).get();

        if (!userDoc.exists) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ user: { uid, ...userDoc.data() } });
    } catch (error: any) {
        console.error("Get User Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
