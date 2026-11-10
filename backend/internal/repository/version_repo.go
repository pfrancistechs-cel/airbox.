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
	ErrVersionNotFound = errors.New("file version not found")
)

type VersionRepository struct {
	db *DB
}

func NewVersionRepository(db *DB) *VersionRepository {
	return &VersionRepository{db: db}
}

func (r *VersionRepository) Create(ctx context.Context, v *domain.FileVersion) error {
	query := `
		INSERT INTO file_versions (
			id, node_id, version_number, storage_public_id, storage_resource_type, size_bytes, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	v.CreatedAt = time.Now()
	_, err := r.db.Pool.Exec(ctx, query,
		v.ID, v.NodeID, v.VersionNumber, v.StoragePublicID, v.StorageResourceType, v.SizeBytes, v.CreatedAt,
	)
	return err
}

func (r *VersionRepository) ListByNodeID(ctx context.Context, nodeID uuid.UUID) ([]domain.FileVersion, error) {
	query := `
		SELECT id, node_id, version_number, storage_public_id, storage_resource_type, size_bytes, created_at
		FROM file_versions
		WHERE node_id = $1
		ORDER BY version_number DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, nodeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	versions := make([]domain.FileVersion, 0)
	for rows.Next() {
		var v domain.FileVersion
		err := rows.Scan(
			&v.ID, &v.NodeID, &v.VersionNumber, &v.StoragePublicID, &v.StorageResourceType, &v.SizeBytes, &v.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		versions = append(versions, v)
	}
	return versions, rows.Err()
}

func (r *VersionRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.FileVersion, error) {
	query := `
		SELECT id, node_id, version_number, storage_public_id, storage_resource_type, size_bytes, created_at
		FROM file_versions
		WHERE id = $1
	`
	var v domain.FileVersion
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&v.ID, &v.NodeID, &v.VersionNumber, &v.StoragePublicID, &v.StorageResourceType, &v.SizeBytes, &v.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrVersionNotFound
		}
		return nil, err
	}
	return &v, nil
}

