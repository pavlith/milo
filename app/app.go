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
	host := &Host{}
	console := slog.Default()
	logs := logger.New(console.Handler(), func(change logger.Change) {
		host.window.EmitEvent(loggerEvent, change)
	})
	host.logger = logs.For("app")
	paths, err := core.UserPaths()
	if err != nil {
		return err
	}
	modules := module.NewManager(logs.For("core"))
	host.modules = modules
	preferences := settings.New(filepath.Join(paths.Config, "settings.json"), logs.For(settings.ID), func(change settings.Change) {
		host.window.EmitEvent(settingsEvent, change)
	})
	if err := modules.Register(preferences.Definition()); err != nil {
		return err
	}
	if err := modules.Register(logs.Definition(preferences)); err != nil {
		return err
	}
	inbox := notify.New(func(change notify.Change) { host.window.EmitEvent(notifyEvent, change) })
	if err := modules.Register(inbox.Definition()); err != nil {
		return err
	}
	tasks := task.New(logs, inbox, func(change task.Change) { host.window.EmitEvent(taskEvent, change) })
	if err := modules.Register(tasks.Definition()); err != nil {
		return err
	}
	customTitlebar := runtime.GOOS == "linux" && os.Getenv("MILO_NATIVE_TITLEBAR") != "1"
	desktop := application.New(application.Options{
		Name:        productName,
		Description: "Milo desktop platform",
		Logger:      console,
		ShouldQuit:  host.requestClose,
		Linux:       application.LinuxOptions{ApplicationID: "io.github.pavlith.milo.platform"},
		Services:    []application.Service{application.NewService(host), application.NewService(settings.NewWorkbench(preferences, logger.ID)), application.NewService(logger.NewWorkbench(logs)), application.NewService(notify.NewWorkbench(inbox)), application.NewService(task.NewWorkbench(tasks))},
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
