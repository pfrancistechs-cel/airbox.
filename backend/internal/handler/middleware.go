package handler

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pfrancistechs-cel/airbox/backend/pkg/auth"
	"golang.org/x/time/rate"
)

func CORSMiddleware(frontendURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
		} else if frontendURL != "" {
			c.Header("Access-Control-Allow-Origin", frontendURL)
		} else {
			c.Header("Access-Control-Allow-Origin", "*")
		}

		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// IPRateLimiter tracks token buckets per IP address without Redis
type IPRateLimiter struct {
	ips sync.Map
	r   rate.Limit
	b   int
}

type clientLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	i := &IPRateLimiter{
		r: r,
		b: b,
	}

	// Background cleanup of stale IP limiters every 10 minutes
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			now := time.Now()
			i.ips.Range(func(key, value interface{}) bool {
				client := value.(*clientLimiter)
				if now.Sub(client.lastSeen) > 30*time.Minute {
					i.ips.Delete(key)
				}
				return true
			})
		}
	}()

	return i
}

func (i *IPRateLimiter) GetLimiter(ip string) *rate.Limiter {
	val, exists := i.ips.Load(ip)
	if !exists {
		l := rate.NewLimiter(i.r, i.b)
		client := &clientLimiter{limiter: l, lastSeen: time.Now()}
		i.ips.Store(ip, client)
		return l
	}
	client := val.(*clientLimiter)
	client.lastSeen = time.Now()
	return client.limiter
}

func RateLimiterMiddleware(limiter *IPRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		l := limiter.GetLimiter(ip)
		if !l.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "too many requests, please slow down",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func AuthMiddleware(tokenManager *auth.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := tokenManager.ValidateAccessToken(tokenStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Next()
	}
}

func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, false
	}
	uid, ok := val.(uuid.UUID)
	return uid, ok
}
