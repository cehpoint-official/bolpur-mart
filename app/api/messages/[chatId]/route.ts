import { NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/firebase-admin";

export async function GET(
    request: Request,
    { params }: { params: { chatId: string } }
) {
    try {
        const { chatId } = params;
        const rtdb = getAdminDatabase();
        const messagesRef = rtdb.ref(`messages/${chatId}`);

        // Fetch last 50 messages
        const snapshot = await messagesRef.orderByChild("timestamp").limitToLast(50).once("value");
        const messages = snapshot.val();

        return NextResponse.json({ messages: messages ? Object.values(messages) : [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: { chatId: string } }
) {
    try {
        const { chatId } = params;
        const { message } = await request.json();
        const rtdb = getAdminDatabase();
        const messagesRef = rtdb.ref(`messages/${chatId}`);

        const newMessageRef = messagesRef.push();
        const timestamp = Date.now();

        await newMessageRef.set({
            ...message,
            id: newMessageRef.key,
            timestamp,
            chatId,
        });

        return NextResponse.json({ messageId: newMessageRef.key, status: "success" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
