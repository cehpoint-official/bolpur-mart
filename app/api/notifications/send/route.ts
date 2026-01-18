import { NextResponse } from "next/server";
import { getAdminMessaging, getAdminFirestore } from "@/lib/firebase-admin";

export async function POST(request: Request) {
    try {
        const { chatId, text, senderName } = await request.json();
        const messaging = getAdminMessaging();
        const db = getAdminFirestore();

        // In a real app, you'd fetch the FCM tokens for all members of the chat
        const chatSnapshot = await db.collection("chats").doc(chatId).get();
        const chatData = chatSnapshot.data();

        if (!chatData) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        // Mock: Send to a topic for the chat
        const message = {
            notification: {
                title: `New message in ${chatData.name || "Chat"}`,
                body: `${senderName}: ${text.slice(0, 100)}`,
            },
            topic: chatId,
        };

        const response = await messaging.send(message);

        return NextResponse.json({ messageId: response, status: "success" });
    } catch (error: any) {
        console.error("FCM Send Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
