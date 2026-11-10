package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/pfrancistechs-cel/airbox/backend/internal/domain"
	"github.com/pfrancistechs-cel/airbox/backend/internal/repository"
	"github.com/pfrancistechs-cel/airbox/backend/pkg/auth"
	"github.com/pfrancistechs-cel/airbox/backend/pkg/storage"
)

var (
	ErrPasswordRequired = errors.New("password required to access this shared link")
	ErrInvalidPassword  = errors.New("incorrect password")
	ErrDownloadDisabled = errors.New("downloading is disabled for this link")
)

type ShareService struct {
	shareRepo    *repository.ShareRepository
	nodeRepo     *repository.NodeRepository
	tokenManager *auth.TokenManager
	storage      storage.StorageProvider
}

func NewShareService(
	shareRepo *repository.ShareRepository,
	nodeRepo *repository.NodeRepository,
	tokenManager *auth.TokenManager,
	storage storage.StorageProvider,
) *ShareService {
	return &ShareService{
		shareRepo:    shareRepo,
		nodeRepo:     nodeRepo,
		tokenManager: tokenManager,
		storage:      storage,
	}
}

func (s *ShareService) CreateShareLink(
	ctx context.Context,
	ownerID, nodeID uuid.UUID,
	password string,
	expiresAt *time.Time,
	allowDownload bool,
) (*domain.SharedLink, error) {
	node, err := s.nodeRepo.GetByID(ctx, nodeID)
	if err != nil {
		return nil, err
	}
	if node.OwnerID != ownerID {
		return nil, errors.New("forbidden")
	}

	b := make([]byte, 16)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)

	var passwordHash *string
	if password != "" {
		h, err := s.tokenManager.HashPassword(password)
		if err != nil {
			return nil, err
		}
		passwordHash = &h
	}

	link := &domain.SharedLink{
		NodeID:        nodeID,
		Token:         token,
		PasswordHash:  passwordHash,
		ExpiresAt:     expiresAt,
		AllowDownload: allowDownload,
	}

	if err := s.shareRepo.Create(ctx, link); err != nil {
		return nil, err
	}
	link.HasPassword = passwordHash != nil
	return link, nil
}

type SharedNodeResponse struct {
	Link *domain.SharedLink `json:"link"`
	Node *domain.Node       `json:"node,omitempty"`
}

func (s *ShareService) GetSharedNode(ctx context.Context, token, password string) (*SharedNodeResponse, error) {
	link, err := s.shareRepo.GetByToken(ctx, token)
	if err != nil {
		return nil, err
	}

	if link.PasswordHash != nil {
		if password == "" {
			return &SharedNodeResponse{Link: link, Node: nil}, ErrPasswordRequired
		}
		if !s.tokenManager.ComparePassword(*link.PasswordHash, password) {
			return &SharedNodeResponse{Link: link, Node: nil}, ErrInvalidPassword
		}
	}

	node, err := s.nodeRepo.GetByID(ctx, link.NodeID)
	if err != nil {
		return nil, err
	}

	return &SharedNodeResponse{
		Link: link,
		Node: node,
	}, nil
}

func (s *ShareService) GetSharedDownloadURL(ctx context.Context, token, password string) (string, error) {
	resp, err := s.GetSharedNode(ctx, token, password)
	if err != nil {
		return "", err
	}
	if !resp.Link.AllowDownload {
		return "", ErrDownloadDisabled
	}
	if resp.Node == nil || resp.Node.StoragePublicID == nil {
		return "", errors.New("file not available")
	}

	resType := "raw"
	if resp.Node.StorageResourceType != nil {
		resType = *resp.Node.StorageResourceType
	}
	return s.storage.GenerateDownloadURL(*resp.Node.StoragePublicID, resType, 60)
}

