"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { LogOut, MessageSquare, ChevronDown } from "lucide-react";
import { getUserChats } from "@/app/actions/chats";

interface Chat {
  id: string;
  title: string;
  userId: number;
  appUrl?: string | null;
  createdAt: Date;
}

export function ChatNavbar() {
  const { data: session, status } = useSession();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (status === "authenticated") {
      getUserChats().then((data) => {
        if (isMounted) {
          setChats(data as Chat[]);
        }
      });
    }
    return () => { isMounted = false; };
  }, [status]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
        setIsChatMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="relative z-20 border-b border-white/5 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-white font-semibold text-lg hover:opacity-80 transition-opacity">
          FLAKY AI
        </Link>
        <div className="flex items-center gap-4">
          {status === "authenticated" ? (
            <div className="flex items-center gap-3">
             
              <div className="relative" ref={chatMenuRef}>
                <button
                  onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Recent Chats</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isChatMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isChatMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-black-900 rounded-lg shadow-xl border border-white/10 py-1 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="px-4 py-2 border-b border-white/5 bg-white/5">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Your Recent Chats</p>
                    </div>
                    {chats.length > 0 ? (
                      <ul className="max-h-64 overflow-y-auto space-y-0.5 p-1 custom-scrollbar">
                        {chats.map((c) => (
                          <li key={c.id}>
                            <Link
                              href={`/chat/${c.id}`}
                              className="block text-sm text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 rounded-md transition-colors truncate"
                              onClick={() => setIsChatMenuOpen(false)}
                            >
                              {c.title || c.id}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
                        <p className="text-xs text-white/40 italic font-light">No chats yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                >
                  {session?.user?.image ? (
                    <Image
                      src={session.user.image}
                      className="h-8 w-8 flex-shrink-0 rounded-full cursor-pointer border border-white/10 shadow-lg"
                      width={32}
                      height={32}
                      alt="Avatar"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold border border-white/10">
                      {session?.user?.name?.[0] || session?.user?.email?.[0]}
                    </div>
                  )}
                </button>
                
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-black-900 rounded-lg shadow-xl border border-white/10 py-1 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                      <p className="text-sm font-medium text-white truncate">{session?.user?.name}</p>
                      <p className="text-xs text-white/50 truncate font-mono">{session?.user?.email}</p>
                    </div>
                    
                    <button
                      onClick={() => {
                        signOut({ callbackUrl: '/' });
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors group"
                    >
                      <LogOut className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : status === "loading" ? (
            <div className="h-8 w-8 animate-pulse bg-white/10 rounded-full" />
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => signIn()}
                className="text-white/70 hover:text-white text-sm font-medium transition-colors"
              >
                Log In
              </button>
              <Link
                href="/signin"
                className="rounded-lg font-semibold relative cursor-pointer hover:-translate-y-0.5 transition duration-200 inline-block text-center bg-white text-black px-4 py-1.5 text-sm shadow-lg shadow-white/5"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}