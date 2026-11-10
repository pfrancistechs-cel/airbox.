"use client";

import React, { useState } from "react";
import { X, FolderPlus, Shield } from "lucide-react";

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, isVault: boolean) => Promise<void>;
  defaultIsVault?: boolean;
}

export function NewFolderModal({
  isOpen,
  onClose,
  onSubmit,
  defaultIsVault = false,
}: NewFolderModalProps) {
  const [name, setName] = useState("");
  const [isVault, setIsVault] = useState(defaultIsVault);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setName("");
      setIsVault(defaultIsVault);
    }
  }, [isOpen, defaultIsVault]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit(name.trim(), isVault);
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create folder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Create New Folder</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Folder Name
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Financial Documents, Invoices"
              className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Zero-Knowledge Vault Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <button
              type="button"
              onClick={() => setIsVault(!isVault)}
              className={`w-5 h-5 rounded mt-0.5 flex items-center justify-center border transition ${
                isVault
                  ? "bg-emerald-500 border-emerald-400 text-white"
                  : "border-slate-700 bg-slate-800"
              }`}
            >
              {isVault && <Shield className="w-3.5 h-3.5" />}
            </button>
            <div className="flex-1 cursor-pointer" onClick={() => setIsVault(!isVault)}>
              <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                Zero-Knowledge Vault Folder
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  AES-GCM
                </span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All files stored in this folder are encrypted client-side in your browser before upload.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

