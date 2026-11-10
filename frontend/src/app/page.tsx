"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  UploadCloud,
  FolderPlus,
  Inbox,
  FolderOpen,
  Trash2,
  Loader2,
  Shield,
  Star,
} from "lucide-react";
import { NodeItem, Breadcrumb, UploadProgressItem } from "@/types";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { encryptVaultFile } from "@/lib/vault";

// Layout components
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

// Explorer components
import { BreadcrumbBar } from "@/components/explorer/breadcrumb-bar";
import { FileGrid } from "@/components/explorer/file-grid";
import { FileList } from "@/components/explorer/file-list";

// Drawers & Modals
import { UploadDrawer } from "@/components/drawers/upload-drawer";
import { VersionDrawer } from "@/components/drawers/version-drawer";
import { NewFolderModal } from "@/components/modals/new-folder-modal";
import { VaultPassphraseModal } from "@/components/modals/vault-passphrase-modal";
import { ShareModal } from "@/components/modals/share-modal";
import { PreviewModal } from "@/components/modals/preview-modal";
import { FileRequestsView } from "@/components/requests/file-requests-view";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, refreshUser } = useAuth();

  // Navigation & View state
  const [currentTab, setCurrentTab] = useState("all");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<NodeItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modals & Drawers state
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedShareNode, setSelectedShareNode] = useState<NodeItem | null>(null);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [selectedVersionNode, setSelectedVersionNode] = useState<NodeItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedPreviewNode, setSelectedPreviewNode] = useState<NodeItem | null>(null);

  // Vault key prompt state
  const [isVaultKeyOpen, setIsVaultKeyOpen] = useState(false);
  const [vaultCallback, setVaultCallback] = useState<((key: string) => void) | null>(null);

  // Upload queue state
  const [uploadQueue, setUploadQueue] = useState<UploadProgressItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOverScreen, setIsDraggingOverScreen] = useState(false);

  // Redirect unauthenticated visitors
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Fetch directory nodes
  const { data, isLoading: nodesLoading } = useQuery({
    queryKey: ["nodes", currentFolderId, currentTab, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (searchQuery) {
        params.search = searchQuery;
      } else {
        if (currentTab !== "all") {
          params.filter = currentTab;
        } else if (currentFolderId) {
          params.parent_id = currentFolderId;
        }
      }

      const res = await api.get("/nodes", { params });
      return res.data as { items: NodeItem[]; breadcrumbs: Breadcrumb[] };
    },
    enabled: !!user && currentTab !== "requests",
  });

  // Track current folder info
  useEffect(() => {
    if (currentFolderId && data?.items) {
      const found = data.items.find((i) => i.id === currentFolderId);
      if (found) setCurrentFolder(found);
    } else if (!currentFolderId) {
      setCurrentFolder(null);
    }
  }, [currentFolderId, data]);

  // Star toggle mutation
  const toggleStarMutation = useMutation({
    mutationFn: async (node: NodeItem) => {
      await api.patch(`/nodes/${node.id}`, { is_starred: !node.is_starred });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
    },
  });

  // Trash / Permanent Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ node, permanent }: { node: NodeItem; permanent?: boolean }) => {
      await api.delete(`/nodes/${node.id}${permanent ? "?permanent=true" : ""}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
      refreshUser();
    },
  });

  // Restore from trash mutation
  const restoreMutation = useMutation({
    mutationFn: async (node: NodeItem) => {
      await api.post(`/nodes/${node.id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
    },
  });

  // Create folder handler
  const handleCreateFolder = async (name: string, isVault: boolean) => {
    await api.post("/nodes/folders", {
      name,
      parent_id: currentFolderId,
      is_vault: isVault || currentFolder?.is_vault || currentTab === "vault",
    });
    queryClient.invalidateQueries({ queryKey: ["nodes"] });
  };

  // UPLOAD ORCHESTRATION (Direct-to-Cloud + Zero-Knowledge Vault)
  const processUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const isTargetVault = currentTab === "vault" || !!currentFolder?.is_vault;

    let vaultPassphrase = "";
    if (isTargetVault) {
      const cached = sessionStorage.getItem("airbox_vault_passphrase");
      if (cached) {
        vaultPassphrase = cached;
      } else {
        await new Promise<string>((resolve) => {
          setVaultCallback(() => (key: string) => {
            sessionStorage.setItem("airbox_vault_passphrase", key);
            vaultPassphrase = key;
            resolve(key);
          });
          setIsVaultKeyOpen(true);
        });
      }
    }

    for (let i = 0; i < files.length; i++) {
      const originalFile = files[i];
      const uploadId = `${Date.now()}-${i}-${originalFile.name}`;

      setUploadQueue((prev) => [
        ...prev,
        {
          id: uploadId,
          name: originalFile.name,
          size: originalFile.size,
          progress: 0,
          status: isTargetVault ? "encrypting" : "uploading",
          isVault: isTargetVault,
        },
      ]);

      try {
        let payloadToUpload: Blob = originalFile;
        let mimeType = originalFile.type || "application/octet-stream";

        // 1. Client-Side Vault Encryption (Zero-Knowledge)
        if (isTargetVault && vaultPassphrase) {
          payloadToUpload = await encryptVaultFile(originalFile, vaultPassphrase);
          mimeType = "application/octet-stream";
        }

        // 2. Request Signed Cloudinary Parameters from Go backend
        const signRes = await api.post("/uploads/sign", {
          estimated_size_bytes: payloadToUpload.size,
        });
        const signData = signRes.data;

        // 3. Direct-to-Cloudinary upload via Axios
        const formData = new FormData();
        formData.append("file", payloadToUpload, originalFile.name);
        formData.append("api_key", signData.api_key);
        formData.append("timestamp", signData.timestamp.toString());
        formData.append("signature", signData.signature);
        if (signData.folder) {
          formData.append("folder", signData.folder);
        }
        formData.append("type", signData.type);

        const cloudinaryURL = `https://api.cloudinary.com/v1_1/${signData.cloud_name}/auto/upload`;

        const uploadRes = await axios.post(cloudinaryURL, formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const p = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadQueue((prev) =>
                prev.map((item) =>
                  item.id === uploadId ? { ...item, progress: p, status: "uploading" } : item
                )
              );
            }
          },
        });

        // 4. Complete upload in Neon Database (handles smart automatic versioning)
        setUploadQueue((prev) =>
          prev.map((item) => (item.id === uploadId ? { ...item, status: "completing" } : item))
        );

        await api.post("/uploads/complete", {
          parent_id: currentFolderId,
          name: originalFile.name,
          mime_type: originalFile.type || "application/octet-stream",
          size_bytes: payloadToUpload.size,
          storage_public_id: uploadRes.data.public_id,
          storage_resource_type: uploadRes.data.resource_type || "raw",
          is_vault: isTargetVault,
        });

        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === uploadId ? { ...item, progress: 100, status: "success" } : item
          )
        );

        queryClient.invalidateQueries({ queryKey: ["nodes"] });
        refreshUser();
      } catch (err: any) {
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === uploadId
              ? {
                  ...item,
                  status: "error",
                  errorMessage: err.response?.data?.error || err.message || "Upload failed",
                }
              : item
          )
        );
      }
    }
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </main>
    );
  }

  const items = data?.items || [];
  const breadcrumbs = data?.breadcrumbs || [];
  const folders = items.filter((i) => i.type === "folder");

  return (
    <div
      className="flex h-screen bg-[#090d16] text-slate-100 overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOverScreen(true);
      }}
      onDragLeave={(e) => {
        if (!e.relatedTarget) setIsDraggingOverScreen(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOverScreen(false);
        processUploadFiles(e.dataTransfer.files);
      }}
    >
      {/* Full-Screen Drag and Drop Overlay */}
      {isDraggingOverScreen && (
        <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-md border-4 border-dashed border-blue-500 flex flex-col items-center justify-center pointer-events-none animate-in fade-in">
          <UploadCloud className="w-16 h-16 text-blue-400 animate-bounce mb-4" />
          <p className="text-xl font-bold text-white tracking-tight">Drop files to upload instantly</p>
          <p className="text-xs text-blue-200 mt-1">Direct-to-Cloud with automatic versioning</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => processUploadFiles(e.target.files)}
      />

      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setCurrentFolderId(null);
          setSearchQuery("");
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNewFolderClick={() => setIsNewFolderOpen(true)}
          onUploadClick={() => fileInputRef.current?.click()}
          isVaultView={currentTab === "vault" || !!currentFolder?.is_vault}
        />

        {/* View Switcher: File Requests Dropzones or VFS Explorer */}
        {currentTab === "requests" ? (
          <div className="flex-1 overflow-y-auto">
            <FileRequestsView folders={folders} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Breadcrumb Navigation */}
            <BreadcrumbBar
              breadcrumbs={breadcrumbs}
              onNavigate={(id) => setCurrentFolderId(id)}
              isVault={currentTab === "vault" || !!currentFolder?.is_vault}
            />

            {/* Explorer Body */}
            <div className="flex-1 overflow-y-auto">
              {nodesLoading ? (
                <div className="flex items-center justify-center p-24 text-slate-500 font-mono text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-500" />
                  Loading items from Neon database...
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-24 text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shadow-inner">
                    {currentTab === "vault" ? (
                      <Shield className="w-8 h-8 text-emerald-500/40" />
                    ) : currentTab === "starred" ? (
                      <Star className="w-8 h-8 text-amber-500/40" />
                    ) : currentTab === "trash" ? (
                      <Trash2 className="w-8 h-8 text-slate-600" />
                    ) : (
                      <FolderOpen className="w-8 h-8 text-slate-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">
                      {searchQuery
                        ? "No matching items found"
                        : currentTab === "starred"
                        ? "No starred files"
                        : currentTab === "vault"
                        ? "Vault is empty"
                        : currentTab === "trash"
                        ? "Trash is empty"
                        : "This folder is empty"}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Drag and drop files here, or click the Upload button to store documents securely.
                    </p>
                  </div>
                </div>
              ) : viewMode === "grid" ? (
                <FileGrid
                  items={items}
                  onOpenFolder={(f) => setCurrentFolderId(f.id)}
                  onPreviewFile={(f) => {
                    setSelectedPreviewNode(f);
                    setIsPreviewOpen(true);
                  }}
                  onToggleStar={(item) => toggleStarMutation.mutate(item)}
                  onShare={(item) => {
                    setSelectedShareNode(item);
                    setIsShareOpen(true);
                  }}
                  onVersionHistory={(item) => {
                    setSelectedVersionNode(item);
                    setIsVersionOpen(true);
                  }}
                  onDelete={(item, perm) => deleteMutation.mutate({ node: item, permanent: perm })}
                  onRestore={(item) => restoreMutation.mutate(item)}
                  isTrashView={currentTab === "trash"}
                />
              ) : (
                <FileList
                  items={items}
                  onOpenFolder={(f) => setCurrentFolderId(f.id)}
                  onPreviewFile={(f) => {
                    setSelectedPreviewNode(f);
                    setIsPreviewOpen(true);
                  }}
                  onToggleStar={(item) => toggleStarMutation.mutate(item)}
                  onShare={(item) => {
                    setSelectedShareNode(item);
                    setIsShareOpen(true);
                  }}
                  onVersionHistory={(item) => {
                    setSelectedVersionNode(item);
                    setIsVersionOpen(true);
                  }}
                  onDelete={(item, perm) => deleteMutation.mutate({ node: item, permanent: perm })}
                  onRestore={(item) => restoreMutation.mutate(item)}
                  isTrashView={currentTab === "trash"}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Version History Drawer */}
      <VersionDrawer
        isOpen={isVersionOpen}
        onClose={() => {
          setIsVersionOpen(false);
          setSelectedVersionNode(null);
        }}
        file={selectedVersionNode}
        onVersionRestored={() => {
          queryClient.invalidateQueries({ queryKey: ["nodes"] });
          refreshUser();
        }}
      />

      {/* Persistent Upload Progress Drawer */}
      <UploadDrawer
        items={uploadQueue}
        onClear={() => setUploadQueue([])}
        onRemoveItem={(id) => setUploadQueue((prev) => prev.filter((i) => i.id !== id))}
      />

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        onSubmit={handleCreateFolder}
        defaultIsVault={currentTab === "vault" || !!currentFolder?.is_vault}
      />

      {/* Vault Key Passphrase Modal */}
      <VaultPassphraseModal
        isOpen={isVaultKeyOpen}
        onClose={() => {
          setIsVaultKeyOpen(false);
          setVaultCallback(null);
        }}
        onSubmit={(key) => {
          if (vaultCallback) vaultCallback(key);
        }}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => {
          setIsShareOpen(false);
          setSelectedShareNode(null);
        }}
        node={selectedShareNode}
      />

      {/* Preview Lightbox Modal */}
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedPreviewNode(null);
        }}
        file={selectedPreviewNode}
        onPromptVaultKey={(cb) => {
          setVaultCallback(() => cb);
          setIsVaultKeyOpen(true);
        }}
      />
    </div>
  );
}
