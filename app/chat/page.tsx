"use client";

import { useState } from "react";
import {
  ChatNavbar,
  ChatInputBox,
  
} from "@/components/chat";

import { useRouter } from "next/navigation";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ prompt: input.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to create chat");
      }
      console.log("Chat created successfully:", data);
      router.push(`/chat/${data.chat_id}`);
    } catch (err) {
      console.error("Error creating chat:", err);
      const message = err instanceof Error ? err.message : "Failed to create chat. Please try again.";
      setError(message);
      setIsLoading(false);
    }
  };


  



  return (
    <div className="min-h-screen w-full relative bg-black">
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(226, 232, 240, 0.15), transparent 70%), #000000",
        }}
      />

      <ChatNavbar />

      <div className="relative z-10 min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4">

        <div className="mb-12">
          <h1 className="text-5xl font-semibold text-white text-center tracking-tight">
            FLAKY AI
          </h1>
        </div>

        <div className="w-full max-w-2xl">
          <ChatInputBox
            input={input}
            isLoading={isLoading}
            onInputChange={setInput}
            onSubmit={handleSubmit}
          />

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
