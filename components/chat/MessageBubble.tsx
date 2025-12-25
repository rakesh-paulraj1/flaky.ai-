import { Message, ActiveToolCall } from "@/lib/chat-types";
import { FormattedMessage } from "./FormattedMessage";
import { Loader2 } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
  isLastMessage: boolean;
  currentTool: ActiveToolCall | null;
}


export function MessageBubble({
  message,
  isLastMessage,
  currentTool,
}: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-xl px-4 py-3 rounded-lg bg-white text-black">
          <p className="text-sm">{message.content}</p>
        </div>
      </div>
    );
  }


  return (
    <div className="flex justify-start">
      <div className="max-w-2xl w-full bg-white/5 text-white border border-white/10 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Use FormattedMessage component for formatted content */}
            <div className="text-sm leading-relaxed">
              <FormattedMessage
                content={message.content}
                formatted={message.formatted}
              />
            </div>

            {/* Active Tool Section - only show on last message */}
            {currentTool && isLastMessage && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="bg-black/40 border border-amber-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    {currentTool.status === "running" ? (
                      <Loader2
                        size={14}
                        className="animate-spin text-amber-400 mt-0.5 shrink-0"
                      />
                    ) : (
                      <span className="text-green-400 text-sm shrink-0">✓</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-amber-300 mb-1">
                        Tool: {currentTool.name}
                      </p>
                      {currentTool.status === "running" ? (
                        <p className="text-xs text-white/50">Processing...</p>
                      ) : (
                        currentTool.output && (
                          <div className="text-xs text-white/60 bg-black/30 rounded p-2 mt-1 font-mono max-h-32 overflow-y-auto wrap-break-word">
                            {currentTool.output}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
