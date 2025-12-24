import React from 'react'
import { sandboxService } from "@/lib/services";
import prisma from "@/lib/prisma";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // 1. Ensure a user exists (simple mock for now)
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
      }
    });
  }

  // 2. Ensure chat exists
  let chat = await prisma.chat.findUnique({ where: { id } });
  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        id,
        userId: user.id,
        title: "New Chat",
      }
    });
  }

  // 3. Get sandbox
  const sandbox = await sandboxService.getSandbox(id);
  
  // 4. Get preview URL (Vite default port 5173)
  const previewUrl = `https://${sandbox.getHost(5173)}`;
  
  // 5. List files in the root folder
  const files = await sandbox.files.list("/");

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-slate-800">Chat Sandbox: {id}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4 text-slate-700">Sandbox Preview</h2>
          <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center mb-4 border border-slate-200 overflow-hidden">
             <iframe src={previewUrl} className="w-full h-full" title="Sandbox Preview" />
          </div>
          <a 
            href={previewUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block w-full text-center py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Open Preview in New Tab
          </a>
          <p className="mt-2 text-xs text-slate-500 break-all">{previewUrl}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4 text-slate-700">File Structure</h2>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-[400px] overflow-y-auto">
            {files.length === 0 ? (
              <p className="text-slate-400 italic">No files found.</p>
            ) : (
              <ul className="space-y-1 font-mono text-sm text-slate-600">
                {files.map(f => (
                  <li key={f.path} className="flex items-center gap-2">
                    {f.type === 'dir' ? (
                      <span className="text-yellow-600">📁</span>
                    ) : (
                      <span className="text-blue-500">📄</span>
                    )}
                    {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}