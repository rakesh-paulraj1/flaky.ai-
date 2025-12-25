"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import apiClient from "@/api/client";
import {
  ChatIdHeader,
  MessageBubble,
  ToolCallsDropdown,
  PreviewPanel,
  ChatInput,
} from "@/components/chat";
import { getAllToolCalls } from "@/lib/chat-utils";
import type { Message } from "@/lib/chat-types";

export default function ChatIdPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [showAllToolsDropdown, setShowAllToolsDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const urlCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkUrlReady = useCallback(async (url: string): Promise<boolean> => {
    try {
      await fetch(url, {
        method: "HEAD",
        mode: "no-cors",
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const pollUrlUntilReady = useCallback((url: string) => {
    setIsCheckingUrl(true);
    let attempts = 0;
    const maxAttempts = 30;

    if (urlCheckIntervalRef.current) clearInterval(urlCheckIntervalRef.current);

    const checkInterval = setInterval(async () => {
      attempts++;
      const isReady = await checkUrlReady(url);

      if (isReady || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        setIsCheckingUrl(false);
        setAppUrl(url);
      }
    }, 1500);

    urlCheckIntervalRef.current = checkInterval;
  }, [checkUrlReady]);

  const fetchSandboxInfo = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`/api/sandbox/${chatId}`);
      if (!res.ok) throw new Error("Failed to load sandbox");
      const data = await res.json();
      
      const url = `https://${data.host}`;
      pollUrlUntilReady(url);
    } catch (err) {
      console.error("Error fetching sandbox info:", err);
    }
  }, [chatId, pollUrlUntilReady]);

  useEffect(() => {
    if (chatId) {
      fetchSandboxInfo();
    }
    setIsLoading(false);
  }, [chatId, fetchSandboxInfo]);

  useEffect(() => {
    return () => {
      if (urlCheckIntervalRef.current) {
        clearInterval(urlCheckIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const chatWidth = (mouseX / rect.width) * 100;
      const newPreviewWidth = 100 - chatWidth;

      if (chatWidth > 20 && chatWidth < 80) {
        setPreviewWidth(newPreviewWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isBuilding) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsBuilding(true);
    try {
      const response = await apiClient.post<Message>("/api/chat", {
        chatId,
        prompt: userMessage.content
      });
      
      if (response.data) {
        setMessages((prev) => [...prev, response.data]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-black relative overflow-hidden"
      ref={containerRef}
    >
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 100% at 10% 0%, rgba(226, 232, 240, 0.15), transparent 65%), #000000",
        }}
      />

      <div className="relative z-10 h-screen flex flex-col">
        <ChatIdHeader
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview(!showPreview)}
          onNewChat={() => router.push("/chat")}
          onBack={() => router.push("/chat")} 
        />

        <div className="flex-1 flex overflow-hidden">
          <div
            className="flex flex-col border-r border-white/5"
            style={{
              width: showPreview ? `${100 - previewWidth}%` : "100%",
              transition: isDragging ? "none" : "width 0.3s ease-out",
            }}>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-2 text-white/60">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading messages...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              ) : null}

              {messages.map((msg, index) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isLastMessage={index === messages.length - 1}
                  currentTool={null}
                />
              ))}

              <div ref={messagesEndRef} />
            </div>

            <ToolCallsDropdown
              toolCalls={getAllToolCalls(messages)}
              isExpanded={showAllToolsDropdown}
              onToggle={() => setShowAllToolsDropdown(!showAllToolsDropdown)}
            />

            <ChatInput
              input={input}
              wsConnected={true}
              isBuilding={isBuilding}
              onInputChange={setInput}
              onSubmit={handleSendMessage}
            />
          </div>

          {showPreview && (
            <div
              className="w-1 bg-white/5 hover:bg-white/20 cursor-col-resize transition-colors"
              onMouseDown={() => setIsDragging(true)}
              style={{ userSelect: "none" }}
            />
          )}

          {showPreview && (
            <PreviewPanel
              appUrl={appUrl}
              isCheckingUrl={isCheckingUrl}
              previewWidth={previewWidth}
            />
          )}
        </div>
      </div>
    </div>
  );
}