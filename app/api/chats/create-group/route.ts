import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

export async function POST(request: Request) {
    try {
        const { name, members, createdBy } = await request.json();
        const db = getAdminFirestore();

        const chatRef = await db.collection("chats").add({
            name,
            members: members || [],
            createdBy,
            type: "group",
            createdAt: new Date().toISOString(),
            lastMessage: null,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ chatId: chatRef.id, status: "success" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
