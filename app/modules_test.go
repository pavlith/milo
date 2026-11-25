package app

import (
	"context"
	"log/slog"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
	"milo.local/platform/core"
	"milo.local/platform/core/module"
)

func TestHostRunsBuiltinModulesAndOwnerDisposers(t *testing.T) {
	host := &Host{}
	services, err := host.configureModules(core.Paths{Config: t.TempDir()}, slog.New(slog.DiscardHandler))
	if err != nil || len(services) != 7 {
		t.Fatalf("configure host: %d services, %v", len(services), err)
	}
	disposed := false
	if err := host.modules.Register(module.Definition{
		ID: "test.owner", Dependencies: []string{"task"},
		Start: func(_ context.Context, scope *module.Scope) error {
			return scope.Add(func(context.Context) error {
				task, _ := host.modules.Lookup("task")
				if task.State != module.Running {
					t.Error("task dependency stopped before its owner cleaned up")
				}
				disposed = true
				return nil
			})
		},
		Stop: func(context.Context) error { return nil },
	}); err != nil {
		t.Fatal(err)
	}
	if err := host.ServiceStartup(t.Context(), application.ServiceOptions{}); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"settings", "logger", "notify", "task", "action", "search", "test.owner"} {
		if entry, ok := host.modules.Lookup(id); !ok || entry.State != module.Running {
			t.Fatalf("module %s did not start: %+v", id, entry)
		}
	}
	if err := host.ServiceShutdown(); err != nil {
		t.Fatal(err)
	}
	if !disposed {
		t.Fatal("owner disposer was not called")
	}
	for _, entry := range host.modules.Inventory() {
		if entry.State != module.Stopped {
			t.Fatalf("module %s did not stop: %s", entry.ID, entry.State)
		}
	}
}
