package logger

import (
	"context"

	"milo.local/platform/core/module"
	"milo.local/platform/modules/action"
)

func (s *Service) RegisterActions(scope *module.Scope, actions *action.Service) error {
	return actions.Register(scope, action.Definition{
		Metadata: action.Metadata{ID: ID + ".clear", Owner: ID, Title: "output.clear", Icon: "trash", Category: "output.title", Delegates: []string{"milo.workbench"}},
		Run: func(context.Context, map[string]string) error {
			s.Clear()
			return nil
		},
	})
}
