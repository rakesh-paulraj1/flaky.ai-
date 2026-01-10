import { ChevronRight, Plus } from "lucide-react";

import {
  FaCode,
  FaMagic,
  FaRocket,
  FaBolt,
  FaCheckCircle,
} from "react-icons/fa";
import { IoSparkles } from "react-icons/io5";
import { MdAutoAwesome, MdSpeed, MdBuild } from "react-icons/md";
import { AiFillThunderbolt } from "react-icons/ai";
import Link from "next/link";
import { AuthButton } from "@/components/auth/AuthButton";
import "./page-styles.css";

export default function Home() {
  return (
    <div
      className="min-h-screen w-full relative overflow-hidden"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <div
        className="absolute w-full top-0 left-0 right-0 z-0 pointer-events-none"
        style={{
          height: "700px",
          background: `
            radial-gradient(
              ellipse 90% 60% at 50% 0%,
              rgba(115, 115, 115, 0.25) 0%,
              rgba(64, 64, 64, 0.15) 40%,
              rgba(0, 0, 0, 0) 80%
            )
          `,
        }}
      />

      <main
        className="landing-page-wrapper w-full font-sans overflow-x-hidden relative z-10"
        style={{
          fontFamily:
            "var(--font-outfit), ui-sans-serif, system-ui, sans-serif",
          backgroundColor: "transparent",
        }}
      >

        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-neutral-400">Your</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 px-3 py-2 rounded-lg border border-neutral-800">
                <IoSparkles size={18} className="text-yellow-400" />
                <span className="bg-gradient-to-r from-yellow-400 via-pink-500 to-blue-500 bg-clip-text text-transparent font-bold">
                  AI
                </span>
              </div>
              <span className="text-neutral-400">web app builder</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-balance">
              Create Web Applications with AI generated Creatives 
            </h1>

            <p className="text-xl text-neutral-400 mb-8 max-w-2xl mx-auto text-balance">
              Transform your ideas into production-ready React applications.
              Just describe what you want to build, and our AI agent handles the
              rest.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              
              
              
              <AuthButton className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full hover:from-blue-500 hover:to-purple-500 transition font-semibold flex items-center gap-2 group">
                START BUILDING FOR FREE
              </AuthButton>

            </div>

         

{/*             
            <div className="mt-16 rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
              <img
                src="/code.png"
                alt="WEB BUILDER AI Interface Demo"
                className="w-full"
              />
            </div> */}
          </div>
        </section>

   
        {/* Feature Icons Section */}
        <section className="py-20 px-6 border-t border-neutral-800">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
              <div className="flex flex-col items-start">
                <MdAutoAwesome size={32} className="mb-4 text-neutral-400" />
                <h3 className="text-lg font-semibold mb-2">
                  AI-Powered Development
                </h3>
                <p className="text-neutral-500">
                  Let AI write your code, set up routing, and configure your
                  entire React application
                </p>
              </div>
              <div className="flex flex-col items-start">
                <MdSpeed size={32} className="mb-4 text-neutral-400" />
                <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
                <p className="text-neutral-500">
                  Go from idea to deployed application in minutes, not days or
                  weeks
                </p>
              </div>
              <div className="flex flex-col items-start">
                <FaBolt size={32} className="mb-4 text-neutral-400" />
                <h3 className="text-lg font-semibold mb-2">
                  Real-time Preview
                </h3>
                <p className="text-neutral-500">
                  See your application come to life in real-time as the AI
                  builds it
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-6 border-t border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-bold mb-4 text-balance">
                Build smarter.
              </h2>
              <p className="text-4xl md:text-5xl font-bold text-neutral-600 mb-6 text-balance">
                Code faster.
              </p>
              <p className="text-xl text-neutral-400 text-balance">
                Our AI agent understands your requirements and builds complete
                React applications with proper architecture.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Describe Card */}
              <div className="border border-neutral-800 rounded-2xl p-8 bg-neutral-900/30 hover:bg-neutral-900/50 transition">
                <h3 className="text-2xl font-semibold mb-3">
                  Describe your app
                </h3>
                <p className="text-neutral-400 mb-8">
                  Tell the AI what you want to build in natural language - no
                  technical jargon required.
                </p>
                <div className="bg-black rounded-lg p-6 mb-6 h-40 border border-neutral-700 flex items-center justify-center">
                  <div className="text-center text-neutral-600">
                    <FaCode size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      "Build a todo app with drag-and-drop"
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-neutral-500 text-sm">
                  <IoSparkles size={16} />
                  <span>AI understands your intent</span>
                </div>
              </div>

             
              <div className="border border-neutral-800 rounded-2xl p-8 bg-neutral-900/30 hover:bg-neutral-900/50 transition">
                <h3 className="text-2xl font-semibold mb-3">Watch it build</h3>
                <p className="text-neutral-400 mb-8">
                  See your application being created in real-time with live
                  preview.
                </p>
                <div className="bg-black rounded-lg p-6 mb-6 border border-neutral-700">
                  <div className="space-y-3">
                    <div className="bg-neutral-900 rounded px-3 py-2 flex items-center justify-between">
                      <span className="text-neutral-400 flex items-center gap-2">
                        <FaCheckCircle size={16} className="text-green-500" />
                        Creating components
                      </span>
                      <ChevronRight size={16} />
                    </div>
                    <div className="text-xs text-neutral-600 px-3">
                      Building your app
                    </div>
                    <div className="space-y-2 ml-1">
                      {[
                        "App.jsx",
                        "TodoList.jsx",
                        "TodoItem.jsx",
                        "styles.css",
                      ].map((file, i) => (
                        <div
                          key={file}
                          className="text-neutral-500 text-sm flex items-center gap-2"
                        >
                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <FaCheckCircle size={10} className="text-white" />
                          </div>
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-6 border-t border-neutral-800">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {/* AI-Powered Section */}
              <div className="border border-neutral-800 rounded-2xl p-8 bg-neutral-900/30 hover:bg-neutral-900/50 transition">
                <h3 className="text-2xl font-semibold mb-3">
                  Intelligent code generation
                </h3>
                <p className="text-neutral-400 mb-8">
                  Our AI doesn't just generate code - it understands best
                  practices, proper architecture, and modern React patterns.
                </p>
                <div className="bg-black rounded-lg p-6 space-y-3">
                  {[
                    "Component-based architecture",
                    "Proper state management",
                    "Responsive design with Tailwind",
                    "Clean, maintainable code",
                  ].map((feature, i) => (
                    <div
                      key={i}
                      className="text-neutral-600 text-sm flex items-start gap-3"
                    >
                      <FaCheckCircle
                        size={16}
                        className="mt-1 text-green-500"
                      />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-neutral-800 rounded-2xl p-8 bg-neutral-900/30 hover:bg-neutral-900/50 transition">
                <h3 className="text-2xl font-semibold mb-3">
                  Iterate with conversation
                </h3>
                <p className="text-neutral-400 mb-8">
                  Chat with the AI to refine your application. Add features, fix
                  bugs, or change designs.
                </p>
                <div className="bg-black rounded-lg p-6 border border-neutral-700">
                  <div className="space-y-4">
                    <div className="text-neutral-500 text-sm">
                      <p>"Add a dark mode toggle button"</p>
                    </div>
                    <div className="text-green-400 text-sm">
                      <p>Updated theme system and added toggle</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-start">
                <FaMagic size={24} className="mb-3 text-neutral-400" />
                <h4 className="font-semibold mb-2">Production-ready code</h4>
                <p className="text-neutral-500 text-sm">
                  Generate code that follows industry best practices and
                  standards.
                </p>
              </div>
              <div className="flex flex-col items-start">
                <FaRocket size={24} className="mb-3 text-neutral-400" />
                <h4 className="font-semibold mb-2">Deploy instantly</h4>
                <p className="text-neutral-500 text-sm">
                  Download your project and deploy to any hosting platform in
                  minutes.
                </p>
              </div>
              <div className="flex flex-col items-start">
                <MdBuild size={24} className="mb-3 text-neutral-400" />
                <h4 className="font-semibold mb-2">Full control</h4>
                <p className="text-neutral-500 text-sm">
                  Own your code completely. Modify, extend, or customize as you
                  wish.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Features Grid */}
        <section className="py-16 px-6 border-t border-neutral-800">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-start">
                <AiFillThunderbolt
                  size={28}
                  className="mb-4 text-neutral-400"
                />
                <h3 className="text-lg font-semibold mb-2">
                  Blazing fast development
                </h3>
                <p className="text-neutral-500">
                  Go from idea to deployed application in minutes, not days.
                </p>
              </div>
              <div className="flex flex-col items-start">
                <FaCode size={28} className="mb-4 text-neutral-400" />
                <h3 className="text-lg font-semibold mb-2">
                  Clean, readable code
                </h3>
                <p className="text-neutral-500">
                  Generated code follows best practices and is easy to
                  understand.
                </p>
              </div>
              <div className="flex flex-col items-start">
                <FaRocket size={28} className="mb-4 text-neutral-400" />
                <h3 className="text-lg font-semibold mb-2">Deploy anywhere</h3>
                <p className="text-neutral-500">
                  Export your project and deploy to Vercel, Netlify, or any
                  platform.
                </p>
              </div>
            </div>
          </div>
        </section>

      
        <section className="py-24 px-6 border-t border-neutral-800">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 mx-auto mb-8 rounded-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-neutral-800 flex items-center justify-center">
              <IoSparkles size={32} className="text-yellow-400" />
            </div>
            <h2 className="text-5xl md:text-6xl font-bold mb-8 text-balance">
              Start building with AI today.
            </h2>
            <AuthButton 
              className="px-8 py-4 border border-neutral-700 rounded-full hover:bg-neutral-900 transition font-semibold"
              showIcon={false}
            >
              START BUILDING FOR FREE
            </AuthButton>
          </div>
        </section>

        
        <footer className="border-t border-neutral-800 py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 pb-8 border-b border-neutral-800">
              <div className="flex items-center gap-2 mb-6 md:mb-0">
                <IoSparkles size={20} className="text-yellow-400" />
                <span className="font-bold bg-gradient-to-r from-yellow-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
                  FLAKY AI
                </span>
                <span className="text-xs px-2 py-1 rounded-full border border-neutral-700 text-neutral-500">
                  BETA
                </span>
              </div>
              <nav className="flex items-center gap-8 text-neutral-400 text-sm">
                <Link href="/" className="hover:text-white transition">
                  Home
                </Link>
                <Link href="/chat" className="hover:text-white transition">
                  Features
                </Link>
                <a href="#contact" className="hover:text-white transition">
                  Contact
                </a>
                <a href="#privacy" className="hover:text-white transition">
                  Privacy Policy
                </a>
              </nav>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
