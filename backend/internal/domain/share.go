package domain

import (
	"time"

	"github.com/google/uuid"
)

type SharedLink struct {
	ID            uuid.UUID  `json:"id"`
	NodeID        uuid.UUID  `json:"node_id"`
	Token         string     `json:"token"`
	PasswordHash  *string    `json:"-"`
	HasPassword   bool       `json:"has_password"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	AllowDownload bool       `json:"allow_download"`
	CreatedAt     time.Time  `json:"created_at"`
}

