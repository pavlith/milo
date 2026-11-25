package app

import (
	"io/fs"
	"log/slog"

	"github.com/pavlith/slicer/core"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const hostReadyEvent = "slicer:host-ready"

func Run(assets fs.FS) error {
	application.RegisterEvent[string](hostReadyEvent)
	host := &Host{logger: slog.Default()}
	desktop := application.New(application.Options{
		Name:        core.Name,
		Description: "Slicer workbench",
		Logger:      host.logger,
		Linux:       application.LinuxOptions{ApplicationID: "io.github.pavlith.slicer"},
		Services:    []application.Service{application.NewService(host)},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})
	window := desktop.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:      "workbench",
		Title:     core.Name,
		Width:     1200,
		Height:    800,
		MinWidth:  720,
		MinHeight: 480,
		URL:       "/",
	})
	host.window = window
	return desktop.Run()
}
