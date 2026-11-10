package domain

import (
	"time"

	"github.com/google/uuid"
)

type NodeType string

const (
	NodeTypeFolder NodeType = "folder"
	NodeTypeFile   NodeType = "file"
)

type Node struct {
	ID                  uuid.UUID  `json:"id"`
	OwnerID             uuid.UUID  `json:"owner_id"`
	ParentID            *uuid.UUID `json:"parent_id"`
	Name                string     `json:"name"`
	Type                NodeType   `json:"type"`
	MimeType            *string    `json:"mime_type,omitempty"`
	SizeBytes           int64      `json:"size_bytes"`
	StoragePublicID     *string    `json:"storage_public_id,omitempty"`
	StorageResourceType *string    `json:"storage_resource_type,omitempty"`
	CurrentVersion      int        `json:"current_version"`
	IsVault             bool       `json:"is_vault"`
	IsStarred           bool       `json:"is_starred"`
	IsTrashed           bool       `json:"is_trashed"`
	TrashedAt           *time.Time `json:"trashed_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type Breadcrumb struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}
