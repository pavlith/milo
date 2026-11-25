package action

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"milo.local/platform/core/module"
)

func TestScopedActionInvocation(t *testing.T) {
	log := slog.New(slog.DiscardHandler)
	manager := module.NewManager(log)
	actions := New(log, nil)
	var scope *module.Scope
	enabled := true
	calls := 0
	meta := Metadata{ID: "example.run", Owner: "example", Title: "example.title", Requires: []string{"editor"}, Delegates: []string{"producer"}}
	def := Definition{
		Metadata: meta,
		Enabled:  func(context.Context) bool { return enabled },
		Validate: func(args map[string]string) bool { return len(args) == 1 && args["mode"] == "safe" },
		Run:      func(context.Context, map[string]string) error { calls++; return nil },
	}
	if err := manager.Register(actions.Definition()); err != nil {
		t.Fatal(err)
	}
	if err := manager.Register(module.Definition{
		ID: "example", Dependencies: []string{ID},
		Start: func(_ context.Context, ownerScope *module.Scope) error {
			scope = ownerScope
			return actions.Register(scope, def)
		},
		Stop: func(context.Context) error {
			if _, ok := actions.Lookup(meta.ID); !ok {
				t.Error("scope disposed before owner Stop")
			}
			return nil
		},
	}); err != nil {
		t.Fatal(err)
	}
	if err := manager.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := actions.Register(scope, def); err == nil || len(actions.List()) != 1 {
		t.Fatal("duplicate changed the registry")
	}
	meta.Delegates[0] = "tampered"
	ref := Reference{ID: def.ID, Args: map[string]string{"mode": "safe"}}
	for _, attempt := range []struct {
		ref   Reference
		owner string
		flags []string
		want  error
	}{
		{Reference{ID: "missing"}, "", nil, ErrMissing},
		{ref, "tampered", []string{"editor"}, ErrUnavailable},
		{ref, "producer", nil, ErrUnavailable},
		{Reference{ID: def.ID}, "producer", []string{"editor"}, ErrArguments},
		{ref, "producer", []string{"editor"}, nil},
	} {
		if err := actions.Invoke(t.Context(), attempt.ref, attempt.owner, attempt.flags); !errors.Is(err, attempt.want) {
			t.Fatalf("%+v: got %v", attempt, err)
		}
	}
	enabled = false
	if err := actions.Invoke(t.Context(), ref, "producer", []string{"editor"}); !errors.Is(err, ErrUnavailable) || calls != 1 {
		t.Fatalf("disabled action: %d runs, %v", calls, err)
	}
	if err := manager.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, ok := actions.Lookup(def.ID); ok {
		t.Fatal("owner scope did not unregister action")
	}
}

func TestActionRemovalCancelsRunningHandlerAndKeepsOtherOwners(t *testing.T) {
	log := slog.New(slog.DiscardHandler)
	actions := New(log, nil)
	if err := actions.Definition().Start(t.Context(), &module.Scope{}); err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{})
	ctx, cancel := context.WithTimeout(t.Context(), time.Second)
	defer cancel()
	for _, definition := range []Definition{
		{Metadata: Metadata{ID: "owner.wait", Owner: "owner", Title: "Wait"}, Run: func(ctx context.Context, _ map[string]string) error {
			close(started)
			<-ctx.Done()
			return ctx.Err()
		}},
		{Metadata: Metadata{ID: "other.fail", Owner: "other", Title: "Fail"}, Run: func(context.Context, map[string]string) error {
			return errors.New("private implementation detail")
		}},
	} {
		if err := actions.Register(&module.Scope{}, definition); err != nil {
			t.Fatal(err)
		}
	}
	done := make(chan error, 1)
	go func() { done <- actions.Invoke(ctx, Reference{ID: "owner.wait"}, "", nil) }()
	select {
	case <-started:
	case <-ctx.Done():
		t.Fatal("handler did not start")
	}
	actions.RemoveOwner("owner")
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("removal did not cancel handler: %v", err)
	}
	if err := actions.Invoke(ctx, Reference{ID: "other.fail"}, "", nil); err != ErrFailed {
		t.Fatalf("expected sanitized failure from other owner, got %v", err)
	}
}
