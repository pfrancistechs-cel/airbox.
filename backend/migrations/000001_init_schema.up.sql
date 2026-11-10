-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    storage_used BIGINT NOT NULL DEFAULT 0,
    storage_limit BIGINT NOT NULL DEFAULT 5368709120, -- 5 GB default
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- 3. NODES (Unified Virtual Filesystem)
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('folder', 'file')),
    mime_type VARCHAR(120),
    size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_public_id VARCHAR(255),
    storage_resource_type VARCHAR(50),
    current_version INT NOT NULL DEFAULT 1,
    is_vault BOOLEAN NOT NULL DEFAULT FALSE,
    is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
    trashed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_owner_parent ON nodes(owner_id, parent_id, is_trashed);
CREATE INDEX IF NOT EXISTS idx_nodes_owner_starred ON nodes(owner_id, is_starred) WHERE is_trashed = FALSE;
CREATE INDEX IF NOT EXISTS idx_nodes_owner_vault ON nodes(owner_id, is_vault) WHERE is_trashed = FALSE;
CREATE INDEX IF NOT EXISTS idx_nodes_owner_trashed ON nodes(owner_id, is_trashed);

-- 4. FILE VERSIONS
CREATE TABLE IF NOT EXISTS file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    storage_public_id VARCHAR(255) NOT NULL,
    storage_resource_type VARCHAR(50) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_versions_node ON file_versions(node_id, version_number DESC);

-- 5. SHARED LINKS
CREATE TABLE IF NOT EXISTS shared_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    expires_at TIMESTAMPTZ,
    allow_download BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);

-- 6. FILE REQUESTS (No-Login Dropzones)
CREATE TABLE IF NOT EXISTS file_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_folder_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    expires_at TIMESTAMPTZ,
    max_file_size_bytes BIGINT NOT NULL DEFAULT 104857600, -- 100 MB default
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_requests_token ON file_requests(token);
