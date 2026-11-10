"use client";

import React, { useState, useEffect } from "react";
import { X, Download, Shield, Loader2, FileText, AlertCircle } from "lucide-react";
import { NodeItem } from "@/types";
import { api } from "@/lib/api";
import { decryptVaultFile } from "@/lib/vault";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: NodeItem | null;
  onPromptVaultKey: (onSubmit: (passphrase: string) => void) => void;
}

export function PreviewModal({ isOpen, onClose, file, onPromptVaultKey }: PreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setDownloadUrl(null);
      setPreviewBlobUrl(null);
      setTextContent(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const loadContent = async () => {
      try {
        // 1. Get 60s expiring signed download URL
        const res = await api.get(`/nodes/${file.id}/download`);
        const url = res.data.download_url;
        setDownloadUrl(url);

        if (file.is_vault) {
          // Vault file: fetch encrypted blob and decrypt with passphrase
          let passphrase = sessionStorage.getItem("airbox_vault_passphrase");
          if (!passphrase) {
            onPromptVaultKey(async (key) => {
              sessionStorage.setItem("airbox_vault_passphrase", key);
              await decryptAndRender(url, key);
            });
            return;
          }
          await decryptAndRender(url, passphrase);
        } else {
          // Standard file
          await renderStandardFile(url);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || "Failed to load file preview");
        setLoading(false);
      }
    };

    const decryptAndRender = async (url: string, passphrase: string) => {
      try {
        const resp = await fetch(url);
        const encryptedBlob = await resp.blob();
        const decryptedBlob = await decryptVaultFile(
          encryptedBlob,
          passphrase,
          file.mime_type || "application/octet-stream"
        );

        const objectUrl = URL.createObjectURL(decryptedBlob);
        setPreviewBlobUrl(objectUrl);

        if (file.mime_type?.startsWith("text/") || file.mime_type?.includes("json")) {
          const text = await decryptedBlob.text();
          setTextContent(text);
        }
      } catch (err: any) {
        setError(err.message || "Decryption failed. Please check your vault passphrase.");
      } finally {
        setLoading(false);
      }
    };

    const renderStandardFile = async (url: string) => {
      const mime = file.mime_type || "";
      if (mime.startsWith("image/") || mime.startsWith("video/") || mime.includes("pdf")) {
        setPreviewBlobUrl(url);
      } else if (mime.startsWith("text/") || mime.includes("json")) {
        try {
          const resp = await fetch(url);
          const text = await resp.text();
          setTextContent(text);
        } catch {
          // fallback to download
        }
      }
      setLoading(false);
    };

    loadContent();

    return () => {
      if (previewBlobUrl && previewBlobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const mime = file.mime_type || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isPDF = mime.includes("pdf");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#0d121f] border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3 truncate max-w-lg">
            {file.is_vault ? (
              <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-blue-400 shrink-0" />
            )}
            <span className="font-semibold text-sm text-white truncate">{file.name}</span>
            {file.is_vault && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Decrypted in Browser
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(previewBlobUrl || downloadUrl) && (
              <a
                href={previewBlobUrl || downloadUrl || "#"}
                download={file.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-[400px] bg-slate-950">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-xs font-mono">
                {file.is_vault ? "Decrypting vault payload in browser..." : "Loading preview..."}
              </p>
            </div>
          ) : error ? (
            <div className="text-center space-y-3 max-w-md p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-200">Preview Unavailable</p>
              <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
            </div>
          ) : isImage && previewBlobUrl ? (
            <img
              src={previewBlobUrl}
              alt={file.name}
              className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
            />
          ) : isVideo && previewBlobUrl ? (
            <video
              src={previewBlobUrl}
              controls
              className="max-h-[70vh] max-w-full rounded-lg shadow-lg"
            />
          ) : isPDF && previewBlobUrl ? (
            <iframe
              src={previewBlobUrl}
              title={file.name}
              className="w-full h-[70vh] rounded-lg border border-slate-800"
            />
          ) : textContent !== null ? (
            <pre className="w-full h-[60vh] p-4 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono overflow-auto whitespace-pre-wrap border border-slate-800">
              {textContent}
            </pre>
          ) : (
            <div className="text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">No inline preview available for this format.</p>
              <a
                href={previewBlobUrl || downloadUrl || "#"}
                download={file.name}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                Download Raw File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

