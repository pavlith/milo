package logger

import (
	"math"
	"reflect"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	maxNodes  = 40
	redacted  = "[redacted]"
	maxDepth  = 5
	maxFields = 12
	maxText   = 1024
)

var (
	authScheme  = regexp.MustCompile(`(?i)\b(bearer|basic)\s+[a-z0-9._~+/=-]+`)
	credentials = regexp.MustCompile(`(?i)\b(?:password|passwd|token|secret|api[_-]?key|authorization|cookie)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)`)
	urlUserInfo = regexp.MustCompile(`(://)[^\s/@]+@`)
)

func scrub(text string) string {
	// Redact before truncating so partial credentials cannot escape.
	text = authScheme.ReplaceAllString(text, redacted)
	text = credentials.ReplaceAllString(text, redacted)
	text = urlUserInfo.ReplaceAllString(text, "://"+redacted+"@")
	if len(text) <= maxText {
		return text
	}
	end := maxText
	for !utf8.RuneStart(text[end]) {
		end--
	}
	return text[:end] + "…"
}

func secretKey(key string) bool {
	var name strings.Builder
	for _, r := range strings.ToLower(key) {
		if r >= 'a' && r <= 'z' {
			name.WriteRune(r)
		}
	}
	for _, term := range []string{"password", "passwd", "token", "apikey", "secret", "authorization", "cookie", "privatekey", "credential", "recoverycode", "sessionid"} {
		if strings.Contains(name.String(), term) {
			return true
		}
	}
	return false
}

// cleanValue only retains bounded, serializable data. It never invokes custom
// marshalers or String methods on arbitrary values.
func cleanValue(value any, depth int, nodes *int) any {
	if depth > maxDepth || *nodes >= maxNodes {
		return "[truncated]"
	}
	(*nodes)++
	switch typed := value.(type) {
	case time.Time:
		return typed.UTC().Format(time.RFC3339Nano)
	case time.Duration:
		return typed.String()
	case error:
		if val := reflect.ValueOf(typed); val.Kind() == reflect.Pointer && val.IsNil() {
			return nil
		}
		return scrub(typed.Error())
	case []byte:
		return "[binary data]"
	}
	return cleanReflect(reflect.ValueOf(value), depth, nodes)
}

func cleanReflect(value reflect.Value, depth int, nodes *int) any {
	switch value.Kind() {
	case reflect.Interface, reflect.Pointer:
		if value.IsNil() {
			return nil
		}
		return cleanValue(value.Elem().Interface(), depth+1, nodes)
	case reflect.String:
		return scrub(value.String())
	case reflect.Bool:
		return value.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return value.Int()
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return value.Uint()
	case reflect.Float32, reflect.Float64:
		if n := value.Float(); !math.IsNaN(n) && !math.IsInf(n, 0) {
			return n
		}
		return "[non-finite number]"
	case reflect.Map:
		if value.Type().Key().Kind() != reflect.String {
			return "[unsupported map keys]"
		}
		fields := make(map[string]any)
		iter := value.MapRange()
		for count := 0; count < maxFields && iter.Next(); count++ {
			addField(fields, iter.Key().String(), iter.Value(), depth, nodes)
		}
		return fields
	case reflect.Struct:
		fields := make(map[string]any)
		for i := 0; i < value.NumField() && len(fields) < maxFields; i++ {
			field := value.Type().Field(i)
			if !field.IsExported() {
				continue
			}
			name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
			if name == "-" {
				continue
			}
			if name == "" {
				name = field.Name
			}
			if secretKey(field.Name) {
				fields[scrub(name)] = redacted
			} else {
				addField(fields, name, value.Field(i), depth, nodes)
			}
		}
		return fields
	case reflect.Slice, reflect.Array:
		if value.Type().Elem().Kind() == reflect.Uint8 {
			return "[binary data]"
		}
		items := make([]any, min(value.Len(), maxFields))
		for i := range items {
			items[i] = cleanValue(value.Index(i).Interface(), depth+1, nodes)
		}
		return items
	case reflect.Invalid:
		return nil
	default:
		return "[unsupported value]"
	}
}

func addField(fields map[string]any, key string, value reflect.Value, depth int, nodes *int) {
	if secretKey(key) {
		fields[scrub(key)] = redacted
	} else {
		fields[scrub(key)] = cleanValue(value.Interface(), depth+1, nodes)
	}
}

func cloneFields(input map[string]any) map[string]any {
	if input == nil {
		return nil
	}
	result := make(map[string]any, len(input))
	for key, value := range input {
		result[key] = cloneField(value)
	}
	return result
}

func cloneField(input any) any {
	switch value := input.(type) {
	case map[string]any:
		return cloneFields(value)
	case []any:
		items := make([]any, len(value))
		for i, item := range value {
			items[i] = cloneField(item)
		}
		return items
	default:
		return value
	}
}
