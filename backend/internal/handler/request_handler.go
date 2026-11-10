package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pfrancistechs-cel/airbox/backend/internal/service"
)

type RequestHandler struct {
	requestService *service.RequestService
}

func NewRequestHandler(requestService *service.RequestService) *RequestHandler {
	return &RequestHandler{requestService: requestService}
}

type CreateFileRequestPayload struct {
	TargetFolderID   uuid.UUID  `json:"target_folder_id" binding:"required"`
	Title            string     `json:"title" binding:"required"`
	Description      string     `json:"description"`
	ExpiresAt        *time.Time `json:"expires_at"`
	MaxFileSizeBytes int64      `json:"max_file_size_bytes"`
}

func (h *RequestHandler) CreateFileRequest(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req CreateFileRequestPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fr, err := h.requestService.CreateFileRequest(
		c.Request.Context(), userID, req.TargetFolderID, req.Title, req.Description, req.ExpiresAt, req.MaxFileSizeBytes,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, fr)
}

func (h *RequestHandler) ListOwnerRequests(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	list, err := h.requestService.ListOwnerRequests(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"requests": list})
}

func (h *RequestHandler) DeactivateRequest(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	reqID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}

	if err := h.requestService.DeactivateRequest(c.Request.Context(), userID, reqID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "dropzone deactivated"})
}

// --- GUEST DROPZONE PUBLIC ENDPOINTS ---

func (h *RequestHandler) GetDropzone(c *gin.Context) {
	token := c.Param("token")
	fr, err := h.requestService.GetDropzone(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dropzone not found or expired"})
		return
	}

	c.JSON(http.StatusOK, fr)
}

type DropzoneSignRequest struct {
	EstimatedSizeBytes int64 `json:"estimated_size_bytes"`
}

func (h *RequestHandler) SignDropzoneUpload(c *gin.Context) {
	token := c.Param("token")
	var req DropzoneSignRequest
	_ = c.ShouldBindJSON(&req)

	params, err := h.requestService.SignDropzoneUpload(c.Request.Context(), token, req.EstimatedSizeBytes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, params)
}

type DropzoneCompleteRequest struct {
	Name                string `json:"name" binding:"required"`
	MimeType            string `json:"mime_type"`
	SizeBytes           int64  `json:"size_bytes" binding:"required"`
	StoragePublicID     string `json:"storage_public_id" binding:"required"`
	StorageResourceType string `json:"storage_resource_type"`
}

func (h *RequestHandler) CompleteDropzoneUpload(c *gin.Context) {
	token := c.Param("token")
	var req DropzoneCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	node, err := h.requestService.CompleteDropzoneUpload(
		c.Request.Context(), token, req.Name, req.MimeType, req.SizeBytes, req.StoragePublicID, req.StorageResourceType,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, node)
}

