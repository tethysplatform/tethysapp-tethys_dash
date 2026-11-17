import { useCallback, useEffect, useRef } from "react";

/**
 * One write per finished edit rather than one per step of it.
 *
 * A caller marks an edit pending as it goes -- each move through a color
 * picker, each keystroke in a number field -- and `flush` performs the write
 * once, if anything is pending. `flush` is the caller's to call when an edit
 * finishes (the picker closes, the field is left); it also runs, while
 * something is pending, on any pointer press and any focus move anywhere on
 * the page.
 *
 * That last part is what makes deferring safe. Reaching the dashboard's Save
 * button takes either a press, which is captured before the click it starts,
 * or a focus move onto the button, which comes before the key that activates
 * it -- so a color still being picked, or typed into the picker's hex field,
 * is written before Save reads the dashboard. The picker's own close, on the
 * click's way back up, would be too late, and a keyboard exit never closes it.
 *
 * Nothing is flushed on unmount: the component goes away when the dashboard
 * leaves edit mode, and after the header's Cancel a write would put back the
 * very edit it discarded.
 *
 * @param {() => void} commit performs the write
 * @returns {{markPending: () => void, flush: () => void}}
 */
export default function usePendingCommit(commit) {
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const pendingRef = useRef(false);

  const flush = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    commitRef.current();
  }, []);

  const markPending = useCallback(() => {
    pendingRef.current = true;
  }, []);

  useEffect(() => {
    document.addEventListener("pointerdown", flush, true);
    document.addEventListener("focusin", flush, true);
    return () => {
      document.removeEventListener("pointerdown", flush, true);
      document.removeEventListener("focusin", flush, true);
    };
  }, [flush]);

  return { markPending, flush };
}
