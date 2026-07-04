import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LiveCallsProvider } from "@/context/LiveCallsContext";
import { ToastProvider } from "@/context/ToastContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AstraMind AI — Hospital AI Receptionist",
    template: "%s | AstraMind AI",
  },
  description:
    "AstraMind AI is an intelligent hospital receptionist platform that handles appointment booking, cancellations, rescheduling, and patient FAQs via real-time voice AI.",
  keywords: ["hospital", "AI receptionist", "voice AI", "appointments", "healthcare"],
  authors: [{ name: "AstraMind AI" }],
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <AuthProvider>
          <LiveCallsProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </LiveCallsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
