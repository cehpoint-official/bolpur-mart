import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export async function POST(request: Request) {
    try {
        const { idToken } = await request.json();
        const auth = getAdminAuth();

        // One-week session
        const expiresIn = 60 * 60 * 24 * 7 * 1000;
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

        const response = NextResponse.json({ status: "success" });

        response.cookies.set("session", sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        });

        return response;
    } catch (error: any) {
        console.error("Auth Login Error:", error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
}

export async function DELETE() {
    try {
        const response = NextResponse.json({ status: "success" });
        response.cookies.delete("session");
        return response;
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
