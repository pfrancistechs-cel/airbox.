"use client";

import React from "react";
import {
  Search,
  LayoutGrid,
  List,
  FolderPlus,
  UploadCloud,
  X,
  ShieldAlert,
} from "lucide-react";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (m: "grid" | "list") => void;
  onNewFolderClick: () => void;
  onUploadClick: () => void;
  isVaultView?: boolean;
}

export function Header({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onNewFolderClick,
  onUploadClick,
  isVaultView,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-800 bg-[#090d16]/80 backdrop-blur-md px-6 flex items-center justify-between gap-4">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files, folders..."
          className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Vault Alert Indicator */}
      {isVaultView && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Client-Side Zero-Knowledge Encryption Active</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Grid/List Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
          <button
            onClick={() => onViewModeChange("grid")}
            title="Grid view"
            className={`p-1.5 rounded-lg transition ${
              viewMode === "grid" ? "bg-slate-800 text-white shadow-sm" : "hover:text-slate-200"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            title="List view"
            className={`p-1.5 rounded-lg transition ${
              viewMode === "list" ? "bg-slate-800 text-white shadow-sm" : "hover:text-slate-200"
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* New Folder */}
        <button
          onClick={onNewFolderClick}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-medium text-slate-200 transition"
        >
          <FolderPlus className="w-4 h-4 text-slate-400" />
          <span className="hidden sm:inline">New Folder</span>
        </button>

        {/* Upload Button */}
        <button
          onClick={onUploadClick}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/30 transition"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload</span>
        </button>
      </div>
    </header>
  );
}

