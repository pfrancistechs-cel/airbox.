package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/pfrancistechs-cel/airbox/backend/internal/domain"
	"github.com/pfrancistechs-cel/airbox/backend/internal/repository"
	"github.com/pfrancistechs-cel/airbox/backend/pkg/storage"
)

type UploadService struct {
	userRepo    *repository.UserRepository
	nodeRepo    *repository.NodeRepository
	versionRepo *repository.VersionRepository
	storage     storage.StorageProvider
}

func NewUploadService(
	userRepo *repository.UserRepository,
	nodeRepo *repository.NodeRepository,
	versionRepo *repository.VersionRepository,
	storage storage.StorageProvider,
) *UploadService {
	return &UploadService{
		userRepo:    userRepo,
		nodeRepo:    nodeRepo,
		versionRepo: versionRepo,
		storage:     storage,
	}
}

func (s *UploadService) SignUpload(ctx context.Context, ownerID uuid.UUID, estimatedSize int64) (*storage.SignedUploadParams, error) {
	user, err := s.userRepo.GetByID(ctx, ownerID)
	if err != nil {
		return nil, err
	}

	if estimatedSize > 0 && user.StorageUsed+estimatedSize > user.StorageLimit {
		return nil, ErrQuotaExceeded
	}

	folder := "airbox/" + ownerID.String()
	return s.storage.GenerateUploadSignature(folder)
}

type CompleteUploadRequest struct {
	ParentID            *uuid.UUID `json:"parent_id"`
	Name                string     `json:"name"`
	MimeType            string     `json:"mime_type"`
	SizeBytes           int64      `json:"size_bytes"`
	StoragePublicID     string     `json:"storage_public_id"`
	StorageResourceType string     `json:"storage_resource_type"`
	IsVault             bool       `json:"is_vault"`
}

func (s *UploadService) CompleteUpload(ctx context.Context, ownerID uuid.UUID, req CompleteUploadRequest) (*domain.Node, error) {
	if req.Name == "" || req.StoragePublicID == "" {
		return nil, errors.New("name and storage_public_id are required")
	}

	user, err := s.userRepo.GetByID(ctx, ownerID)
	if err != nil {
		return nil, err
	}

	// Check if a non-trashed file with exact same name already exists in this folder
	existing, _ := s.nodeRepo.GetByParentAndName(ctx, ownerID, req.ParentID, req.Name)

	if existing != nil && existing.Type == domain.NodeTypeFile {
		// --- SMART AUTOMATIC VERSIONING ---
		// Check quota delta
		delta := req.SizeBytes - existing.SizeBytes
		if delta > 0 && user.StorageUsed+delta > user.StorageLimit {
			return nil, ErrQuotaExceeded
		}

		// 1. Archive the previous version into file_versions
		if existing.StoragePublicID != nil {
			oldResType := "raw"
			if existing.StorageResourceType != nil {
				oldResType = *existing.StorageResourceType
			}
			_ = s.versionRepo.Create(ctx, &domain.FileVersion{
				NodeID:              existing.ID,
				VersionNumber:       existing.CurrentVersion,
				StoragePublicID:     *existing.StoragePublicID,
				StorageResourceType: oldResType,
				SizeBytes:           existing.SizeBytes,
			})
		}

		// 2. Update existing node to point to the new version
		existing.StoragePublicID = &req.StoragePublicID
		resType := req.StorageResourceType
		if resType == "" {
			resType = "raw"
		}
		existing.StorageResourceType = &resType
		existing.MimeType = &req.MimeType
		existing.SizeBytes = req.SizeBytes
		existing.CurrentVersion++
		existing.IsVault = req.IsVault

		if err := s.nodeRepo.Update(ctx, existing); err != nil {
			return nil, err
		}

		if delta != 0 {
			_ = s.userRepo.UpdateStorageUsed(ctx, ownerID, delta)
		}

		return existing, nil
	}

	// --- NEW FILE CREATION ---
	if user.StorageUsed+req.SizeBytes > user.StorageLimit {
		return nil, ErrQuotaExceeded
	}

	resType := req.StorageResourceType
	if resType == "" {
		resType = "raw"
	}

	newNode := &domain.Node{
		OwnerID:             ownerID,
		ParentID:            req.ParentID,
		Name:                req.Name,
		Type:                domain.NodeTypeFile,
		MimeType:            &req.MimeType,
		SizeBytes:           req.SizeBytes,
		StoragePublicID:     &req.StoragePublicID,
		StorageResourceType: &resType,
		CurrentVersion:      1,
		IsVault:             req.IsVault,
		IsStarred:           false,
		IsTrashed:           false,
	}

	if err := s.nodeRepo.Create(ctx, newNode); err != nil {
		return nil, err
	}

	_ = s.userRepo.UpdateStorageUsed(ctx, ownerID, req.SizeBytes)
	return newNode, nil
}

func (s *UploadService) GetDownloadURL(ctx context.Context, ownerID, nodeID uuid.UUID) (string, error) {
	node, err := s.nodeRepo.GetByID(ctx, nodeID)
	if err != nil {
		return "", err
	}
	if node.OwnerID != ownerID {
		return "", errors.New("forbidden")
	}
	if node.Type != domain.NodeTypeFile || node.StoragePublicID == nil {
		return "", errors.New("node is not a downloadable file")
	}

	resType := "raw"
	if node.StorageResourceType != nil {
		resType = *node.StorageResourceType
	}

	return s.storage.GenerateDownloadURL(*node.StoragePublicID, resType, 60)
}

