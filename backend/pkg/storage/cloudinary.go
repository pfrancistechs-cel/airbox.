package storage

import (
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type CloudinaryStorage struct {
	cloudName string
	apiKey    string
	apiSecret string
}

func NewCloudinaryStorage(cloudName, apiKey, apiSecret string) *CloudinaryStorage {
	return &CloudinaryStorage{
		cloudName: cloudName,
		apiKey:    apiKey,
		apiSecret: apiSecret,
	}
}

func (c *CloudinaryStorage) GenerateUploadSignature(folder string) (*SignedUploadParams, error) {
	timestamp := time.Now().Unix()

	params := map[string]string{
		"timestamp": strconv.FormatInt(timestamp, 10),
		"type":      "authenticated",
	}
	if folder != "" {
		params["folder"] = folder
	}

	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var toSignParts []string
	for _, k := range keys {
		toSignParts = append(toSignParts, fmt.Sprintf("%s=%s", k, params[k]))
	}
	toSign := strings.Join(toSignParts, "&") + c.apiSecret

	hasher := sha1.New()
	hasher.Write([]byte(toSign))
	signature := hex.EncodeToString(hasher.Sum(nil))

	return &SignedUploadParams{
		Timestamp: timestamp,
		Signature: signature,
		APIKey:    c.apiKey,
		CloudName: c.cloudName,
		Folder:    folder,
		Type:      "authenticated",
	}, nil
}

func (c *CloudinaryStorage) GenerateDownloadURL(publicID, resourceType string, expiresInSeconds int) (string, error) {
	if resourceType == "" {
		resourceType = "raw"
	}
	if expiresInSeconds <= 0 {
		expiresInSeconds = 60
	}

	expiration := time.Now().Unix() + int64(expiresInSeconds)

	// Format: /v1/<public_id> or /<public_id>
	targetPath := publicID
	if !strings.HasPrefix(targetPath, "v") {
		targetPath = "v1/" + targetPath
	}

	// Signed Cloudinary URL algorithm
	// to_sign: s--signature--/<resource_type>/authenticated/
	toSign := fmt.Sprintf("%s%d%s", targetPath, expiration, c.apiSecret)
	hasher := sha256.New()
	hasher.Write([]byte(toSign))
	fullSig := hex.EncodeToString(hasher.Sum(nil))
	shortSig := fullSig[:8]

	baseURL := fmt.Sprintf("https://res.cloudinary.com/%s/%s/authenticated/s--%s--/%s?_a=DATAg1AAZAA0",
		c.cloudName,
		resourceType,
		shortSig,
		targetPath,
	)

	return baseURL, nil
}

func (c *CloudinaryStorage) DeleteFile(publicID, resourceType string) error {
	if resourceType == "" {
		resourceType = "raw"
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	toSign := fmt.Sprintf("public_id=%s&timestamp=%s&type=authenticated%s", publicID, timestamp, c.apiSecret)

	hasher := sha1.New()
	hasher.Write([]byte(toSign))
	signature := hex.EncodeToString(hasher.Sum(nil))

	form := url.Values{}
	form.Set("public_id", publicID)
	form.Set("timestamp", timestamp)
	form.Set("type", "authenticated")
	form.Set("api_key", c.apiKey)
	form.Set("signature", signature)

	apiURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/%s/destroy", c.cloudName, resourceType)
	resp, err := http.PostForm(apiURL, form)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

