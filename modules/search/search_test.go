package search

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"milo.local/platform/core/module"
)

func TestProviderIsolationAndLimits(t *testing.T) {
	log := slog.New(slog.DiscardHandler)
	searches := New(log, nil)
	manager := module.NewManager(log)
	if err := manager.Register(searches.Definition()); err != nil {
		t.Fatal(err)
	}
	good := Provider{Metadata: Metadata{ID: "owner.good", Owner: "owner", Label: "Good", Limit: 2, TimeoutMS: 1000},
		Query: func(_ context.Context, query string, limit int) ([]Result, error) {
			if query != "term" || limit != 2 {
				t.Errorf("unexpected provider inputs: %q %d", query, limit)
			}
			return []Result{{ID: "one", Title: "First", Owner: "forged"}, {ID: "two", Title: "Second"}, {ID: "three", Title: "Third"}}, nil
		}}
	bad := Provider{Metadata: Metadata{ID: "owner.bad", Owner: "owner", Label: "Bad", Limit: 2, TimeoutMS: 1000},
		Query: func(context.Context, string, int) ([]Result, error) {
			panic("internal bug")
		}}
	if err := manager.Register(module.Definition{
		ID: "owner", Dependencies: []string{ID},
		Start: func(_ context.Context, scope *module.Scope) error {
			if err := searches.Register(scope, good); err != nil {
				return err
			}
			if err := searches.Register(scope, good); err == nil {
				t.Error("duplicate provider accepted")
			}
			return searches.Register(scope, bad)
		},
		Stop: func(context.Context) error { return nil },
	}); err != nil {
		t.Fatal(err)
	}
	if err := manager.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	inventory := searches.List()
	if len(inventory) != 2 || inventory[0].ID != bad.ID {
		t.Fatalf("unexpected provider order: %+v", inventory)
	}
	if _, err := searches.Query(t.Context(), bad.ID, "", 10); err != ErrFailed {
		t.Fatalf("provider panic escaped: %v", err)
	}
	results, err := searches.Query(t.Context(), good.ID, " term ", 10)
	if err != nil || len(results) != 2 || results[0].Owner != good.Owner || results[0].Provider != good.ID {
		t.Fatalf("invalid result projection: %+v %v", results, err)
	}
	if err := manager.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(searches.List()) != 0 {
		t.Fatal("providers survived owner shutdown")
	}
}

func TestProviderDeadlineAndCancellation(t *testing.T) {
	searches := New(slog.New(slog.DiscardHandler), nil)
	if err := searches.Definition().Start(t.Context(), &module.Scope{}); err != nil {
		t.Fatal(err)
	}
	release := make(chan struct{})
	defer close(release)
	started := make(chan struct{}, 2)
	def := Provider{Metadata: Metadata{ID: "owner.wait", Owner: "owner", Label: "Wait", Limit: 2, TimeoutMS: 20},
		Query: func(ctx context.Context, query string, _ int) ([]Result, error) {
			if query == "deadline" {
				<-release // A noncooperative provider must not stall the caller.
				return nil, nil
			}
			started <- struct{}{}
			<-ctx.Done()
			return nil, ctx.Err()
		}}
	if err := searches.Register(&module.Scope{}, def); err != nil {
		t.Fatal(err)
	}
	if _, err := searches.Query(t.Context(), def.ID, "deadline", 1); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("query deadline: %v", err)
	}
	searches.Unregister(def.ID)
	def.TimeoutMS = 3000
	if err := searches.Register(&module.Scope{}, def); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	done := make(chan error, 1)
	query := func(ctx context.Context) {
		_, err := searches.Query(ctx, def.ID, "cancel", 1)
		done <- err
	}
	go query(ctx)
	<-started
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("caller cancel: %v", err)
	}
	go query(t.Context())
	<-started
	searches.RemoveOwner(def.Owner)
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("owner cancel: %v", err)
	}
	if _, ok := searches.Lookup(def.ID); ok {
		t.Fatal("removed owner still has a provider")
	}
}
