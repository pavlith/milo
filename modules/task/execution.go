package task

import (
	"context"
	"errors"
	"fmt"
	"math"
	"slices"
	"time"

	"milo.local/platform/modules/notify"
)

const defaultFailure = "The background operation failed. See Output for diagnostics."

func (o *Owner) execute(ctx context.Context, run *execution, options Options, operation Operation) {
	log := o.service.log(run.Owner, run.ID)
	err := errors.New("operation did not return")
	defer func() {
		panicked := recover() != nil
		outcome := o.finish(ctx, run, options.FailureSummary, err != nil || panicked)
		defer o.release(run)
		switch outcome.Status {
		case Succeeded:
			log.Info("background task succeeded")
			if options.NotifyOnSuccess {
				o.notify(notify.Success, outcome.Title, "")
			}
		case Failed:
			log.Error("background task failed", "error_type", fmt.Sprintf("%T", err), "panic", panicked)
			o.notify(notify.Error, outcome.Title, outcome.ErrorSummary)
		case Cancelled:
			log.Info("background task cancelled")
		}
	}()
	log.Debug("background task started")
	if ctx.Err() == nil {
		err = operation(ctx, func(progress *float64) error {
			return o.service.progress(run, progress)
		})
	}
}

func (o *Owner) finish(ctx context.Context, run *execution, summary string, failed bool) Task {
	s := o.service
	s.mu.Lock()
	defer s.mu.Unlock()
	completed := time.Now().UTC()
	run.Completed = &completed
	run.CanCancel = false
	if run.progressTimer != nil {
		run.progressTimer.Stop()
		run.Progress = run.pending
		run.pending = nil
		run.progressTimer = nil
	}
	switch {
	case ctx.Err() != nil:
		run.Status = Cancelled
	case failed:
		run.Status = Failed
		if summary == "" {
			summary = defaultFailure
		}
		run.ErrorSummary = summary
	default:
		run.Status = Succeeded
		if run.Progress != nil {
			complete := 1.0
			run.Progress = &complete
		}
	}
	run.cancel()
	delete(s.active, run.ID)
	evicted := 0
	if len(s.completed) == HistoryLimit {
		evicted = s.completed[0].Run
		s.completed = slices.Delete(s.completed, 0, 1)
	}
	s.completed = append(s.completed, run.Task)
	s.publish(run.Task, evicted)
	return run.Task
}

func (o *Owner) notify(severity notify.Severity, title, description string) {
	_, err := o.service.inbox.Publish(o.id, notify.Message{
		Severity: severity, Title: title, Description: description,
		Actions: []notify.ActionRef{{ID: OpenActionID}},
	})
	if err != nil {
		o.service.logs.For(o.id).Warn("could not publish task notification", "error", err)
	}
}

func (o *Owner) release(run *execution) {
	s := o.service
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(o.runs, run)
	s.inFlight--
	o.removeIfStopped()
	close(run.done)
}

const progressInterval = 50 * time.Millisecond

func validProgress(progress *float64) bool {
	return progress == nil || (!math.IsNaN(*progress) && *progress >= 0 && *progress <= 1)
}

func (s *Service) progress(run *execution, progress *float64) error {
	if !validProgress(progress) {
		return ErrProgress
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if run.Status != Running {
		return ErrNotRunning
	}
	if run.progressTimer != nil {
		run.pending = clone(progress)
		return nil
	}
	delay := time.Until(run.progressDue)
	if delay <= 0 {
		s.setProgress(run, clone(progress))
	} else {
		run.pending = clone(progress)
		run.progressTimer = time.AfterFunc(delay, func() {
			s.mu.Lock()
			defer s.mu.Unlock()
			if run.Status == Running {
				s.setProgress(run, run.pending)
				run.pending = nil
				run.progressTimer = nil
			}
		})
	}
	return nil
}

func (s *Service) setProgress(run *execution, progress *float64) {
	if (run.Progress == nil && progress == nil) || (run.Progress != nil && progress != nil && *run.Progress == *progress) {
		return
	}
	run.Progress = progress
	run.progressDue = time.Now().Add(progressInterval)
	s.publish(run.Task, 0)
}
