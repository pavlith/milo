package task

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"milo.local/platform/core/module"
	"milo.local/platform/modules/logger"
	"milo.local/platform/modules/notify"
	"milo.local/platform/modules/search"
	"milo.local/platform/modules/settings"
)

type harness struct {
	*Service
	*module.Manager
	logs  *logger.Service
	inbox *notify.Service
}

func start(t *testing.T, emit func(Change)) harness {
	t.Helper()
	inbox := notify.New(nil)
	logs := logger.New(nil, nil)
	service := New(logs, inbox, emit)
	prefs := settings.New(filepath.Join(t.TempDir(), "settings.json"), logs.For(settings.ID), nil)
	manager := module.NewManager(slog.New(slog.DiscardHandler))
	for _, def := range []module.Definition{service.Definition(), inbox.Definition(), logs.Definition(prefs), prefs.Definition()} {
		if err := manager.Register(def); err != nil {
			t.Fatal(err)
		}
	}
	if err := manager.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := manager.Shutdown(context.Background()); err != nil {
			t.Error(err)
		}
	})
	return harness{service, manager, logs, inbox}
}

func attach(t *testing.T, service *Service, id string) *Owner {
	t.Helper()
	owner, err := service.AttachOwner(&module.Scope{}, id)
	if err != nil {
		t.Fatal(err)
	}
	return owner
}

func take[T any](t *testing.T, ch <-chan T) T {
	t.Helper()
	select {
	case value := <-ch:
		return value
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for task")
		var zero T
		return zero
	}
}

func TestProgressAndCancellationAreConcurrentAndCooperative(t *testing.T) {
	events := make(chan Change, 256)
	h := start(t, func(change Change) { events <- change })
	owner := attach(t, h.Service, "example.owner")
	other := attach(t, h.Service, "example.other")
	reporter := make(chan Report, 1)
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	cancellation := make(chan struct{})
	initial := .1
	options := Options{ID: "index", Title: "Build index", Progress: &initial, Cancellable: true}
	work := func(ctx context.Context, report Report) error {
		reporter <- report
		<-ctx.Done()
		close(cancellation)
		<-release
		return nil
	}
	run, err := owner.Start(options, work)
	if err != nil || run.ID != "example.owner.index" || *run.Progress != .1 {
		t.Fatalf("wrong initial task: %+v, %v", run, err)
	}
	*run.Progress = .9
	if *h.List().Active[0].Progress != .1 {
		t.Fatal("caller mutated stored progress")
	}
	if _, err := owner.Start(options, work); !errors.Is(err, ErrDuplicate) {
		t.Fatalf("duplicate result: %v", err)
	}
	if err := other.Cancel(run.ID, run.Run); !errors.Is(err, ErrNotRunning) {
		t.Fatalf("other owner cancel result: %v", err)
	}
	report := take(t, reporter)
	for _, invalid := range []float64{-1, 1.1, math.NaN(), math.Inf(1)} {
		if err := report(&invalid); !errors.Is(err, ErrProgress) {
			t.Fatalf("invalid progress result: %v", err)
		}
	}
	if err := report(nil); err != nil || h.List().Active[0].Progress != nil {
		t.Fatal("could not set indeterminate progress")
	}
	var group sync.WaitGroup
	for i := range 40 {
		group.Go(func() {
			fraction := float64(i) / 40
			if err := report(&fraction); err != nil {
				t.Error(err)
			}
		})
	}
	group.Go(func() {
		if err := NewWorkbench(h.Service).Cancel(run.ID, run.Run); err != nil {
			t.Error(err)
		}
	})
	group.Wait()
	take(t, cancellation)
	active := h.List().Active
	if len(active) != 1 || active[0].Status != Running || !active[0].CancellationRequested || active[0].CanCancel {
		t.Fatalf("cancellation prematurely completed or not recorded: %+v", active)
	}
	// Returning after the cancellation request determines the terminal result.
	stopCtx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	if err := owner.Stop(stopCtx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("owner cleanup ignored its budget: %v", err)
	}
	var terminal Change
	release <- struct{}{}
	for terminal.Task.Status != Cancelled {
		terminal = take(t, events)
	}
	if terminal.Task.Completed == nil || len(h.List().Active) != 0 {
		t.Fatal("terminal state not committed")
	}
	if err := report(nil); !errors.Is(err, ErrNotRunning) {
		t.Fatalf("finalized task accepted progress: %v", err)
	}
	if len(events) != 0 {
		t.Fatal("event emitted after terminal outcome")
	}
}

func TestTaskOutcomesRetentionAndDiagnostics(t *testing.T) {
	events := make(chan Change, 256)
	h := start(t, func(change Change) { events <- change })
	owner := attach(t, h.Service, "test")
	for i := range HistoryLimit + 3 {
		run, err := owner.Start(Options{ID: "job", Title: fmt.Sprintf("Job %d", i), FailureSummary: "Check the input.", NotifyOnSuccess: i == 0},
			func(context.Context, Report) error {
				if i == 1 {
					return errors.New("private diagnostic")
				}
				if i == 2 {
					panic("private panic text")
				}
				return nil
			})
		if err != nil {
			t.Fatal(err)
		}
		if next := take(t, events).Task; next.Status != Running || next.Run != run.Run {
			t.Fatalf("wrong start event: %+v", next)
		}
		next := take(t, events).Task
		if i == 1 || i == 2 {
			if next.Status != Failed || next.ErrorSummary != "Check the input." {
				t.Fatalf("unsafe or incorrect failure: %+v", next)
			}
		} else if next.Status != Succeeded {
			t.Fatalf("wrong success: %+v", next)
		}
	}
	if err := owner.Stop(t.Context()); err != nil {
		t.Fatal(err)
	}
	if snapshot := h.List(); len(snapshot.Completed) != HistoryLimit || snapshot.Completed[0].Title != "Job 3" {
		t.Fatalf("wrong completed retention: %+v", snapshot)
	}
	items := h.inbox.List().Items
	searches := search.New(h.logs.For(search.ID), nil)
	if err := searches.Definition().Start(t.Context(), &module.Scope{}); err != nil {
		t.Fatal(err)
	}
	if err := h.RegisterSearch(&module.Scope{}, searches); err != nil {
		t.Fatal(err)
	}
	results, err := searches.Query(t.Context(), ID+".history", "succeeded job 4", 1)
	if err != nil || len(results) != 1 || results[0].Title != "Job 49" ||
		results[0].Action == nil || results[0].Action.ID != OpenActionID {
		t.Fatalf("unexpected task search results: %+v, %v", results, err)
	}
	notified := make(map[string]notify.Severity, len(items))
	for _, item := range items {
		if len(item.Actions) != 1 || item.Actions[0].ID != OpenActionID || item.Owner != "test" {
			t.Fatalf("unexpected task action reference: %+v", item)
		}
		notified[item.Title] = item.Severity
		if item.Severity == notify.Error && item.Description != "Check the input." {
			t.Fatalf("unsafe notification: %+v", item)
		}
	}
	if len(items) != 3 || notified["Job 0"] != notify.Success ||
		notified["Job 1"] != notify.Error || notified["Job 2"] != notify.Error {
		t.Fatalf("wrong actionable notifications: %+v", items)
	}
	for _, record := range h.logs.List(logger.Filter{Owner: "test"}).Records {
		if strings.Contains(fmt.Sprint(record), "private") {
			t.Fatal("raw failure text leaked")
		}
	}
}

func TestOwnerCleanupDoesNotAffectOtherOwners(t *testing.T) {
	h := start(t, nil)
	one := attach(t, h.Service, "one")
	two := attach(t, h.Service, "two")
	begin := make(chan struct{}, 2)
	work := func(ctx context.Context, _ Report) error {
		begin <- struct{}{}
		<-ctx.Done()
		return ctx.Err()
	}
	options := Options{ID: "shared", Title: "Same relative task"}
	if _, err := one.Start(options, work); err != nil {
		t.Fatal(err)
	}
	if _, err := two.Start(options, work); err != nil {
		t.Fatal(err)
	}
	take(t, begin)
	take(t, begin)
	if err := one.Stop(t.Context()); err != nil {
		t.Fatal(err)
	}
	if _, err := one.Start(options, work); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("closed owner can still start work: %v", err)
	}
	current := h.List()
	if len(current.Active) != 1 || current.Active[0].Owner != "two" || current.Completed[0].Status != Cancelled {
		t.Fatalf("wrong owner isolation: %+v", current)
	}
	if err := h.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	if current = h.List(); len(current.Active) != 0 || current.Completed[1].Owner != "two" ||
		current.Completed[1].Status != Cancelled {
		t.Fatalf("host shutdown did not cancel remaining owner: %+v", current)
	}
}
