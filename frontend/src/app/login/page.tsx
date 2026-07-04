"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Activity, Lock, Mail, AlertCircle, RefreshCw } from "lucide-react";

export default function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const [email, setEmail] = useState("staff@astramind.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const success = await login(email, password);
      if (!success) {
        setError("Invalid email or password. Please use the default credentials.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <span className="text-sm text-zinc-500 font-medium">Verifying Session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      {/* Decorative Blur Backdrops */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl" />

      <div className="w-full max-w-md space-y-6">
        {/* Logo and Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/30">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">AstraMind AI Receptionist</h1>
          <p className="mt-1 text-sm text-zinc-500">Hospital Administration Dashboard Portal</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Email Address</label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@astramind.com"
                  className="w-full h-10 pl-9 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Password</label>
                <a href="#" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-4 w-4 text-zinc-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-9 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/60 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Log In</span>
              )}
            </button>
          </form>

          {/* Credentials Helper Box */}
          <div className="mt-6 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-900 p-3.5 text-center">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Demo Credentials</span>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
              Email: <strong>staff@astramind.com</strong> <br />
              Password: <strong>password123</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
