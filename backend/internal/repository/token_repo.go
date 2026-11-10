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
	ErrTokenNotFound = errors.New("refresh token not found or revoked")
)

type TokenRepository struct {
	db *DB
}

func NewTokenRepository(db *DB) *TokenRepository {
	return &TokenRepository{db: db}
}

func (r *TokenRepository) SaveRefreshToken(ctx context.Context, t *domain.RefreshToken) error {
	query := `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	t.CreatedAt = time.Now()
	_, err := r.db.Pool.Exec(ctx, query, t.ID, t.UserID, t.TokenHash, t.ExpiresAt, t.Revoked, t.CreatedAt)
	return err
}

func (r *TokenRepository) GetRefreshToken(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	query := `
		SELECT id, user_id, token_hash, expires_at, revoked, created_at
		FROM refresh_tokens
		WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()
	`
	var t domain.RefreshToken
	err := r.db.Pool.QueryRow(ctx, query, tokenHash).Scan(
		&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.Revoked, &t.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTokenNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (r *TokenRepository) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	query := `
		UPDATE refresh_tokens
		SET revoked = TRUE
		WHERE token_hash = $1
	`
	_, err := r.db.Pool.Exec(ctx, query, tokenHash)
	return err
}

func (r *TokenRepository) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	query := `
		UPDATE refresh_tokens
		SET revoked = TRUE
		WHERE user_id = $1
	`
	_, err := r.db.Pool.Exec(ctx, query, userID)
	return err
}

func (r *TokenRepository) CleanupExpired(ctx context.Context) error {
	query := `
		DELETE FROM refresh_tokens
		WHERE expires_at < NOW() OR revoked = TRUE
	`
	_, err := r.db.Pool.Exec(ctx, query)
	return err
}

