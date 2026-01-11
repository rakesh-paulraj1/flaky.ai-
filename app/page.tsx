"use client";

import { motion } from "motion/react";
import React from "react";
import { AuthButton } from "@/components/auth/AuthButton";
import { HoverBorderGradient } from "@/components/ui/hoverbutton";
import {
  FaCode,
  FaRocket,
  FaBolt,
 
  FaGithub,
} from "react-icons/fa";
import { IoSparkles, IoLayers } from "react-icons/io5";
import { MdAutoAwesome, MdSpeed, MdBuild, MdDevices } from "react-icons/md";
import "./page-styles.css";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleNavigation = (path: string) => {
    if (status === "authenticated") {
      router.push(path);
    } else {
      setIsModalOpen(true);
    }
  };
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-x-hidden font-sans selection:bg-purple-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[150px]" />
      </div>

      {/* Navbar Placeholder / Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 blur-sm opacity-50" />
              <IoSparkles className="relative text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight">Flaky AI</span>
          </div>
          
          <div className="flex items-center gap-4">
            <AuthButton className="text-sm font-medium px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all flex items-center gap-2">
              Sign In
            </AuthButton>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-32 pb-20 px-6">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto text-center mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-8"
          >
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-zinc-400">AI-Powered Web Builder v2.0</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-8xl font-bold tracking-tight mb-8 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent"
          >
        Generate Creatives<br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            and scale it fast
            </span>
          </motion.h1>

          

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <HoverBorderGradient
              containerClassName="rounded-full"
              as="button"
              className="bg-black text-white flex items-center gap-2 px-8 py-3 text-lg font-semibold"
              onClick={() => handleNavigation("/chat")}
            >
              <IoSparkles className="w-5 h-5" />
              <span>Start Building Free</span>
            </HoverBorderGradient>
            
            <a 
              href="https://github.com/rakesh-paulraj1/flaky.ai-" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <FaGithub className="w-5 h-5" />
              <span>View on GitHub</span>
            </a>
          </motion.div>

          {/* Hero Visual / Code Demo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 relative mx-auto max-w-4xl"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20" />
            <div className="relative bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20" />
                </div>
                <div className="ml-4 text-xs text-zinc-500 font-mono">agent-workflow.tsx</div>
              </div>
              <div className="p-6 font-mono text-sm text-left overflow-hidden">
                <div className="flex gap-4">
                  <div className="text-zinc-700 select-none text-right">
                    1<br/>2<br/>3<br/>4<br/>5
                  </div>
                  <div className="text-zinc-300">
                    <span className="text-purple-400">const</span> <span className="text-blue-400">Agent</span> = <span className="text-purple-400">await</span> ai.createWorker(&#123;<br/>
                    &nbsp;&nbsp;role: <span className="text-green-400">"Full Stack Developer"</span>,<br/>
                    &nbsp;&nbsp;skills: [<span className="text-green-400">"React"</span>, <span className="text-green-400">"Next.js"</span>, <span className="text-green-400">"Prisma"</span>],<br/>
                    &nbsp;&nbsp;task: <span className="text-green-400">"Build a SaaS dashboard with analytics"</span><br/>
                    &#125;);
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="max-w-6xl mx-auto mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Engineered for excellence</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              We've combined the power of LLMs with specialized agents to create a development 
              experience that feels like magic, but outputs production-grade code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 - Large */}
            <div className="md:col-span-2 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <FaCode className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6">
                  <MdAutoAwesome className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Autonomous Refinement</h3>
                <p className="text-zinc-400 max-w-md">
                  Our agents don't just write code once. They self-critique, detect errors, 
                  fix bugs, and refine the UI until it meets professional standards.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="md:col-span-1 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors">
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-6">
                  <MdSpeed className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Instant Deploy</h3>
                <p className="text-zinc-400">
                  One-click deployment to global edge networks. Your app goes live in seconds.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="md:col-span-1 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors">
              <div className="relative z-10">
                 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-6">
                  <MdDevices className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Responsive</h3>
                <p className="text-zinc-400">
                  Mobile-first architecture ensures your application looks stunning on any device.
                </p>
              </div>
            </div>

            {/* Feature 4 - Large */}
            <div className="md:col-span-2 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors">
              <div className="absolute bottom-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <IoLayers className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-6">
                  <FaRocket className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Modern Tech Stack</h3>
                <p className="text-zinc-400 max-w-md">
                  Pre-configured with Next.js 14, Tailwind CSS, TypeScript, and Prisma. 
                  No boilerplate setup, just pure creation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-4xl mx-auto text-center py-20 border-t border-white/10">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to build the future?</h2>
            <HoverBorderGradient
                containerClassName="rounded-full mx-auto"
                as="button"
                className="bg-zinc-900 text-white flex items-center gap-2 px-10 py-4 text-xl font-semibold"
                onClick={() => handleNavigation("/creative")}
            >
                <FaBolt className="text-yellow-400" />
                <span>Start Creating Now</span>
            </HoverBorderGradient>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/10 bg-black py-12 text-center text-zinc-500 text-sm">
        <p>
          &copy; {new Date().getFullYear()} Flaky AI. All rights reserved. 
          <span className="mx-2">|</span>
          Created by <a href="https://www.rakeshpaulraj.me/" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">Rakesh</a>
        </p>
      </footer>
      <AuthModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
