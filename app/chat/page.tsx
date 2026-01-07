"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChatNavbar,
  ChatInput,
} from "@/components/chat";
import { FileUpload } from "@/components/ui/file-upload";
import { Loader2 } from "lucide-react";
import type { Message } from "@/lib/chat-types";

export default function ChatPage() {
  const [showForm, setShowForm] = useState(true);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    productName: "",
    productDescription: "",
    ctaLink: "",
    videoPrompt: "",
  });
  const [files, setFiles] = useState<File[]>([]);
    const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);

  const handleFileUpload = (uploadedFiles: File[]) => {
    // Only accept the first file and validate it's an image
    if (uploadedFiles.length > 0) {
      const file = uploadedFiles[0];
      if (file.type.startsWith("image/")) {
        setFiles([file]);
        setError("");
      } else {
        setError("Please upload an image file only");
        setFiles([]);
      }
    }
  };

  const openStream = useCallback(() => {
    if (!chatId || streamRef.current) return;
    const es = new EventSource(`/api/chat/${chatId}/stream`);
    streamRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "start") {
          setIsBuilding(true);
        } else if (msg.type === "partial") {
          const payload = msg.payload || {};
          
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
            text = `${payload.e}`;
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
        } else if (msg.type === "done") {
          setIsBuilding(false);
        } else if (msg.type === "error") {
          setError(msg.message || "Streaming error");
          setIsBuilding(false);
        }
      } catch (err) {
        console.error("Stream parse error:", err);
      }
    };

    es.onerror = () => {
      es.close();
      streamRef.current = null;
    };
  }, [chatId]);

  useEffect(() => {
    if (chatId) {
      openStream();
      return () => {
        if (streamRef.current) {
          streamRef.current.close();
          streamRef.current = null;
        }
      };
    }
  }, [chatId, openStream]);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`/api/chat/${chatId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, [chatId]);

  useEffect(() => {
    if (chatId) {
      fetchMessages();
    }
  }, [chatId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productName.trim() || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const submitFormData = new FormData();
      submitFormData.append("productName", formData.productName);
      submitFormData.append("productDescription", formData.productDescription);
      submitFormData.append("ctaLink", formData.ctaLink);
      submitFormData.append("videoPrompt", formData.videoPrompt);
      submitFormData.append("files",files[0])
   
      const response = await fetch("/api/creative", {
        method: "POST",
        body: submitFormData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to create project");
      }
      
      console.log("Project created successfully:", data);
      setChatId(data.chat_id);
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl);
      }
      setShowForm(false);
      setIsLoading(false);
    } catch (err) {
      console.error("Error creating project:", err);
      const message = err instanceof Error ? err.message : "Failed to create project. Please try again.";
      setError(message);
      setIsLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsBuilding(true);

    try {
      const response = await fetch(`/api/chat/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      await fetchMessages();
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsBuilding(false);
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

      {showForm ? (
        <div className="relative z-10 min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8">
          <div className="mb-8">
            <h1 className="text-5xl font-semibold text-white text-center tracking-tight">
              Create AI Creative
            </h1>
            <p className="text-gray-400 text-center mt-2">
              Generate AI-powered video creatives for your product
            </p>
          </div>

          <div className="w-full max-w-3xl">
            <form
              onSubmit={handleCreativeSubmit}
              className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8 space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) =>
                    setFormData({ ...formData, productName: e.target.value })
                  }
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-transparent"
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Product Description
                </label>
                <textarea
                  value={formData.productDescription}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      productDescription: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-transparent resize-none"
                  placeholder="Describe your product, its features and benefits..."
                />
              </div>

              <div className="w-full border border-dashed bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
                <FileUpload onChange={handleFileUpload} />
              
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CTA Link
                </label>
                <input
                  type="url"
                  value={formData.ctaLink}
                  onChange={(e) =>
                    setFormData({ ...formData, ctaLink: e.target.value })
                  }
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-transparent"
                  placeholder="https://your-store.com/product"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Video Generation Prompt
                </label>
                <textarea
                  value={formData.videoPrompt}
                  onChange={(e) =>
                    setFormData({ ...formData, videoPrompt: e.target.value })
                  }
                  rows={4}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-transparent resize-none"
                  placeholder="Describe the video you want to generate (e.g., 'Create a dynamic video showcasing the product with smooth transitions and modern animations')"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !formData.productName.trim()}
                className="w-full px-4 py-3 rounded-md border border-neutral-300 bg-neutral-100 text-neutral-500 text-sm hover:-translate-y-1 transform transition duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Creating...
                  </span>
                ) : (
                  "Generate Creative"
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col h-[calc(100vh-60px)]">
          <div className="flex-1 overflow-hidden">
            {videoUrl ? (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
                <video
                  src={videoUrl}
                  className="max-w-full max-h-full"
                  controls
                  autoPlay
                  loop
                  muted
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
                <div className="text-center">
                  <Loader2 className="animate-spin h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">Generating your creative...</p>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input at Bottom */}
          <div className="border-t border-zinc-800 p-4 bg-black/50 backdrop-blur-sm">
            <ChatInput
              input={input}
              isBuilding={isBuilding}
              onInputChange={setInput}
              onSubmit={handleChatSubmit}
            />
          </div>
        </div>
      )}
    </div>
  );
}
