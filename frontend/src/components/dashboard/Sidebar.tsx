"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PhoneCall,
  Calendar,
  Users,
  UserRoundCheck,
  BookOpen,
  BarChart3,
  Settings as SettingsIcon,
  X,
  Activity,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useLiveCalls } from "@/context/LiveCallsContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { calls, isConnected } = useLiveCalls();

  // Count only active (in-progress) calls for the live badge
  const activeCallCount = Object.values(calls || {}).filter(
    (c) => c.status === "active"
  ).length;

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
      name: "Live Calls",
      href: "/live-calls",
      icon: PhoneCall,
      badge: activeCallCount > 0 ? activeCallCount : undefined,
    },
    { name: "Appointments", href: "/appointments", icon: Calendar },
    { name: "Doctors", href: "/doctors", icon: UserRoundCheck },
    { name: "Patients", href: "/patients", icon: Users },
    { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: SettingsIcon },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        id="sidebar"
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-zinc-950 text-zinc-400 border-r border-zinc-900 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:h-screen`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-zinc-900 shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
            onClick={onClose}
            aria-label="AstraMind AI — Go to dashboard"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 shrink-0 group-hover:bg-indigo-500 transition-colors">
              <Activity className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              AstraMind AI
            </span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-white transition-colors lg:hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5"
          aria-label="Primary navigation"
        >
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                  isActive
                    ? "bg-indigo-600/12 text-indigo-300 border-l-2 border-indigo-500 pl-2.5"
                    : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors shrink-0 ${
                      isActive
                        ? "text-indigo-400"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.name}</span>
                </div>

                {/* Live badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    aria-label={`${item.badge} active call${item.badge !== 1 ? "s" : ""}`}
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600/15 px-1.5 text-[10px] font-bold text-rose-400 ring-1 ring-rose-500/25 animate-pulse"
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: WS Status + User */}
        <div className="border-t border-zinc-900 p-3 space-y-2 shrink-0">
          {/* WebSocket connection indicator */}
          <div
            aria-live="polite"
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-semibold ${
              isConnected
                ? "text-emerald-500 bg-emerald-500/8"
                : "text-zinc-500 bg-zinc-900/40"
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>Live Stream Connected</span>
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>Reconnecting…</span>
              </>
            )}
          </div>

          {/* User info */}
          <div className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-zinc-900/40 transition-colors cursor-default">
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&auto=format&fit=crop&q=60"
                alt="Dr. Sarah Jenkins"
                className="h-9 w-9 rounded-full object-cover ring-2 ring-indigo-500/20"
              />
              <span
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950"
                aria-label="Online"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">Dr. Sarah Jenkins</p>
              <p className="text-[10px] text-zinc-500 truncate">Chief Medical Officer</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
