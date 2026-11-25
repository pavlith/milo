package app

import (
	"io/fs"
	"log/slog"
	"os"
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	productName    = "Milo"
	hostReadyEvent = "milo:host-ready"
)

func Run(assets fs.FS) error {
	application.RegisterEvent[string](hostReadyEvent)
	host := &Host{logger: slog.Default()}
	customTitlebar := runtime.GOOS == "linux" && os.Getenv("MILO_NATIVE_TITLEBAR") != "1"
	desktop := application.New(application.Options{
		Name:        productName,
		Description: "Milo desktop platform",
		Logger:      host.logger,
		Linux:       application.LinuxOptions{ApplicationID: "io.github.pavlith.milo.platform"},
		Services:    []application.Service{application.NewService(host)},
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
	return desktop.Run()
}
