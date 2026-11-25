package module

import (
	"fmt"
	"maps"
	"slices"
	"strings"
)

// order traverses the sealed graph in stable ID order, dependencies first.
func (r *registry) order() ([]*entry, error) {
	var ordered []*entry
	visited := make(map[string]bool)
	var path []string
	var visit func(string) error
	visit = func(id string) error {
		if done, seen := visited[id]; seen {
			if done {
				return nil
			}
			return fmt.Errorf("module dependency cycle: %s", strings.Join(append(path, id), " -> "))
		}
		visited[id] = false
		path = append(path, id)
		e := r.entries[id]
		for _, dep := range e.def.Dependencies {
			if _, ok := r.entries[dep]; !ok {
				return fmt.Errorf("module %q requires missing module %q", id, dep)
			}
			if err := visit(dep); err != nil {
				return err
			}
		}
		path = path[:len(path)-1]
		visited[id] = true
		ordered = append(ordered, e)
		return nil
	}
	for _, id := range slices.Sorted(maps.Keys(r.entries)) {
		if err := visit(id); err != nil {
			return nil, err
		}
	}
	return ordered, nil
}
