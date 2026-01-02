"use client";

import { Eye, FileCode, Globe, ExternalLink } from "lucide-react";
import { useState } from "react";
import { FileViewer } from "./FileViewer";

interface PreviewPanelProps {
  appUrl: string | null;
  isCheckingUrl: boolean;
  previewWidth: number;
  projectId?: string;
  files?: string[];
}

type TabType = "preview" | "code";

export function PreviewPanel({
  appUrl,
  isCheckingUrl,
  previewWidth,
  projectId,
  files,
}: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("preview");

  return (
    <div
      className="flex flex-col bg-black/50 border-l border-white/5 h-full overflow-hidden"
      style={{
        width: `${previewWidth}%`,
      }}
    >
    
      <div className="flex items-center justify-between border-b border-white/5 bg-black/30 shrink-0">
        <div className="flex">
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "preview"
                ? "text-white border-b-2 border-white bg-white/5"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Preview
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "code"
                ? "text-white border-b-2 border-white bg-white/5"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Code
          </button>
        </div>

     
        {appUrl && !isCheckingUrl && (
          <button
            onClick={() => window.open(appUrl, "_blank")}
            className="flex items-center gap-1.5 px-3 py-2 mx-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "preview" ? (
          <div className="h-full p-4">
            {isCheckingUrl ? (
              <div className="w-full h-full rounded-lg border border-white/10 flex items-center justify-center bg-black/20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/60 mx-auto mb-4" />
                  <p className="text-white/60 text-sm font-sans">
                    Preparing your application...
                  </p>
                </div>
              </div>
            ) : appUrl ? (
              <div className="w-full h-full rounded-lg overflow-hidden border border-white/10 bg-white shadow-2xl">
                <iframe
                  src={appUrl}
                  title="App Preview"
                  className="w-full h-full bg-white"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
              </div>
            ) : (
              <div className="w-full h-full rounded-lg border border-white/10 flex items-center justify-center bg-black/20">
                <div className="text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Eye className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/60 font-medium">No Preview Available</p>
                  <p className="text-white/40 text-sm mt-1">Deploy your app to see the preview here</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            {projectId ? (
              <FileViewer projectId={projectId} files={files} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/40 p-10 text-center">
                <FileCode className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a project to view files</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
