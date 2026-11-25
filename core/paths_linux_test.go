package core

import (
	"path/filepath"
	"testing"
)

func TestUserPaths(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", "")
	t.Setenv("XDG_CACHE_HOME", "")
	t.Setenv("XDG_DATA_HOME", "")

	paths, err := UserPaths()
	if err != nil {
		t.Fatal(err)
	}
	want := Paths{
		Config: filepath.Join(home, ".config", "milo-platform"),
		Data:   filepath.Join(home, ".local", "share", "milo-platform"),
		Cache:  filepath.Join(home, ".cache", "milo-platform"),
	}
	if paths != want {
		t.Fatalf("default paths = %+v, want %+v", paths, want)
	}

	config := filepath.Join(home, "config")
	cache := filepath.Join(home, "cache")
	data := filepath.Join(home, "data")
	t.Setenv("XDG_CONFIG_HOME", config)
	t.Setenv("XDG_CACHE_HOME", cache)
	t.Setenv("XDG_DATA_HOME", data)

	paths, err = UserPaths()
	if err != nil {
		t.Fatal(err)
	}
	want = Paths{
		Config: filepath.Join(config, "milo-platform"),
		Data:   filepath.Join(data, "milo-platform"),
		Cache:  filepath.Join(cache, "milo-platform"),
	}
	if paths != want {
		t.Fatalf("XDG paths = %+v, want %+v", paths, want)
	}
}
