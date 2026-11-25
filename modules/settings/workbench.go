package settings

import "slices"

// Workbench exposes the trusted built-in settings editor operations.
type Workbench struct {
	settings *Service
	owners   []string
}

func NewWorkbench(service *Service, owners ...string) *Workbench {
	return &Workbench{service, append([]string{ID}, owners...)}
}

func (w *Workbench) List() (Snapshot, error) { return w.settings.List() }

func (w *Workbench) owner(id string) string {
	w.settings.mu.Lock()
	defer w.settings.mu.Unlock()
	owner := w.settings.owners[id]
	if slices.Contains(w.owners, owner) {
		return owner
	}
	return ""
}

func (w *Workbench) Set(id string, value Value) error { return w.settings.Set(w.owner(id), id, value) }
func (w *Workbench) Reset(id string) error            { return w.settings.Reset(w.owner(id), id) }
func (w *Workbench) ResetCategory(category string) error {
	return w.settings.resetCategory(category, w.owners...)
}
func (w *Workbench) MigrateTheme(legacy string) error { return w.settings.MigrateTheme(legacy) }
