"use client";

import React from "react";
import { X, History, RotateCcw, CheckCircle2, Clock } from "lucide-react";
import { NodeItem, FileVersion } from "@/types";
import { api } from "@/lib/api";

interface VersionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  file: NodeItem | null;
  onVersionRestored: () => void;
}

export function VersionDrawer({
  isOpen,
  onClose,
  file,
  onVersionRestored,
}: VersionDrawerProps) {
  const [versions, setVersions] = React.useState<FileVersion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && file) {
      setLoading(true);
      api
        .get(`/nodes/${file.id}/versions`)
        .then((res) => setVersions(res.data.versions || []))
        .catch(() => setVersions([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const handleRestore = async (versionID: string) => {
    setRestoringId(versionID);
    try {
      await api.post(`/nodes/${file.id}/versions/${versionID}/restore`);
      onVersionRestored();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to restore version");
    } finally {
      setRestoringId(null);
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-[#0d121f] border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Version History</h2>
              <p className="text-xs text-slate-400 truncate max-w-[220px]">{file.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Current Active Version */}
          <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                Current Active (v{file.current_version})
              </span>
              <span className="text-xs font-mono text-slate-400">{formatSize(file.size_bytes)}</span>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              {formatDate(file.updated_at)}
            </p>
          </div>

          <div className="border-t border-slate-800/80 my-4 pt-4">
            <p className="text-[11px] uppercase font-semibold text-slate-500 tracking-wider mb-3">
              Past Revisions
            </p>

            {loading ? (
              <p className="text-xs text-slate-500 font-mono">Loading version history...</p>
            ) : versions.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No previous versions recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 font-mono">
                          v{ver.version_number}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatSize(ver.size_bytes)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {formatDate(ver.created_at)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRestore(ver.id)}
                      disabled={restoringId === ver.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{restoringId === ver.id ? "Restoring..." : "Restore"}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#090d16]/80 text-center">
          <p className="text-[11px] text-slate-500">
            Smart automatic versioning archives past revisions whenever you upload a file with the same name.
          </p>
        </div>
      </div>
    </div>
  );
}

