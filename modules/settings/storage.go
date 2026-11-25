package settings

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

const version = 1
const maxSize = 1 << 20

type document struct {
	Version       int              `json:"version"`
	ThemeMigrated bool             `json:"themeMigrated"`
	Values        map[string]Value `json:"values"`
}

func (s *Service) start() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = document{Version: version, Values: make(map[string]Value)}
	loaded, err := load(s.path)
	switch {
	case errors.Is(err, os.ErrNotExist):
	case err != nil:
		if !errors.Is(err, errInvalid) {
			return err
		}
		backup := s.path + ".invalid-" + time.Now().UTC().Format("20060102T150405.000000000")
		if err := os.Rename(s.path, backup); err != nil {
			return fmt.Errorf("preserve invalid settings: %w", err)
		}
		s.logger.Warn("invalid settings recovered with defaults")
	case loaded.Version != version:
		s.readOnly = true
		s.logger.Warn("unsupported settings version; using defaults", "version", loaded.Version)
	default:
		s.data = loaded
		for id, schema := range s.schemas {
			if value, ok := loaded.Values[id]; ok && !valid(schema, value) {
				delete(s.data.Values, id)
				s.logger.Warn("invalid setting recovered with default", "setting", id)
			}
		}
	}
	s.running = true
	return nil
}

var errInvalid = errors.New("invalid settings document")

func load(path string) (document, error) {
	file, err := os.Open(path)
	if err != nil {
		return document{}, err
	}
	defer file.Close()
	raw, err := io.ReadAll(io.LimitReader(file, maxSize+1))
	if err != nil {
		return document{}, err
	}
	var header struct {
		Version int `json:"version"`
	}
	if len(raw) > maxSize || json.Unmarshal(raw, &header) != nil || header.Version < 1 {
		return document{}, errInvalid
	}
	result := document{Version: header.Version}
	if header.Version == version && (json.Unmarshal(raw, &result) != nil || result.Values == nil) {
		return document{}, errInvalid
	}
	return result, nil
}

func save(path string, data document) error {
	body, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	if len(body)+1 > maxSize {
		return errors.New("settings exceed storage limit")
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	file, err := os.CreateTemp(dir, ".settings-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if _, err := file.Write(append(body, '\n')); err != nil {
		file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(file.Name(), path)
}
