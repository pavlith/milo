// Package settings manages validated, owner-scoped application preferences.
package settings

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"regexp"
	"slices"
	"strings"
	"sync"

	"milo.local/platform/core/module"
)

const ID = "settings"
const Theme = "settings.appearance.theme"
const Toasts = "settings.general.notification-toasts"
const EditorStatus = "settings.workbench.editor-status"

type Kind string

const (
	Choice  Kind = "choice"
	Boolean Kind = "boolean"
)

// Value carries exactly one typed preference. A choice must be nonempty.
type Value struct {
	Text    string `json:"text,omitempty"`
	Enabled *bool  `json:"enabled,omitempty"`
}

func Flag(enabled bool) Value { return Value{Enabled: &enabled} }

type Schema struct {
	ID          string   `json:"id"`
	Category    string   `json:"category"`
	Label       string   `json:"label"`
	Description string   `json:"description"`
	Kind        Kind     `json:"kind"`
	Options     []string `json:"options,omitempty"`
	Default     Value    `json:"default"`
}

type Setting struct {
	Schema     Schema `json:"schema"`
	Value      Value  `json:"value"`
	Overridden bool   `json:"overridden"`
}

type Snapshot struct {
	Revision int       `json:"revision"`
	Entries  []Setting `json:"entries"`
}

type Change struct {
	Revision int       `json:"revision"`
	Upsert   []Setting `json:"upsert,omitempty"`
	Removed  []string  `json:"removed,omitempty"`
}

type Service struct {
	mu        sync.Mutex
	path      string
	logger    *slog.Logger
	emit      func(Change)
	schemas   map[string]Schema
	owners    map[string]string
	observers map[int]observer
	next      int
	data      document
	revision  int
	running   bool
	// Preserve the file when its version belongs to a newer application.
	readOnly bool
}

type observer struct {
	id     string
	notify func(Value)
}

func New(path string, logger *slog.Logger, emit func(Change)) *Service {
	return &Service{path: path, logger: logger, emit: emit, schemas: make(map[string]Schema), owners: make(map[string]string), observers: make(map[int]observer)}
}

func (s *Service) Definition() module.Definition {
	return module.Definition{
		ID: ID,
		Start: func(_ context.Context, scope *module.Scope) error {
			builtins := []Schema{
				{Theme, "appearance", "settings.theme", "settings.theme.description", Choice, []string{"light", "dark", "system"}, Value{Text: "system"}},
				{Toasts, "general", "settings.toasts", "settings.toasts.description", Boolean, nil, Flag(true)},
				{EditorStatus, "workbench", "settings.editorStatus", "settings.editorStatus.description", Boolean, nil, Flag(true)},
			}
			if err := s.Register(scope, ID, builtins...); err != nil {
				return err
			}
			return s.start()
		},
		Stop: func(context.Context) error {
			s.mu.Lock()
			defer s.mu.Unlock()
			s.running = false
			return nil
		},
	}
}

var namespace = regexp.MustCompile(`^[a-z0-9_-]+(\.[a-z0-9_-]+)*$`)

// Register installs a batch owned by a single scope. Disposal leaves overrides
// on disk so a later registration of the same setting can restore them.
func (s *Service) Register(scope *module.Scope, owner string, schemas ...Schema) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	batch := make(map[string]Schema, len(schemas))
	for _, schema := range schemas {
		if !namespace.MatchString(owner) || !namespace.MatchString(schema.ID) || !strings.HasPrefix(schema.ID, owner+".") ||
			schema.Category == "" || schema.Label == "" || !valid(schema, schema.Default) {
			return fmt.Errorf("invalid schema for setting %q", schema.ID)
		}
		if _, exists := s.schemas[schema.ID]; exists || batch[schema.ID].ID != "" {
			return fmt.Errorf("setting %q is already registered", schema.ID)
		}
		schema.Options = slices.Clone(schema.Options)
		schema.Default = cloneValue(schema.Default)
		batch[schema.ID] = schema
	}
	if err := scope.Add(func(context.Context) error {
		s.mu.Lock()
		defer s.mu.Unlock()
		removed := slices.Sorted(maps.Keys(batch))
		for _, id := range removed {
			delete(s.schemas, id)
			delete(s.owners, id)
			for key, observer := range s.observers {
				if observer.id == id {
					delete(s.observers, key)
				}
			}
		}
		if s.running && len(removed) > 0 {
			s.publish(nil, removed)
		}
		return nil
	}); err != nil {
		return err
	}
	maps.Copy(s.schemas, batch)
	for id := range batch {
		s.owners[id] = owner
	}
	if s.running && len(batch) > 0 {
		s.publish(slices.Sorted(maps.Keys(batch)), nil)
	}
	return nil
}

// Observe seeds and updates a trusted consumer in revision order. A callback
// must return promptly and must not call the settings service.
func (s *Service) Observe(scope *module.Scope, id string, notify func(Value)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running || s.schemas[id].ID == "" || notify == nil {
		return errors.New("cannot observe unavailable setting")
	}
	key := s.next
	s.next++
	if err := scope.Add(func(context.Context) error {
		s.mu.Lock()
		defer s.mu.Unlock()
		delete(s.observers, key)
		return nil
	}); err != nil {
		return err
	}
	s.observers[key] = observer{id, notify}
	notify(s.entry(id).Value)
	return nil
}

func valid(schema Schema, value Value) bool {
	switch schema.Kind {
	case Choice:
		return value.Enabled == nil && value.Text != "" && slices.Contains(schema.Options, value.Text)
	case Boolean:
		return value.Text == "" && value.Enabled != nil && len(schema.Options) == 0
	default:
		return false
	}
}

func cloneValue(value Value) Value {
	if value.Enabled != nil {
		return Flag(*value.Enabled)
	}
	return value
}

func (s *Service) entry(id string) Setting {
	schema := s.schemas[id]
	value, exists := s.data.Values[id]
	exists = exists && valid(schema, value)
	if !exists {
		value = schema.Default
	}
	schema.Default = cloneValue(schema.Default)
	schema.Options = slices.Clone(schema.Options)
	return Setting{schema, cloneValue(value), exists}
}

func (s *Service) Get(id string) (Setting, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running || s.schemas[id].ID == "" {
		return Setting{}, errors.New("setting is unavailable")
	}
	return s.entry(id), nil
}

func (s *Service) List() (Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running {
		return Snapshot{}, errors.New("settings are unavailable")
	}
	return Snapshot{s.revision, s.entries(slices.Sorted(maps.Keys(s.schemas)))}, nil
}

func (s *Service) Set(owner, id string, value Value) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	schema := s.schemas[id]
	if schema.ID == "" || s.owners[id] != owner {
		return errors.New("setting is unavailable for this owner")
	}
	if !valid(schema, value) {
		return errors.New("invalid value for this setting")
	}
	next := s.copyData()
	next.Values[id] = cloneValue(value)
	return s.commit(next, []string{id})
}

func (s *Service) Reset(owner, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.schemas[id].ID == "" || s.owners[id] != owner {
		return errors.New("setting is unavailable for this owner")
	}
	next := s.copyData()
	delete(next.Values, id)
	return s.commit(next, []string{id})
}

func (s *Service) ResetCategory(owner, category string) error {
	return s.resetCategory(category, owner)
}

func (s *Service) resetCategory(category string, owners ...string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := s.copyData()
	var ids []string
	for id, schema := range s.schemas {
		if schema.Category == category && slices.Contains(owners, s.owners[id]) {
			delete(next.Values, id)
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return errors.New("settings category is unavailable")
	}
	slices.Sort(ids)
	return s.commit(next, ids)
}

// MigrateTheme consumes the old WebKit mode once per backend profile. The
// marker is committed with the value so subsequent resets remain effective.
func (s *Service) MigrateTheme(legacy string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.data.ThemeMigrated {
		return nil
	}
	next := s.copyData()
	next.ThemeMigrated = true
	value := Value{Text: legacy}
	if !s.entry(Theme).Overridden && valid(s.schemas[Theme], value) {
		next.Values[Theme] = value
		return s.commit(next, []string{Theme})
	}
	return s.commit(next, nil)
}

func (s *Service) copyData() document {
	next := s.data
	next.Values = maps.Clone(next.Values)
	if next.Values == nil {
		next.Values = make(map[string]Value)
	}
	return next
}

func (s *Service) commit(next document, ids []string) error {
	if !s.running || s.readOnly {
		return errors.New("settings are unavailable for writing")
	}
	if err := save(s.path, next); err != nil {
		s.logger.Error("could not save settings", "error", err)
		return errors.New("could not save settings")
	}
	s.data = next
	if len(ids) > 0 {
		s.publish(ids, nil)
	}
	return nil
}

func (s *Service) entries(ids []string) []Setting {
	entries := make([]Setting, 0, len(ids))
	for _, id := range ids {
		entries = append(entries, s.entry(id))
	}
	return entries
}

func (s *Service) publish(ids, removed []string) {
	s.revision++
	for _, observer := range s.observers {
		if slices.Contains(ids, observer.id) {
			observer.notify(s.entry(observer.id).Value)
		}
	}
	if s.emit != nil {
		s.emit(Change{s.revision, s.entries(ids), removed})
	}
}
