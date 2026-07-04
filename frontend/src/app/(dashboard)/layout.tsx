"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import { RefreshCw } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <span className="text-sm text-zinc-500 font-medium">Verifying Credentials...</span>
        </div>
      </div>
    );
  }

  // Prevent flicker before redirect completes
  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar Utility Navigation */}
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/10 p-6">
          <div className="mx-auto max-w-7xl animate-in fade-in duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
