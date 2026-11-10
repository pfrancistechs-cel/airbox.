"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
} from "lucide-react";
import { UploadProgressItem } from "@/types";

interface UploadDrawerProps {
  items: UploadProgressItem[];
  onClear: () => void;
  onRemoveItem: (id: string) => void;
}

export function UploadDrawer({ items, onClear, onRemoveItem }: UploadDrawerProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (items.length === 0) return null;

  const inProgressCount = items.filter(
    (i) => i.status === "uploading" || i.status === "encrypting" || i.status === "completing"
  ).length;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 rounded-2xl bg-[#0d121f] border border-slate-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <UploadCloud className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-white">
            {inProgressCount > 0 ? `Uploading ${inProgressCount} items...` : "Uploads Complete"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-slate-400 hover:text-slate-200 transition"
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onClear}
            className="p-1 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Item List */}
      {!isMinimized && (
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 p-2">
          {items.map((item) => (
            <div key={item.id} className="p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate max-w-[200px]">
                  {item.isVault && <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  <span className="truncate font-medium text-slate-200">{item.name}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "encrypting" && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                      <Loader2 className="w-3 h-3 animate-spin" /> Encrypting
                    </span>
                  )}
                  {item.status === "uploading" && (
                    <span className="text-[11px] text-blue-400 font-mono">{item.progress}%</span>
                  )}
                  {item.status === "completing" && (
                    <span className="text-[10px] text-blue-400 flex items-center gap-1 font-mono">
                      <Loader2 className="w-3 h-3 animate-spin" /> Finalizing
                    </span>
                  )}
                  {item.status === "success" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  {item.status === "error" && (
                    <AlertCircle className="w-4 h-4 text-rose-400" title={item.errorMessage} />
                  )}
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-slate-600 hover:text-slate-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {(item.status === "uploading" || item.status === "encrypting") && (
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      item.isVault ? "bg-emerald-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
