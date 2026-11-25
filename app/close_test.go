package app

import "testing"

func TestWindowCloseDecisionOnlyAppliesToPendingRequest(t *testing.T) {
	host := &Host{workbenchReady: true, closeSequence: 2, pendingClose: 2}
	if host.requestClose() {
		t.Fatal("a concurrent close attempt bypassed the pending decision")
	}
	if err := host.ResolveWindowClose(1, true); err == nil {
		t.Fatal("an earlier request was allowed to approve the current close")
	}
	if host.pendingClose != 2 || host.closeApproved {
		t.Fatal("a stale decision changed the pending request")
	}
	if err := host.ResolveWindowClose(2, false); err != nil {
		t.Fatalf("cancelling the pending request: %v", err)
	}
	if host.pendingClose != 0 || host.closeApproved {
		t.Fatal("cancellation did not clear the pending request")
	}
}

func TestWindowCanCloseDuringStartup(t *testing.T) {
	host := &Host{}
	if !host.requestClose() {
		t.Fatal("startup has no workbench to confirm a close")
	}
	host.workbenchReady = true
	if !host.requestClose() {
		t.Fatal("workbench readiness interrupted a close already in progress")
	}
}
