package settings

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"milo.local/platform/core/module"
)

func startSettings(t *testing.T, path string, extra ...module.Definition) *Service {
	t.Helper()
	service := New(path, slog.New(slog.DiscardHandler), nil)
	manager := module.NewManager(slog.New(slog.DiscardHandler))
	for _, definition := range append([]module.Definition{service.Definition()}, extra...) {
		if err := manager.Register(definition); err != nil {
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
	return service
}

func TestSettingsPersistenceAndMigration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config", "settings.json")
	first := startSettings(t, path)
	if err := first.Set(ID, Theme, Value{Text: "purple"}); err == nil {
		t.Fatal("invalid theme accepted")
	}
	if err := first.Set(ID, Theme, Value{Text: "dark"}); err != nil {
		t.Fatal(err)
	}
	if err := first.MigrateTheme("light"); err != nil {
		t.Fatal(err)
	}
	second := startSettings(t, path)
	theme, err := second.Get(Theme)
	if err != nil || theme.Value.Text != "dark" || !theme.Overridden {
		t.Fatalf("wrong persisted theme: %+v, %v", theme, err)
	}
	if err := second.ResetCategory(ID, "appearance"); err != nil {
		t.Fatal(err)
	}
	third := startSettings(t, path)
	if err := third.MigrateTheme("light"); err != nil {
		t.Fatal(err)
	}
	theme, _ = third.Get(Theme)
	if theme.Value.Text != "system" || theme.Overridden {
		t.Fatal("migration ran after reset")
	}
}

func TestSettingsRecovery(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, []byte("{invalid"), 0600); err != nil {
		t.Fatal(err)
	}
	service := startSettings(t, path)
	if files, _ := filepath.Glob(path + ".invalid-*"); len(files) != 1 {
		t.Fatal("invalid settings were not preserved")
	}
	if err := service.MigrateTheme("light"); err != nil {
		t.Fatal(err)
	}
	if entry, _ := service.Get(Theme); entry.Value.Text != "light" {
		t.Fatal("compatible theme migration failed")
	}
	future := []byte(`{"version":2,"values":["future format"]}`)
	if err := os.WriteFile(path, future, 0600); err != nil {
		t.Fatal(err)
	}
	next := startSettings(t, path)
	if err := next.Reset(ID, Theme); err == nil {
		t.Fatal("newer version was writable")
	}
	if got, _ := os.ReadFile(path); string(got) != string(future) {
		t.Fatal("newer version was replaced")
	}
}

func TestSettingsOwnerIsolationAndCopies(t *testing.T) {
	service := startSettings(t, filepath.Join(t.TempDir(), "settings.json"))
	owner, other := &module.Scope{}, &module.Scope{}
	schema := func(id string) Schema {
		return Schema{ID: id, Category: "general", Label: id, Kind: Boolean, Default: Flag(true)}
	}
	if err := service.Register(owner, "ext", schema("ext.flag")); err != nil {
		t.Fatal(err)
	}
	if err := service.Register(other, "ext.other", schema("ext.other.flag")); err != nil {
		t.Fatal(err)
	}
	if err := service.Set("ext", "ext.other.flag", Flag(false)); err == nil {
		t.Fatal("nested owner bypassed ownership check")
	}
	if err := service.Set("ext.other", "ext.other.flag", Flag(false)); err != nil {
		t.Fatal(err)
	}
	if err := service.ResetCategory("ext", "general"); err != nil {
		t.Fatal(err)
	}
	entry, _ := service.Get("ext.other.flag")
	if !entry.Overridden || *entry.Value.Enabled {
		t.Fatal("category reset changed another owner")
	}
	*entry.Value.Enabled = true
	entry, _ = service.Get("ext.other.flag")
	if *entry.Value.Enabled {
		t.Fatal("Get exposed mutable state")
	}
}
