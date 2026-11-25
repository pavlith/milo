package logger

type Workbench struct{ logger *Service }

func NewWorkbench(service *Service) *Workbench { return &Workbench{service} }

func (w *Workbench) List() Snapshot { return w.logger.List(Filter{}) }
