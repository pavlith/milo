package module

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"sync"
	"time"
)

// Manager runs one host lifetime. Register all definitions before Start.
type Manager struct {
	registry
	logger    *slog.Logger
	cancel    context.CancelFunc
	startDone chan struct{}
	stopDone  chan struct{}
	stopErr   error

	// Start owns attempted until startDone closes. Rollback and shutdown
	// share the same teardown, including its cached result.
	attempted []*entry
	drainOnce sync.Once
	drainErr  error
}

func NewManager(logger *slog.Logger) *Manager {
	return &Manager{registry: registry{entries: make(map[string]*entry)}, logger: logger}
}

const shutdownBudget = 5 * time.Second

func (m *Manager) transition(e *entry, state State, err error) {
	var message string
	if err != nil {
		message = err.Error()
	}
	m.mu.Lock()
	e.state, e.message = state, message
	m.mu.Unlock()
	if err != nil {
		m.logger.Error("module lifecycle", "module", e.def.ID, "state", state, "error", err)
	} else {
		m.logger.Info("module lifecycle", "module", e.def.ID, "state", state)
	}
}

func (m *Manager) Start(parent context.Context) error {
	m.mu.Lock()
	if m.sealed {
		m.mu.Unlock()
		return errors.New("module manager already started or shut down")
	}
	m.sealed = true
	ctx, cancel := context.WithCancel(parent)
	m.cancel = cancel
	m.startDone = make(chan struct{})
	m.mu.Unlock()
	defer close(m.startDone)

	order, err := m.order()
	if err != nil {
		cancel()
		m.logger.Error("invalid module graph", "error", err)
		return err
	}
	for _, e := range order {
		if ctx.Err() != nil {
			break
		}
		m.attempted = append(m.attempted, e)
		m.transition(e, Starting, nil)
		if err = e.def.Start(ctx, &e.scope); err != nil {
			err = fmt.Errorf("start %s: %w", e.def.ID, err)
			e.startErr = err
			break
		}
		m.transition(e, Running, nil)
	}
	if err = errors.Join(err, ctx.Err()); err != nil {
		cancel()
		return errors.Join(err, m.drain(context.WithoutCancel(parent)))
	}
	return nil
}

// Shutdown cancels the module lifetime immediately. Concurrent callers share
// one teardown. Each caller can bound its wait with its own context.
func (m *Manager) Shutdown(ctx context.Context) error {
	m.mu.Lock()
	if m.stopDone == nil {
		m.sealed = true
		m.stopDone = make(chan struct{})
		if m.cancel != nil {
			m.cancel()
		}
		go m.finish(ctx, m.startDone)
	}
	done := m.stopDone
	m.mu.Unlock()
	select {
	case <-done:
		return m.stopErr
	default:
	}
	select {
	case <-done:
		return m.stopErr
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (m *Manager) finish(ctx context.Context, startDone <-chan struct{}) {
	if startDone != nil {
		<-startDone
	}
	m.stopErr = m.drain(ctx)
	close(m.stopDone)
}

func (m *Manager) drain(parent context.Context) error {
	m.drainOnce.Do(func() {
		ctx, cancel := context.WithTimeout(parent, shutdownBudget)
		defer cancel()
		for _, e := range slices.Backward(m.attempted) {
			callbacks := e.scope.seal()
			m.transition(e, Stopping, e.startErr)
			var teardown error
			if err := e.def.Stop(ctx); err != nil {
				teardown = fmt.Errorf("stop %s: %w", e.def.ID, err)
			}
			for _, cleanup := range callbacks {
				if err := cleanup(ctx); err != nil {
					teardown = errors.Join(teardown, fmt.Errorf("clean up %s: %w", e.def.ID, err))
				}
			}
			teardown = errors.Join(teardown, ctx.Err())
			if err := errors.Join(e.startErr, teardown); err != nil {
				m.transition(e, Failed, err)
			} else {
				m.transition(e, Stopped, nil)
			}
			m.drainErr = errors.Join(m.drainErr, teardown)
		}
		m.attempted = nil
	})
	return m.drainErr
}
