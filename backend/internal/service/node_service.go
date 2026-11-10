package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/pfrancistechs-cel/airbox/backend/internal/domain"
	"github.com/pfrancistechs-cel/airbox/backend/internal/repository"
	"github.com/pfrancistechs-cel/airbox/backend/pkg/storage"
)

type NodeService struct {
	nodeRepo    *repository.NodeRepository
	versionRepo *repository.VersionRepository
	userRepo    *repository.UserRepository
	storage     storage.StorageProvider
}

func NewNodeService(
	nodeRepo *repository.NodeRepository,
	versionRepo *repository.VersionRepository,
	userRepo *repository.UserRepository,
	storage storage.StorageProvider,
) *NodeService {
	return &NodeService{
		nodeRepo:    nodeRepo,
		versionRepo: versionRepo,
		userRepo:    userRepo,
		storage:     storage,
	}
}

type NodeListResponse struct {
	Items       []domain.Node       `json:"items"`
	Breadcrumbs []domain.Breadcrumb `json:"breadcrumbs"`
}

func (s *NodeService) CreateFolder(ctx context.Context, ownerID uuid.UUID, parentID *uuid.UUID, name string, isVault bool) (*domain.Node, error) {
	if name == "" {
		return nil, errors.New("folder name cannot be empty")
	}

	// Check sibling duplicates
	existing, _ := s.nodeRepo.GetByParentAndName(ctx, ownerID, parentID, name)
	if existing != nil {
		return nil, repository.ErrDuplicateSibling
	}

	folder := &domain.Node{
		OwnerID:        ownerID,
		ParentID:       parentID,
		Name:           name,
		Type:           domain.NodeTypeFolder,
		SizeBytes:      0,
		CurrentVersion: 1,
		IsVault:        isVault,
		IsStarred:      false,
		IsTrashed:      false,
	}
	if err := s.nodeRepo.Create(ctx, folder); err != nil {
		return nil, err
	}
	return folder, nil
}

func (s *NodeService) ListNodes(ctx context.Context, ownerID uuid.UUID, parentID *uuid.UUID, filter, search string) (*NodeListResponse, error) {
	items, err := s.nodeRepo.List(ctx, ownerID, parentID, filter, search)
	if err != nil {
		return nil, err
	}

	breadcrumbs := make([]domain.Breadcrumb, 0)
	if parentID != nil && *parentID != uuid.Nil {
		crumbs, err := s.nodeRepo.GetBreadcrumbs(ctx, *parentID)
		if err == nil {
			breadcrumbs = crumbs
		}
	}

	return &NodeListResponse{
		Items:       items,
		Breadcrumbs: breadcrumbs,
	}, nil
}

func (s *NodeService) UpdateNode(ctx context.Context, ownerID, nodeID uuid.UUID, name *string, parentID **uuid.UUID, isStarred *bool) (*domain.Node, error) {
	node, err := s.nodeRepo.GetByID(ctx, nodeID)
	if err != nil {
		return nil, err
	}
	if node.OwnerID != ownerID {
		return nil, errors.New("forbidden")
	}

	if name != nil && *name != "" && *name != node.Name {
		// check collision
		existing, _ := s.nodeRepo.GetByParentAndName(ctx, ownerID, node.ParentID, *name)
		if existing != nil && existing.ID != node.ID {
			return nil, repository.ErrDuplicateSibling
		}
		node.Name = *name
	}

	if parentID != nil {
		targetParent := *parentID
		if targetParent != nil && *targetParent != uuid.Nil {
			// check circular parent
			isCircular, err := s.nodeRepo.CheckCircularParent(ctx, node.ID, *targetParent)
			if err != nil {
				return nil, err
			}
			if isCircular {
				return nil, repository.ErrCircularParent
			}
		}
		node.ParentID = targetParent
	}

	if isStarred != nil {
		node.IsStarred = *isStarred
	}

	if err := s.nodeRepo.Update(ctx, node); err != nil {
		return nil, err
	}
	return node, nil
}

func (s *NodeService) SoftDelete(ctx context.Context, ownerID, nodeID uuid.UUID) error {
	node, err := s.nodeRepo.GetByID(ctx, nodeID)
	if err != nil {
		return err
	}
	if node.OwnerID != ownerID {
		return errors.New("forbidden")
	}
	return s.nodeRepo.SoftDelete(ctx, nodeID)
}

func (s *NodeService) Restore(ctx context.Context, ownerID, nodeID uuid.UUID) error {
	node, err := s.nodeRepo.GetByID(ctx, nodeID)
	if err != nil {
		return err
	}
	if node.OwnerID != ownerID {
		return errors.New("forbidden")
	}
	return s.nodeRepo.Restore(ctx, nodeID)
}

func (s *NodeService) PermanentDelete(ctx context.Context, ownerID, nodeID uuid.UUID) error {
	node, err := s.nodeRepo.GetByID(ctx, nodeID)
	if err != nil {
		return err
	}
	if node.OwnerID != ownerID {
		return errors.New("forbidden")
	}

	// If it's a file, delete storage in Cloudinary
	if node.Type == domain.NodeTypeFile {
		if node.StoragePublicID != nil {
			resType := "raw"
			if node.StorageResourceType != nil {
				resType = *node.StorageResourceType
			}
			_ = s.storage.DeleteFile(*node.StoragePublicID, resType)
		}
		// Also clean up prior versions
		versions, _ := s.versionRepo.ListByNodeID(ctx, node.ID)
		for _, v := range versions {
			_ = s.storage.DeleteFile(v.StoragePublicID, v.StorageResourceType)
		}
		// Decrement user storage
		_ = s.userRepo.UpdateStorageUsed(ctx, ownerID, -node.SizeBytes)
	}

	return s.nodeRepo.PermanentDelete(ctx, nodeID)
}

func (s *NodeService) ListVersions(ctx context.Context, ownerID, nodeID uuid.UUID) ([]domain.FileVersion, error) {
	node, err := s.nodeRepo.GetByID(ctx, nodeID)
	if err != nil {
		return nil, err
	}
	if node.OwnerID != ownerID {
		return nil, errors.New("forbidden")
	}
	return s.versionRepo.ListByNodeID(ctx, nodeID)
}

func (s *NodeService) RestoreVersion(ctx context.Context, ownerID, nodeID, versionID uuid.UUID) (*domain.Node, error) {
	node, err := s.nodeRepo.GetByID(ctx, nodeID)
	if err != nil {
		return nil, err
	}
	if node.OwnerID != ownerID {
		return nil, errors.New("forbidden")
	}

	targetVersion, err := s.versionRepo.GetByID(ctx, versionID)
	if err != nil {
		return nil, err
	}

	// Archive the current active file version into file_versions table
	if node.StoragePublicID != nil {
		resType := "raw"
		if node.StorageResourceType != nil {
			resType = *node.StorageResourceType
		}
		_ = s.versionRepo.Create(ctx, &domain.FileVersion{
			NodeID:              node.ID,
			VersionNumber:       node.CurrentVersion,
			StoragePublicID:     *node.StoragePublicID,
			StorageResourceType: resType,
			SizeBytes:           node.SizeBytes,
		})
	}

	// Swap active pointer to the target version
	node.StoragePublicID = &targetVersion.StoragePublicID
	node.StorageResourceType = &targetVersion.StorageResourceType
	sizeDiff := targetVersion.SizeBytes - node.SizeBytes
	node.SizeBytes = targetVersion.SizeBytes
	node.CurrentVersion++

	if err := s.nodeRepo.Update(ctx, node); err != nil {
		return nil, err
	}

	if sizeDiff != 0 {
		_ = s.userRepo.UpdateStorageUsed(ctx, ownerID, sizeDiff)
	}

	return node, nil
}

