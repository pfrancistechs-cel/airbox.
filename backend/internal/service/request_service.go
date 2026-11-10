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
	"github.com/pfrancistechs-cel/airbox/backend/pkg/storage"
)

var (
	ErrDropzoneExpired = errors.New("this file request dropzone has expired or is inactive")
	ErrFileTooLarge    = errors.New("file size exceeds dropzone maximum limit")
)

type RequestService struct {
	requestRepo *repository.RequestRepository
	nodeRepo    *repository.NodeRepository
	userRepo    *repository.UserRepository
	storage     storage.StorageProvider
}

func NewRequestService(
	requestRepo *repository.RequestRepository,
	nodeRepo *repository.NodeRepository,
	userRepo *repository.UserRepository,
	storage storage.StorageProvider,
) *RequestService {
	return &RequestService{
		requestRepo: requestRepo,
		nodeRepo:    nodeRepo,
		userRepo:    userRepo,
		storage:     storage,
	}
}

func (s *RequestService) CreateFileRequest(
	ctx context.Context,
	ownerID, targetFolderID uuid.UUID,
	title, description string,
	expiresAt *time.Time,
	maxSizeBytes int64,
) (*domain.FileRequest, error) {
	// Verify target folder exists and belongs to owner
	folder, err := s.nodeRepo.GetByID(ctx, targetFolderID)
	if err != nil {
		return nil, err
	}
	if folder.OwnerID != ownerID || folder.Type != domain.NodeTypeFolder {
		return nil, errors.New("target node must be a valid folder you own")
	}

	if maxSizeBytes <= 0 {
		maxSizeBytes = 100 * 1024 * 1024 // 100 MB default
	}

	b := make([]byte, 16)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)

	req := &domain.FileRequest{
		OwnerID:          ownerID,
		TargetFolderID:   targetFolderID,
		Token:            token,
		Title:            title,
		Description:      description,
		ExpiresAt:        expiresAt,
		MaxFileSizeBytes: maxSizeBytes,
		IsActive:         true,
	}

	if err := s.requestRepo.Create(ctx, req); err != nil {
		return nil, err
	}
	return req, nil
}

func (s *RequestService) GetDropzone(ctx context.Context, token string) (*domain.FileRequest, error) {
	return s.requestRepo.GetByToken(ctx, token)
}

func (s *RequestService) ListOwnerRequests(ctx context.Context, ownerID uuid.UUID) ([]domain.FileRequest, error) {
	return s.requestRepo.ListByOwner(ctx, ownerID)
}

func (s *RequestService) DeactivateRequest(ctx context.Context, ownerID, requestID uuid.UUID) error {
	return s.requestRepo.Deactivate(ctx, requestID, ownerID)
}

func (s *RequestService) SignDropzoneUpload(ctx context.Context, token string, estimatedSize int64) (*storage.SignedUploadParams, error) {
	fr, err := s.requestRepo.GetByToken(ctx, token)
	if err != nil {
		return nil, ErrDropzoneExpired
	}

	if estimatedSize > fr.MaxFileSizeBytes {
		return nil, ErrFileTooLarge
	}

	// Verify owner storage quota
	owner, err := s.userRepo.GetByID(ctx, fr.OwnerID)
	if err != nil {
		return nil, errors.New("dropzone owner unavailable")
	}

	if estimatedSize > 0 && owner.StorageUsed+estimatedSize > owner.StorageLimit {
		return nil, errors.New("recipient storage quota is currently full")
	}

	folder := "airbox/dropzone/" + fr.Token
	return s.storage.GenerateUploadSignature(folder)
}

func (s *RequestService) CompleteDropzoneUpload(
	ctx context.Context,
	token, name, mimeType string,
	sizeBytes int64,
	publicID, resourceType string,
) (*domain.Node, error) {
	fr, err := s.requestRepo.GetByToken(ctx, token)
	if err != nil {
		return nil, ErrDropzoneExpired
	}

	if sizeBytes > fr.MaxFileSizeBytes {
		return nil, ErrFileTooLarge
	}

	owner, err := s.userRepo.GetByID(ctx, fr.OwnerID)
	if err != nil {
		return nil, errors.New("dropzone owner unavailable")
	}

	if owner.StorageUsed+sizeBytes > owner.StorageLimit {
		return nil, errors.New("recipient storage quota exceeded")
	}

	resType := resourceType
	if resType == "" {
		resType = "raw"
	}

	targetFolderID := fr.TargetFolderID
	node := &domain.Node{
		OwnerID:             fr.OwnerID,
		ParentID:            &targetFolderID,
		Name:                name,
		Type:                domain.NodeTypeFile,
		MimeType:            &mimeType,
		SizeBytes:           sizeBytes,
		StoragePublicID:     &publicID,
		StorageResourceType: &resType,
		CurrentVersion:      1,
		IsVault:             false, // Public dropzone uploads are standard non-vault
		IsStarred:           false,
		IsTrashed:           false,
	}

	if err := s.nodeRepo.Create(ctx, node); err != nil {
		return nil, err
	}

	_ = s.userRepo.UpdateStorageUsed(ctx, fr.OwnerID, sizeBytes)
	return node, nil
}
