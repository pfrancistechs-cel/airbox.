export type NodeType = "folder" | "file";

export interface User {
  id: string;
  email: string;
  full_name: string;
  storage_used: number;
  storage_limit: number;
  created_at: string;
  updated_at: string;
}

export interface NodeItem {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  type: NodeType;
  mime_type?: string;
  size_bytes: number;
  storage_public_id?: string;
  storage_resource_type?: string;
  current_version: number;
  is_vault: boolean;
  is_starred: boolean;
  is_trashed: boolean;
  trashed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Breadcrumb {
  id: string;
  name: string;
}

export interface NodeListResponse {
  items: NodeItem[];
  breadcrumbs: Breadcrumb[];
}

export interface FileVersion {
  id: string;
  node_id: string;
  version_number: number;
  storage_public_id: string;
  storage_resource_type: string;
  size_bytes: number;
  created_at: string;
}

export interface SharedLink {
  id: string;
  node_id: string;
  token: string;
  has_password: boolean;
  expires_at?: string;
  allow_download: boolean;
  created_at: string;
}

export interface FileRequest {
  id: string;
  owner_id: string;
  target_folder_id: string;
  token: string;
  title: string;
  description: string;
  expires_at?: string;
  max_file_size_bytes: number;
  is_active: boolean;
  created_at: string;
}

export interface SignedUploadParams {
  timestamp: number;
  signature: string;
  api_key: string;
  cloud_name: string;
  folder: string;
  type: string;
}

export interface UploadProgressItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "pending" | "encrypting" | "uploading" | "completing" | "success" | "error";
  errorMessage?: string;
  isVault?: boolean;
}
