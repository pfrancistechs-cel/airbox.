"use client";

import React from "react";
import {
  Folder,
  Shield,
  Star,
  Inbox,
  Trash2,
  HardDrive,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ currentTab, onTabChange }: SidebarProps) {
  const { user, logout } = useAuth();

  const navigation = [
    { id: "all", name: "All Files", icon: Folder },
    { id: "vault", name: "Zero-Knowledge Vault", icon: Shield, badge: "Encrypted" },
    { id: "starred", name: "Starred", icon: Star },
    { id: "requests", name: "File Requests", icon: Inbox, badge: "Dropzones" },
    { id: "trash", name: "Trash", icon: Trash2 },
  ];

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const usedBytes = user?.storage_used || 0;
  const limitBytes = user?.storage_limit || 5368709120;
  const percentUsed = Math.min(100, Math.round((usedBytes / limitBytes) * 100));

  return (
    <aside className="w-64 bg-[#0d121f] border-r border-slate-800 flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-lg">
            📦
          </div>
          <div>
            <div className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
              AirBox
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400">Zero-Knowledge Drive</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-800 text-slate-400 border border-slate-700/60"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: Storage Quota & User Profile */}
      <div className="p-4 border-t border-slate-800/80 space-y-4">
        {/* Storage Bar */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              Storage
            </span>
            <span className="text-slate-300 font-mono">{percentUsed}%</span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentUsed > 90
                  ? "bg-rose-500"
                  : percentUsed > 70
                  ? "bg-amber-400"
                  : "bg-blue-500"
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 font-mono">
            {formatBytes(usedBytes)} of {formatBytes(limitBytes)} used
          </p>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.full_name || "User"}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

