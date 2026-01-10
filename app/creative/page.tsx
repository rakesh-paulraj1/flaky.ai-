"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatNavbar } from "@/components/chat";
import { FileUpload } from "@/components/ui/file-upload";
import { Loader2 } from "lucide-react";
import { HoverBorderGradient } from "@/components/ui/hoverbutton";
import puter from '@heyputer/puter.js'

export default function CreativePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    productName: "",
    productDescription: "",
    ctaLink: "",
    imagePrompt: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  


  const handleFileUpload = (uploadedFiles: File[]) => {
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


 



const dataURLtoBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};


  const handleCreativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productName.trim() || isLoading) return;

    setIsLoading(true);
    setIsGenerating(true);
    setError("");

    try {
    
      const systemPrompt = `Create a stunning, eye-catching image for the product. The image should be professional, modern, and perfect for social media. Use vibrant colors, attractive composition, and make the product the focal point.`;
      const productInfo = `Product Name: ${formData.productName}${formData.productDescription ? `\nProduct Details: ${formData.productDescription}` : ""}`;
      const finalPrompt = `${systemPrompt}\n\n${productInfo}\n\nAdditional Instructions: ${formData.imagePrompt}`;

      let generatedImageFile: File | null = null;

      if (files[0] && formData.imagePrompt) {
        console.log("Starting image generation with Puter AI...");
        
        const fileToBase64 = (file: File): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
           
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        };
        
        const inputImageBase64 = await fileToBase64(files[0]);
        
     
        const generatedImage = await puter.ai.txt2img({
          prompt: finalPrompt,
          model: "gemini-2.5-flash-image-preview",
          input_image: inputImageBase64,
          input_image_mime_type: "image/png",
        }, true);

        console.log("Image generated successfully");
        setIsGenerating(false);
        if (generatedImage && generatedImage.src) {
          const imageBlob = dataURLtoBlob(generatedImage.src);
          generatedImageFile = new File([imageBlob], `generated-${Date.now()}.png`, {
            type: "image/png",
          });
          console.log("Generated image converted to file, size:", generatedImageFile.size);
        }
      }

    
      const submitFormData = new FormData();
      submitFormData.append("productName", formData.productName);
      submitFormData.append("productDescription", formData.productDescription);
    
      submitFormData.append("imagePrompt", formData.imagePrompt);
      
      if (files[0]) {
        submitFormData.append("files", files[0]);
      }
      
   
      if (generatedImageFile) {
        submitFormData.append("generatedimage", generatedImageFile);
      }

      const response = await fetch("/api/creative", {
        method: "POST",
        body: submitFormData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to create project"
        );
      }

      console.log("Project created successfully:", data);
     
      
  
      router.push(`/project/${data.project_id}/chat`);
      
      setIsLoading(false);
    } catch (err) {
      console.error("Error creating project:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create project. Please try again.";
      setError(message);
      setIsLoading(false);
      setIsGenerating(false);
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
                  Image Generation Prompt
                </label>
                <textarea
                  value={formData.imagePrompt}
                  onChange={(e) =>
                    setFormData({ ...formData, imagePrompt: e.target.value })
                  }
                  rows={4}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-transparent resize-none"
                  placeholder="Describe how you want your product image enhanced (e.g., 'Add vibrant background, make the product pop, professional lighting')"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div className="flex justify-center w-full">
                <HoverBorderGradient
                  containerClassName="rounded-full w-full"
                  as="button"
                  type="submit"
                  disabled={isLoading || !formData.productName.trim()}
                  className="dark:bg-black bg-white text-black dark:text-white flex items-center justify-center w-full"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      {isGenerating ? "Generating Image..." : "Creating Project..."}
                    </span>
                  ) : (
                    "Generate Creative"
                  )}
                </HoverBorderGradient>
              </div>
            </form>
          </div>
        </div>
     
    </div>
  );
}
