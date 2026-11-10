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
	ErrFileRequestNotFound = errors.New("file request dropzone not found or inactive")
)

type RequestRepository struct {
	db *DB
}

func NewRequestRepository(db *DB) *RequestRepository {
	return &RequestRepository{db: db}
}

func (r *RequestRepository) Create(ctx context.Context, fr *domain.FileRequest) error {
	query := `
		INSERT INTO file_requests (
			id, owner_id, target_folder_id, token, title, description,
			expires_at, max_file_size_bytes, is_active, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`
	if fr.ID == uuid.Nil {
		fr.ID = uuid.New()
	}
	fr.CreatedAt = time.Now()
	return r.db.Pool.QueryRow(ctx, query,
		fr.ID, fr.OwnerID, fr.TargetFolderID, fr.Token, fr.Title, fr.Description,
		fr.ExpiresAt, fr.MaxFileSizeBytes, fr.IsActive, fr.CreatedAt,
	).Scan(&fr.ID, &fr.CreatedAt)
}

func (r *RequestRepository) GetByToken(ctx context.Context, token string) (*domain.FileRequest, error) {
	query := `
		SELECT
			id, owner_id, target_folder_id, token, title, description,
			expires_at, max_file_size_bytes, is_active, created_at
		FROM file_requests
		WHERE token = $1 AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
	`
	var fr domain.FileRequest
	err := r.db.Pool.QueryRow(ctx, query, token).Scan(
		&fr.ID, &fr.OwnerID, &fr.TargetFolderID, &fr.Token, &fr.Title, &fr.Description,
		&fr.ExpiresAt, &fr.MaxFileSizeBytes, &fr.IsActive, &fr.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFileRequestNotFound
		}
		return nil, err
	}
	return &fr, nil
}

func (r *RequestRepository) ListByOwner(ctx context.Context, ownerID uuid.UUID) ([]domain.FileRequest, error) {
	query := `
		SELECT
			id, owner_id, target_folder_id, token, title, description,
			expires_at, max_file_size_bytes, is_active, created_at
		FROM file_requests
		WHERE owner_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reqs []domain.FileRequest
	for rows.Next() {
		var fr domain.FileRequest
		err := rows.Scan(
			&fr.ID, &fr.OwnerID, &fr.TargetFolderID, &fr.Token, &fr.Title, &fr.Description,
			&fr.ExpiresAt, &fr.MaxFileSizeBytes, &fr.IsActive, &fr.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		reqs = append(reqs, fr)
	}
	return reqs, rows.Err()
}

func (r *RequestRepository) Deactivate(ctx context.Context, id uuid.UUID, ownerID uuid.UUID) error {
	query := `
		UPDATE file_requests
		SET is_active = FALSE
		WHERE id = $1 AND owner_id = $2
	`
	_, err := r.db.Pool.Exec(ctx, query, id, ownerID)
	return err
}
