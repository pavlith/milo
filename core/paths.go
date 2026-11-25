package core

import (
	"fmt"
	"os"
	"path/filepath"
)

const directoryName = "milo-platform"

// Paths holds the native locations reserved for Milo configuration, data and cache.
type Paths struct {
	Config string
	Data   string
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
	data := os.Getenv("XDG_DATA_HOME")
	if !filepath.IsAbs(data) {
		home, err := os.UserHomeDir()
		if err != nil {
			return Paths{}, fmt.Errorf("resolve user data directory: %w", err)
		}
		data = filepath.Join(home, ".local", "share")
	}
	return Paths{
		Config: filepath.Join(config, directoryName),
		Data:   filepath.Join(data, directoryName),
		Cache:  filepath.Join(cache, directoryName),
	}, nil
}
