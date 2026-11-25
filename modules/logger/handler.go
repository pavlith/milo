package logger

import (
	"context"
	"log/slog"
	"slices"
)

type handler struct {
	service *Service
	owner   string
	groups  []string
	fields  map[string]any
}

func (h *handler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= h.service.minimum.Level()
}

func (h *handler) Handle(ctx context.Context, source slog.Record) error {
	fields := cloneFields(h.fields)
	if fields == nil {
		fields = make(map[string]any)
	}
	nodes := fieldNodes(fields)
	source.Attrs(func(attr slog.Attr) bool {
		put(fields, h.groups, attr, &nodes)
		return nodes < maxNodes
	})
	record := Record{Time: source.Time, Level: severity(source.Level), Owner: h.owner, Message: scrub(source.Message), Fields: fields}
	h.service.append(record)
	if sink := h.service.sink; sink != nil && sink.Enabled(ctx, source.Level) {
		clean := slog.NewRecord(source.Time, source.Level, record.Message, source.PC)
		clean.AddAttrs(slog.String("owner", record.Owner))
		if len(fields) > 0 {
			clean.AddAttrs(slog.Any("fields", fields))
		}
		return sink.Handle(ctx, clean)
	}
	return nil
}

func (h *handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	next := *h
	next.fields = cloneFields(h.fields)
	if next.fields == nil {
		next.fields = make(map[string]any)
	}
	nodes := fieldNodes(next.fields)
	for _, attr := range attrs {
		put(next.fields, h.groups, attr, &nodes)
	}
	return &next
}

func (h *handler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}
	next := *h
	next.groups = append(slices.Clone(h.groups), name)
	return &next
}

func put(fields map[string]any, groups []string, attr slog.Attr, nodes *int) {
	if *nodes+len(groups) >= maxNodes || len(groups) >= maxDepth {
		return
	}
	for _, group := range groups {
		if secretKey(group) {
			if len(fields) < maxFields {
				fields[scrub(group)] = redacted
			}
			return
		}
		if len(fields) >= maxFields {
			return
		}
		key := scrub(group)
		child, ok := fields[key].(map[string]any)
		if !ok {
			child = make(map[string]any)
			fields[key] = child
			(*nodes)++
		}
		fields = child
	}
	putAttr(fields, attr, len(groups), nodes)
}

func putAttr(fields map[string]any, attr slog.Attr, depth int, nodes *int) {
	if *nodes >= maxNodes || depth >= maxDepth || len(fields) >= maxFields || attr.Equal(slog.Attr{}) {
		return
	}
	key := scrub(attr.Key)
	if secretKey(attr.Key) {
		(*nodes)++
		fields[key] = redacted
		return
	}
	value := attr.Value.Resolve()
	if value.Kind() != slog.KindGroup {
		fields[key] = cleanValue(value.Any(), depth+1, nodes)
		return
	}
	if key == "" {
		for _, child := range value.Group() {
			putAttr(fields, child, depth+1, nodes)
		}
		return
	}
	(*nodes)++
	group := make(map[string]any)
	for _, child := range value.Group() {
		putAttr(group, child, depth+1, nodes)
	}
	if len(group) > 0 {
		fields[key] = group
	}
}

func fieldNodes(value any) int {
	count := 1
	switch fields := value.(type) {
	case map[string]any:
		for _, field := range fields {
			count += fieldNodes(field)
		}
	case []any:
		for _, field := range fields {
			count += fieldNodes(field)
		}
	}
	return count
}
