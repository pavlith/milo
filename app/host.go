package app

import (
	"context"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"milo.local/platform/core/module"
)

type Host struct {
	modules  *module.Manager
	logger   *slog.Logger
	window   *application.WebviewWindow
	stopping atomic.Bool

	closeMu        sync.Mutex
	workbenchReady bool
	closeSequence  int
	pendingClose   int
	closeApproved  bool
}

func (h *Host) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	if err := h.modules.Start(ctx); err != nil {
		return err
	}
	h.logger.InfoContext(ctx, "desktop host started")
	return nil
}

func (h *Host) ServiceShutdown() error {
	h.stopping.Store(true)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := h.modules.Shutdown(ctx); err != nil {
		return err
	}
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
