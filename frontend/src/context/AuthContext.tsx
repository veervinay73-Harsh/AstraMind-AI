"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  email: string;
  name: string;
  role: string;
  avatar: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load auth state from LocalStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("astramind_user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Failed to load user state", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    // Simulate brief network latency for mock auth
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Valid mock credentials check
    if (email === "staff@astramind.com" && password === "password123") {
      const mockProfile: UserProfile = {
        email,
        name: "Dr. Sarah Jenkins",
        role: "Chief Medical Officer",
        avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&auto=format&fit=crop&q=60"
      };
      
      setUser(mockProfile);
      localStorage.setItem("astramind_user", JSON.stringify(mockProfile));
      setIsLoading(false);
      router.push("/dashboard");
      return true;
    }
    
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("astramind_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
