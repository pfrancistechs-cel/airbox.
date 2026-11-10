"use client";

import React, { useState } from "react";
import { X, Shield, KeyRound } from "lucide-react";

interface VaultPassphraseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (passphrase: string) => void;
  title?: string;
  description?: string;
}

export function VaultPassphraseModal({
  isOpen,
  onClose,
  onSubmit,
  title = "Unlock Zero-Knowledge Vault",
  description = "Enter your secret passphrase to decrypt and access this vault file in your browser.",
}: VaultPassphraseModalProps) {
  const [passphrase, setPassphrase] = useState("");

  React.useEffect(() => {
    if (isOpen) {
      const cached = sessionStorage.getItem("airbox_vault_passphrase");
      if (cached) {
        setPassphrase(cached);
      } else {
        setPassphrase("");
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    sessionStorage.setItem("airbox_vault_passphrase", passphrase.trim());
    onSubmit(passphrase.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#0d121f] border border-emerald-500/30 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
              <span className="text-[10px] text-emerald-400 font-mono">Web Crypto Subtle AES-GCM</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              autoFocus
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter your secret vault passphrase"
              className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">🔒 Zero-Knowledge Guarantee:</p>
            <p>
              Your passphrase is never sent to Neon DB or Cloudinary. Decryption is performed entirely in your browser using local CPU memory.
            </p>
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
              disabled={!passphrase.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition disabled:opacity-50"
            >
              Unlock & Proceed
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
