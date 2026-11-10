package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pfrancistechs-cel/airbox/backend/internal/service"
)

type ShareHandler struct {
	shareService *service.ShareService
}

func NewShareHandler(shareService *service.ShareService) *ShareHandler {
	return &ShareHandler{shareService: shareService}
}

type CreateShareRequest struct {
	Password      string     `json:"password"`
	ExpiresAt     *time.Time `json:"expires_at"`
	AllowDownload bool       `json:"allow_download"`
}

func (h *ShareHandler) CreateShare(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	nodeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid node id"})
		return
	}

	var req CreateShareRequest
	_ = c.ShouldBindJSON(&req)

	link, err := h.shareService.CreateShareLink(
		c.Request.Context(), userID, nodeID, req.Password, req.ExpiresAt, req.AllowDownload,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, link)
}

type VerifyPasswordRequest struct {
	Password string `json:"password" binding:"required"`
}

func (h *ShareHandler) GetSharedNode(c *gin.Context) {
	token := c.Param("token")
	password := c.Query("password")

	resp, err := h.shareService.GetSharedNode(c.Request.Context(), token, password)
	if err != nil {
		if errors.Is(err, service.ErrPasswordRequired) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":        "password_required",
				"has_password": true,
				"token":        token,
			})
			return
		}
		if errors.Is(err, service.ErrInvalidPassword) {
			c.JSON(http.StatusForbidden, gin.H{"error": "incorrect password"})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *ShareHandler) VerifySharedPassword(c *gin.Context) {
	token := c.Param("token")
	var req VerifyPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.shareService.GetSharedNode(c.Request.Context(), token, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidPassword) {
			c.JSON(http.StatusForbidden, gin.H{"error": "incorrect password"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *ShareHandler) GetSharedDownloadURL(c *gin.Context) {
	token := c.Param("token")
	password := c.Query("password")

	url, err := h.shareService.GetSharedDownloadURL(c.Request.Context(), token, password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"download_url": url,
		"expires_in":   60,
	})
}

