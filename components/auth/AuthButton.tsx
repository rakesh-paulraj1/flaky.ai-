"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";

export function AuthButton({ 
  className, 
  children,
  showIcon = true 
}: { 
  className?: string; 
  children: React.ReactNode;
  showIcon?: boolean;
}) {
  const { status } = useSession();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (status === "authenticated") {
      router.push("/chat");
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <button 
        onClick={handleClick}
        className={className}
      >
        {children}
        {showIcon && (
          <ArrowUpRight
            size={18}
            className="group-hover:translate-x-1 group-hover:-translate-y-1 transition"
          />
        )}
      </button>

      <AuthModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}
