package core

import (
	"fmt"
	"os"
	"path/filepath"
)

const Name = "slicer"

// Paths holds the native locations reserved for Slicer configuration and cache.
type Paths struct {
	Config string
	Cache  string
}

func UserPaths() (Paths, error) {
	config, err := os.UserConfigDir()
	if err != nil {
		return Paths{}, fmt.Errorf("resolve user config directory: %w", err)
	}
	cache, err := os.UserCacheDir()
	if err != nil {
		return Paths{}, fmt.Errorf("resolve user cache directory: %w", err)
	}
	return Paths{Config: filepath.Join(config, Name), Cache: filepath.Join(cache, Name)}, nil
}
