package app

import (
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"milo.local/platform/core"
	"milo.local/platform/core/module"
	"milo.local/platform/modules/settings"
)

const (
	settingsEvent  = "milo:settings-changed"
	productName    = "Milo"
	hostReadyEvent = "milo:host-ready"
)

func Run(assets fs.FS) error {
	application.RegisterEvent[string](hostReadyEvent)
	application.RegisterEvent[int](closeRequestedEvent)
	application.RegisterEvent[settings.Change](settingsEvent)
	logger := slog.Default()
	paths, err := core.UserPaths()
	if err != nil {
		return err
	}
	modules := module.NewManager(logger)
	host := &Host{logger: logger, modules: modules}
	preferences := settings.New(filepath.Join(paths.Config, "settings.json"), logger.With("owner", settings.ID), func(change settings.Change) {
		host.window.EmitEvent(settingsEvent, change)
	})
	if err := modules.Register(preferences.Definition()); err != nil {
		return err
	}
	customTitlebar := runtime.GOOS == "linux" && os.Getenv("MILO_NATIVE_TITLEBAR") != "1"
	desktop := application.New(application.Options{
		Name:        productName,
		Description: "Milo desktop platform",
		Logger:      host.logger,
		ShouldQuit:  host.requestClose,
		Linux:       application.LinuxOptions{ApplicationID: "io.github.pavlith.milo.platform"},
		Services:    []application.Service{application.NewService(host), application.NewService(settings.NewWorkbench(preferences))},
		Flags:       map[string]any{"milo.customTitlebar": customTitlebar},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})
	window := desktop.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:      "workbench",
		Title:     productName,
		Width:     1200,
		Height:    800,
		MinWidth:  720,
		MinHeight: 480,
		Frameless: customTitlebar,
		URL:       "/",
	})
	host.window = window
	window.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		if !host.requestClose() {
			event.Cancel()
		}
	})
	return desktop.Run()
}
