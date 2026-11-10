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
  Download,
  Share2,
  History,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { NodeItem } from "@/types";

interface FileListProps {
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

export function FileList({
  items,
  onOpenFolder,
  onPreviewFile,
  onToggleStar,
  onShare,
  onVersionHistory,
  onDelete,
  onRestore,
  isTrashView,
}: FileListProps) {
  const getFileIcon = (item: NodeItem) => {
    if (item.type === "folder") {
      if (item.is_vault) return <Shield className="w-4 h-4 text-emerald-400" />;
      return <Folder className="w-4 h-4 text-blue-400 fill-blue-500/20" />;
    }
    const mime = item.mime_type || "";
    if (mime.startsWith("image/")) return <FileImage className="w-4 h-4 text-purple-400" />;
    if (mime.startsWith("video/")) return <FileVideo className="w-4 h-4 text-rose-400" />;
    if (mime.includes("pdf")) return <FileText className="w-4 h-4 text-red-400" />;
    if (mime.includes("json") || mime.includes("javascript") || mime.includes("typescript")) {
      return <FileCode className="w-4 h-4 text-emerald-400" />;
    }
    if (mime.includes("zip") || mime.includes("tar")) return <FileArchive className="w-4 h-4 text-amber-400" />;
    return <FileIcon className="w-4 h-4 text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "--";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1000) return `${(mb / 1024).toFixed(2)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-400">
        <thead className="border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-500 tracking-wider">
          <tr>
            <th className="py-3 px-6">Name</th>
            <th className="py-3 px-4">Size</th>
            <th className="py-3 px-4">Version</th>
            <th className="py-3 px-4">Modified</th>
            <th className="py-3 px-6 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {items.map((item) => (
            <tr
              key={item.id}
              onDoubleClick={() => {
                if (item.type === "folder") onOpenFolder(item);
                else onPreviewFile(item);
              }}
              className="hover:bg-slate-900/40 transition group cursor-pointer"
            >
              {/* Name */}
              <td className="py-3.5 px-6">
                <div className="flex items-center gap-3">
                  {!isTrashView && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(item);
                      }}
                      className={`transition ${
                        item.is_starred
                          ? "text-amber-400"
                          : "text-slate-600 group-hover:text-slate-400"
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                  {getFileIcon(item)}
                  <span className="font-medium text-slate-200 group-hover:text-blue-400 transition truncate max-w-xs md:max-w-md">
                    {item.name}
                  </span>
                  {item.is_vault && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      Vault
                    </span>
                  )}
                </div>
              </td>

              {/* Size */}
              <td className="py-3.5 px-4 font-mono text-slate-400">
                {item.type === "folder" ? "Folder" : formatSize(item.size_bytes)}
              </td>

              {/* Version */}
              <td className="py-3.5 px-4 font-mono">
                {item.type === "file" && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                    v{item.current_version}
                  </span>
                )}
              </td>

              {/* Modified */}
              <td className="py-3.5 px-4 font-mono text-slate-500">
                {formatDate(item.updated_at)}
              </td>

              {/* Actions */}
              <td className="py-3.5 px-6 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isTrashView ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRestore(item);
                        }}
                        title="Restore"
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item, true);
                        }}
                        title="Permanent Delete"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
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
                            title="Download"
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onVersionHistory(item);
                            }}
                            title="Version History"
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
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
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item);
                        }}
                        title="Move to Trash"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
