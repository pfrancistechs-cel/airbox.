"use client";

import React, { useState, useEffect, use } from "react";
import axios from "axios";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  File as FileIcon,
  HardDrive,
  Calendar,
  Loader2,
  Inbox,
} from "lucide-react";
import { FileRequest } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export default function DropzonePage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [dropzone, setDropzone] = useState<FileRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Uploading state
  const [uploadQueue, setUploadQueue] = useState<
    { name: string; size: number; progress: number; status: string; error?: string }[]
  >([]);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE}/dropzone/${token}`)
      .then((res) => {
        setDropzone(res.data);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "This dropzone is closed or does not exist.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !dropzone) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > dropzone.max_file_size_bytes) {
        alert(
          `File "${file.name}" exceeds the maximum allowed size of ${(
            dropzone.max_file_size_bytes /
            (1024 * 1024)
          ).toFixed(0)} MB.`
        );
        continue;
      }

      const itemIdx = uploadQueue.length + i;
      setUploadQueue((prev) => [
        ...prev,
        { name: file.name, size: file.size, progress: 0, status: "uploading" },
      ]);

      try {
        // 1. Request upload signature
        const signRes = await axios.post(`${API_BASE}/dropzone/${token}/sign`, {
          estimated_size_bytes: file.size,
        });
        const signData = signRes.data;

        // 2. Direct-to-Cloudinary upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", signData.api_key);
        formData.append("timestamp", signData.timestamp.toString());
        formData.append("signature", signData.signature);
        formData.append("folder", signData.folder);
        formData.append("type", signData.type);

        const cloudinaryURL = `https://api.cloudinary.com/v1_1/${signData.cloud_name}/auto/upload`;

        const uploadRes = await axios.post(cloudinaryURL, formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const p = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadQueue((prev) =>
                prev.map((item, idx) => (idx === itemIdx ? { ...item, progress: p } : item))
              );
            }
          },
        });

        // 3. Finalize in Neon database
        await axios.post(`${API_BASE}/dropzone/${token}/complete`, {
          name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          storage_public_id: uploadRes.data.public_id,
          storage_resource_type: uploadRes.data.resource_type || "raw",
        });

        setUploadQueue((prev) =>
          prev.map((item, idx) =>
            idx === itemIdx ? { ...item, progress: 100, status: "success" } : item
          )
        );
      } catch (err: any) {
        setUploadQueue((prev) =>
          prev.map((item, idx) =>
            idx === itemIdx
              ? {
                  ...item,
                  status: "error",
                  error: err.response?.data?.error || err.message || "Upload failed",
                }
              : item
          )
        );
      }
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-400 font-mono text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span>Connecting to AirBox dropzone...</span>
        </div>
      </main>
    );
  }

  if (error || !dropzone) {
    return (
      <main className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d121f] border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold text-white tracking-tight">Dropzone Unavailable</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-xl bg-[#0d121f] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="space-y-3 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-blue-400 tracking-wider font-mono">
                AirBox File Request Dropzone
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">{dropzone.title}</h1>
            </div>
          </div>

          {dropzone.description && (
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
              {dropzone.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              Up to {(dropzone.max_file_size_bytes / (1024 * 1024)).toFixed(0)} MB per file
            </span>
            {dropzone.expires_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Valid until {new Date(dropzone.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer ${
            isDragOver
              ? "border-blue-500 bg-blue-500/10"
              : "border-slate-800 hover:border-slate-700 bg-slate-900/30"
          }`}
          onClick={() => document.getElementById("guest-file-input")?.click()}
        >
          <input
            id="guest-file-input"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <UploadCloud className="w-10 h-10 text-blue-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-200">
            Drag and drop files here, or <span className="text-blue-400 underline">browse</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Files will be delivered straight into the requester&apos;s AirBox drive.
          </p>
        </div>

        {/* Upload Status List */}
        {uploadQueue.length > 0 && (
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Upload Progress
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {uploadQueue.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate max-w-[280px]">
                      <FileIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === "uploading" && (
                        <span className="text-blue-400 font-mono text-[11px]">
                          {item.progress}%
                        </span>
                      )}
                      {item.status === "success" && (
                        <span className="text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="text-rose-400 font-medium text-[11px] flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {item.status === "uploading" && (
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500">
          Powered by <span className="text-slate-400 font-semibold">AirBox</span> • Direct-to-Cloud Architecture
        </p>
      </div>
    </main>
  );
}
