package domain

import (
	"time"

	"github.com/google/uuid"
)

type FileRequest struct {
	ID               uuid.UUID  `json:"id"`
	OwnerID          uuid.UUID  `json:"owner_id"`
	TargetFolderID   uuid.UUID  `json:"target_folder_id"`
	Token            string     `json:"token"`
	Title            string     `json:"title"`
	Description      string     `json:"description"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
	MaxFileSizeBytes int64      `json:"max_file_size_bytes"`
	IsActive         bool       `json:"is_active"`
	CreatedAt        time.Time  `json:"created_at"`
}

