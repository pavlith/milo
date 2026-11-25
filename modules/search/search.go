// Package search runs trusted providers independently so results can be delivered
// to the Workbench as each provider completes.
package search

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"milo.local/platform/core/module"
	"milo.local/platform/modules/action"
)

const ID = "search"
const MaxResults = 25
const MaxQueryBytes = 1024

var (
	ErrUnavailable = errors.New("search provider unavailable")
	ErrFailed      = errors.New("search provider failed")
	ErrQuery       = errors.New("invalid search query")
)

type Metadata struct {
	ID        string `json:"id"`
	Owner     string `json:"owner"`
	Label     string `json:"label"`
	Scope     string `json:"scope,omitempty"`
	Limit     int    `json:"limit"`
	TimeoutMS int    `json:"timeoutMS"`
}

type Result struct {
	ID          string            `json:"id"`
	Owner       string            `json:"owner"`
	Provider    string            `json:"provider"`
	Title       string            `json:"title"`
	Description string            `json:"description,omitempty"`
	Icon        string            `json:"icon,omitempty"`
	Resource    string            `json:"resource,omitempty"`
	Action      *action.Reference `json:"action,omitempty"`
}

type Provider struct {
	Metadata
	Query func(context.Context, string, int) ([]Result, error)
}

type registration struct {
	Provider
	ctx    context.Context
	cancel context.CancelFunc
	slots  chan struct{}
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

func (s *Service) Register(scope *module.Scope, provider Provider) error {
	if scope == nil || !action.ValidID(provider.ID) || !action.ValidID(provider.Owner) ||
		!strings.HasPrefix(provider.ID, provider.Owner+".") || provider.Label == "" || provider.Query == nil ||
		provider.Limit < 1 || provider.Limit > MaxResults || provider.TimeoutMS < 1 || provider.TimeoutMS > 5000 {
		return errors.New("invalid search provider")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ctx == nil || s.ctx.Err() != nil {
		return ErrUnavailable
	}
	if s.entries[provider.ID] != nil {
		return fmt.Errorf("duplicate search provider ID: %s", provider.ID)
	}
	ctx, cancel := context.WithCancel(s.ctx)
	entry := &registration{provider, ctx, cancel, make(chan struct{}, 4)}
	if err := scope.Add(func(context.Context) error {
		s.remove(provider.ID, entry)
		return nil
	}); err != nil {
		cancel()
		return err
	}
	s.entries[provider.ID] = entry
	s.publish()
	return nil
}

func (s *Service) Lookup(id string) (Metadata, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if entry := s.entries[id]; entry != nil {
		return entry.Metadata, true
	}
	return Metadata{}, false
}

func (s *Service) List() []Metadata {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Metadata, 0, len(s.entries))
	for _, entry := range s.entries {
		result = append(result, entry.Metadata)
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

func (s *Service) Query(ctx context.Context, id, query string, limit int) ([]Result, error) {
	s.mu.RLock()
	entry := s.entries[id]
	s.mu.RUnlock()
	if entry == nil {
		return nil, ErrUnavailable
	}
	if len(query) > MaxQueryBytes || limit < 1 {
		return nil, ErrQuery
	}
	limit = min(limit, entry.Limit)
	ctx, cancel := context.WithTimeout(ctx, time.Duration(entry.TimeoutMS)*time.Millisecond)
	defer cancel()
	stop := context.AfterFunc(entry.ctx, cancel)
	defer stop()
	if entry.ctx.Err() != nil {
		return nil, context.Canceled
	}
	select {
	case entry.slots <- struct{}{}:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	type outcome struct {
		results []Result
		err     error
	}
	done := make(chan outcome, 1)
	go func() {
		defer func() { <-entry.slots }()
		var result outcome
		defer func() {
			if recover() != nil {
				s.log.Error("search provider panicked", "provider", id)
				result = outcome{err: ErrFailed}
			}
			done <- result
		}()
		if ctx.Err() != nil {
			return
		}
		items, err := entry.Query(ctx, strings.TrimSpace(query), limit)
		if err != nil {
			if ctx.Err() == nil {
				s.log.Warn("search provider failed", "provider", id, "error_type", fmt.Sprintf("%T", err))
			}
			result.err = ErrFailed
			return
		}
		result.results = normalize(entry, items, limit)
	}()
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-done:
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		return result.results, result.err
	}
}

func normalize(entry *registration, items []Result, limit int) []Result {
	results := make([]Result, 0, min(limit, len(items)))
	seen := make(map[string]bool)
	for _, item := range items[:min(len(items), limit)] {
		if !action.ValidID(item.ID) || seen[item.ID] || item.Title == "" || len(item.Title) > 512 ||
			len(item.Description) > 1024 || len(item.Resource) > 512 ||
			(item.Action != nil && (!action.ValidID(item.Action.ID) || !action.ValidArguments(item.Action.Args))) {
			continue
		}
		if item.Action != nil {
			ref := *item.Action
			ref.Args = maps.Clone(ref.Args)
			item.Action = &ref
		}
		item.Owner, item.Provider = entry.Owner, entry.ID
		seen[item.ID] = true
		results = append(results, item)
	}
	return results
}
