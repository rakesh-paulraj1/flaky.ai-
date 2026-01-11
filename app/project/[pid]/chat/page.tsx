"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatNavbar } from "@/components/chat";
import { Loader2,  X } from "lucide-react";
import { getProjectwithid } from "@/app/actions/projects";
import { HoverBorderGradient } from "@/components/ui/hoverbutton";
import { getChatMessages } from "@/app/actions/chats";
interface ProjectData {
  id: string;
  productName: string;
  productDetails: string;
  imageLink: string;
  imageGenerationEntities: string;
  generatedimageLink: string | null;
  state: string;
  chatId: string;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function ProjectChatPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.pid as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState<ProjectData | null>(null);
  
  const [showDialog, setShowDialog] = useState(false);
  const [catchyPhrase, setCatchyPhrase] = useState("");
  const [ctaInputType, setCtaInputType] = useState<"email" | "phone">("email");
  const [apiSpecification, setApiSpecification] = useState("");

  useEffect(() => {
    if (!projectId) {
      return;
    }

   
    
    const fetchProjectAndMessages = async () => {
      const projectData = await getProjectwithid(projectId);
      setProject(projectData);
      setIsLoading(false);

      if (projectData?.chatId) {
        const messages = await getChatMessages(projectData.chatId);
        if (messages.length > 0) {
          router.push(`/project/${projectId}/chat/${projectData.chatId}`);
        }
      }
    };

    fetchProjectAndMessages();
  }, [projectId,router]);

  const handleGenerateWebsite = async () => {
    if (!catchyPhrase.trim() || !project?.chatId) return;

    setShowDialog(false);

    try {
      const response = await fetch(`/api/chat/${project.chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Catchy Phrase: ${catchyPhrase}\nCTA Input Type: ${ctaInputType === "email" ? "Email Address" : "Phone Number"}\nAPI Specification for CTA Form: ${apiSpecification || "None provided"}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate website");
      }

      router.push(`/project/${projectId}/chat/${project.chatId}`);
    } catch (err) {
      console.error("Error generating website:", err);
      setError(err instanceof Error ? err.message : "Failed to generate website");
    }
  };

  if (!isLoading && (error || !project)) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Project not found"}</p>
          <button
            onClick={() => router.push("/creative")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Go to Creative Page
          </button>
        </div>
      </div>
    );
  }

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

      <div className="relative z-10 flex flex-col h-[calc(100vh-60px)]">
        <div className="flex-1 overflow-hidden p-4">
          <div className="h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center bg-zinc-900/50 rounded-lg mb-4 relative">
              {isLoading || !project?.imageLink ? (
                <div className="text-center">
                  <Loader2 className="animate-spin h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">Loading creative...</p>
                </div>
              ) : (
                <Image
                  src={project.generatedimageLink || project.imageLink}
                  alt="Product"
                  width={500}
                  height={500}
                  className="max-w-full max-h-full rounded-lg"
                />
              )}
              
             
              <div className="absolute top-4 right-4">
                <HoverBorderGradient  containerClassName="rounded-full"
        as="button"
        className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2" onClick={() => setShowDialog(true)}
                  >
                                    
                 
               
                    
                      <span>Generate Website</span>
            
               
                  </HoverBorderGradient>
               
              </div>
            </div>

          
          </div>
        </div>

        {error && (
          <div className="px-4 pb-4">
            <div className="max-w-2xl mx-auto p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          </div>
        )}
      </div>
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDialog(false)}
          />

          <div className="relative bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
            <button
              onClick={() => setShowDialog(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

          
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            
                Generate Website
              </h2>
              <p className="text-white/50 text-sm mt-1">
                Customize your website generation
              </p>
            </div>

      
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Catchy Phrase for Product *
                </label>
                <input
                  type="text"
                  value={catchyPhrase}
                  onChange={(e) => setCatchyPhrase(e.target.value)}
                  placeholder="e.g., Transform your ideas into reality"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  CTA Input Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCtaInputType("email")}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      ctaInputType === "email"
                        ? "bg-purple-600 text-white"
                        : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    Email ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setCtaInputType("phone")}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      ctaInputType === "phone"
                        ? "bg-purple-600 text-white"
                        : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    }`}>
                    Phone Number
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  API Specification for CTA Form
                </label>
                <textarea
                  value={apiSpecification}
                  onChange={(e) => setApiSpecification(e.target.value)}
                  placeholder={ctaInputType === "email" 
                    ? `curl -X POST http://your-api.com/api/subscribe \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com"}'`
                    : `curl -X POST http://your-api.com/api/phones \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"+1234567890"}'`
                  }
                  rows={4}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none font-mono text-sm"
                />
              </div>
            </div>

       
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 text-white/70 hover:text-white transition-colors">
                Cancel
              </button>
              <HoverBorderGradient  containerClassName="rounded-full"
        as="button"
                onClick={handleGenerateWebsite}
                disabled={!catchyPhrase.trim()}
              >
             
                Generate
              </HoverBorderGradient>
               
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
