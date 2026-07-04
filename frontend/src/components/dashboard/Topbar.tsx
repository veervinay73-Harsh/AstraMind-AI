"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings as SettingsIcon,
  Hospital,
  CalendarCheck2,
  PhoneCall,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface TopbarProps {
  onMenuClick: () => void;
}

const NOTIFICATIONS = [
  {
    id: 1,
    icon: CalendarCheck2,
    iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    title: "New appointment booked",
    desc: "Dr. Robert Smith — tomorrow at 9:00 AM",
    time: "2 min ago",
    unread: true,
  },
  {
    id: 2,
    icon: PhoneCall,
    iconBg: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    title: "Call transferred to human",
    desc: "Incoming call handed off to receptionist",
    time: "10 min ago",
    unread: true,
  },
  {
    id: 3,
    icon: BookOpen,
    iconBg: "bg-indigo-50 dark:bg-indigo-950/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    title: "KB article updated",
    desc: "Cardiology department timings updated",
    time: "1 hour ago",
    unread: false,
  },
];

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(
    NOTIFICATIONS.filter((n) => n.unread).length
  );

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // ── Click-outside and Escape key close handlers ───────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsNotifOpen(false);
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handleMarkAllRead = () => setUnreadCount(0);

  return (
    <header
      className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6 shadow-sm"
      role="banner"
    >
      {/* Left: Mobile Menu Toggle + Hospital Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors lg:hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <Hospital className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="hidden sm:inline-block font-semibold text-sm text-zinc-900 dark:text-white">
            AstraMind Integrated Medical Center
          </span>
          <span className="inline-block sm:hidden font-semibold text-sm text-zinc-900 dark:text-white">
            AstraMind IMC
          </span>
        </div>
      </div>

      {/* Right: Notifications + Separator + Profile */}
      <div className="flex items-center gap-2 sm:gap-3">

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setIsNotifOpen((v) => !v);
              setIsProfileOpen(false);
            }}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={isNotifOpen}
            aria-haspopup="listbox"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950 animate-pulse" />
            )}
          </button>

          {isNotifOpen && (
            <div
              role="listbox"
              aria-label="Notifications"
              className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in slide-in-from-top-2 duration-200 z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-900">
                <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center h-4 w-4 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </span>
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="divide-y divide-zinc-50 dark:divide-zinc-900 max-h-72 overflow-y-auto">
                {NOTIFICATIONS.map((n) => {
                  const Icon = n.icon;
                  return (
                    <div
                      key={n.id}
                      role="option"
                      aria-selected={n.unread}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60 ${
                        n.unread ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${n.iconBg}`}>
                        <Icon className={`h-3.5 w-3.5 ${n.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                          {n.title}
                          {n.unread && (
                            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 align-middle" />
                          )}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                          {n.desc}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-900 px-4 py-2.5">
                <button className="text-xs text-center w-full text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <span className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setIsProfileOpen((v) => !v);
              setIsNotifOpen(false);
            }}
            aria-label="User account menu"
            aria-expanded={isProfileOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user?.avatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&auto=format&fit=crop&q=60"}
              alt={user?.name || "Staff member"}
              className="h-7 w-7 rounded-full object-cover ring-2 ring-indigo-500/20"
            />
            <span className="hidden md:inline-block text-sm font-medium text-zinc-700 dark:text-zinc-300 max-w-[120px] truncate">
              {user?.name || "Dr. Sarah Jenkins"}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${isProfileOpen ? "rotate-180" : ""}`} />
          </button>

          {isProfileOpen && (
            <div
              role="menu"
              aria-label="User menu"
              className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in slide-in-from-top-2 duration-200 z-50 overflow-hidden"
            >
              {/* User Info Header */}
              <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-900">
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">Signed in as</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                  {user?.email || "staff@astramind.com"}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{user?.role || "Chief Medical Officer"}</p>
              </div>

              {/* Menu Items */}
              <div role="group" className="p-1.5 space-y-0.5">
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  <User className="h-4 w-4 text-zinc-400" />
                  <span>My Profile</span>
                </button>
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  <SettingsIcon className="h-4 w-4 text-zinc-400" />
                  <span>System Settings</span>
                </Link>
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-900 p-1.5">
                <button
                  role="menuitem"
                  onClick={() => { setIsProfileOpen(false); logout(); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
