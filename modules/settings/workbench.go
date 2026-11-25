package settings

// Workbench exposes the trusted built-in settings editor operations.
type Workbench struct{ settings *Service }

func NewWorkbench(service *Service) *Workbench { return &Workbench{service} }

func (w *Workbench) List() (Snapshot, error) {
	snapshot, err := w.settings.List()
	return snapshot, err
}
func (w *Workbench) Set(id string, value Value) error { return w.settings.Set(ID, id, value) }
func (w *Workbench) Reset(id string) error            { return w.settings.Reset(ID, id) }
func (w *Workbench) ResetCategory(category string) error {
	return w.settings.ResetCategory(ID, category)
}
func (w *Workbench) MigrateTheme(legacy string) error { return w.settings.MigrateTheme(legacy) }
