package notify

type Workbench struct{ notify *Service }

func NewWorkbench(service *Service) *Workbench { return &Workbench{service} }

func (w *Workbench) List() Snapshot     { return w.notify.List() }
func (w *Workbench) MarkRead(id string) { w.notify.MarkRead(id) }
func (w *Workbench) MarkAllRead()       { w.notify.MarkAllRead() }
func (w *Workbench) Dismiss(id string)  { w.notify.Dismiss(id) }
func (w *Workbench) Clear()             { w.notify.Clear() }
