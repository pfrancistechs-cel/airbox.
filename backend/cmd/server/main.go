package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/pfrancistechs-cel/airbox/backend/internal/handler"
	"github.com/pfrancistechs-cel/airbox/backend/internal/repository"
	"github.com/pfrancistechs-cel/airbox/backend/internal/service"
	"github.com/pfrancistechs-cel/airbox/backend/pkg/auth"
	"github.com/pfrancistechs-cel/airbox/backend/pkg/storage"
	"golang.org/x/time/rate"
)

func main() {
	// 1. Load environment
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Println("[AirBox] Warning: DATABASE_URL not set in environment.")
	}

	accessSecret := os.Getenv("JWT_ACCESS_SECRET")
	if accessSecret == "" {
		accessSecret = "airbox_default_access_secret_super_secure_32_chars"
	}
	refreshSecret := os.Getenv("JWT_REFRESH_SECRET")
	if refreshSecret == "" {
		refreshSecret = "airbox_default_refresh_secret_super_secure_32_chars"
	}

	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	defaultQuotaStr := os.Getenv("DEFAULT_USER_QUOTA_BYTES")
	defaultQuota, _ := strconv.ParseInt(defaultQuotaStr, 10, 64)
	if defaultQuota <= 0 {
		defaultQuota = 5 * 1024 * 1024 * 1024 // 5 GB
	}

	// 2. Storage & Auth Managers
	storageProvider := storage.NewCloudinaryStorage(cloudName, apiKey, apiSecret)
	tokenManager := auth.NewTokenManager(accessSecret, refreshSecret)

	// 3. Database connection (Neon / PostgreSQL)
	var db *repository.DB
	if databaseURL != "" {
		var err error
		db, err = repository.NewDB(databaseURL)
		if err != nil {
			log.Fatalf("[AirBox] Failed to connect to Neon PostgreSQL: %v\n", err)
		}
		defer db.Close()
		log.Println("[AirBox] Connected to Neon PostgreSQL successfully.")
	} else {
		log.Println("[AirBox] Running without database connection. Provide DATABASE_URL for full persistence.")
	}

	// 4. Repositories
	userRepo := repository.NewUserRepository(db)
	tokenRepo := repository.NewTokenRepository(db)
	nodeRepo := repository.NewNodeRepository(db)
	versionRepo := repository.NewVersionRepository(db)
	shareRepo := repository.NewShareRepository(db)
	requestRepo := repository.NewRequestRepository(db)

	// 5. Background Cleanup Worker (Zero Redis)
	if db != nil {
		go func() {
			ticker := time.NewTicker(1 * time.Hour)
			defer ticker.Stop()
			for range ticker.C {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				if err := tokenRepo.CleanupExpired(ctx); err != nil {
					log.Printf("[Worker] Cleanup expired tokens error: %v\n", err)
				}
				cancel()
			}
		}()
	}

	// 6. Services
	authService := service.NewAuthService(userRepo, tokenRepo, tokenManager, defaultQuota)
	nodeService := service.NewNodeService(nodeRepo, versionRepo, userRepo, storageProvider)
	uploadService := service.NewUploadService(userRepo, nodeRepo, versionRepo, storageProvider)
	shareService := service.NewShareService(shareRepo, nodeRepo, tokenManager, storageProvider)
	requestService := service.NewRequestService(requestRepo, nodeRepo, userRepo, storageProvider)

	// 7. Handlers & Rate Limiter
	ipLimiter := handler.NewIPRateLimiter(rate.Limit(50), 100) // 50 requests/sec, burst 100

	authHandler := handler.NewAuthHandler(authService)
	nodeHandler := handler.NewNodeHandler(nodeService)
	uploadHandler := handler.NewUploadHandler(uploadService)
	shareHandler := handler.NewShareHandler(shareService)
	requestHandler := handler.NewRequestHandler(requestService)

	// 8. Router
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(handler.CORSMiddleware(frontendURL))
	router.Use(handler.RateLimiterMiddleware(ipLimiter))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "airbox-core-engine",
			"version": "1.0.0",
		})
	})

	apiV1 := router.Group("/api/v1")
	{
		// --- AUTH (Public) ---
		authGroup := apiV1.Group("/auth")
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
			authGroup.POST("/refresh", authHandler.Refresh)
			authGroup.POST("/logout", authHandler.Logout)
			authGroup.GET("/me", handler.AuthMiddleware(tokenManager), authHandler.GetMe)
		}

		// --- PUBLIC SHARED LINKS ---
		sharePublic := apiV1.Group("/share")
		{
			sharePublic.GET("/:token", shareHandler.GetSharedNode)
			sharePublic.POST("/:token/verify", shareHandler.VerifySharedPassword)
			sharePublic.GET("/:token/download", shareHandler.GetSharedDownloadURL)
		}

		// --- NO-LOGIN DROPZONES (Public) ---
		dropzonePublic := apiV1.Group("/dropzone")
		{
			dropzonePublic.GET("/:token", requestHandler.GetDropzone)
			dropzonePublic.POST("/:token/sign", requestHandler.SignDropzoneUpload)
			dropzonePublic.POST("/:token/complete", requestHandler.CompleteDropzoneUpload)
		}

		// --- AUTHENTICATED ROUTES ---
		authRequired := apiV1.Group("/")
		authRequired.Use(handler.AuthMiddleware(tokenManager))
		{
			// VFS Nodes & Version History
			nodes := authRequired.Group("/nodes")
			{
				nodes.GET("", nodeHandler.ListNodes)
				nodes.POST("/folders", nodeHandler.CreateFolder)
				nodes.PATCH("/:id", nodeHandler.UpdateNode)
				nodes.DELETE("/:id", nodeHandler.DeleteNode)
				nodes.POST("/:id/restore", nodeHandler.RestoreNode)
				nodes.GET("/:id/download", uploadHandler.GetDownloadURL)
				nodes.POST("/:id/share", shareHandler.CreateShare)
				nodes.GET("/:id/versions", nodeHandler.ListVersions)
				nodes.POST("/:id/versions/:version_id/restore", nodeHandler.RestoreVersion)
			}

			// Direct-to-Cloud Uploads
			uploads := authRequired.Group("/uploads")
			{
				uploads.POST("/sign", uploadHandler.SignUpload)
				uploads.POST("/complete", uploadHandler.CompleteUpload)
			}

			// File Requests (Dropzone management by owner)
			requests := authRequired.Group("/file-requests")
			{
				requests.POST("", requestHandler.CreateFileRequest)
				requests.GET("", requestHandler.ListOwnerRequests)
				requests.DELETE("/:id", requestHandler.DeactivateRequest)
			}
		}
	}

	// 9. Graceful Shutdown
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("[AirBox Engine] Listening on http://localhost:%s\n", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[AirBox Engine] Server error: %v\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[AirBox Engine] Shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("[AirBox Engine] Forced shutdown: %v\n", err)
	}
	log.Println("[AirBox Engine] Server exited clean.")
}
