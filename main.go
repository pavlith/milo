package main

import (
	"log/slog"
	"os"

	"milo.local/platform/app"
)

func main() {
	if err := app.Run(assets); err != nil {
		slog.Error("Milo exited with an error", "error", err)
		os.Exit(1)
	}
}
