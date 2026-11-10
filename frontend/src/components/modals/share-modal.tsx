"use client";

import React, { useState } from "react";
import { X, Share2, Copy, Check, Lock, Calendar, Download } from "lucide-react";
import { NodeItem, SharedLink } from "@/types";
import { api } from "@/lib/api";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: NodeItem | null;
}

export function ShareModal({ isOpen, onClose, node }: ShareModalProps) {
  const [password, setPassword] = useState("");
  const [enablePassword, setEnablePassword] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [createdLink, setCreatedLink] = useState<SharedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setPassword("");
      setEnablePassword(false);
      setAllowDownload(true);
      setExpiresInDays("7");
      setCreatedLink(null);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen || !node) return null;

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let expiresAt: string | undefined = undefined;
      if (expiresInDays !== "never") {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(expiresInDays, 10));
        expiresAt = d.toISOString();
      }

      const res = await api.post(`/nodes/${node.id}/share`, {
        password: enablePassword ? password : "",
        expires_at: expiresAt,
        allow_download: allowDownload,
      });

      setCreatedLink(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create shared link");
    } finally {
      setLoading(false);
    }
  };

  const shareURL = createdLink
    ? `${window.location.origin}/share/${createdLink.token}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(shareURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Share Item</h2>
              <p className="text-xs text-slate-400 truncate max-w-[220px]">{node.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!createdLink ? (
          <form onSubmit={handleCreateLink} className="space-y-4">
            {/* Password Protection */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                  Require Password
                </div>
                <input
                  type="checkbox"
                  checked={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
                />
              </div>

              {enablePassword && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set an access password"
                  className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
                  required={enablePassword}
                />
              )}
            </div>

            {/* Expiration */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Link Expiration
              </div>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none"
              >
                <option value="1">1 Day</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="never">Never</option>
              </select>
            </div>

            {/* Allow Download */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Download className="w-3.5 h-3.5 text-blue-400" />
                Allow File Download
              </div>
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700"
              />
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
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition disabled:opacity-50"
              >
                {loading ? "Generating..." : "Create Link"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-emerald-400 font-medium">
              Link created successfully! Anyone with this link can view this file.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareURL}
                className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3.5 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

