package repository

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func NewDB(databaseURL string) (*DB, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid database connection string: %w", err)
	}

	config.MaxConns = 25
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping neon database: %w", err)
	}

	db := &DB{Pool: pool}

	// Run migrations automatically
	if err := db.autoMigrate(ctx); err != nil {
		log.Printf("[DB] Warning: auto-migrate: %v\n", err)
	}

	return db, nil
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

// autoMigrate runs 000001_init_schema.up.sql if tables do not exist
func (db *DB) autoMigrate(ctx context.Context) error {
	migrationCandidates := []string{
		"migrations/000001_init_schema.up.sql",
		"backend/migrations/000001_init_schema.up.sql",
		"../migrations/000001_init_schema.up.sql",
	}

	var sqlContent []byte
	var readErr error
	for _, path := range migrationCandidates {
		abs, _ := filepath.Abs(path)
		content, err := os.ReadFile(abs)
		if err == nil && len(content) > 0 {
			sqlContent = content
			break
		}
		readErr = err
	}

	if len(sqlContent) == 0 {
		return fmt.Errorf("migration file not found: %w", readErr)
	}

	// Execute migration statements
	queries := strings.Split(string(sqlContent), ";")
	for _, q := range queries {
		trimmed := strings.TrimSpace(q)
		if trimmed == "" {
			continue
		}
		if _, err := db.Pool.Exec(ctx, trimmed); err != nil {
			// Ignore extension creation errors if permissions are restricted
			if strings.Contains(err.Error(), "pgcrypto") {
				continue
			}
			return fmt.Errorf("executing migration query [%s...]: %w", trimmed[:min(len(trimmed), 40)], err)
		}
	}

	log.Println("[DB] Neon database schemas and tables verified successfully.")
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

