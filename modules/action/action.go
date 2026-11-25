// Package action registers trusted, owner-scoped Go commands.
package action

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"slices"
	"strings"
	"sync"

	"milo.local/platform/core/module"
)

const ID = "action"

var (
	ErrMissing     = errors.New("action not found")
	ErrUnavailable = errors.New("action unavailable")
	ErrArguments   = errors.New("invalid action arguments")
	ErrFailed      = errors.New("action failed; see Output for details")
	idPattern      = regexp.MustCompile(`^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$`)
)

type Reference struct {
	ID   string            `json:"id"`
	Args map[string]string `json:"args,omitempty"`
}

func ValidID(id string) bool { return len(id) <= 128 && idPattern.MatchString(id) }

func ValidArguments(args map[string]string) bool {
	if len(args) > 16 {
		return false
	}
	for key, value := range args {
		if !ValidID(key) || len(value) > 512 {
			return false
		}
	}
	return true
}

type Binding struct {
	Key      string `json:"key"`
	Code     string `json:"code,omitempty"`
	Shift    bool   `json:"shift,omitempty"`
	Context  string `json:"context,omitempty"`
	Editable bool   `json:"editable,omitempty"`
}

type Metadata struct {
	ID               string   `json:"id"`
	Owner            string   `json:"owner"`
	Title            string   `json:"title"`
	Description      string   `json:"description,omitempty"`
	Icon             string   `json:"icon,omitempty"`
	Category         string   `json:"category,omitempty"`
	Binding          *Binding `json:"binding,omitempty"`
	Requires         []string `json:"requires,omitempty"`
	Delegates        []string `json:"delegates,omitempty"`
	AcceptsArguments bool     `json:"acceptsArguments,omitempty"`
}

type Definition struct {
	Metadata
	Available func(context.Context) bool
	Enabled   func(context.Context) bool
	Validate  func(map[string]string) bool
	Run       func(context.Context, map[string]string) error
}

type registration struct {
	Definition
	ctx    context.Context
	cancel context.CancelFunc
}

type Service struct {
	mu      sync.RWMutex
	ctx     context.Context
	entries map[string]*registration
	log     *slog.Logger
	changed func()
}

func New(log *slog.Logger, changed func()) *Service {
	return &Service{entries: make(map[string]*registration), log: log, changed: changed}
}

func (s *Service) Definition() module.Definition {
	return module.Definition{
		ID: ID,
		Start: func(ctx context.Context, _ *module.Scope) error {
			s.mu.Lock()
			defer s.mu.Unlock()
			s.ctx = ctx
			return nil
		},
		Stop: func(context.Context) error {
			s.mu.Lock()
			defer s.mu.Unlock()
			for id, entry := range s.entries {
				entry.cancel()
				delete(s.entries, id)
			}
			s.ctx = nil
			return nil
		},
	}
}

func (s *Service) Register(scope *module.Scope, definition Definition) error {
	if scope == nil || !ValidID(definition.ID) || !ValidID(definition.Owner) ||
		!strings.HasPrefix(definition.ID, definition.Owner+".") || definition.Title == "" || definition.Run == nil {
		return errors.New("invalid action registration")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ctx == nil || s.ctx.Err() != nil {
		return ErrUnavailable
	}
	if s.entries[definition.ID] != nil {
		return fmt.Errorf("duplicate action ID: %s", definition.ID)
	}
	ctx, cancel := context.WithCancel(s.ctx)
	definition.Metadata = cloneMetadata(definition.Metadata)
	definition.AcceptsArguments = definition.Validate != nil
	entry := &registration{definition, ctx, cancel}
	if err := scope.Add(func(context.Context) error {
		s.remove(definition.ID, entry)
		return nil
	}); err != nil {
		cancel()
		return err
	}
	s.entries[definition.ID] = entry
	s.publish()
	return nil
}

func cloneMetadata(meta Metadata) Metadata {
	meta.Requires = slices.Clone(meta.Requires)
	meta.Delegates = slices.Clone(meta.Delegates)
	if meta.Binding != nil {
		binding := *meta.Binding
		meta.Binding = &binding
	}
	return meta
}

func (s *Service) Lookup(id string) (Metadata, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if entry := s.entries[id]; entry != nil {
		return cloneMetadata(entry.Metadata), true
	}
	return Metadata{}, false
}

func (s *Service) List() []Metadata {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Metadata, 0, len(s.entries))
	for _, entry := range s.entries {
		result = append(result, cloneMetadata(entry.Metadata))
	}
	slices.SortFunc(result, func(a, b Metadata) int { return strings.Compare(a.ID, b.ID) })
	return result
}

func (s *Service) Unregister(id string) { s.remove(id, nil) }

func (s *Service) remove(id string, expected *registration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if entry := s.entries[id]; entry != nil && (expected == nil || expected == entry) {
		entry.cancel()
		delete(s.entries, id)
		s.publish()
	}
}

func (s *Service) RemoveOwner(owner string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	changed := false
	for id, entry := range s.entries {
		if entry.Owner == owner {
			entry.cancel()
			delete(s.entries, id)
			changed = true
		}
	}
	if changed {
		s.publish()
	}
}

// The catalog publisher must return promptly and may not reenter Service.
func (s *Service) publish() {
	if s.changed != nil {
		s.changed()
	}
}

func (s *Service) Invoke(ctx context.Context, ref Reference, owner string, contexts []string) (err error) {
	s.mu.RLock()
	entry := s.entries[ref.ID]
	s.mu.RUnlock()
	if entry == nil {
		return ErrMissing
	}
	if owner != "" && owner != entry.Owner && !slices.Contains(entry.Delegates, owner) && !slices.Contains(entry.Delegates, "*") {
		return ErrUnavailable
	}
	for _, required := range entry.Requires {
		if !slices.Contains(contexts, required) {
			return ErrUnavailable
		}
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	stop := context.AfterFunc(entry.ctx, cancel)
	defer stop()
	if entry.ctx.Err() != nil {
		return context.Canceled
	}
	defer func() {
		if recover() != nil {
			s.log.Error("action panicked", "action", ref.ID)
			err = ErrFailed
		}
	}()
	if err := ctx.Err(); err != nil {
		return err
	}
	if (entry.Available != nil && !entry.Available(ctx)) || (entry.Enabled != nil && !entry.Enabled(ctx)) {
		return ErrUnavailable
	}
	if !ValidArguments(ref.Args) || (entry.Validate == nil && len(ref.Args) != 0) ||
		(entry.Validate != nil && !entry.Validate(ref.Args)) {
		return ErrArguments
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	err = entry.Run(ctx, ref.Args)
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if err != nil && !errors.Is(err, ErrUnavailable) && !errors.Is(err, ErrArguments) {
		s.log.Error("action failed", "action", ref.ID, "error_type", fmt.Sprintf("%T", err))
		return ErrFailed
	}
	if err != nil {
		// Normalize wrapped errors to keep implementation details in Go.
		if errors.Is(err, ErrArguments) {
			return ErrArguments
		}
		return ErrUnavailable
	}
	return nil
}
