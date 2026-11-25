package search

import "context"

type Workbench struct{ search *Service }

func NewWorkbench(service *Service) *Workbench { return &Workbench{service} }

func (w *Workbench) List() []Metadata { return w.search.List() }
func (w *Workbench) Query(ctx context.Context, id, query string, limit int) ([]Result, error) {
	return w.search.Query(ctx, id, query, limit)
}
