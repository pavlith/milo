package app

import (
	"io/fs"
	"log/slog"
	"os"
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"milo.local/platform/core"
	"milo.local/platform/modules/logger"
	"milo.local/platform/modules/notify"
	"milo.local/platform/modules/settings"
	"milo.local/platform/modules/task"
)

const (
	taskEvent      = "milo:task-changed"
	notifyEvent    = "milo:notification-changed"
	loggerEvent    = "milo:log-changed"
	settingsEvent  = "milo:settings-changed"
	productName    = "Milo"
	hostReadyEvent = "milo:host-ready"
)

func Run(assets fs.FS) error {
	application.RegisterEvent[string](hostReadyEvent)
	application.RegisterEvent[int](closeRequestedEvent)
	application.RegisterEvent[settings.Change](settingsEvent)
	application.RegisterEvent[logger.Change](loggerEvent)
	application.RegisterEvent[notify.Change](notifyEvent)
	application.RegisterEvent[task.Change](taskEvent)
	paths, err := core.UserPaths()
	if err != nil {
		return err
	}
	console := slog.Default()
	host := &Host{}
	services, err := host.configureModules(paths, console)
	if err != nil {
		return err
	}
	customTitlebar := runtime.GOOS == "linux" && os.Getenv("MILO_NATIVE_TITLEBAR") != "1"
	desktop := application.New(application.Options{
		Name:        productName,
		Description: "Milo desktop platform",
		Logger:      console,
		ShouldQuit:  host.requestClose,
		Linux:       application.LinuxOptions{ApplicationID: "io.github.pavlith.milo.platform"},
		Services:    services,
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
