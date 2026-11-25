package notify

import (
	"context"
	"log/slog"
	"testing"

	"milo.local/platform/core/module"
)

func TestNotificationLifecycleAndRetention(t *testing.T) {
	var changes []Change
	service := New(func(change Change) { changes = append(changes, change) })
	message := Message{Severity: Success, Title: "Finished", Actions: []ActionRef{{ID: "example.open", Args: map[string]string{"category": "general"}}}}
	if _, err := service.Publish("test", message); err == nil {
		t.Fatal("published before start")
	}
	manager := module.NewManager(slog.New(slog.DiscardHandler))
	if err := manager.Register(service.Definition()); err != nil {
		t.Fatal(err)
	}
	if err := manager.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	first, err := service.Publish("test", message)
	if err != nil {
		t.Fatal(err)
	}
	for range HistoryLimit {
		if _, err := service.Publish("test", message); err != nil {
			t.Fatal(err)
		}
	}
	snapshot := service.List()
	if len(snapshot.Items) != HistoryLimit || snapshot.Items[0].ID == first ||
		changes[len(changes)-1].Removed != first {
		t.Fatal("oldest notification not evicted")
	}
	id := snapshot.Items[0].ID
	snapshot.Items[0].Actions[0].ID = "changed"
	snapshot.Items[0].Actions[0].Args["category"] = "changed"
	message.Actions[0].Args["category"] = "changed"
	changes[1].Added.Actions[0].Args["category"] = "changed"
	service.MarkRead(id)
	service.MarkRead(id)
	snapshot = service.List()
	if !snapshot.Items[0].Read || snapshot.Items[0].Actions[0].ID != "example.open" || snapshot.Items[0].Actions[0].Args["category"] != "general" || snapshot.Revision != HistoryLimit+2 {
		t.Fatalf("unexpected read state or revision: %d", snapshot.Revision)
	}
	service.MarkAllRead()
	for _, item := range service.List().Items {
		if !item.Read {
			t.Fatal("notification remains unread")
		}
	}
	service.Dismiss(id)
	if len(service.List().Items) != HistoryLimit-1 {
		t.Fatal("dismissal failed")
	}
	service.Clear()
	if len(service.List().Items) != 0 || !changes[len(changes)-1].Cleared {
		t.Fatal("clear failed")
	}
	if err := manager.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Publish("test", message); err == nil {
		t.Fatal("published after shutdown")
	}
}
