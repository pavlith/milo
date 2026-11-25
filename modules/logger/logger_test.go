package logger

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"
	"testing"

	"milo.local/platform/core/module"
	"milo.local/platform/modules/settings"
)

func TestRetentionFilteringAndClear(t *testing.T) {
	service := New(nil, nil)
	log := service.For("test")
	for i := range HistoryLimit + 5 {
		log.Info(fmt.Sprintf("record %d", i))
	}
	snapshot := service.List(Filter{})
	if len(snapshot.Records) != HistoryLimit || snapshot.Records[0].ID != 6 {
		t.Fatalf("wrong bounded history: %d, first id %d", len(snapshot.Records), snapshot.Records[0].ID)
	}
	service.For("other").Warn("find this")
	snapshot = service.List(Filter{Minimum: Warn, Owner: "other", Text: "FIND"})
	if len(snapshot.Records) != 1 || snapshot.Records[0].Level != Warn {
		t.Fatalf("filter failed: %+v", snapshot)
	}
	service.Clear()
	if cleared := service.List(Filter{}); len(cleared.Records) != 0 || cleared.Revision != snapshot.Revision+1 {
		t.Fatalf("wrong cleared snapshot: %+v", cleared)
	}
}

func TestStructuredLoggingRedactsAtEverySink(t *testing.T) {
	var console bytes.Buffer
	service := New(slog.NewJSONHandler(&console, nil), nil)
	log := service.For("app").With("count", 7).WithGroup("request")
	log.Info("Authorization: Bearer fake-bearer URL https://user:fake-pass@example.org",
		slog.Group("nested", slog.String("password", "fake-password"), slog.String("safe", "hello")),
		"payload", []any{map[string]any{"api_key": "fake-api", "size": 5}})
	record := service.List(Filter{}).Records[0]
	body, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	for _, candidate := range []string{string(body), console.String()} {
		if strings.Contains(candidate, "fake-") || !strings.Contains(candidate, "hello") || !strings.Contains(candidate, `"count":7`) {
			t.Fatalf("wrong projected content: %s", candidate)
		}
	}
	record.Fields["count"] = 10
	if service.List(Filter{}).Records[0].Fields["count"] != int64(7) {
		t.Fatal("snapshot mutated retained fields")
	}
}

func TestLoggerUsesLiveSettingsAndEmitsIncrementalRecords(t *testing.T) {
	var changes []Change
	service := New(nil, func(change Change) { changes = append(changes, change) })
	log := service.For("test")
	log.Info("bootstrap")
	prefs := settings.New(filepath.Join(t.TempDir(), "settings.json"), log, nil)
	manager := module.NewManager(log)
	for _, definition := range []module.Definition{service.Definition(prefs), prefs.Definition()} {
		if err := manager.Register(definition); err != nil {
			t.Fatal(err)
		}
	}
	if err := manager.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	defer manager.Shutdown(context.Background())
	if err := prefs.Set(ID, LevelSetting, settings.Value{Text: "debug"}); err != nil {
		t.Fatal(err)
	}
	log.Debug("visible")
	if last := changes[len(changes)-1]; last.Added.Message != "visible" || last.Added.ID != last.Revision {
		t.Fatalf("wrong change: %+v", last)
	}
	if first := service.List(Filter{}).Records[0]; first.Message != "bootstrap" {
		t.Fatal("bootstrap record lost")
	}
}
