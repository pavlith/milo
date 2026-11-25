package app

import (
	"io/fs"
	"log/slog"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	productName    = "Milo"
	hostReadyEvent = "milo:host-ready"
)

func Run(assets fs.FS) error {
	application.RegisterEvent[string](hostReadyEvent)
	host := &Host{logger: slog.Default()}
	desktop := application.New(application.Options{
		Name:        productName,
		Description: "Milo desktop platform",
		Logger:      host.logger,
		Linux:       application.LinuxOptions{ApplicationID: "io.github.pavlith.milo.platform"},
		Services:    []application.Service{application.NewService(host)},
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
		URL:       "/",
	})
	host.window = window
	return desktop.Run()
}
