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

	paths, err := UserPaths()
	if err != nil {
		t.Fatal(err)
	}
	want := Paths{
		Config: filepath.Join(home, ".config", Name),
		Cache:  filepath.Join(home, ".cache", Name),
	}
	if paths != want {
		t.Fatalf("default paths = %+v, want %+v", paths, want)
	}

	config := filepath.Join(home, "config")
	cache := filepath.Join(home, "cache")
	t.Setenv("XDG_CONFIG_HOME", config)
	t.Setenv("XDG_CACHE_HOME", cache)

	paths, err = UserPaths()
	if err != nil {
		t.Fatal(err)
	}
	want = Paths{
		Config: filepath.Join(config, Name),
		Cache:  filepath.Join(cache, Name),
	}
	if paths != want {
		t.Fatalf("XDG paths = %+v, want %+v", paths, want)
	}
}
