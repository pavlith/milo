package task

import (
	"context"
	"slices"
	"strconv"
	"strings"

	"milo.local/platform/core/module"
	"milo.local/platform/modules/action"
	"milo.local/platform/modules/search"
)

const OpenActionID = "milo.task.open"

func (s *Service) RegisterSearch(scope *module.Scope, searches *search.Service) error {
	return searches.Register(scope, search.Provider{
		Metadata: search.Metadata{
			ID: ID + ".history", Owner: ID, Label: "task.title", Scope: "tasks", Limit: 12, TimeoutMS: 800,
		},
		Query: s.search,
	})
}

func (s *Service) search(ctx context.Context, query string, limit int) ([]search.Result, error) {
	if query == "" {
		return nil, nil
	}
	snapshot := s.List()
	slices.Reverse(snapshot.Completed)
	words := strings.Fields(strings.ToLower(query))
	results := make([]search.Result, 0, limit)
	for _, item := range slices.Concat(snapshot.Active, snapshot.Completed) {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		text := strings.ToLower(strings.Join([]string{item.Title, item.Description, item.Owner, string(item.Status)}, " "))
		if !slices.ContainsFunc(words, func(word string) bool { return !strings.Contains(text, word) }) {
			results = append(results, search.Result{
				ID: "run." + strconv.Itoa(item.Run), Title: item.Title, Description: item.Description,
				Icon: "tasks", Action: &action.Reference{ID: OpenActionID},
			})
			if len(results) == limit {
				break
			}
		}
	}
	return results, nil
}
