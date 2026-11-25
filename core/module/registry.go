// Package module manages the trusted built-in services of a Milo host.
package module

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"sync"
	"unicode"
)

// Definition binds concrete service methods at the composition root.
type Definition struct {
	ID           string
	Dependencies []string
	Start        func(context.Context, *Scope) error
	Stop         func(context.Context) error
}

type State string

const (
	Registered State = "registered"
	Starting   State = "starting"
	Running    State = "running"
	Stopping   State = "stopping"
	Stopped    State = "stopped"
	Failed     State = "failed"
)

type Snapshot struct {
	ID           string
	Dependencies []string
	State        State
	Error        string
}

type entry struct {
	def      Definition
	scope    Scope
	state    State
	startErr error
	message  string
}

// registry is owned by one Manager. Its lock also guards lifecycle transitions.
type registry struct {
	mu      sync.RWMutex
	entries map[string]*entry
	sealed  bool
}

func validID(id string) bool {
	return id != "" && !strings.ContainsFunc(id, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) })
}

func (r *registry) Register(def Definition) error {
	if !validID(def.ID) || def.Start == nil || def.Stop == nil {
		return fmt.Errorf("invalid module definition for %q", def.ID)
	}
	def.Dependencies = slices.Clone(def.Dependencies)
	slices.Sort(def.Dependencies)
	for i, dep := range def.Dependencies {
		if !validID(dep) || (i > 0 && def.Dependencies[i-1] == dep) {
			return fmt.Errorf("module %q has invalid or repeated dependency %q", def.ID, dep)
		}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.sealed {
		return errors.New("module registration is closed")
	}
	if _, ok := r.entries[def.ID]; ok {
		return fmt.Errorf("duplicate module %q", def.ID)
	}
	r.entries[def.ID] = &entry{def: def, state: Registered}
	return nil
}

func (e *entry) snapshot() Snapshot {
	s := Snapshot{ID: e.def.ID, Dependencies: slices.Clone(e.def.Dependencies), State: e.state}
	s.Error = e.message
	return s
}

func (r *registry) Lookup(id string) (Snapshot, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e, ok := r.entries[id]
	if !ok {
		return Snapshot{}, false
	}
	return e.snapshot(), true
}

func (r *registry) Inventory() []Snapshot {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]Snapshot, 0, len(r.entries))
	for _, id := range slices.Sorted(maps.Keys(r.entries)) {
		result = append(result, r.entries[id].snapshot())
	}
	return result
}
