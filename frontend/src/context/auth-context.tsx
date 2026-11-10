"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/types";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("airbox_access_token");
    if (token) {
      setAccessToken(token);
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.post("/auth/login", { email, password: pass });
    const { user, access_token, refresh_token } = res.data;
    localStorage.setItem("airbox_access_token", access_token);
    localStorage.setItem("airbox_refresh_token", refresh_token);
    setUser(user);
    setAccessToken(access_token);
  };

  const register = async (email: string, pass: string, name: string) => {
    const res = await api.post("/auth/register", {
      email,
      password: pass,
      full_name: name,
    });
    const { user, access_token, refresh_token } = res.data;
    localStorage.setItem("airbox_access_token", access_token);
    localStorage.setItem("airbox_refresh_token", refresh_token);
    setUser(user);
    setAccessToken(access_token);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("airbox_refresh_token");
    try {
      if (refreshToken) {
        await api.post("/auth/logout", { refresh_token: refreshToken });
      }
    } catch {
      // ignore
    } finally {
      localStorage.removeItem("airbox_access_token");
      localStorage.removeItem("airbox_refresh_token");
      setUser(null);
      setAccessToken(null);
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

