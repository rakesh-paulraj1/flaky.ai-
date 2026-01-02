"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
  const [files, setFiles] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const urlCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  const openStream = useCallback(() => {
    if (streamRef.current) return;
    const es = new EventSource(`/api/chat/${chatId}/stream`);
    streamRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "start") {
          setIsBuilding(true);
        } else if (msg.type === "partial") {
          const payload = msg.payload || {};
          
          // Extract text content from different event types
          let text = "";
          if (payload.message) {
            text = payload.message;
          } else if (payload.e === "file_created" && payload.file_path) {
            text = `Created file: ${payload.file_path}`;
          } else if (payload.e === "tool_started" && payload.tool_name) {
            text = `Running tool: ${payload.tool_name}`;
          } else if (payload.e === "tool_completed" && payload.tool_name) {
            text = `Completed: ${payload.tool_name}`;
          } else if (payload.e === "planner_complete") {
            text = "✓ Planning completed";
          } else if (payload.e === "builder_complete") {
            text = "✓ Build completed";
          } else if (payload.e === "validation_success") {
            text = "✓ Validation successful";
          } else if (payload.e === "app_check_complete") {
            text = "✓ Application check completed";
          } else if (payload.e) {
            text = `Event: ${payload.e}`;
          }
          
          if (text) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && last.id === msg.id) {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...last,
                  content: (last.content || "") + "\n" + text,
                };
                return updated;
              }
              return [
                ...prev,
                {
                  id: msg.id,
                  role: "assistant",
                  content: text,
                  created_at: new Date().toISOString(),
                },
              ];
            });
          }
        } else if (msg.type === "message") {
        } else if (msg.type === "done") {
          setIsBuilding(false);
        } else if (msg.type === "error") {
          setError(msg.message || "Streaming error");
          setIsBuilding(false);
        }
      } catch {
      }
    };

    es.onerror = () => {
      console.error("EventSource error");
    };
  }, [chatId]);

  const closeStream = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
  }, []);

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

  const pollUrlUntilReady = useCallback(async (url: string) => {
    setIsCheckingUrl(true);
    console.log("Starting URL health check for:", url);
    let attempts = 0;
    const maxAttempts = 20; 

    const checkInterval = setInterval(async () => {
      attempts++;
      console.log(`Health check attempt ${attempts}/${maxAttempts}`);

      const isReady = await checkUrlReady(url);

      if (isReady || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        setIsCheckingUrl(false);

        if (isReady) {
          console.log("URL is ready, setting iframe");
          setAppUrl(url);
        } else {
          console.log("Max attempts reached, setting iframe anyway");
          setAppUrl(url);
        }
      }
    }, 1000);

    urlCheckIntervalRef.current = checkInterval;
  }, [checkUrlReady]);


  useEffect(() => {
    if (!chatId) return;

    const fetchMessagesAndStream = async () => {
      try {
        setIsLoading(true);
        
        // Load messages
        const res = await fetch(`/api/chat/${chatId}/messages`);
        if (!res.ok) throw new Error("Failed to load messages");
        const loadedMessages: Message[] = await res.json();
        setMessages(loadedMessages);

        // Load sandbox info (ensures sandbox is created/started)
        try {
          const sandboxRes = await fetch(`/api/sandbox/${chatId}`);
          if (sandboxRes.ok) {
            const data = await sandboxRes.json();
            const url = `https://${data.host}`;
            if (data.files) setFiles(data.files);
            pollUrlUntilReady(url);
          }
        } catch (err) {
          console.error("Error fetching sandbox info:", err);
        }

        // Open stream if this is a new chat
        const hasAssistantMessage = loadedMessages.some((msg) => msg.role === "assistant");
        if (!hasAssistantMessage) {
          openStream();
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessagesAndStream();

    return () => {
      closeStream();
    };
  }, [chatId, openStream, closeStream, checkUrlReady, pollUrlUntilReady]);

  useEffect(() => {
    return () => {
      if (urlCheckIntervalRef.current) {
        clearInterval(urlCheckIntervalRef.current);
      }
    };
  }, []);

  // Cleanup: Close sandbox when leaving the page
  useEffect(() => {
    return () => {
      if (chatId) {
        // Call cleanup endpoint when component unmounts
        fetch(`/api/sandbox/${chatId}/cleanup`, { method: "DELETE" }).catch(() => {
          // Ignore errors on cleanup
        });
      }
    };
  }, [chatId]);

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
  try {
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsBuilding(true);

    const res = await fetch(`/api/chat/${chatId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: userMessage.content }),
    });
    if (!res.ok) throw new Error("Failed to save message");

     openStream();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to send message");
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
              projectId={chatId}
              files={files}
            />
          )}                                                                                                                    
        </div>
      </div>
    </div>
  );
}