package app

import (
	"context"
	"log/slog"

	"github.com/pavlith/slicer/core"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type Host struct {
	logger *slog.Logger
	window *application.WebviewWindow
}

func (h *Host) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	paths, err := core.UserPaths()
	if err != nil {
		return err
	}
	h.logger.DebugContext(ctx, "resolved application paths", "config", paths.Config, "cache", paths.Cache)
	h.logger.InfoContext(ctx, "desktop host started")
	return nil
}

func (h *Host) ServiceShutdown() error {
	h.logger.Info("desktop host stopped")
	return nil
}

// WorkbenchReady acknowledges a mounted workbench, including after a Vite reload.
func (h *Host) WorkbenchReady() {
	h.window.EmitEvent(hostReadyEvent, core.Name)
	h.logger.Info("workbench ready")
}
