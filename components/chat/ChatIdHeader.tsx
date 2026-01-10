import { Button } from "@/components/ui/button";
import { ChevronLeft, Eye, EyeOff, BarChart3, MessageSquare } from "lucide-react";
import { useSession } from "next-auth/react";

interface ChatIdHeaderProps {
  showPreview: boolean;
  onTogglePreview: () => void;
  onToggleView: () => void;
  onBack: () => void;
  viewMode: "chat" | "analytics";
  isDeployed: boolean;
}

export function ChatIdHeader({
  showPreview,
  onTogglePreview,
  onToggleView,
  onBack,
  viewMode,
  isDeployed,
}: ChatIdHeaderProps) {

  const userData = useSession();

  return (
    <div className="flex-1 w-full border-b border-white/5 backdrop-blur-md px-4 py-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-white/60 hover:text-white hover:bg-white/5 font-sans"
        >
          <ChevronLeft size={24} />
        </Button>
        <h1 className="font-mono font-semibold tracking-tight text-white">
          FLAKY AI
        </h1>
        <div className="flex items-center gap-2">
          {userData.data?.user && (
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <span className="text-sm text-white/60">{userData.data?.user?.email}</span>
              <span className="text-xs text-white/40">•</span>
            </div>
          )}    
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePreview}
            className="text-white/60 hover:text-white hover:bg-white/5 hidden md:flex"
          >
            {showPreview ? <Eye size={20} /> : <EyeOff size={20} />}
          </Button>
          {isDeployed ? (
            <Button
              className="bg-white text-black hover:bg-slate-100 text-sm font-sans flex items-center gap-2"
              onClick={onToggleView}
            >
              {viewMode === "chat" ? (
                <>
                  <BarChart3 size={16} />
                  Analytics
                </>
              ) : (
                <>
                  <MessageSquare size={16} />
                  Chat
                </>
              )}
            </Button>
          ) : (
            <></>
          )}
        </div>
      </div>
    </div>
  );
}
