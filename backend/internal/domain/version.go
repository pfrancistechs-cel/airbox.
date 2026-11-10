package domain

import (
	"time"

	"github.com/google/uuid"
)

type FileVersion struct {
	ID                  uuid.UUID `json:"id"`
	NodeID              uuid.UUID `json:"node_id"`
	VersionNumber       int       `json:"version_number"`
	StoragePublicID     string    `json:"storage_public_id"`
	StorageResourceType string    `json:"storage_resource_type"`
	SizeBytes           int64     `json:"size_bytes"`
	CreatedAt           time.Time `json:"created_at"`
}

