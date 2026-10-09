import { act, waitFor } from "@testing-library/react";
import { createMocks } from "react-idle-timer";
import appAPI from "services/api/app";

// The idle thresholds are seconds apart, so tests that cross them move a fake
// clock past each one instead of sleeping through it. Real time still flows
// underneath, so the mocked requests settle on their own.
//
// Returns a spy on the activity ping, for pingApplied. Pair with
// `afterEach(restoreIdleClock)` in the test file.
export function useIdleClock() {
  jest.useFakeTimers({ advanceTimers: true });
  // react-idle-timer binds the timer functions it finds when it loads, so it is
  // pointed at the fake ones explicitly -- and back at the real ones afterwards.
  createMocks();
  return jest.spyOn(appAPI, "getActivityData");
}

export function restoreIdleClock() {
  jest.useRealTimers();
  createMocks();
}

// The first ping carries the warn and expire settings, and the timer runs on its
// defaults until that response has been applied -- so the clock must not move
// before then.
export async function pingApplied(ping) {
  await waitFor(() => expect(ping).toHaveBeenCalled());
  await act(() => ping.mock.results[0].value);
}

export function advanceIdleClock(ms) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}
