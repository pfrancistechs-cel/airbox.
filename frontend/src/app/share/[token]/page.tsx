"use client";

import React, { useState, useEffect, use } from "react";
import axios from "axios";
import {
  Download,
  Lock,
  FileText,
  FileImage,
  FileVideo,
  FileCode,
  FileArchive,
  File as FileIcon,
  Shield,
  Loader2,
  AlertCircle,
  Clock,
  KeyRound,
} from "lucide-react";
import { NodeItem, SharedLink } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export default function SharedLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [link, setLink] = useState<SharedLink | null>(null);
  const [node, setNode] = useState<NodeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchShared = async (pass?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = pass
        ? `${API_BASE}/share/${token}?password=${encodeURIComponent(pass)}`
        : `${API_BASE}/share/${token}`;

      const res = await axios.get(url);
      setLink(res.data.link);
      setNode(res.data.node);
      setNeedsPassword(false);
    } catch (err: any) {
      if (err.response?.status === 401 && err.response?.data?.has_password) {
        setNeedsPassword(true);
      } else {
        setError(err.response?.data?.error || "This link is invalid or has expired.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShared();
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    fetchShared(password.trim());
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = password
        ? `${API_BASE}/share/${token}/download?password=${encodeURIComponent(password)}`
        : `${API_BASE}/share/${token}/download`;

      const res = await axios.get(url);
      window.location.href = res.data.download_url;
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to download file");
    } finally {
      setDownloading(false);
    }
  };

  const getFileIcon = (item: NodeItem) => {
    if (item.type === "folder") return <Shield className="w-12 h-12 text-blue-400" />;
    const mime = item.mime_type || "";
    if (mime.startsWith("image/")) return <FileImage className="w-12 h-12 text-purple-400" />;
    if (mime.startsWith("video/")) return <FileVideo className="w-12 h-12 text-rose-400" />;
    if (mime.includes("pdf")) return <FileText className="w-12 h-12 text-red-400" />;
    if (mime.includes("json") || mime.includes("javascript")) return <FileCode className="w-12 h-12 text-emerald-400" />;
    if (mime.includes("zip") || mime.includes("tar")) return <FileArchive className="w-12 h-12 text-amber-400" />;
    return <FileIcon className="w-12 h-12 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "--";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  if (loading && !needsPassword) {
    return (
      <main className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-400 font-mono text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span>Loading shared item...</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d121f] border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold text-white tracking-tight">Link Unavailable</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {needsPassword ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold text-white tracking-tight">Password Protected</h1>
              <p className="text-xs text-slate-400">
                This shared link requires a password to view or download.
              </p>
            </div>

            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock File"}
            </button>
          </form>
        ) : node ? (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto shadow-inner">
              {getFileIcon(node)}
            </div>

            <div className="space-y-1">
              <h1 className="text-lg font-bold text-white tracking-tight break-all">
                {node.name}
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                {formatSize(node.size_bytes)} • Version {node.current_version}
              </p>
            </div>

            {link?.expires_at && (
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                Expires {new Date(link.expires_at).toLocaleDateString()}
              </p>
            )}

            {link?.allow_download ? (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </>
                )}
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                Direct downloading is disabled by the file owner for this link.
              </div>
            )}
          </div>
        ) : null}

        <p className="text-center text-[11px] text-slate-500 border-t border-slate-800/80 pt-4">
          Shared securely via <span className="text-slate-400 font-semibold">AirBox</span>
        </p>
      </div>
    </main>
  );
}
