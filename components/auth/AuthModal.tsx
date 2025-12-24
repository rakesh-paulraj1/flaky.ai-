"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { signIn } from "next-auth/react";
import { IoSparkles } from "react-icons/io5";
import { FaGoogle } from "react-icons/fa";
import { X } from "lucide-react";

export function AuthModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-300" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-md bg-neutral-900 border border-neutral-800 p-8 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-300">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 mb-6 rounded-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-neutral-800 flex items-center justify-center">
              <IoSparkles size={24} className="text-yellow-400" />
            </div>
            
            <Dialog.Title className="text-2xl font-bold mb-2">
              Welcome to Flaky AI
            </Dialog.Title>
            <Dialog.Description className="text-neutral-400 mb-8">
              Sign in to start building your next web application with AI.
            </Dialog.Description>

            <button
              onClick={() => signIn("google", { callbackUrl: "/chat" })}
              className="w-full py-3 px-4 bg-white text-black rounded-lg font-semibold flex items-center justify-center gap-3 hover:bg-neutral-200 transition-colors"
            >
              <FaGoogle size={20} />
              Continue with Google
            </button>

            <p className="mt-6 text-sm text-neutral-500">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>

          <Dialog.Close asChild>
            <button 
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
