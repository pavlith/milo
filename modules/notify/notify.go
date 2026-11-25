// Package notify keeps the in-app notification inbox and its live updates.
package notify

import (
	"context"
	"crypto/rand"
	"errors"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"milo.local/platform/core/module"
	"milo.local/platform/modules/action"
)

const ID = "notify"
const HistoryLimit = 100

type Severity string

const (
	Info    Severity = "info"
	Success Severity = "success"
	Warning Severity = "warning"
	Error   Severity = "error"
)

// ActionRef contains only a registered ID and data arguments.
type ActionRef = action.Reference

func cloneActions(refs []ActionRef) []ActionRef {
	result := slices.Clone(refs)
	for i := range result {
		result[i].Args = maps.Clone(result[i].Args)
	}
	return result
}

type Message struct {
	Severity    Severity
	Title       string
	Description string
	Actions     []ActionRef
}

type Notification struct {
	ID          string      `json:"id"`
	Owner       string      `json:"owner"`
	Severity    Severity    `json:"severity"`
	Title       string      `json:"title"`
	Description string      `json:"description,omitempty"`
	Time        time.Time   `json:"time"`
	Read        bool        `json:"read"`
	Actions     []ActionRef `json:"actions,omitempty"`
}

type Snapshot struct {
	Revision int            `json:"revision"`
	Items    []Notification `json:"items"`
}

type Change struct {
	Revision int           `json:"revision"`
	Added    *Notification `json:"added,omitempty"`
	Removed  string        `json:"removed,omitempty"`
	Read     string        `json:"read,omitempty"`
	ReadAll  bool          `json:"readAll,omitempty"`
	Cleared  bool          `json:"cleared,omitempty"`
}

type Service struct {
	mu       sync.Mutex
	emit     func(Change)
	items    []Notification
	revision int
	running  bool
}

func New(emit func(Change)) *Service { return &Service{emit: emit} }

func (s *Service) Definition() module.Definition {
	return module.Definition{
		ID: ID,
		Start: func(context.Context, *module.Scope) error {
			s.mu.Lock()
			defer s.mu.Unlock()
			s.running = true
			return nil
		},
		Stop: func(context.Context) error {
			s.mu.Lock()
			defer s.mu.Unlock()
			s.running = false
			return nil
		},
	}
}

func (s *Service) Publish(owner string, message Message) (string, error) {
	title := strings.TrimSpace(message.Title)
	if !validID(owner) || title == "" || len(title) > 200 || len(message.Description) > 2000 || len(message.Actions) > 5 {
		return "", errors.New("invalid notification")
	}
	switch message.Severity {
	case Info, Success, Warning, Error:
	default:
		return "", errors.New("invalid notification severity")
	}
	for _, ref := range message.Actions {
		if !action.ValidID(ref.ID) || !strings.Contains(ref.ID, ".") || !action.ValidArguments(ref.Args) {
			return "", errors.New("invalid notification action reference")
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running {
		return "", errors.New("notifications are unavailable")
	}
	item := Notification{ID: rand.Text(), Owner: owner, Severity: message.Severity, Title: title,
		Description: message.Description, Actions: cloneActions(message.Actions), Time: time.Now().UTC()}
	change := Change{}
	if len(s.items) == HistoryLimit {
		change.Removed = s.items[0].ID
		s.items = slices.Delete(s.items, 0, 1)
	}
	s.items = append(s.items, item)
	item.Actions = cloneActions(item.Actions)
	change.Added = &item
	s.publish(change)
	return item.ID, nil
}

func validID(id string) bool {
	return id != "" && len(id) <= 128 && strings.Trim(id, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-") == ""
}

func (s *Service) List() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	items := make([]Notification, len(s.items))
	for i, item := range s.items {
		item.Actions = cloneActions(item.Actions)
		items[i] = item
	}
	return Snapshot{s.revision, items}
}

func (s *Service) MarkRead(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id && !s.items[i].Read {
			s.items[i].Read = true
			s.publish(Change{Read: id})
			return
		}
	}
}

func (s *Service) MarkAllRead() {
	s.mu.Lock()
	defer s.mu.Unlock()
	changed := false
	for i := range s.items {
		changed = changed || !s.items[i].Read
		s.items[i].Read = true
	}
	if changed {
		s.publish(Change{ReadAll: true})
	}
}

func (s *Service) Dismiss(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, item := range s.items {
		if item.ID == id {
			s.items = slices.Delete(s.items, i, i+1)
			s.publish(Change{Removed: id})
			return
		}
	}
}

func (s *Service) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.items) > 0 {
		s.items = nil
		s.publish(Change{Cleared: true})
	}
}

func (s *Service) publish(change Change) {
	s.revision++
	change.Revision = s.revision
	if s.running && s.emit != nil {
		s.emit(change)
	}
}
