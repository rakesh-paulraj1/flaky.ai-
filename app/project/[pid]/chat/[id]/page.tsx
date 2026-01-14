"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, BarChart3 } from "lucide-react";
import {
  ChatIdHeader,
  MessageBubble,
  PreviewPanel,
  ChatInput,
} from "@/components/chat";

import type { Message } from "@/lib/chat-types";
import { getChatMessages } from "@/app/actions/chats";

export default function ChatIdPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);

  const [files, setFiles] = useState<string[]>([]);
  const [projectState, setProjectState] = useState<string>("INITIAL");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"chat" | "analytics">("chat");
  const [analytics, setAnalytics] = useState<{ totalViews: number; viewsBySource: Array<{ source: string; count: number }>; } | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const urlCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const hasStreamedRef = useRef<boolean>(false);

  const openStream = useCallback(() => {
    if (streamRef.current && streamRef.current.readyState !== EventSource.CLOSED) {
      console.log("Stream already active, skipping duplicate call");
      return;
    }
 
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    
    const streamUrl = `/api/chat/${chatId}/stream`;
    console.log("Opening EventSource stream:", streamUrl);
    
    const es = new EventSource(streamUrl);
    streamRef.current = es;

    es.onopen = () => {
      console.log("EventSource connection opened successfully");
    };

    es.onmessage = (e) => {
      console.log("EventSource message received:", e.data.substring(0, 100));
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "start") {
          console.log("Stream started with id:", msg.id);
          setIsBuilding(true);
        } else if (msg.type === "partial") {
          const payload = msg.payload || {};
          const text = payload.message || "";
          
          if (text) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && last.id === msg.id) {
                const updated = [...prev];
                const newContent = last.content + "\n\n" + text;
                updated[updated.length - 1] = {
                  ...last,
                  content: newContent.trim(),
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
          console.log("Message type received");
        } else if (msg.type === "done") {
          console.log("Stream done");
          setIsBuilding(false);
          es.close();
          streamRef.current = null;
        } else if (msg.type === "error") {
          console.error("Stream error:", msg.message);
          setIsBuilding(false);
          es.close();
          streamRef.current = null;
        }
      } catch (parseError) {
        console.error("Failed to parse stream message:", parseError, e.data);
      }
    };

    es.onerror = (error) => {
      console.error("EventSource error:", error);
      console.log("EventSource readyState:", es.readyState);
      if (es.readyState === EventSource.CLOSED) {
        console.log("EventSource connection was closed");
        setIsBuilding(false);
        streamRef.current = null;
      }
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
      const isReady = await checkUrlReady(url);
      if (isReady || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        setIsCheckingUrl(false);

        if (isReady) {
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
        try {
          const projectRes = await fetch(`/api/sandbox/${chatId}`);
          if (projectRes.ok) {
            const data = await projectRes.json();
            if (data.projectId) setProjectId(data.projectId);
            if (data.projectState) setProjectState(data.projectState);
            
            if (data.projectState === "DEPLOYED" && data.deployedUrl) {
              setDeployedUrl(data.deployedUrl);
              setAppUrl(data.deployedUrl);
              setIsCheckingUrl(false);
              setViewMode("analytics");
              return; 
              
            } else {
              const url = `https://${data.host}`;
              if (data.files) setFiles(data.files);
              await pollUrlUntilReady(url);
            }
          }
        } catch (err) {
          console.error("Error fetching project info:", err);
        }

        const fetchedMessages = await getChatMessages(chatId);
        setMessages(fetchedMessages);

        if (fetchedMessages.length > 0 && !hasStreamedRef.current) {
          const lastMessage = fetchedMessages[fetchedMessages.length - 1];
          if (lastMessage.role === "user") {
            hasStreamedRef.current = true;
            openStream();
          }
        }

      } catch (err) {
        console.error("Error fetching messages:", err);
       
      } finally {
        
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

  useEffect(() => {
    return () => {
      if (chatId) {
     
        fetch(`/api/sandbox/${chatId}/cleanup`, { method: "DELETE" }).catch(() => {
        });
      }
    };
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (viewMode === "analytics" && projectId) {
      fetchAnalytics();
    }
  }, [viewMode, projectId]);

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
    setIsBuilding(false);
  }
};


  const fetchAnalytics = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/analytics/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
  };
  const handleDeploy = async () => {
    if (!projectId) return;
    setIsDeploying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setDeployedUrl(data.deployedUrl);
        setAppUrl(data.deployedUrl);
        setProjectState("DEPLOYED");
        setViewMode("analytics");
      } else {
        console.error("Deploy failed:", data.error);
      }
    } catch (err) {
      console.error("Deploy error:", err);
    } finally {
      setIsDeploying(false);
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
        <div className="flex items-center justify-between shrink-0">
          <ChatIdHeader
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
            onBack={() => router.push("/")}
          />
        </div>

     
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div
            className="flex flex-col border-r border-white/5"
            style={{
              width: showPreview ? `${100 - previewWidth}%` : "100%",
              transition: isDragging ? "none" : "width 0.3s ease-out",
            }}>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {viewMode === "analytics" ? (
                <div className="h-full flex items-center justify-center">
                  {analytics ? (
                    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 max-w-lg w-full">
                      <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                        <BarChart3 className="w-6 h-6" /> Analytics
                      </h2>
                      <div className="space-y-6">
                        <div className="bg-white/5 rounded-lg p-6 text-center">
                          <p className="text-4xl font-bold text-white">{analytics.totalViews}</p>
                          <p className="text-white/60 text-sm mt-1">Total Page Views</p>
                        </div>
                        {analytics.viewsBySource.length > 0 && (
                          <div>
                            <p className="text-white/70 text-sm mb-3">Views by Source</p>
                            <div className="space-y-2">
                              {analytics.viewsBySource.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm bg-white/5 rounded-lg px-4 py-2">
                                  <span className="text-white/80">{item.source}</span>
                                  <span className="text-white font-medium">{item.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-white/60">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Loading analytics...</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                

                  {messages.map((msg, index) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isLastMessage={index === messages.length - 1}
                      currentTool={null}
                    />
                  ))}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <ChatInput
              input={input}
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
              onDeploy={handleDeploy}
              isDeploying={isDeploying}
              deployedUrl={deployedUrl}
              isDeployedProject={projectState === "DEPLOYED"}
            />
          )}                                                                                                                    
        </div>
      </div>
    </div>
  );
}