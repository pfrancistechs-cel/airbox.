package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/pfrancistechs-cel/airbox/backend/internal/domain"
)

var (
	ErrNodeNotFound     = errors.New("node not found")
	ErrCircularParent   = errors.New("cannot move folder inside itself or its children")
	ErrDuplicateSibling = errors.New("an item with this name already exists in this folder")
)

type NodeRepository struct {
	db *DB
}

func NewNodeRepository(db *DB) *NodeRepository {
	return &NodeRepository{db: db}
}

func (r *NodeRepository) Create(ctx context.Context, n *domain.Node) error {
	query := `
		INSERT INTO nodes (
			id, owner_id, parent_id, name, type, mime_type, size_bytes,
			storage_public_id, storage_resource_type, current_version,
			is_vault, is_starred, is_trashed, trashed_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING id, created_at, updated_at
	`
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	now := time.Now()
	n.CreatedAt = now
	n.UpdatedAt = now

	err := r.db.Pool.QueryRow(ctx, query,
		n.ID, n.OwnerID, n.ParentID, n.Name, n.Type, n.MimeType, n.SizeBytes,
		n.StoragePublicID, n.StorageResourceType, n.CurrentVersion,
		n.IsVault, n.IsStarred, n.IsTrashed, n.TrashedAt, n.CreatedAt, n.UpdatedAt,
	).Scan(&n.ID, &n.CreatedAt, &n.UpdatedAt)
	return err
}

func (r *NodeRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Node, error) {
	query := `
		SELECT
			id, owner_id, parent_id, name, type, mime_type, size_bytes,
			storage_public_id, storage_resource_type, current_version,
			is_vault, is_starred, is_trashed, trashed_at, created_at, updated_at
		FROM nodes
		WHERE id = $1
	`
	var n domain.Node
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&n.ID, &n.OwnerID, &n.ParentID, &n.Name, &n.Type, &n.MimeType, &n.SizeBytes,
		&n.StoragePublicID, &n.StorageResourceType, &n.CurrentVersion,
		&n.IsVault, &n.IsStarred, &n.IsTrashed, &n.TrashedAt, &n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNodeNotFound
		}
		return nil, err
	}
	return &n, nil
}

func (r *NodeRepository) GetByParentAndName(ctx context.Context, ownerID uuid.UUID, parentID *uuid.UUID, name string) (*domain.Node, error) {
	query := `
		SELECT
			id, owner_id, parent_id, name, type, mime_type, size_bytes,
			storage_public_id, storage_resource_type, current_version,
			is_vault, is_starred, is_trashed, trashed_at, created_at, updated_at
		FROM nodes
		WHERE owner_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND name = $3 AND is_trashed = FALSE
		LIMIT 1
	`
	var n domain.Node
	err := r.db.Pool.QueryRow(ctx, query, ownerID, parentID, name).Scan(
		&n.ID, &n.OwnerID, &n.ParentID, &n.Name, &n.Type, &n.MimeType, &n.SizeBytes,
		&n.StoragePublicID, &n.StorageResourceType, &n.CurrentVersion,
		&n.IsVault, &n.IsStarred, &n.IsTrashed, &n.TrashedAt, &n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // not found, which is fine
		}
		return nil, err
	}
	return &n, nil
}

func (r *NodeRepository) List(ctx context.Context, ownerID uuid.UUID, parentID *uuid.UUID, filter, search string) ([]domain.Node, error) {
	var query string
	var args []interface{}

	if search != "" {
		query = `
			SELECT
				id, owner_id, parent_id, name, type, mime_type, size_bytes,
				storage_public_id, storage_resource_type, current_version,
				is_vault, is_starred, is_trashed, trashed_at, created_at, updated_at
			FROM nodes
			WHERE owner_id = $1 AND is_trashed = FALSE AND name ILIKE $2
			ORDER BY type DESC, name ASC
		`
		args = []interface{}{ownerID, "%" + search + "%"}
	} else {
		switch filter {
		case "starred":
			query = `
				SELECT
					id, owner_id, parent_id, name, type, mime_type, size_bytes,
					storage_public_id, storage_resource_type, current_version,
					is_vault, is_starred, is_trashed, trashed_at, created_at, updated_at
				FROM nodes
				WHERE owner_id = $1 AND is_starred = TRUE AND is_trashed = FALSE
				ORDER BY type DESC, name ASC
			`
			args = []interface{}{ownerID}
		case "vault":
			query = `
				SELECT
					id, owner_id, parent_id, name, type, mime_type, size_bytes,
					storage_public_id, storage_resource_type, current_version,
					is_vault, is_starred, is_trashed, trashed_at, created_at, updated_at
				FROM nodes
				WHERE owner_id = $1 AND is_vault = TRUE AND is_trashed = FALSE
				ORDER BY type DESC, name ASC
			`
			args = []interface{}{ownerID}
		case "trash":
			query = `
				SELECT
					id, owner_id, parent_id, name, type, mime_type, size_bytes,
					storage_public_id, storage_resource_type, current_version,
					is_vault, is_starred, is_trashed, trashed_at, created_at, updated_at
				FROM nodes
				WHERE owner_id = $1 AND is_trashed = TRUE
				ORDER BY trashed_at DESC
			`
			args = []interface{}{ownerID}
		default:
			// Standard directory listing inside parent_id
			query = `
				SELECT
					id, owner_id, parent_id, name, type, mime_type, size_bytes,
					storage_public_id, storage_resource_type, current_version,
					is_vault, is_starred, is_trashed, trashed_at, created_at, updated_at
				FROM nodes
				WHERE owner_id = $1 AND is_trashed = FALSE AND parent_id IS NOT DISTINCT FROM $2
				ORDER BY type DESC, name ASC
			`
			args = []interface{}{ownerID, parentID}
		}
	}

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query nodes error: %w", err)
	}
	defer rows.Close()

	nodes := make([]domain.Node, 0)
	for rows.Next() {
		var n domain.Node
		err := rows.Scan(
			&n.ID, &n.OwnerID, &n.ParentID, &n.Name, &n.Type, &n.MimeType, &n.SizeBytes,
			&n.StoragePublicID, &n.StorageResourceType, &n.CurrentVersion,
			&n.IsVault, &n.IsStarred, &n.IsTrashed, &n.TrashedAt, &n.CreatedAt, &n.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

func (r *NodeRepository) GetBreadcrumbs(ctx context.Context, nodeID uuid.UUID) ([]domain.Breadcrumb, error) {
	query := `
		WITH RECURSIVE path_tree AS (
			SELECT id, parent_id, name, 0 AS depth
			FROM nodes
			WHERE id = $1
			UNION ALL
			SELECT n.id, n.parent_id, n.name, pt.depth + 1
			FROM nodes n
			INNER JOIN path_tree pt ON n.id = pt.parent_id
		)
		SELECT id, name
		FROM path_tree
		ORDER BY depth DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, nodeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var crumbs []domain.Breadcrumb
	for rows.Next() {
		var b domain.Breadcrumb
		if err := rows.Scan(&b.ID, &b.Name); err != nil {
			return nil, err
		}
		crumbs = append(crumbs, b)
	}
	return crumbs, nil
}

func (r *NodeRepository) Update(ctx context.Context, n *domain.Node) error {
	query := `
		UPDATE nodes
		SET
			name = $2,
			parent_id = $3,
			mime_type = $4,
			size_bytes = $5,
			storage_public_id = $6,
			storage_resource_type = $7,
			current_version = $8,
			is_vault = $9,
			is_starred = $10,
			is_trashed = $11,
			trashed_at = $12,
			updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Pool.Exec(ctx, query,
		n.ID, n.Name, n.ParentID, n.MimeType, n.SizeBytes,
		n.StoragePublicID, n.StorageResourceType, n.CurrentVersion,
		n.IsVault, n.IsStarred, n.IsTrashed, n.TrashedAt,
	)
	return err
}

func (r *NodeRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE nodes
		SET is_trashed = TRUE, trashed_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *NodeRepository) Restore(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE nodes
		SET is_trashed = FALSE, trashed_at = NULL, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *NodeRepository) PermanentDelete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM nodes WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

func (r *NodeRepository) CheckCircularParent(ctx context.Context, nodeID, targetParentID uuid.UUID) (bool, error) {
	if nodeID == targetParentID {
		return true, nil
	}
	query := `
		WITH RECURSIVE parent_tree AS (
			SELECT id, parent_id
			FROM nodes
			WHERE id = $1
			UNION ALL
			SELECT n.id, n.parent_id
			FROM nodes n
			INNER JOIN parent_tree pt ON n.id = pt.parent_id
		)
		SELECT EXISTS (
			SELECT 1 FROM parent_tree WHERE id = $2
		)
	`
	var isCircular bool
	err := r.db.Pool.QueryRow(ctx, query, targetParentID, nodeID).Scan(&isCircular)
	return isCircular, err
}

