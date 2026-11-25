// Package task runs and tracks cooperative Go background operations.
package task

import (
	"context"
	"errors"
	"log/slog"
	"maps"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"milo.local/platform/core/module"
	"milo.local/platform/modules/logger"
	"milo.local/platform/modules/notify"
)

const ID = "task"
const HistoryLimit = 50
const ActiveLimit = 64

type Status string

const (
	Running   Status = "running"
	Succeeded Status = "succeeded"
	Failed    Status = "failed"
	Cancelled Status = "cancelled"
)

type Task struct {
	ID                    string     `json:"id"`
	Run                   int        `json:"run"`
	Owner                 string     `json:"owner"`
	Title                 string     `json:"title"`
	Description           string     `json:"description,omitempty"`
	Status                Status     `json:"status"`
	Started               time.Time  `json:"started"`
	Completed             *time.Time `json:"completed,omitempty"`
	Progress              *float64   `json:"progress,omitempty"`
	CanCancel             bool       `json:"canCancel"`
	CancellationRequested bool       `json:"cancellationRequested"`
	ErrorSummary          string     `json:"errorSummary,omitempty"`
}

type Snapshot struct {
	Revision  int    `json:"revision"`
	Active    []Task `json:"active"`
	Completed []Task `json:"completed"`
}

type Change struct {
	Revision int  `json:"revision"`
	Task     Task `json:"task"`
	Evicted  int  `json:"evicted,omitempty"`
}

type Options struct {
	// ID is relative to the registered owner's namespace.
	ID              string
	Title           string
	Description     string
	Progress        *float64
	Cancellable     bool
	FailureSummary  string // optional wording approved for display in the Workbench
	NotifyOnSuccess bool
}

// Report accepts a fraction in [0,1] or nil for indeterminate progress.
type Report func(progress *float64) error
type Operation func(context.Context, Report) error

var (
	ErrUnavailable = errors.New("task owner is unavailable")
	ErrDuplicate   = errors.New("a task with this ID is already running")
	ErrNotRunning  = errors.New("task is no longer running")
	ErrProgress    = errors.New("task progress must be between zero and one")
)

type Service struct {
	mu        sync.Mutex
	logs      *logger.Service
	inbox     *notify.Service
	emit      func(Change)
	lifetime  context.Context
	owners    map[string]*Owner
	active    map[string]*execution
	inFlight  int
	completed []Task
	revision  int
}

type execution struct {
	Task
	cancel        context.CancelFunc
	done          chan struct{}
	pending       *float64
	progressDue   time.Time
	progressTimer *time.Timer
}

// Owner is a capability for one activation. A stale handle cannot submit work
// or cancel work that belongs to a subsequent activation.
type Owner struct {
	id      string
	service *Service
	stopped bool
	runs    map[*execution]struct{}
}

func New(logs *logger.Service, inbox *notify.Service, emit func(Change)) *Service {
	return &Service{logs: logs, inbox: inbox, emit: emit, owners: make(map[string]*Owner), active: make(map[string]*execution)}
}

func (s *Service) Definition() module.Definition {
	return module.Definition{
		ID: ID, Dependencies: []string{logger.ID, notify.ID},
		Start: func(ctx context.Context, _ *module.Scope) error {
			s.mu.Lock()
			defer s.mu.Unlock()
			s.lifetime = ctx
			return nil
		},
		Stop: s.stop,
	}
}

var qualifiedID = regexp.MustCompile(`^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$`)

func (s *Service) AttachOwner(scope *module.Scope, id string) (*Owner, error) {
	if len(id) > 100 || !qualifiedID.MatchString(id) {
		return nil, errors.New("invalid task owner ID")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running() || s.owners[id] != nil {
		return nil, ErrUnavailable
	}
	owner := &Owner{id: id, service: s, runs: make(map[*execution]struct{})}
	if err := scope.Add(owner.Stop); err != nil {
		return nil, err
	}
	s.owners[id] = owner
	return owner, nil
}

func (s *Service) running() bool { return s.lifetime != nil && s.lifetime.Err() == nil }

func (o *Owner) Start(options Options, operation Operation) (Task, error) {
	title := strings.TrimSpace(options.Title)
	if !qualifiedID.MatchString(options.ID) || len(o.id)+len(options.ID)+1 > 128 || title == "" ||
		len(title) > 200 || len(options.Description) > 2000 || len(options.FailureSummary) > 512 || operation == nil {
		return Task{}, errors.New("invalid background task")
	}
	if !validProgress(options.Progress) {
		return Task{}, ErrProgress
	}
	s := o.service
	s.mu.Lock()
	defer s.mu.Unlock()
	if o.stopped || !s.running() {
		return Task{}, ErrUnavailable
	}
	id := o.id + "." + options.ID
	if s.active[id] != nil {
		return Task{}, ErrDuplicate
	}
	if s.inFlight >= ActiveLimit {
		return Task{}, errors.New("too many background tasks are running")
	}
	ctx, cancel := context.WithCancel(s.lifetime)
	run := &execution{
		Task: Task{ID: id, Run: s.revision + 1, Owner: o.id, Title: title, Description: options.Description,
			Status: Running, Started: time.Now().UTC(), Progress: clone(options.Progress), CanCancel: options.Cancellable},
		cancel: cancel, done: make(chan struct{}),
	}
	s.active[id] = run
	o.runs[run] = struct{}{}
	s.inFlight++
	s.publish(run.Task, 0)
	go o.execute(ctx, run, options, operation)
	return copyTask(run.Task), nil
}

func (o *Owner) Cancel(id string, revision int) error {
	return o.service.cancel(id, revision, o)
}

func (s *Service) cancel(id string, revision int, owner *Owner) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	run := s.active[id]
	if run == nil || run.Run != revision || (owner != nil && (owner.stopped || run.Owner != owner.id)) {
		return ErrNotRunning
	}
	if run.CancellationRequested {
		return nil
	}
	if !run.CanCancel {
		return errors.New("task does not support user cancellation")
	}
	s.requestCancellation(run)
	return nil
}

func (s *Service) requestCancellation(run *execution) {
	run.cancel()
	if run.Status == Running && !run.CancellationRequested {
		run.CancellationRequested = true
		run.CanCancel = false
		s.publish(run.Task, 0)
	}
}

func (s *Service) List() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := Snapshot{Revision: s.revision, Active: make([]Task, 0, len(s.active)), Completed: make([]Task, 0, len(s.completed))}
	for _, run := range s.active {
		out.Active = append(out.Active, copyTask(run.Task))
	}
	slices.SortFunc(out.Active, func(a, b Task) int { return a.Run - b.Run })
	for _, item := range s.completed {
		out.Completed = append(out.Completed, copyTask(item))
	}
	return out
}

func (s *Service) publish(task Task, evicted int) {
	s.revision++
	if s.lifetime != nil && s.emit != nil {
		s.emit(Change{s.revision, copyTask(task), evicted})
	}
}

func copyTask(task Task) Task {
	task.Progress = clone(task.Progress)
	task.Completed = clone(task.Completed)
	return task
}

func clone[T any](value *T) *T {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func (o *Owner) Stop(ctx context.Context) error {
	s := o.service
	s.mu.Lock()
	pending := o.stopLocked()
	s.mu.Unlock()
	return wait(ctx, pending)
}

func (o *Owner) stopLocked() []<-chan struct{} {
	o.stopped = true
	pending := make([]<-chan struct{}, 0, len(o.runs))
	for run := range o.runs {
		o.service.requestCancellation(run)
		pending = append(pending, run.done)
	}
	o.removeIfStopped()
	return pending
}

func (o *Owner) removeIfStopped() {
	if o.stopped && len(o.runs) == 0 && o.service.owners[o.id] == o {
		delete(o.service.owners, o.id)
	}
}

func (s *Service) stop(ctx context.Context) error {
	s.mu.Lock()
	s.lifetime = nil
	var pending []<-chan struct{}
	for owner := range maps.Values(s.owners) {
		pending = append(pending, owner.stopLocked()...)
	}
	s.mu.Unlock()
	return wait(ctx, pending)
}

func wait(ctx context.Context, pending []<-chan struct{}) error {
	for _, done := range pending {
		select {
		case <-done:
			continue
		default:
		}
		select {
		case <-done:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

func (s *Service) log(owner, id string) *slog.Logger {
	return s.logs.For(owner).With("task", id)
}
