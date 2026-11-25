// Package logger projects structured slog records into a bounded Output view.
package logger

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"time"

	"milo.local/platform/core/module"
	"milo.local/platform/modules/settings"
)

const ID = "logger"
const LevelSetting = "logger.general.minimum-level"
const HistoryLimit = 300

type Level string

const (
	Debug Level = "debug"
	Info  Level = "info"
	Warn  Level = "warn"
	Error Level = "error"
)

type Record struct {
	ID      int            `json:"id"`
	Time    time.Time      `json:"time"`
	Level   Level          `json:"level"`
	Owner   string         `json:"owner"`
	Message string         `json:"message"`
	Fields  map[string]any `json:"fields,omitempty"`
}

type Snapshot struct {
	Revision int      `json:"revision"`
	Records  []Record `json:"records"`
}

type Change struct {
	Revision int     `json:"revision"`
	Added    *Record `json:"added,omitempty"`
	Evicted  int     `json:"evicted,omitempty"`
	Cleared  bool    `json:"cleared,omitempty"`
}

type Filter struct {
	Minimum Level  `json:"minimum"`
	Owner   string `json:"owner"`
	Text    string `json:"text"`
}

type Service struct {
	mu       sync.Mutex
	minimum  slog.LevelVar
	sink     slog.Handler
	emit     func(Change)
	records  [HistoryLimit]Record
	first    int
	size     int
	revision int
	running  bool
}

// New starts collecting bootstrap diagnostics immediately. The optional sink
// receives the redacted records as well and must be independent of this handler.
func New(sink slog.Handler, emit func(Change)) *Service { return &Service{sink: sink, emit: emit} }

func (s *Service) Definition(preferences *settings.Service) module.Definition {
	return module.Definition{
		ID: ID, Dependencies: []string{settings.ID},
		Start: func(_ context.Context, scope *module.Scope) error {
			schema := settings.Schema{
				ID: LevelSetting, Category: "general", Label: "settings.logLevel",
				Description: "settings.logLevel.description", Kind: settings.Choice,
				Options: []string{string(Debug), string(Info), string(Warn), string(Error)},
				Default: settings.Value{Text: string(Info)},
			}
			if err := preferences.Register(scope, ID, schema); err != nil {
				return err
			}
			if err := preferences.Observe(scope, LevelSetting, func(value settings.Value) {
				s.minimum.Set(priority(Level(value.Text)))
			}); err != nil {
				return err
			}
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

func (s *Service) For(owner string) *slog.Logger {
	return slog.New(&handler{service: s, owner: scrub(owner)})
}

func (s *Service) List(filter Filter) Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := Snapshot{Revision: s.revision, Records: make([]Record, 0, s.size)}
	text := strings.ToLower(strings.TrimSpace(filter.Text))
	for i := 0; i < s.size; i++ {
		record := s.records[(s.first+i)%HistoryLimit]
		if (filter.Minimum == "" || priority(record.Level) >= priority(filter.Minimum)) &&
			(filter.Owner == "" || record.Owner == filter.Owner) &&
			(text == "" || strings.Contains(strings.ToLower(record.Message), text)) {
			record.Fields = cloneFields(record.Fields)
			out.Records = append(out.Records, record)
		}
	}
	return out
}

func (s *Service) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	clear(s.records[:])
	s.first, s.size = 0, 0
	s.revision++
	s.publish(Change{Revision: s.revision, Cleared: true})
}

func (s *Service) append(record Record) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.revision++
	record.ID = s.revision
	index := (s.first + s.size) % HistoryLimit
	change := Change{Revision: s.revision}
	if s.size == HistoryLimit {
		change.Evicted = s.records[index].ID
		s.first = (s.first + 1) % HistoryLimit
	} else {
		s.size++
	}
	s.records[index] = record
	record.Fields = cloneFields(record.Fields)
	change.Added = &record
	s.publish(change)
}

func (s *Service) publish(change Change) {
	if s.running && s.emit != nil {
		s.emit(change)
	}
}

func priority(level Level) slog.Level {
	switch level {
	case Debug:
		return slog.LevelDebug
	case Warn:
		return slog.LevelWarn
	case Error:
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func severity(level slog.Level) Level {
	switch {
	case level < slog.LevelInfo:
		return Debug
	case level < slog.LevelWarn:
		return Info
	case level < slog.LevelError:
		return Warn
	default:
		return Error
	}
}
