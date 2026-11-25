//go:build !production

package main

import "os"

// Wails dev serves assets from Vite instead of this directory.
var assets = os.DirFS("frontend/dist")
