"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ─── Config ───────────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: React.ElementType; bg: string; border: string; iconColor: string; titleColor: string }> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    iconColor: "text-emerald-500",
    titleColor: "text-emerald-800 dark:text-emerald-300",
  },
  error: {
    icon: XCircle,
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800",
    iconColor: "text-rose-500",
    titleColor: "text-rose-800 dark:text-rose-300",
  },
  warning: {
    icon: AlertCircle,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    iconColor: "text-amber-500",
    titleColor: "text-amber-800 dark:text-amber-300",
  },
  info: {
    icon: Info,
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-200 dark:border-sky-800",
    iconColor: "text-sky-500",
    titleColor: "text-sky-800 dark:text-sky-300",
  },
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);

    // Auto-remove after 4s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const ctx: ToastContextType = {
    toast: addToast,
    success: (title, message) => addToast("success", title, message),
    error: (title, message) => addToast("error", title, message),
    warning: (title, message) => addToast("warning", title, message),
    info: (title, message) => addToast("info", title, message),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Toast Portal */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map((t) => {
          const cfg = TOAST_CONFIG[t.type];
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto w-80 flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-4 fade-in duration-300 ${cfg.bg} ${cfg.border}`}
            >
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-tight ${cfg.titleColor}`}>
                  {t.title}
                </p>
                {t.message && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
