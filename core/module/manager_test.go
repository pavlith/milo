package module_test

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"testing"
	"time"

	"milo.local/platform/core/module"
)

func definition(id string, deps ...string) module.Definition {
	return module.Definition{ID: id, Dependencies: deps, Start: func(context.Context, *module.Scope) error { return nil }, Stop: func(context.Context) error { return nil }}
}

func register(t *testing.T, m *module.Manager, d module.Definition) {
	t.Helper()
	if err := m.Register(d); err != nil {
		t.Fatal(err)
	}
}

func state(t *testing.T, m *module.Manager, id string, want module.State) module.Snapshot {
	t.Helper()
	s, ok := m.Lookup(id)
	if !ok || s.State != want {
		t.Fatalf("lookup %q = %+v, want %v", id, s, want)
	}
	return s
}

func TestRegistration(t *testing.T) {
	m := module.NewManager(slog.Default())
	d := definition("consumer", "provider")
	register(t, m, d)
	d.Dependencies[0] = "changed"
	s := state(t, m, "consumer", module.Registered)
	s.Dependencies[0] = "changed again"
	if got := m.Inventory()[0].Dependencies; !slices.Equal(got, []string{"provider"}) {
		t.Fatal(got)
	}
	if _, ok := m.Lookup("missing"); ok {
		t.Fatal("unexpected entry")
	}
	missingStart, missingStop := definition("a"), definition("b")
	missingStart.Start = nil
	missingStop.Stop = nil
	for _, invalid := range []module.Definition{d, definition(""), definition("bad id"), definition("a", ""), definition("a", "b", "b"), missingStart, missingStop} {
		if err := m.Register(invalid); err == nil {
			t.Fatalf("accepted invalid definition %q", invalid.ID)
		}
	}
}

func TestGraphBeforeCallbacks(t *testing.T) {
	for _, tc := range []struct {
		defs    []module.Definition
		message string
	}{
		{[]module.Definition{definition("z", "missing")}, "missing"},
		{[]module.Definition{definition("z", "y"), definition("y", "z")}, "cycle"},
		{[]module.Definition{definition("z", "z")}, "cycle"},
	} {
		m := module.NewManager(slog.Default())
		for _, d := range append(tc.defs, definition("a")) {
			d.Start = func(context.Context, *module.Scope) error { t.Fatal("started before graph validation"); return nil }
			register(t, m, d)
		}
		if err := m.Start(t.Context()); err == nil || !strings.Contains(err.Error(), tc.message) {
			t.Fatalf("got %v, want %s", err, tc.message)
		}
		state(t, m, "a", module.Registered)
	}
}

func TestOrdering(t *testing.T) {
	for _, ids := range [][]string{{"z", "d", "b", "a"}, {"a", "b", "d", "z"}} {
		m := module.NewManager(slog.Default())
		var calls []string
		for _, id := range ids {
			d := definition(id)
			if id == "a" {
				d.Dependencies = []string{"d", "b"}
			}
			d.Start = func(context.Context, *module.Scope) error {
				calls = append(calls, id)
				state(t, m, id, module.Starting)
				return nil
			}
			d.Stop = func(context.Context) error { calls = append(calls, "-"+id); return nil }
			register(t, m, d)
		}
		if err := m.Start(t.Context()); err != nil {
			t.Fatal(err)
		}
		if m.Register(definition("late")) == nil {
			t.Fatal("accepted late module")
		}
		for range 2 {
			if err := m.Shutdown(t.Context()); err != nil {
				t.Fatal(err)
			}
		}
		if want := []string{"b", "d", "a", "z", "-z", "-a", "-d", "-b"}; !slices.Equal(want, calls) {
			t.Fatal(calls)
		}
	}
}

func TestPartialStartupRollback(t *testing.T) {
	m := module.NewManager(slog.Default())
	startErr, stopErr, cleanupErr := errors.New("init"), errors.New("stop"), errors.New("release")
	var calls []string
	for _, id := range []string{"a", "b", "c"} {
		d := definition(id)
		d.Start = func(_ context.Context, s *module.Scope) error {
			for i := range 2 {
				err := s.Add(func(ctx context.Context) error {
					if _, ok := ctx.Deadline(); !ok || ctx.Err() != nil {
						return errors.New("invalid rollback context")
					}
					calls = append(calls, fmt.Sprintf("%s%d", id, i))
					if id == "b" && i == 1 {
						return cleanupErr
					}
					return nil
				})
				if err != nil {
					return err
				}
			}
			if id == "b" {
				return startErr
			}
			return nil
		}
		d.Stop = func(context.Context) error {
			calls = append(calls, "-"+id)
			if id == "b" {
				return stopErr
			}
			return nil
		}
		register(t, m, d)
	}
	err := m.Start(t.Context())
	for _, want := range []error{startErr, stopErr, cleanupErr} {
		if !errors.Is(err, want) {
			t.Fatal(err)
		}
	}
	state(t, m, "a", module.Stopped)
	failed := state(t, m, "b", module.Failed)
	if !strings.Contains(failed.Error, "release") {
		t.Fatal(failed)
	}
	state(t, m, "c", module.Registered)
	if err := m.Shutdown(t.Context()); !errors.Is(err, stopErr) {
		t.Fatal(err)
	}
	if want := []string{"-b", "b1", "b0", "-a", "a1", "a0"}; !slices.Equal(want, calls) {
		t.Fatal(calls)
	}
}

func TestCancelDuringStartup(t *testing.T) {
	m := module.NewManager(slog.Default())
	entered := make(chan struct{})
	d := definition("service")
	d.Start = func(ctx context.Context, _ *module.Scope) error { close(entered); <-ctx.Done(); return ctx.Err() }
	register(t, m, d)
	started := make(chan error, 1)
	go func() { started <- m.Start(t.Context()) }()
	<-entered
	if err := m.Start(t.Context()); err == nil {
		t.Fatal("second start accepted")
	}
	if err := m.Shutdown(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := <-started; !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	state(t, m, d.ID, module.Failed)
}

func TestConcurrentShutdownAndScopeIsolation(t *testing.T) {
	m := module.NewManager(slog.Default())
	d := definition("owner")
	var scope *module.Scope
	entered, release := make(chan struct{}), make(chan struct{})
	failure := errors.New("stop failed")
	d.Start = func(_ context.Context, s *module.Scope) error { scope = s; return nil }
	d.Stop = func(context.Context) error { close(entered); <-release; return failure }
	register(t, m, d)
	if err := m.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	results := make(chan error, 8)
	for range cap(results) {
		go func() { results <- m.Shutdown(t.Context()) }()
	}
	<-entered
	state(t, m, d.ID, module.Stopping)
	if err := scope.Add(func(context.Context) error { return nil }); err == nil {
		t.Fatal("stopping owner accepted cleanup")
	}
	short, cancel := context.WithTimeout(t.Context(), time.Millisecond)
	defer cancel()
	if err := m.Shutdown(short); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal(err)
	}
	close(release)
	for range cap(results) {
		if err := <-results; !errors.Is(err, failure) {
			t.Fatal(err)
		}
	}
	state(t, m, d.ID, module.Failed)
}

func TestOwnerCleanupPreservesDependencyResources(t *testing.T) {
	m := module.NewManager(slog.Default())
	active := map[string]bool{}
	for _, id := range []string{"consumer", "provider"} {
		d := definition(id)
		if id == "consumer" {
			d.Dependencies = []string{"provider"}
		}
		d.Start = func(_ context.Context, s *module.Scope) error {
			active[id] = true
			return s.Add(func(context.Context) error { delete(active, id); return nil })
		}
		d.Stop = func(context.Context) error {
			if !active["provider"] || active["consumer"] != (id == "consumer") {
				return fmt.Errorf("wrong resources at %s stop: %v", id, active)
			}
			return nil
		}
		register(t, m, d)
	}
	if err := m.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := m.Shutdown(t.Context()); err != nil {
		t.Fatal(err)
	}
	if len(active) != 0 {
		t.Fatal(active)
	}
}
