"use client";

import React from "react";
import {
  Folder,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileArchive,
  File as FileIcon,
  Shield,
  Star,
  MoreVertical,
  Download,
  Share2,
  History,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { NodeItem } from "@/types";

interface FileGridProps {
  items: NodeItem[];
  onOpenFolder: (item: NodeItem) => void;
  onPreviewFile: (item: NodeItem) => void;
  onToggleStar: (item: NodeItem) => void;
  onShare: (item: NodeItem) => void;
  onVersionHistory: (item: NodeItem) => void;
  onDelete: (item: NodeItem, permanent?: boolean) => void;
  onRestore: (item: NodeItem) => void;
  isTrashView?: boolean;
}

export function FileGrid({
  items,
  onOpenFolder,
  onPreviewFile,
  onToggleStar,
  onShare,
  onVersionHistory,
  onDelete,
  onRestore,
  isTrashView,
}: FileGridProps) {
  const getFileIcon = (item: NodeItem) => {
    if (item.type === "folder") {
      if (item.is_vault) {
        return <Shield className="w-8 h-8 text-emerald-400" />;
      }
      return <Folder className="w-8 h-8 text-blue-400 fill-blue-500/20" />;
    }

    const mime = item.mime_type || "";
    if (mime.startsWith("image/")) return <FileImage className="w-8 h-8 text-purple-400" />;
    if (mime.startsWith("video/")) return <FileVideo className="w-8 h-8 text-rose-400" />;
    if (mime.includes("pdf")) return <FileText className="w-8 h-8 text-red-400" />;
    if (mime.includes("json") || mime.includes("javascript") || mime.includes("typescript") || mime.includes("html")) {
      return <FileCode className="w-8 h-8 text-emerald-400" />;
    }
    if (mime.includes("zip") || mime.includes("tar") || mime.includes("rar")) {
      return <FileArchive className="w-8 h-8 text-amber-400" />;
    }
    return <FileIcon className="w-8 h-8 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "--";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1000) return `${(mb / 1024).toFixed(2)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
      {items.map((item) => (
        <div
          key={item.id}
          onDoubleClick={() => {
            if (item.type === "folder") onOpenFolder(item);
            else onPreviewFile(item);
          }}
          className="group relative p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between cursor-pointer select-none"
        >
          {/* Top badges & star */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              {item.is_vault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Vault
                </span>
              )}
              {item.current_version > 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  v{item.current_version}
                </span>
              )}
            </div>

            {!isTrashView && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(item);
                }}
                className={`p-1 rounded-lg transition ${
                  item.is_starred
                    ? "text-amber-400"
                    : "text-slate-500 opacity-0 group-hover:opacity-100 hover:text-slate-300"
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
              </button>
            )}
          </div>

          {/* Center Icon */}
          <div className="flex items-center justify-center my-3 group-hover:scale-105 transition-transform">
            {getFileIcon(item)}
          </div>

          {/* Name & Meta */}
          <div className="mt-2 text-center">
            <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-400 transition">
              {item.name}
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              {item.type === "folder" ? "Folder" : formatSize(item.size_bytes)}
            </p>
          </div>

          {/* Context Action Overlay */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 bg-slate-950/90 backdrop-blur-md rounded-lg border border-slate-700 p-1 shadow-lg">
              {isTrashView ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(item);
                    }}
                    title="Restore"
                    className="p-1 hover:text-emerald-400 rounded"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item, true);
                    }}
                    title="Permanent Delete"
                    className="p-1 hover:text-rose-400 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  {item.type === "file" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewFile(item);
                        }}
                        title="Download / Preview"
                        className="p-1 hover:text-blue-400 rounded"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVersionHistory(item);
                        }}
                        title="Version History"
                        className="p-1 hover:text-blue-400 rounded"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(item);
                    }}
                    title="Share Link"
                    className="p-1 hover:text-blue-400 rounded"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item);
                    }}
                    title="Move to Trash"
                    className="p-1 hover:text-rose-400 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
