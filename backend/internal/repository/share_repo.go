package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/pfrancistechs-cel/airbox/backend/internal/domain"
)

var (
	ErrSharedLinkNotFound = errors.New("shared link not found or expired")
)

type ShareRepository struct {
	db *DB
}

func NewShareRepository(db *DB) *ShareRepository {
	return &ShareRepository{db: db}
}

func (r *ShareRepository) Create(ctx context.Context, s *domain.SharedLink) error {
	query := `
		INSERT INTO shared_links (
			id, node_id, token, password_hash, expires_at, allow_download, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	s.CreatedAt = time.Now()
	return r.db.Pool.QueryRow(ctx, query,
		s.ID, s.NodeID, s.Token, s.PasswordHash, s.ExpiresAt, s.AllowDownload, s.CreatedAt,
	).Scan(&s.ID, &s.CreatedAt)
}

func (r *ShareRepository) GetByToken(ctx context.Context, token string) (*domain.SharedLink, error) {
	query := `
		SELECT id, node_id, token, password_hash, expires_at, allow_download, created_at
		FROM shared_links
		WHERE token = $1 AND (expires_at IS NULL OR expires_at > NOW())
	`
	var s domain.SharedLink
	err := r.db.Pool.QueryRow(ctx, query, token).Scan(
		&s.ID, &s.NodeID, &s.Token, &s.PasswordHash, &s.ExpiresAt, &s.AllowDownload, &s.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSharedLinkNotFound
		}
		return nil, err
	}
	s.HasPassword = s.PasswordHash != nil
	return &s, nil
}

func (r *ShareRepository) DeleteByNodeID(ctx context.Context, nodeID uuid.UUID) error {
	query := `DELETE FROM shared_links WHERE node_id = $1`
	_, err := r.db.Pool.Exec(ctx, query, nodeID)
	return err
}
