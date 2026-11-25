package action

import "context"

// Workbench exposes only lookup and dispatch for the trusted Workbench.
type Workbench struct{ actions *Service }

func NewWorkbench(actions *Service) *Workbench { return &Workbench{actions} }

func (w *Workbench) List() []Metadata { return w.actions.List() }
func (w *Workbench) Invoke(ctx context.Context, ref Reference, owner string, contexts []string) error {
	return w.actions.Invoke(ctx, ref, owner, contexts)
}
