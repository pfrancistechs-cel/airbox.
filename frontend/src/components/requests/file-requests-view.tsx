"use client";

import React, { useState, useEffect } from "react";
import { Inbox, Plus, Copy, Check, ExternalLink, Trash2, Calendar, HardDrive } from "lucide-react";
import { FileRequest, NodeItem } from "@/types";
import { api } from "@/lib/api";

interface FileRequestsViewProps {
  folders: NodeItem[];
}

export function FileRequestsView({ folders }: FileRequestsViewProps) {
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // New dropzone form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetFolderId, setTargetFolderId] = useState("");
  const [maxSizeMB, setMaxSizeMB] = useState("100");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await api.get("/file-requests");
      setRequests(res.data.requests || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    if (folders.length > 0 && !targetFolderId) {
      setTargetFolderId(folders[0].id);
    }
  }, [folders]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetFolderId) return;

    setSubmitting(true);
    try {
      let expiresAt: string | undefined = undefined;
      if (expiresInDays !== "never") {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(expiresInDays, 10));
        expiresAt = d.toISOString();
      }

      await api.post("/file-requests", {
        title: title.trim(),
        description: description.trim(),
        target_folder_id: targetFolderId,
        max_file_size_bytes: parseInt(maxSizeMB, 10) * 1024 * 1024,
        expires_at: expiresAt,
      });

      setIsModalOpen(false);
      setTitle("");
      setDescription("");
      fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create file request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this dropzone?")) return;
    try {
      await api.delete(`/file-requests/${id}`);
      fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to deactivate dropzone");
    }
  };

  const handleCopy = (token: string) => {
    const url = `${window.location.origin}/dropzone/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-400" />
            No-Login File Request Dropzones
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Allow external clients or friends to upload files straight into your drive without creating an account.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Dropzone</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-xs text-slate-500 font-mono">Loading dropzones...</p>
      ) : requests.length === 0 ? (
        <div className="text-center p-12 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-200">No active dropzones</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create a file request to get a public upload link where anyone can drop files directly into your selected folder.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className={`p-5 rounded-2xl border transition space-y-4 ${
                req.is_active
                  ? "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                  : "bg-slate-950/40 border-slate-800/40 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">{req.title}</h3>
                  {req.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{req.description}</p>
                  )}
                </div>

                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    req.is_active
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-slate-800 text-slate-500 border-slate-700"
                  }`}
                >
                  {req.is_active ? "Active" : "Closed"}
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                  Max {(req.max_file_size_bytes / (1024 * 1024)).toFixed(0)} MB
                </span>
                {req.expires_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Expires {new Date(req.expires_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Action row */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-800/60">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(req.token)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                  >
                    {copiedToken === req.token ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedToken === req.token ? "Copied" : "Copy Link"}</span>
                  </button>

                  <a
                    href={`/dropzone/${req.token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
                    title="Open public dropzone"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {req.is_active && (
                  <button
                    onClick={() => handleDeactivate(req.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Deactivate dropzone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#0d121f] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <h2 className="text-base font-bold text-white tracking-tight">Create File Request</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Request Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q3 Financial Receipts, Project Assets"
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Instructions for Uploader
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Please upload your scanned invoices in PDF format."
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Save Files Into Folder
                </label>
                <select
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                  required
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name} {f.is_vault ? "(Vault)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Max File Size
                  </label>
                  <select
                    value={maxSizeMB}
                    onChange={(e) => setMaxSizeMB(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="50">50 MB</option>
                    <option value="100">100 MB</option>
                    <option value="250">250 MB</option>
                    <option value="500">500 MB</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Expiration
                  </label>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="3">3 Days</option>
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="never">Never</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Dropzone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
