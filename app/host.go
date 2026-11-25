package app

import (
	"context"
	"log/slog"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"milo.local/platform/core"
)

type Host struct {
	logger *slog.Logger
	window *application.WebviewWindow

	closeMu        sync.Mutex
	workbenchReady bool
	closeSequence  int
	pendingClose   int
	closeApproved  bool
}

func (h *Host) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	paths, err := core.UserPaths()
	if err != nil {
		return err
	}
	h.logger.DebugContext(ctx, "resolved application paths", "config", paths.Config, "data", paths.Data, "cache", paths.Cache)
	h.logger.InfoContext(ctx, "desktop host started")
	return nil
}

func (h *Host) ServiceShutdown() error {
	h.logger.Info("desktop host stopped")
	return nil
}

// WorkbenchReady acknowledges a mounted workbench, including after a Vite reload.
func (h *Host) WorkbenchReady() {
	h.closeMu.Lock()
	h.workbenchReady = true
	request := h.pendingClose
	h.closeMu.Unlock()

	if request != 0 {
		h.window.EmitEvent(closeRequestedEvent, request)
	}
	h.window.EmitEvent(hostReadyEvent, productName)
	h.logger.Info("workbench ready")
}
