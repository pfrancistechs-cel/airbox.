package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/pfrancistechs-cel/airbox/backend/internal/domain"
	"github.com/pfrancistechs-cel/airbox/backend/internal/repository"
	"github.com/pfrancistechs-cel/airbox/backend/pkg/auth"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrQuotaExceeded      = errors.New("storage quota exceeded")
)

type AuthService struct {
	userRepo     *repository.UserRepository
	tokenRepo    *repository.TokenRepository
	tokenManager *auth.TokenManager
	defaultQuota int64
}

func NewAuthService(
	userRepo *repository.UserRepository,
	tokenRepo *repository.TokenRepository,
	tokenManager *auth.TokenManager,
	defaultQuota int64,
) *AuthService {
	if defaultQuota <= 0 {
		defaultQuota = 5 * 1024 * 1024 * 1024 // 5 GB
	}
	return &AuthService{
		userRepo:     userRepo,
		tokenRepo:    tokenRepo,
		tokenManager: tokenManager,
		defaultQuota: defaultQuota,
	}
}

type AuthResponse struct {
	User         *domain.User `json:"user"`
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
}

func (s *AuthService) Register(ctx context.Context, email, password, fullName string) (*AuthResponse, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if cleanEmail == "" || len(password) < 6 {
		return nil, errors.New("email and password (min 6 chars) are required")
	}

	existing, _ := s.userRepo.GetByEmail(ctx, cleanEmail)
	if existing != nil {
		return nil, repository.ErrUserAlreadyExists
	}

	hash, err := s.tokenManager.HashPassword(password)
	if err != nil {
		return nil, err
	}

	user := &domain.User{
		Email:        cleanEmail,
		PasswordHash: hash,
		FullName:     strings.TrimSpace(fullName),
		StorageLimit: s.defaultQuota,
		StorageUsed:  0,
	}
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	access, err := s.tokenManager.GenerateAccessToken(user.ID, user.Email)
	if err != nil {
		return nil, err
	}

	refresh, tokenHash, expiresAt, err := s.tokenManager.GenerateRefreshToken(user.ID)
	if err != nil {
		return nil, err
	}

	tokenModel := &domain.RefreshToken{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		Revoked:   false,
	}
	_ = s.tokenRepo.SaveRefreshToken(ctx, tokenModel)

	return &AuthResponse{
		User:         user,
		AccessToken:  access,
		RefreshToken: refresh,
	}, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*AuthResponse, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	user, err := s.userRepo.GetByEmail(ctx, cleanEmail)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if !s.tokenManager.ComparePassword(user.PasswordHash, password) {
		return nil, ErrInvalidCredentials
	}

	access, err := s.tokenManager.GenerateAccessToken(user.ID, user.Email)
	if err != nil {
		return nil, err
	}

	refresh, tokenHash, expiresAt, err := s.tokenManager.GenerateRefreshToken(user.ID)
	if err != nil {
		return nil, err
	}

	tokenModel := &domain.RefreshToken{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		Revoked:   false,
	}
	_ = s.tokenRepo.SaveRefreshToken(ctx, tokenModel)

	return &AuthResponse{
		User:         user,
		AccessToken:  access,
		RefreshToken: refresh,
	}, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshTokenStr string) (*AuthResponse, error) {
	claims, tokenHash, err := s.tokenManager.ValidateRefreshToken(refreshTokenStr)
	if err != nil {
		return nil, auth.ErrInvalidToken
	}

	tokenRecord, err := s.tokenRepo.GetRefreshToken(ctx, tokenHash)
	if err != nil || tokenRecord.Revoked {
		return nil, auth.ErrInvalidToken
	}

	// Revoke the old token (rotation)
	_ = s.tokenRepo.RevokeRefreshToken(ctx, tokenHash)

	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, repository.ErrUserNotFound
	}

	// Issue new pair
	newAccess, err := s.tokenManager.GenerateAccessToken(user.ID, user.Email)
	if err != nil {
		return nil, err
	}
	newRefresh, newTokenHash, expiresAt, err := s.tokenManager.GenerateRefreshToken(user.ID)
	if err != nil {
		return nil, err
	}

	newTokenModel := &domain.RefreshToken{
		UserID:    user.ID,
		TokenHash: newTokenHash,
		ExpiresAt: expiresAt,
		Revoked:   false,
	}
	_ = s.tokenRepo.SaveRefreshToken(ctx, newTokenModel)

	return &AuthResponse{
		User:         user,
		AccessToken:  newAccess,
		RefreshToken: newRefresh,
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshTokenStr string) error {
	if refreshTokenStr == "" {
		return nil
	}
	_, tokenHash, err := s.tokenManager.ValidateRefreshToken(refreshTokenStr)
	if err == nil {
		_ = s.tokenRepo.RevokeRefreshToken(ctx, tokenHash)
	}
	return nil
}

func (s *AuthService) GetProfile(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	return s.userRepo.GetByID(ctx, userID)
}

