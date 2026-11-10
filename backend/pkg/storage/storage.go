package storage

type SignedUploadParams struct {
	Timestamp int64  `json:"timestamp"`
	Signature string `json:"signature"`
	APIKey    string `json:"api_key"`
	CloudName string `json:"cloud_name"`
	Folder    string `json:"folder"`
	Type      string `json:"type"`
}

type StorageProvider interface {
	GenerateUploadSignature(folder string) (*SignedUploadParams, error)
	GenerateDownloadURL(publicID, resourceType string, expiresInSeconds int) (string, error)
	DeleteFile(publicID, resourceType string) error
}

