package app

import "errors"

const closeRequestedEvent = "milo:close-requested"

// requestClose returns true when the current native close or quit may proceed.
// Wails can call this concurrently for a window close and an application quit.
func (h *Host) requestClose() bool {
	h.closeMu.Lock()
	if !h.workbenchReady || h.closeApproved {
		h.closeApproved = true
		h.closeMu.Unlock()
		return true
	}
	if h.pendingClose != 0 {
		h.closeMu.Unlock()
		return false
	}
	h.closeSequence++
	request := h.closeSequence
	h.pendingClose = request
	h.closeMu.Unlock()

	h.window.EmitEvent(closeRequestedEvent, request)
	return false
}

// ResolveWindowClose resumes a native close only for the current request.
func (h *Host) ResolveWindowClose(request int, approved bool) error {
	h.closeMu.Lock()
	if request == 0 || h.pendingClose != request {
		h.closeMu.Unlock()
		return errors.New("window close request is no longer pending")
	}
	h.pendingClose = 0
	h.closeApproved = approved
	h.closeMu.Unlock()

	if approved {
		h.window.Close()
	}
	return nil
}
