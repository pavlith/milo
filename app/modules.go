package app

import (
	"context"
	"log/slog"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"
	"milo.local/platform/core"
	"milo.local/platform/core/module"
	"milo.local/platform/modules/action"
	"milo.local/platform/modules/logger"
	"milo.local/platform/modules/notify"
	"milo.local/platform/modules/search"
	"milo.local/platform/modules/settings"
	"milo.local/platform/modules/task"
)

func (h *Host) configureModules(paths core.Paths, console *slog.Logger) ([]application.Service, error) {
	logs := logger.New(console.Handler(), func(change logger.Change) { h.dispatchModuleEvent(loggerEvent, change) })
	h.logger = logs.For("app")
	h.logger.Debug("resolved application paths", "config", paths.Config, "data", paths.Data, "cache", paths.Cache)
	h.modules = module.NewManager(logs.For("core"))
	preferences := settings.New(filepath.Join(paths.Config, "settings.json"), logs.For(settings.ID),
		func(change settings.Change) { h.dispatchModuleEvent(settingsEvent, change) })
	inbox := notify.New(func(change notify.Change) { h.dispatchModuleEvent(notifyEvent, change) })
	tasks := task.New(logs, inbox, func(change task.Change) { h.dispatchModuleEvent(taskEvent, change) })
	actions := action.New(logs.For(action.ID), func() { h.dispatchModuleEvent(actionCatalogEvent, true) })
	searches := search.New(logs.For(search.ID), func() { h.dispatchModuleEvent(searchCatalogEvent, true) })
	logDefinition := logs.Definition(preferences)
	taskDefinition := tasks.Definition()
	for _, definition := range []module.Definition{
		preferences.Definition(), inbox.Definition(), actions.Definition(), searches.Definition(),
		withRegistration(logDefinition, action.ID, func(scope *module.Scope) error {
			return logs.RegisterActions(scope, actions)
		}),
		withRegistration(taskDefinition, search.ID, func(scope *module.Scope) error {
			return tasks.RegisterSearch(scope, searches)
		}),
	} {
		if err := h.modules.Register(definition); err != nil {
			return nil, err
		}
	}
	return []application.Service{
		application.NewService(h),
		application.NewService(settings.NewWorkbench(preferences, logger.ID)),
		application.NewService(logger.NewWorkbench(logs)),
		application.NewService(notify.NewWorkbench(inbox)),
		application.NewService(task.NewWorkbench(tasks)),
		application.NewService(action.NewWorkbench(actions)),
		application.NewService(search.NewWorkbench(searches)),
	}, nil
}

func (h *Host) dispatchModuleEvent(name string, data any) {
	if h.window == nil || h.stopping.Load() {
		return
	}
	// The typed publishers target this window's bounded Wails event queue.
	// The app-wide emitter queues broadcasts without a capacity limit.
	h.window.DispatchWailsEvent(&application.CustomEvent{Name: name, Sender: h.window.Name(), Data: data})
}

func withRegistration(definition module.Definition, dependency string, register func(*module.Scope) error) module.Definition {
	start := definition.Start
	definition.Dependencies = append(definition.Dependencies, dependency)
	definition.Start = func(ctx context.Context, scope *module.Scope) error {
		if err := start(ctx, scope); err != nil {
			return err
		}
		return register(scope)
	}
	return definition
}
