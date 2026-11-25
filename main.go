package main

import (
	"log/slog"
	"os"

	"github.com/pavlith/slicer/app"
)

func main() {
	if err := app.Run(assets); err != nil {
		slog.Error("slicer exited with an error", "error", err)
		os.Exit(1)
	}
}
