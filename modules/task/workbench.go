package task

type Workbench struct{ tasks *Service }

func NewWorkbench(service *Service) *Workbench { return &Workbench{service} }

func (w *Workbench) List() Snapshot                  { return w.tasks.List() }
func (w *Workbench) Cancel(id string, run int) error { return w.tasks.cancel(id, run, nil) }
