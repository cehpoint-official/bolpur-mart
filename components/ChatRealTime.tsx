"use client";

import React, { useEffect, useState, useRef } from "react";
import { ref, onValue, push, set, query, limitToLast } from "firebase/database";
import { rtdb } from "@/lib/firebase-client";
import { transformMessage } from "@/lib/ai-service";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: number;
}

export function ChatRealTime({ chatId }: { chatId: string }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const messagesRef = query(ref(rtdb, `messages/${chatId}`), limitToLast(50));
        const unsubscribe = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const messageList = Object.values(data) as Message[];
                setMessages(messageList.sort((a, b) => a.timestamp - b.timestamp));
            }
        });

        return () => unsubscribe();
    }, [chatId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !user) return;

        const originalText = inputText;
        setInputText("");

        // AI Transform
        const transformedText = await transformMessage(originalText);

        const messagesRef = ref(rtdb, `messages/${chatId}`);
        const newMessageRef = push(messagesRef);

        await set(newMessageRef, {
            id: newMessageRef.key,
            text: transformedText,
            senderId: user.uid,
            senderName: user.displayName || user.email,
            timestamp: Date.now(),
        });

        // Send notification via API
        await fetch("/api/notifications/send", {
            method: "POST",
            body: JSON.stringify({
                chatId,
                text: transformedText,
                senderName: user.displayName || user.email,
            }),
        });
    };

    return (
        <div className="flex flex-col h-[600px] border rounded-lg overflow-hidden bg-background">
            <ScrollArea className="flex-1 p-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`mb-4 flex ${msg.senderId === user?.uid ? "justify-end" : "justify-start"
                            }`}
                    >
                        <div
                            className={`max-w-[70%] p-3 rounded-lg ${msg.senderId === user?.uid
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                }`}
                        >
                            <p className="text-xs opacity-70 mb-1">{msg.senderName}</p>
                            <p>{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </ScrollArea>
            <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
                <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                />
                <Button type="submit">Send</Button>
            </form>
        </div>
    );
}
