package module

import (
	"context"
	"errors"
	"slices"
	"sync"
)

// Scope tracks resources acquired by one module. The manager owns disposal.
type Scope struct {
	mu        sync.Mutex
	closed    bool
	callbacks []func(context.Context) error
}

// Add transfers cleanup responsibility on success. On rejection the caller
// still owns the resource and must release it.
func (s *Scope) Add(cleanup func(context.Context) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cleanup == nil || s.closed {
		return errors.New("cannot register cleanup on closed scope or with nil callback")
	}
	s.callbacks = append(s.callbacks, cleanup)
	return nil
}

// seal takes ownership of the callbacks before invoking any module code.
func (s *Scope) seal() []func(context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
	callbacks := s.callbacks
	s.callbacks = nil
	slices.Reverse(callbacks)
	return callbacks
}
